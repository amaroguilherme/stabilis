import type { Band, Instrument, InstrumentAnswers, InstrumentResult, Profile } from "./types.ts";

function unanswered(id: string): InstrumentResult {
  return { instrument_id: id, answered: false, total: null, band: null, flags: [] };
}

function bandFor(bands: Band[] | undefined, total: number): string | null {
  return bands?.find((b) => total >= b.min && total <= b.max)?.id ?? null;
}

function validValues(def: Instrument, itemId: string): Set<number> {
  const item = def.items.find((i) => i.id === itemId);
  return new Set((item?.options ?? def.options).map((o) => o.value));
}

// Every item must be answered with one of its allowed values; partial answers are not scored.
function complete(def: Instrument, answers: InstrumentAnswers): boolean {
  return def.items.every((item) => {
    const value = answers[item.id];
    return typeof value === "number" && validValues(def, item.id).has(value);
  });
}

function compare(value: number, op: "gt" | "gte" | "eq", threshold: number): boolean {
  if (op === "gt") return value > threshold;
  if (op === "gte") return value >= threshold;
  return value === threshold;
}

export function scoreInstrument(def: Instrument, answers: InstrumentAnswers | undefined, profile?: Profile): InstrumentResult {
  if (!answers || !complete(def, answers)) return unanswered(def.id);
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

  if (scoring.type === "cssrs_screener" && scoring.cssrs) {
    const high = scoring.cssrs.high_items.some((id) => answers[id] === 1);
    const low = scoring.cssrs.low_items.some((id) => answers[id] === 1);
    return { instrument_id: def.id, answered: true, total: null, band: high ? "high" : low ? "low" : "none", flags: [] };
  }

  return unanswered(def.id);
}
