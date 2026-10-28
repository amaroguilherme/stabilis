// Treatment review: was each medicine the person already tried given a fair chance? A trial is
// adequate when the dose reached the minimum effective dose (the rule's, or the label's usual
// minimum) for at least the rule's number of weeks. Rules with only a maximum (benzodiazepines)
// judge just the duration. Rules tied to conditions apply only when evaluating one of them, so the
// patient mode reviews each condition section separately. Next steps come from the knowledge base.

import { matchesSelector } from "./predicates.ts";
import type { Drug, HistoryEntry, KnowledgeBaseData, Mode, NextStep, Trial, TreatmentReviewItem, TrialStatus } from "./types.ts";

const WEEKS_PER_MONTH = 4.345;

function specificity(trial: Trial): number {
  const s = trial.selector;
  return "drug" in s ? 3 : "class" in s && s.subclass ? 2 : "class" in s ? 1 : 0;
}

function trialFor(kb: KnowledgeBaseData, drug: Drug, condition: string | null): Trial | undefined {
  return kb.trials
    .filter((t) => matchesSelector(drug, t.selector) && (!t.conditions || (condition !== null && t.conditions.includes(condition))))
    .sort((a, b) => specificity(b) - specificity(a) || (a.id < b.id ? -1 : 1))[0];
}

function stepStatus(status: TrialStatus, response: HistoryEntry["response"]): NextStep["status"] | null {
  if (status === "adequate") return response === "none" ? "no_response_adequate" : response === "partial" ? "partial_response_adequate" : null;
  if (status === "no_criteria" || status === "within_recommended") return null;
  return status;
}

export function reviewTreatments(kb: KnowledgeBaseData, history: HistoryEntry[], mode: Mode, condition: string | null): TreatmentReviewItem[] {
  const drugs = new Map(kb.drugs.map((d) => [d.id, d]));
  return history.map((entry) => {
    const drug = entry.drug_id ? drugs.get(entry.drug_id) : undefined;
    const base: TreatmentReviewItem = {
      raw_text: entry.raw_text,
      drug_id: drug?.id ?? null,
      status: "no_criteria",
      response: entry.response,
      mg_per_day: entry.mg_per_day,
      weeks: entry.duration_months === null ? null : Math.round(entry.duration_months * WEEKS_PER_MONTH),
      min_mg_per_day: null,
      dose_basis: null,
      min_weeks: null,
      max_weeks: null,
      trial_id: null,
      sources: [],
      steps: [],
    };
    const trial = drug ? trialFor(kb, drug, condition) : undefined;
    if (!drug || !trial) return base;

    const judgesDose = trial.min_weeks !== undefined;
    const labelDose = judgesDose && trial.min_mg_per_day === undefined ? (drug.dose_adult?.usual_min ?? null) : null;
    const minDose = judgesDose ? (trial.min_mg_per_day ?? labelDose) : null;
    const doseBasis = minDose === null ? null : labelDose !== null ? "label" : "rule";
    const sources = [...trial.sources, ...(doseBasis === "label" && drug.dose_adult ? [drug.dose_adult.cite] : [])];
    let status: TrialStatus;
    if (trial.max_weeks !== undefined && base.weeks !== null && base.weeks > trial.max_weeks) status = "beyond_recommended";
    else if (trial.min_weeks === undefined) status = base.weeks === null ? "unknown" : "within_recommended";
    else if (base.weeks === null || (minDose !== null && entry.mg_per_day === null)) status = "unknown";
    else if (minDose !== null && entry.mg_per_day !== null && entry.mg_per_day < minDose) status = "low_dose";
    else if (base.weeks < trial.min_weeks) status = "short_duration";
    else status = "adequate";

    const wanted = stepStatus(status, entry.response);
    const steps = wanted
      ? kb.next_steps
          .filter((s) => s.status === wanted && s.modes.includes(mode))
          .filter((s) => !s.selector || matchesSelector(drug, s.selector))
          .filter((s) => !s.condition || s.condition === condition)
          .map((s) => ({ message: { key: s.message_key, params: { drug: drug.names.display_pt } }, origin: s.id, sources: s.sources }))
      : [];
    return { ...base, status, min_mg_per_day: minDose, dose_basis: doseBasis, min_weeks: trial.min_weeks ?? null, max_weeks: trial.max_weeks ?? null, trial_id: trial.id, sources, steps };
  });
}
