import { useMemo } from "react";
import { evaluate } from "../engine/evaluate.ts";
import type { EngineOutput } from "../engine/types.ts";
import { knowledgeBase } from "../kb/index.ts";
import { crisisLexicon } from "../safety/lexicon.ts";
import { engineInput, sections, type PatientSection } from "./flow.ts";
import type { PatientSessionV1 } from "./store.ts";

export interface PatientOutputs {
  parts: (PatientSection & { output: EngineOutput })[];
  review: EngineOutput; // no condition: medication review and case-level alerts
}

/** Engine results for the patient: one per condition to show, plus the review of current medications. */
export function usePatientOutputs(session: PatientSessionV1): PatientOutputs {
  return useMemo(() => {
    const kb = knowledgeBase.data;
    const parts = sections(kb, session).map((section) => ({ ...section, output: evaluate(knowledgeBase, engineInput(kb, session, section.condition), { crisisLexicon }) }));
    const review = evaluate(knowledgeBase, engineInput(kb, session, null), { crisisLexicon });
    return { parts, review };
  }, [session]);
}
