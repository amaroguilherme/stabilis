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

export interface PrescriptionDrug {
  name: string;
  name_pt: string | null;
  dose: number;
  interval: number;
}

export interface CurrentMedication {
  name: string;
  dose: number;
  duration_months: number;
}

export interface SessionData {
  results: DrugResult[];
  checklist: PatientChecklist;
  doctor_summary: string;
  prescription?: PrescriptionDrug[];
  current_medications?: CurrentMedication[];
  treatment_anamnesis?: string;
}
