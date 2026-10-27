// Result of the "extract" job (core/extraction/extract.py, schema v1). Every suggestion quotes the
// passage of the text it came from; nothing is applied to the form without confirmation.

export interface ExtractedMedication {
  drug_id: string | null;
  candidates: string[];
  raw_text: string;
  evidence: string;
  status: "current" | "past" | "unknown";
  mg_per_day: number | null;
  source: "llm" | "lexicon";
}

export interface ExtractionResult {
  version: 1;
  task: "patient" | "professional";
  degraded: boolean;
  crisis: { language: boolean; negated_only: boolean; llm_risk: boolean };
  suggestions: {
    conditions: { id: string; evidence: string }[];
    habits: { id: string; evidence: string }[];
    medications: ExtractedMedication[];
    pregnancy: { status: "pregnant" | "not_pregnant" | "planning" | "breastfeeding"; evidence?: string } | null;
    symptoms: { domain: string; evidence: string; temporality: string }[];
  };
  excluded: { kind: string; code: string; evidence: string; reason: "negated" | "other_person" | "hypothetical" }[];
  items_proposed: number;
  discarded_unsupported: number;
}
