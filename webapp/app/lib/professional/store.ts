import type { EngineInput } from "../engine/types.ts";
import { createSessionStore } from "../storage/sessionStore.ts";

// Only the inputs are kept; the result is recomputed from the current knowledge base on every view.
export interface ProfessionalCase {
  input: EngineInput;
  gender_identity?: string;
  saved_at: string;
}

export const professionalCase = createSessionStore<ProfessionalCase>("stabilis_professional_case", 1);
