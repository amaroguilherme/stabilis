import type { Drug, EngineInput, InstrumentResult, Predicate, ProfilePath, Selector, Signal } from "./types.ts";

export interface PredicateContext {
  input: EngineInput;
  scores: Record<string, InstrumentResult>;
  derived: Record<string, boolean>;
  signals: Record<Signal, boolean>;
  currentMeds: Drug[];
  drug?: Drug; // candidate drug, for applies_to=drug rules
}

export function drugHasFact(drug: Drug, tag: string): boolean {
  return drug.facts.some((fact) => fact.tag === tag);
}

export function matchesClass(drug: Drug, cls: string, subclass?: string): boolean {
  return drug.class === cls && (subclass === undefined || drug.subclass === subclass);
}

export function matchesSelector(drug: Drug, selector: Selector): boolean {
  if ("drug" in selector) return drug.id === selector.drug;
  if ("class" in selector) return matchesClass(drug, selector.class, selector.subclass);
  return drugHasFact(drug, selector.fact);
}

function profileValue(input: EngineInput, path: ProfilePath): unknown {
  const profile = input.profile;
  switch (path) {
    case "age":
      return profile.age;
    case "sex_at_birth":
      return profile.sex_at_birth;
    case "reproductive.pregnant":
      return profile.reproductive.pregnant;
    case "reproductive.breastfeeding":
      return profile.reproductive.breastfeeding;
    case "reproductive.planning":
      return profile.reproductive.planning;
    case "conditions":
      return profile.conditions;
    case "habits":
      return profile.habits;
    case "severity":
      return profile.severity ?? null;
    case "suicide_risk_assessed":
      return profile.suicide_risk_assessed ?? null;
  }
}

// Unknown values (null/undefined) never satisfy a comparison: safety-relevant profile fields are
// required by the intake forms, and the engine raises an alert when they are missing.
function compare(actual: unknown, op: string, expected: unknown): boolean {
  if (op === "exists") return actual !== null && actual !== undefined;
  if (actual === null || actual === undefined) return false;
  switch (op) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "contains":
      return Array.isArray(actual) && actual.includes(expected);
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "between":
      return (
        typeof actual === "number" &&
        Array.isArray(expected) &&
        typeof expected[0] === "number" &&
        typeof expected[1] === "number" &&
        actual >= expected[0] &&
        actual <= expected[1]
      );
    default:
      return false;
  }
}

export function evaluatePredicate(predicate: Predicate, ctx: PredicateContext): boolean {
  if ("all" in predicate) return predicate.all.every((p) => evaluatePredicate(p, ctx));
  if ("any" in predicate) return predicate.any.some((p) => evaluatePredicate(p, ctx));
  if ("not" in predicate) return !evaluatePredicate(predicate.not, ctx);
  if ("profile" in predicate) return compare(profileValue(ctx.input, predicate.profile), predicate.op, predicate.value);
  if ("derived" in predicate) return (ctx.derived[predicate.derived] ?? false) === (predicate.value ?? true);
  if ("instrument" in predicate) {
    const score = ctx.scores[predicate.instrument];
    if (predicate.answered !== undefined) return (score?.answered ?? false) === predicate.answered;
    if (!score?.answered) return false;
    if (predicate.band_in) return score.band !== null && predicate.band_in.includes(score.band);
    if (predicate.flag) return score.flags.includes(predicate.flag);
    return false;
  }
  if ("drug_fact" in predicate) return ctx.drug !== undefined && drugHasFact(ctx.drug, predicate.drug_fact);
  if ("drug_class" in predicate) return ctx.drug !== undefined && matchesClass(ctx.drug, predicate.drug_class, predicate.subclass);
  if ("drug" in predicate) return ctx.drug?.id === predicate.drug;
  if ("current_med_fact" in predicate) return ctx.currentMeds.some((d) => drugHasFact(d, predicate.current_med_fact));
  if ("current_med_class" in predicate) return ctx.currentMeds.some((d) => matchesClass(d, predicate.current_med_class, predicate.subclass));
  if ("current_med" in predicate) return ctx.currentMeds.some((d) => d.id === predicate.current_med);
  if ("mode" in predicate) return ctx.input.mode === predicate.mode;
  if ("condition" in predicate) {
    const condition = ctx.input.condition;
    return condition?.id === predicate.condition && (predicate.phase === undefined || condition.phase === predicate.phase);
  }
  if ("signal" in predicate) return ctx.signals[predicate.signal] ?? false;
  return false;
}
