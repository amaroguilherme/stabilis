export interface DrugResult {
  name: string;
  final_score: number;
  ai_score: number;
  bonus: number;
  penalty: number;
  risk_profile: string[];
  drug_class: string;
  name_pt: string | null;
  reasons: { type: "bonus" | "penalty"; text: string }[];
  in_use?: boolean;
  in_use_duration_months?: number;
}

export interface PatientChecklist {
  patient_id: string;
  weight: number;
  gender: string;
  base_diagnosis: string;
  comorbidities: string[];
  habits: string[];
}

export interface AnalyzeRequest {
  checklist: PatientChecklist;
  doctor_summary: string;
}

export interface CurrentMedication {
  name: string;
  dose: number;
  duration_months: number;
}

export interface ReanalyzeRequest extends AnalyzeRequest {
  current_medications: CurrentMedication[];
  treatment_anamnesis: string;
}

export interface SafetySummary {
  crisis: boolean;
  negated_only: boolean;
}

export interface AnalysisResult {
  results: DrugResult[];
  degraded: boolean;
  safety: SafetySummary;
}

export interface SessionData {
  results: DrugResult[];
  checklist: PatientChecklist;
  doctor_summary: string;
  degraded?: boolean;
  safety?: SafetySummary;
  current_medications?: CurrentMedication[];
  treatment_anamnesis?: string;
}
