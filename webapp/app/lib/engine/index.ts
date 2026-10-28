// Public entry point of the decision engine. The engine is pure: it receives the knowledge base and
// the crisis lexicon as arguments, so it runs the same way in the browser and in `node --test`.
export { evaluate, PREFERENCE_CONCERNS, TIER_ORDER, type EngineOptions } from "./evaluate.ts";
export { checkInvariants } from "./invariants.ts";
export { scoreInstrument } from "./instruments.ts";
export { renderMessage, type Variant } from "./messages.ts";
export type * from "./types.ts";
