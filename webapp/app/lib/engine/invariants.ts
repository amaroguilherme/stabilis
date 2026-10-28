// Safety invariants checked on every engine output. They restate the most important rules of the
// knowledge base independently of how the rules are written, so a mistake in a rule (or in the
// engine) is caught instead of shown. Any violation makes the engine hide all medication content.

import { drugHasFact, matchesClass } from "./predicates.ts";
import type { Drug, EngineInput, EngineOutput, KnowledgeBase, Tier, TreatmentReviewItem } from "./types.ts";

const POSITIVE: Tier[] = ["first_line", "second_line", "alternative"];
// Treatment review facts: what the person reported and the cited minimums/maximums (not scores).
const REVIEW_NUMBERS = ["mg_per_day", "weeks", "min_mg_per_day", "min_weeks", "max_weeks"] as const;
// Percentages, "x/100" and score words: the patient view never rates medications.
const SCORE_LIKE = /\d\s*%|\d+\s*\/\s*100|\b(nota|pontua[çc][ãa]o|score|probabilidade)\b/i;
const MONITORED_DRUGS = ["litio", "valproato", "clozapina"];

export function checkInvariants(kb: KnowledgeBase, input: EngineInput, output: EngineOutput): string[] {
  const violations: string[] = [];
  const drugs = new Map(kb.data.drugs.map((d) => [d.id, d]));
  const placed = output.tiers.flatMap((group) => group.drugs.map((d) => ({ tier: group.tier, result: d, drug: drugs.get(d.drug_id) })));
  const positive = placed.filter((p) => POSITIVE.includes(p.tier));
  const fail = (id: string, detail: string) => violations.push(`${id}: ${detail}`);

  for (const p of placed) {
    if (!p.drug) fail("INV-00", `fármaco desconhecido na saída: ${p.result.drug_id}`);
    else if (p.drug.scope.interaction_only) fail("INV-00", `fármaco só de interação listado como opção: ${p.drug.id}`);
    if (p.result.tier !== p.tier) fail("INV-00", `${p.result.drug_id} no grupo ${p.tier} com linha ${p.result.tier}`);
  }
  const ids = placed.map((p) => p.result.drug_id);
  if (new Set(ids).size !== ids.length) fail("INV-00", "fármaco repetido entre as linhas");

  // INV-01: crisis language or a positive risk screener in patient mode hides every medication.
  const screenerPositive = kb.data.instruments.some((i) => i.scoring.type === "risk_screener" && output.scores[i.id]?.answered && output.scores[i.id].band !== "none");
  if (input.mode === "patient" && (output.crisis.language || screenerPositive) && placed.length > 0) {
    fail("INV-01", "crise no modo paciente com medicamentos na saída");
  }
  if (input.mode === "patient" && (output.crisis.language || screenerPositive) && output.treatment_review.some((t) => t.steps.length > 0)) {
    fail("INV-01", "crise no modo paciente com próximos passos de tratamento");
  }

  // INV-02: in patient mode, antidepressants only after a negative bipolar screen, never for bipolar disorder.
  if (input.mode === "patient") {
    const bipolar = input.condition?.id === "bipolar_1" || input.condition?.id === "bipolar_2";
    const bipolarScreens = kb.data.instruments.filter((i) => i.purpose === "bipolar_screen" && output.scores[i.id]?.answered);
    const screenNegative = bipolarScreens.length > 0 && bipolarScreens.every((i) => output.scores[i.id].band === "negative");
    if ((bipolar || !screenNegative) && placed.some((p) => p.drug && matchesClass(p.drug, "antidepressant"))) {
      fail("INV-02", "antidepressivo no modo paciente sem triagem de bipolaridade negativa");
    }
    const vocab = kb.data.vocab.conditions.conditions.find((c) => c.id === input.condition?.id);
    if (vocab?.patient_scope === "referral" && placed.length > 0) {
      fail("INV-02", `medicamentos no modo paciente para condição de encaminhamento (${vocab.id})`);
    }
  }

  // INV-03: possible pregnancy never leaves a major teratogen in a recommended line.
  if (output.derived.childbearing_potential && positive.some((p) => p.drug && drugHasFact(p.drug, "teratogenic_major"))) {
    fail("INV-03", "teratogênico maior em linha recomendada com possibilidade de gestação");
  }

  // INV-04: minors in patient mode get referral only.
  if (input.mode === "patient" && output.derived.minor && placed.length > 0) {
    fail("INV-04", "menor de idade no modo paciente com medicamentos na saída");
  }

  // INV-05: suicide risk keeps tricyclics out of every recommended line (NICE NG222 1.4.23, mhGAP).
  if (output.derived.suicide_risk && positive.some((p) => p.drug && matchesClass(p.drug, "antidepressant", "tca"))) {
    fail("INV-05", "tricíclico em linha recomendada com risco de suicídio");
  }

  // INV-06: an MAOI with a drug whose label contraindicates MAOIs always raises a contraindication
  // (and moves the candidate to "avoid"); with any other serotonergic drug, at least a major warning.
  const inUse = output.medication_review.map((m) => (m.drug_id ? drugs.get(m.drug_id) : undefined)).filter((d): d is Drug => d !== undefined);
  const expectedMaoiFinding = (a: Drug, b: Drug): "contraindicated" | "major" | null => {
    const maoiPair = (x: Drug, y: Drug) => drugHasFact(x, "maoi") && x.id !== y.id;
    if ((maoiPair(a, b) && drugHasFact(b, "maoi_contraindicated")) || (maoiPair(b, a) && drugHasFact(a, "maoi_contraindicated"))) return "contraindicated";
    if ((maoiPair(a, b) && drugHasFact(b, "serotonergic")) || (maoiPair(b, a) && drugHasFact(a, "serotonergic"))) return "major";
    return null;
  };
  const flaggedAt = (findings: EngineOutput["interactions"], a: Drug, b: Drug, level: "contraindicated" | "major") =>
    findings.some(
      (i) => i.drugs.includes(a.id) && i.drugs.includes(b.id) && (level === "major" ? i.severity === "major" || i.severity === "contraindicated" : i.severity === "contraindicated"),
    );
  for (const p of placed) {
    if (!p.drug) continue;
    for (const med of inUse) {
      const level = expectedMaoiFinding(p.drug, med);
      if (!level) continue;
      if (!flaggedAt(p.result.interactions, p.drug, med, level)) fail("INV-06", `${p.drug.id} + ${med.id} (IMAO) sem alerta de nível ${level}`);
      if (level === "contraindicated" && p.tier !== "avoid_for_profile") fail("INV-06", `${p.drug.id} fora de "evitar" com IMAO em uso`);
    }
  }
  for (const a of inUse) {
    for (const b of inUse) {
      if (a.id >= b.id) continue;
      const level = expectedMaoiFinding(a, b);
      if (level && !flaggedAt(output.interactions, a, b, level)) fail("INV-06", `${a.id} + ${b.id} em uso (IMAO) sem alerta de nível ${level}`);
    }
  }

  // INV-07: lithium, valproate and clozapine always come with their monitoring list.
  for (const p of placed) {
    if (MONITORED_DRUGS.includes(p.result.drug_id) && p.result.monitoring.length === 0) fail("INV-07", `${p.result.drug_id} sem monitoramento`);
  }
  for (const item of output.medication_review) {
    if (item.drug_id && MONITORED_DRUGS.includes(item.drug_id) && item.monitoring.length === 0) fail("INV-07", `${item.drug_id} em uso sem monitoramento`);
  }

  // INV-08: every option, reason and knowledge-base alert carries a source.
  for (const group of output.tiers) {
    for (const option of group.options) if (option.sources.length === 0) fail("INV-08", `opção sem fonte: ${option.option_id}`);
    for (const d of group.drugs) {
      for (const reason of d.reasons) if (reason.sources.length === 0) fail("INV-08", `motivo sem fonte: ${d.drug_id}/${reason.option_id}`);
      for (const alert of d.alerts) if (!alert.origin.startsWith("engine:") && alert.sources.length === 0) fail("INV-08", `alerta sem fonte: ${alert.origin}`);
      if (d.tier === "avoid_for_profile" && d.alerts.length === 0) fail("INV-08", `${d.drug_id} em "evitar" sem explicação`);
    }
  }
  const caseLevel = [...output.alerts, ...output.medication_review.flatMap((m) => m.alerts)];
  for (const alert of caseLevel) {
    if (!alert.origin.startsWith("engine:") && alert.sources.length === 0) fail("INV-08", `alerta sem fonte: ${alert.origin}`);
  }
  for (const item of [...output.referrals, ...output.questions, ...output.treatment_review.flatMap((t) => t.steps)]) {
    if (item.sources.length === 0) fail("INV-08", `item sem fonte: ${item.origin}`);
  }
  for (const t of output.treatment_review) {
    if (t.trial_id && t.sources.length === 0) fail("INV-08", `critério de tentativa sem fonte: ${t.trial_id}`);
  }

  // INV-09: no scores of our own. The only numeric values in the output are validated instrument
  // totals and, in the treatment review, the dose and duration the person reported next to the cited
  // minimums; patient-facing templates carry no percentages or score-like wording.
  const strayNumbers: string[] = [];
  const reviewFacts = output.treatment_review.map((item) => {
    const facts: Partial<TreatmentReviewItem> = { ...item };
    for (const key of REVIEW_NUMBERS) delete facts[key];
    return facts;
  });
  JSON.stringify({ ...output, treatment_review: reviewFacts }, (key, value) => {
    if (key === "scores" || key === "sources" || key === "cite") return undefined;
    if (typeof value === "number") strayNumbers.push(key);
    return value;
  });
  if (strayNumbers.length > 0) fail("INV-09", `valor numérico fora dos escores: ${strayNumbers.join(", ")}`);
  if (input.mode === "patient") {
    const keys = new Set<string>();
    for (const group of output.tiers) {
      for (const option of group.options) keys.add(option.message.key);
      for (const d of group.drugs) for (const a of d.alerts) keys.add(a.message.key);
    }
    for (const a of caseLevel) keys.add(a.message.key);
    for (const item of [...output.referrals, ...output.questions]) keys.add(item.message.key);
    for (const key of keys) {
      const entry = kb.data.messages[key];
      const template = (entry?.plain ?? entry?.clinical ?? "").replace(/\{\w+\}/g, "");
      if (SCORE_LIKE.test(template)) fail("INV-09", `texto do paciente com aparência de nota ou probabilidade (${key})`);
    }
  }

  // INV-10: every medication the person listed is visible in the review, recognized or not.
  const review = output.medication_review;
  if (review.length !== input.profile.current_meds.length) fail("INV-10", "medicamento informado ausente da revisão");
  input.profile.current_meds.forEach((med, i) => {
    const item = review[i];
    if (!item || item.raw_text !== med.raw_text) fail("INV-10", `medicamento fora de ordem ou ausente: ${med.raw_text}`);
    else if (item.status === "unrecognized" && item.alerts.length === 0) fail("INV-10", `medicamento não reconhecido sem alerta: ${med.raw_text}`);
  });

  // Every message key must exist, or the person would see a raw key.
  const allMessages = [
    ...output.tiers.flatMap((g) => [...g.options.map((o) => o.message), ...g.drugs.flatMap((d) => [...d.alerts.map((a) => a.message), ...d.reasons.map((r) => r.message)])]),
    ...caseLevel.map((a) => a.message),
    ...output.referrals.map((r) => r.message),
    ...output.questions.map((q) => q.message),
    ...output.interactions.map((i) => i.message),
    ...output.treatment_review.flatMap((t) => t.steps.map((s) => s.message)),
  ];
  for (const message of allMessages) if (!kb.data.messages[message.key]) fail("INV-12", `mensagem inexistente: ${message.key}`);

  return violations;
}
