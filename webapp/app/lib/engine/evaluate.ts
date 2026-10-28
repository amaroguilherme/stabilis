// The decision engine: pure functions over the knowledge base. Every option, tier change and alert
// comes from a sourced item in the knowledge base; the engine only combines them.

import { detectCrisis, summarizeCrisis, type CompiledLexicon } from "../safety/crisis.ts";
import { scoreInstrument } from "./instruments.ts";
import { renderMessage } from "./messages.ts";
import { checkInvariants } from "./invariants.ts";
import { evaluatePredicate, matchesClass, matchesSelector, type PredicateContext } from "./predicates.ts";
import type {
  Alert,
  AlertLevel,
  Cite,
  DoseCheck,
  Drug,
  DrugResult,
  EngineInput,
  EngineOutput,
  GuidelineTier,
  Interaction,
  InteractionFinding,
  KnowledgeBase,
  MedReviewItem,
  Option,
  OptionResult,
  Reason,
  SafetyRule,
  Severity,
  Signal,
  Tier,
  TierGroup,
} from "./types.ts";

export const TIER_ORDER: Tier[] = ["first_line", "second_line", "alternative", "not_recommended", "avoid_for_profile"];

/** Preferences that are not drug facts: available through the SUS (RENAME), fewer blood tests. */
export const PREFERENCE_CONCERNS = { prefer_sus: "prefer_sus", fewer_blood_tests: "fewer_blood_tests" } as const;
const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, major: 2, contraindicated: 3 };
const LEVEL_RANK: Record<AlertLevel, number> = { info: 0, warning: 1, critical: 2 };

export interface EngineOptions {
  crisisLexicon: CompiledLexicon;
}

interface Exclusions {
  all: boolean;
  classes: { class: string; subclass?: string }[];
}

function displayName(drug: Drug): string {
  return drug.names.display_pt;
}

// Locale-independent comparison for ids, so the output is identical in every runtime.
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function severityLevel(severity: Severity): AlertLevel {
  if (severity === "contraindicated") return "critical";
  if (severity === "info") return "info";
  return "warning";
}

function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort(
    (a, b) =>
      LEVEL_RANK[b.level] - LEVEL_RANK[a.level] ||
      cmp(a.message.key, b.message.key) ||
      cmp(a.drug_id ?? "", b.drug_id ?? "") ||
      cmp(a.origin, b.origin),
  );
}

