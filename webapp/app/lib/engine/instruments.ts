import type { Band, Instrument, InstrumentAnswers, InstrumentItem, InstrumentResult, Profile } from "./types.ts";

function unanswered(id: string): InstrumentResult {
  return { instrument_id: id, answered: false, total: null, band: null, flags: [] };
}

function bandFor(bands: Band[] | undefined, total: number): string | null {
  return bands?.find((b) => total >= b.min && total <= b.max)?.id ?? null;
}

function validValues(def: Instrument, item: InstrumentItem): Set<number> {
  return new Set((item.options ?? def.options).map((o) => o.value));
}

/** Whether an item is asked, given the answers to the items before it (skip logic). */
export function isAsked(item: InstrumentItem, answers: InstrumentAnswers): boolean {
  if (!item.ask_if) return true;
  return item.ask_if.items.filter((id) => (answers[id] ?? 0) > 0).length >= item.ask_if.min_yes;
}

/** Answers with skipped items filled in as 0, or null while an asked item is missing or invalid. */
export function completeAnswers(def: Instrument, answers: InstrumentAnswers): InstrumentAnswers | null {
  const filled: InstrumentAnswers = {};
  for (const item of def.items) {
    if (!isAsked(item, filled)) {
      filled[item.id] = 0;
      continue;
    }
    const value = answers[item.id];
    if (typeof value !== "number" || !validValues(def, item).has(value)) return null;
    filled[item.id] = value;
  }
  return filled;
}

function compare(value: number, op: "gt" | "gte" | "eq", threshold: number): boolean {
  if (op === "gt") return value > threshold;
  if (op === "gte") return value >= threshold;
  return value === threshold;
}

// Every asked item must have one of its allowed values; partial answers are not scored.
export function scoreInstrument(def: Instrument, raw: InstrumentAnswers | undefined, profile?: Profile): InstrumentResult {
  const answers = raw ? completeAnswers(def, raw) : null;
  if (!answers) return unanswered(def.id);
  const scoring = def.scoring;

  if (scoring.type === "sum") {
    const total = def.items.reduce((sum, item) => sum + answers[item.id], 0);
    const sex = profile?.sex_at_birth ?? undefined;
    const bands = (sex && scoring.bands_by_sex?.[sex]) || scoring.bands;
    const flags = (scoring.flags ?? [])
      .filter((flag) => compare(flag.item === "total" ? total : answers[flag.item], flag.op, flag.value))
      .map((flag) => flag.id);
    return { instrument_id: def.id, answered: true, total, band: bandFor(bands, total), flags };
  }

  if (scoring.type === "mdq" && scoring.mdq) {
    const rule = scoring.mdq;
    const yes = rule.symptom_items.filter((id) => answers[id] === 1).length;
    const positive = yes >= rule.min_yes && answers[rule.same_period_item] === 1 && answers[rule.problem_item] >= rule.problem_min_value;
    return { instrument_id: def.id, answered: true, total: yes, band: positive ? "positive" : "negative", flags: [] };
  }

  if (scoring.type === "risk_screener" && scoring.risk) {
    const high = scoring.risk.high_items.some((id) => answers[id] > 0);
    const low = scoring.risk.low_items.some((id) => answers[id] > 0);
    return { instrument_id: def.id, answered: true, total: null, band: high ? "high" : low ? "low" : "none", flags: [] };
  }

  return unanswered(def.id);
}