function dedupeAlerts(alerts: Alert[]): Alert[] {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = `${alert.message.key}|${alert.drug_id ?? ""}|${JSON.stringify(alert.message.params)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isExcluded(drug: Drug, exclusions: Exclusions): boolean {
  return exclusions.all || exclusions.classes.some((c) => matchesClass(drug, c.class, c.subclass));
}

// ── Interactions ─────────────────────────────────────────────────────────────

function findInteractions(a: Drug, b: Drug, interactions: Interaction[]): InteractionFinding[] {
  const found: InteractionFinding[] = [];
  for (const ix of interactions) {
    if (ix.type === "pharmacodynamic" && ix.participants) {
      const [first, second] = ix.participants;
      if ((matchesSelector(a, first) && matchesSelector(b, second)) || (matchesSelector(a, second) && matchesSelector(b, first))) {
        found.push({
          interaction_id: ix.id,
          effect: ix.effect,
          severity: ix.severity,
          message: { key: ix.message_key, params: { a: displayName(a), b: displayName(b) } },
          drugs: [a.id, b.id],
          sources: ix.sources,
        });
      }
    } else if (ix.type === "pharmacokinetic" && ix.perpetrator && ix.victim) {
      for (const [perpetrator, victim] of [[a, b], [b, a]] as const) {
        if (matchesSelector(perpetrator, ix.perpetrator) && matchesSelector(victim, ix.victim)) {
          found.push({
            interaction_id: ix.id,
            effect: ix.effect,
            severity: ix.severity,
            message: { key: ix.message_key, params: { perpetrator: displayName(perpetrator), victim: displayName(victim) } },
            drugs: [a.id, b.id],
            perpetrator: perpetrator.id,
            victim: victim.id,
            sources: ix.sources,
          });
        }
      }
    }
  }
  // A specific entry replaces the general ones it declares (the MAOI contraindication replaces the
  // general serotonergic warning). Then, per effect and direction, the most severe entry wins.
  const superseded = new Set(
    found.flatMap((f) => interactions.find((ix) => ix.id === f.interaction_id)?.supersedes ?? []),
  );
  const best = new Map<string, InteractionFinding>();
  for (const finding of found) {
    if (superseded.has(finding.interaction_id)) continue;
    const key = `${finding.effect}|${finding.perpetrator ?? ""}`;
    const current = best.get(key);
    if (!current || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[current.severity]) best.set(key, finding);
  }
  return [...best.values()].sort((x, y) => cmp(x.interaction_id, y.interaction_id) || cmp(x.perpetrator ?? "", y.perpetrator ?? ""));
}

function interactionAlert(finding: InteractionFinding, drugId?: string): Alert {
  return {
    level: severityLevel(finding.severity),
    message: finding.message,
    drug_id: drugId,
    origin: finding.interaction_id,
    sources: finding.sources,
  };
}

// ── Rules ────────────────────────────────────────────────────────────────────

interface RuleEffects {
  alerts: Alert[];
  tier?: "avoid_for_profile" | "not_recommended";
  excluded: boolean;
}

function applyDrugRules(rules: SafetyRule[], ctx: PredicateContext, drug: Drug, questions: EngineOutput["questions"]): RuleEffects {
  const effects: RuleEffects = { alerts: [], excluded: false };
  const drugCtx = { ...ctx, drug };
  for (const rule of rules) {
    if (rule.applies_to !== "drug" || !rule.modes.includes(ctx.input.mode)) continue;
    if (!evaluatePredicate(rule.when, drugCtx)) continue;
    for (const action of rule.then) {
      if (action.action === "exclude") effects.excluded = true;
      else if (action.action === "set_tier") {
        if (action.tier === "avoid_for_profile" || effects.tier === undefined) effects.tier = action.tier;
      } else if (action.action === "alert") {
        effects.alerts.push({
          level: action.level,
          message: { key: action.message_key, params: { drug: displayName(drug) } },
          drug_id: drug.id,
          origin: rule.id,
          sources: rule.sources,
        });
      } else if (action.action === "add_question") {
        questions.push({ message: { key: action.message_key, params: { drug: displayName(drug) } }, origin: rule.id, sources: rule.sources });
      }
    }
  }
  return effects;
}

// ── Medication review ────────────────────────────────────────────────────────

function doseCheck(drug: Drug, mgPerDay: number | null | undefined): DoseCheck {
  const dose = drug.dose_adult;
  if (!dose) return "no_label_data";
  if (mgPerDay === null || mgPerDay === undefined) return "no_dose_informed";
  if (dose.max !== undefined && mgPerDay > dose.max) return "above_max";
  if (dose.usual_max !== undefined && mgPerDay > dose.usual_max) return "above_usual";
  if (dose.usual_min !== undefined && mgPerDay < dose.usual_min) return "below_usual";
  if (dose.usual_min === undefined && dose.usual_max === undefined && dose.max === undefined) return "no_label_data";
  return "within_usual";
}

const DOSE_ALERTS: Partial<Record<DoseCheck, { level: AlertLevel; key: string }>> = {
  above_max: { level: "warning", key: "alert.dose_above_max" },
  above_usual: { level: "info", key: "alert.dose_above_usual" },
  below_usual: { level: "info", key: "alert.dose_below_usual" },
};

/** At least one bipolar screen answered, and every answered one negative. */
export function bipolarScreenNegative(instruments: KnowledgeBase["data"]["instruments"], scores: EngineOutput["scores"]): boolean {
  const answered = instruments.filter((i) => i.purpose === "bipolar_screen" && scores[i.id]?.answered);
  return answered.length > 0 && answered.every((i) => scores[i.id].band === "negative");
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function evaluate(kb: KnowledgeBase, input: EngineInput, options: EngineOptions): EngineOutput {
  const data = kb.data;
  const drugsById = new Map(data.drugs.map((d) => [d.id, d]));
  const mode = input.mode;

  // 1. Recognized current medications (each drug once, even if listed twice)
  const currentMeds = [...new Set(input.profile.current_meds.map((med) => med.drug_id))]
    .map((id) => (id ? drugsById.get(id) : undefined))
    .filter((d): d is Drug => d !== undefined);

  // 2. Signals and instrument scores
  const crisis = summarizeCrisis(detectCrisis(input.free_text ?? "", options.crisisLexicon, mode));
  const scores: EngineOutput["scores"] = {};
  for (const instrument of data.instruments) {
    scores[instrument.id] = scoreInstrument(instrument, input.instruments?.[instrument.id], input.profile);
  }
  const signals: Record<Signal, boolean> = {
    crisis_language: crisis.crisis,
    crisis_language_negated_only: crisis.negated_only,
    bipolar_screen_negative: bipolarScreenNegative(data.instruments, scores),
  };

  // 3. Derived facts, in order
  const derived: Record<string, boolean> = {};
  const ctx: PredicateContext = { input, scores, derived, signals, currentMeds };
  for (const fact of data.derived) derived[fact.id] = evaluatePredicate(fact.when, ctx);

  const alerts: Alert[] = [];
  const referrals: EngineOutput["referrals"] = [];
  const questions: EngineOutput["questions"] = [];
  const exclusions: Exclusions = { all: false, classes: [] };

  // 4. Global rules (gates, case-level alerts)
  for (const rule of data.rules) {
    if (rule.applies_to !== "global" || !rule.modes.includes(mode) || !evaluatePredicate(rule.when, ctx)) continue;
    for (const action of rule.then) {
      if (action.action === "exclude_medications") {
        if (action.scope === "all") exclusions.all = true;
        else exclusions.classes.push(action.scope);
      } else if (action.action === "alert") {
        alerts.push({ level: action.level, message: { key: action.message_key, params: {} }, origin: rule.id, sources: rule.sources });
      } else if (action.action === "referral") {
        referrals.push({ message: { key: action.message_key, params: {} }, urgent: action.urgent ?? false, origin: rule.id, sources: rule.sources });
      } else if (action.action === "add_question") {
        questions.push({ message: { key: action.message_key, params: {} }, origin: rule.id, sources: rule.sources });
      }
    }
  }

  // 5. Guideline options for the selected condition and phase
  const condition = input.condition ? data.conditions.find((c) => c.id === input.condition?.id) : undefined;
  const conditionVocab = data.vocab.conditions.conditions.find((c) => c.id === input.condition?.id);
  const phase = input.condition?.phase ?? null;
  const matchedOptions: Option[] = [];
  if (condition) {
    const ageMin = condition.population?.age_min;
    if (ageMin !== undefined && input.profile.age !== null && input.profile.age < ageMin && mode === "professional") {
      alerts.push({ level: "warning", message: { key: "alert.population_age", params: { age: String(ageMin) } }, origin: "engine:population", sources: [] });
    }
    if (mode === "professional" && conditionVocab && conditionVocab.phases.length > 0 && phase === null) {
      alerts.push({ level: "warning", message: { key: "alert.phase_missing", params: {} }, origin: "engine:phase_missing", sources: [] });
    }
    for (const option of condition.options) {
      if (!option.modes.includes(mode)) continue;
      if (option.phase !== undefined && option.phase !== phase) continue;
      if (option.applies_when && !evaluatePredicate(option.applies_when, ctx)) continue;
      // Defense in depth: conditions handled by referral in patient mode never show medications.
      if (mode === "patient" && conditionVocab?.patient_scope === "referral" && option.kind === "medication") continue;
      matchedOptions.push(option);
    }
  }
  const optionIndex = new Map(matchedOptions.map((o, i) => [o.id, i]));

  // 6. Candidate drugs from medication options, with their guideline tier
  const drugResults = new Map<string, DrugResult>();
  for (const drug of data.drugs) {
    if (drug.scope.interaction_only) continue;
    const matching = matchedOptions.filter((o) => o.kind === "medication" && (o.targets ?? []).some((t) => matchesSelector(drug, t)));
    if (matching.length === 0) continue;
    const positive = matching.filter((o) => o.tier !== "not_recommended").sort((x, y) => TIER_ORDER.indexOf(x.tier) - TIER_ORDER.indexOf(y.tier));
    const best = positive[0];
    const reasons: Reason[] = matching.map((o) => ({
      kind: o.tier === "not_recommended" && best ? "guideline_caution" : "guideline",
      option_id: o.id,
      tier: o.tier,
      use: o.use,
      message: { key: o.text_key, params: {} },
      sources: o.sources,
    }));
    const guidelineTier: GuidelineTier = best ? best.tier : "not_recommended";
    drugResults.set(drug.id, {
      drug_id: drug.id,
      tier: guidelineTier,
      guideline_tier: guidelineTier,
      use: best?.use,
      in_use: currentMeds.some((m) => m.id === drug.id),
      reasons,
      alerts: [],
      interactions: [],
      monitoring: drug.monitoring ?? [],
    });
  }

  // 7. Drug-level safety rules and interactions with current medications
  for (const result of drugResults.values()) {
    const drug = drugsById.get(result.drug_id) as Drug;
    const effects = applyDrugRules(data.rules, ctx, drug, questions);
    if (effects.excluded) {
      drugResults.delete(result.drug_id);
      continue;
    }
    result.alerts.push(...effects.alerts);
    if (effects.tier === "avoid_for_profile") result.tier = "avoid_for_profile";
    else if (effects.tier === "not_recommended" && result.tier !== "avoid_for_profile") result.tier = "not_recommended";

    for (const med of currentMeds) {
      if (med.id === drug.id) continue;
      for (const finding of findInteractions(drug, med, data.interactions)) {
        result.interactions.push(finding);
        result.alerts.push(interactionAlert(finding, drug.id));
        if (finding.severity === "contraindicated") result.tier = "avoid_for_profile";
      }
    }
    result.alerts = sortAlerts(dedupeAlerts(result.alerts));
  }

  // 8. Global exclusions (gates)
  for (const id of [...drugResults.keys()]) {
    if (isExcluded(drugsById.get(id) as Drug, exclusions)) drugResults.delete(id);
  }

  // 9. Review of the medications already in use
  const medicationReview: MedReviewItem[] = input.profile.current_meds.map((med) => {
    const drug = med.drug_id ? drugsById.get(med.drug_id) : undefined;
    if (!drug) {
      return {
        raw_text: med.raw_text,
        drug_id: null,
        status: "unrecognized",
        dose_check: "no_label_data",
        alerts: [{ level: "warning", message: { key: "alert.unrecognized_med", params: { text: med.raw_text } }, origin: "engine:unrecognized", sources: [] }],
        monitoring: [],
      };
    }
    const check = doseCheck(drug, med.mg_per_day);
    const reviewAlerts = applyDrugRules(data.rules, ctx, drug, questions).alerts;
    const doseAlert = DOSE_ALERTS[check];
    if (doseAlert && drug.dose_adult) {
      reviewAlerts.push({
        level: doseAlert.level,
        message: { key: doseAlert.key, params: { drug: displayName(drug), dose: String(med.mg_per_day) } },
        drug_id: drug.id,
        origin: "engine:dose",
        sources: [drug.dose_adult.cite],
      });
    }
    return { raw_text: med.raw_text, drug_id: drug.id, status: "recognized", dose_check: check, alerts: sortAlerts(dedupeAlerts(reviewAlerts)), monitoring: drug.monitoring ?? [] };
  });

  const interactions: InteractionFinding[] = [];
  for (let i = 0; i < currentMeds.length; i++) {
    for (let j = i + 1; j < currentMeds.length; j++) {
      if (currentMeds[i].id !== currentMeds[j].id) interactions.push(...findInteractions(currentMeds[i], currentMeds[j], data.interactions));
    }
  }

  // 10. Tier groups, ordered: within a tier by the person's concerns, then by the order in which the
  // guideline lists the options and their drugs (CANMAT lists first-line agents hierarchically), then name.
  const concerns = new Set(input.concerns ?? []);
  const bloodTests = new Set(data.vocab.monitoring.monitoring.filter((m) => m.blood_test).map((m) => m.id));
  const concernPenalty = (drug: Drug) =>
    drug.facts.filter((f) => concerns.has(f.tag)).length +
    (concerns.has(PREFERENCE_CONCERNS.prefer_sus) && (!drug.sus || drug.sus.component === "nao_consta") ? 1 : 0) +
    (concerns.has(PREFERENCE_CONCERNS.fewer_blood_tests) && (drug.monitoring ?? []).some((m) => bloodTests.has(m.id)) ? 1 : 0);
  const guidelineRank = (result: DrugResult, drug: Drug) =>
    Math.min(
      ...result.reasons.map((r) => {
        const option = matchedOptions[optionIndex.get(r.option_id) ?? -1];
        const target = option?.targets?.findIndex((t) => matchesSelector(drug, t)) ?? 0;
        return (optionIndex.get(r.option_id) ?? matchedOptions.length) * 1000 + Math.max(target, 0);
      }),
    );
  const sortedDrugs = [...drugResults.values()].sort((a, b) => {
    const da = drugsById.get(a.drug_id) as Drug;
    const db = drugsById.get(b.drug_id) as Drug;
    return (
      TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) ||
      concernPenalty(da) - concernPenalty(db) ||
      guidelineRank(a, da) - guidelineRank(b, db) ||
      displayName(da).localeCompare(displayName(db), "pt-BR") ||
      cmp(da.id, db.id)
    );
  });

  const optionResults: OptionResult[] = matchedOptions
    .map((option) => ({
      option_id: option.id,
      kind: option.kind,
      tier: option.tier,
      use: option.use,
      message: { key: option.text_key, params: {} },
      sources: option.sources,
      // Only the drugs still in the option's own tier; a drug moved to "avoid" keeps the option as a reason.
      drug_ids: sortedDrugs.filter((d) => d.tier === option.tier && d.reasons.some((r) => r.option_id === option.id)).map((d) => d.drug_id),
    }))
    // A medication option left without drugs in its tier (removed by a gate or moved by a rule) disappears.
    .filter((option) => option.kind !== "medication" || option.drug_ids.length > 0);

  const tiers: TierGroup[] = TIER_ORDER.map((tier) => ({
    tier,
    options: optionResults.filter((o) => o.tier === tier),
    drugs: sortedDrugs.filter((d) => d.tier === tier),
  })).filter((group) => group.options.length > 0 || group.drugs.length > 0);

  // Questions are deduplicated by their rendered text (several rules ask the same thing); the first source wins.
  const seenQuestions = new Set<string>();
  const uniqueQuestions = questions.filter((q) => {
    const key = `${renderMessage(data, q.message, "plain")}|${renderMessage(data, q.message, "clinical")}`;
    if (seenQuestions.has(key)) return false;
    seenQuestions.add(key);
    return true;
  });

  const output: EngineOutput = {
    kb_version: kb.version,
    kb_hash: kb.hash,
    mode,
    condition: input.condition ? { id: input.condition.id, phase } : null,
    crisis: { language: crisis.crisis, negated_only: crisis.negated_only },
    derived,
    scores,
    medications_excluded: exclusions.all ? "all" : exclusions.classes.length > 0 ? exclusions.classes : null,
    tiers,
    alerts: sortAlerts(dedupeAlerts(alerts)),
    referrals,
    questions: uniqueQuestions,
    medication_review: medicationReview,
    interactions,
    violations: [],
    fail_closed: false,
  };

  // 11. Safety invariants: any violation hides all medication content (fail closed).
  const violations = checkInvariants(kb, input, output);
  if (violations.length > 0) return failClosed(output, violations);
  return output;
}

// Keeps what helps the person seek care (non-drug options, referrals, the list of medications they
// informed) and drops everything about specific drugs, which can no longer be trusted.
function failClosed(output: EngineOutput, violations: string[]): EngineOutput {
  const tiers = output.tiers
    .map((group) => ({ ...group, drugs: [], options: group.options.filter((o) => o.kind !== "medication") }))
    .filter((group) => group.options.length > 0);
  const failAlert: Alert = { level: "critical", message: { key: "alert.fail_closed", params: {} }, origin: "engine:fail_closed", sources: [] as Cite[] };
  return {
    ...output,
    tiers,
    medications_excluded: "all",
    alerts: [failAlert, ...output.alerts.filter((a) => a.drug_id === undefined)],
    questions: output.questions.filter((q) => Object.keys(q.message.params).length === 0),
    medication_review: output.medication_review.map((item) => ({ ...item, dose_check: "no_label_data", alerts: [], monitoring: [] })),
    interactions: [],
    violations,
    fail_closed: true,
  };
}
