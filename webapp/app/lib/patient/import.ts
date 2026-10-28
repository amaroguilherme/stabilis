// Reads the file the patient exported (report page) so a professional can pre-fill the form.
// The checksum only shows whether the file changed after export; it does not prove who made it.

import { scoreInstrument } from "../engine/instruments.ts";
import type { EngineInput, HistoryEntry, KnowledgeBaseData, MedEntry, Profile } from "../engine/types.ts";

export interface PatientExport {
  schema: "stabilis.patient-session";
  version: 1;
  kb_version: string;
  exported_at: string;
  checksum: string;
  data: {
    profile: Omit<Profile, "current_meds" | "severity" | "suicide_risk_assessed">;
    gender_identity: string;
    known_diagnoses: string[];
    current_meds: MedEntry[];
    relato: string;
    instruments: Record<string, Record<string, number>>;
    screening: { answers: Record<string, number>; completed_at: string | null };
    history: HistoryEntry[];
    priorities: string[];
  };
}

export type ImportResult = { ok: true; file: PatientExport; checksumOk: boolean } | { ok: false; error: string };

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function parsePatientExport(text: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "O arquivo não é um JSON válido." };
  }
  const file = parsed as Partial<PatientExport>;
  if (file?.schema !== "stabilis.patient-session") return { ok: false, error: "Este arquivo não foi exportado pelo modo paciente do Stabilis." };
  if (file.version !== 1) return { ok: false, error: "Versão do arquivo não suportada." };
  const data = file.data;
  if (!data || typeof data !== "object" || !data.profile || !Array.isArray(data.current_meds) || !Array.isArray(data.history)) {
    return { ok: false, error: "O arquivo está incompleto." };
  }
  const checksumOk = file.checksum === `sha256:${await sha256(JSON.stringify(data))}`;
  return { ok: true, file: file as PatientExport, checksumOk };
}

export interface ImportedCase {
  profile: PatientExport["data"]["profile"];
  gender_identity: string;
  meds: MedEntry[];
  history: HistoryEntry[];
  text: string;
  instruments: EngineInput["instruments"];
  condition: string;
  severity: "" | "less_severe" | "more_severe";
  suicideRisk: "" | "yes";
  concerns: string[];
  notes: string[]; // what the professional should know about the suggestions
}

const FACT_CONCERNS = new Set(["weight_gain_significant", "sedation_significant", "sexual_dysfunction", "prolactin_elevation"]);

/** Turns the patient's answers into form suggestions. The professional reviews everything before using it. */
export function toProfessionalCase(kb: KnowledgeBaseData, file: PatientExport): ImportedCase {
  const d = file.data;
  const screener = kb.instruments.find((i) => i.purpose === "suicide_screen");
  const instruments = { ...d.instruments, ...(screener && d.screening?.completed_at ? { [screener.id]: d.screening.answers } : {}) };
  const score = (id: string) => {
    const def = kb.instruments.find((i) => i.id === id);
    return def ? scoreInstrument(def, instruments[id], { ...d.profile, current_meds: d.current_meds }) : undefined;
  };
  const phq9 = score("phq9");
  const gad7 = score("gad7");
  const asq = screener ? score(screener.id) : undefined;
  const known = new Set(d.known_diagnoses);
  const bipolarScreen = kb.instruments.filter((i) => i.purpose === "bipolar_screen").map((i) => score(i.id)).find((r) => r?.answered);
  const notes: string[] = [];

  let condition = "";
  if (known.has("bipolar_1") || known.has("bipolar_unknown")) condition = "bipolar_1";
  else if (known.has("bipolar_2")) condition = "bipolar_2";
  else if (known.has("depression") || (phq9?.answered && (phq9.total ?? 0) >= 5)) condition = "depression_unipolar";
  else if (known.has("anxiety") || (gad7?.answered && (gad7.total ?? 0) >= 5)) condition = "gad";
  if (condition.startsWith("bipolar")) notes.push("A pessoa informou diagnóstico de transtorno bipolar: escolha a fase atual.");
  if (bipolarScreen?.band === "positive") notes.push("A triagem de bipolaridade da pessoa foi positiva (relato de período com sinais de mania ou hipomania).");
  if (condition === "depression_unipolar" && gad7?.answered && (gad7.total ?? 0) >= 10) notes.push(`GAD-7 de ${gad7.total} pontos: considere também o transtorno de ansiedade generalizada.`);

  const severity = condition === "depression_unipolar" && phq9?.answered ? ((phq9.total ?? 0) >= 16 ? "more_severe" : "less_severe") : "";
  if (severity) notes.push(`Gravidade sugerida pelo PHQ-9 (${phq9?.total} pontos; NICE NG222: 16 ou mais é mais grave).`);
  const item9 = d.instruments.phq9?.phq9_9 ?? 0;
  const suicideRisk = (asq?.answered && asq.band !== "none") || item9 > 0 ? "yes" : "";
  if (suicideRisk) notes.push("Risco de suicídio marcado como presente pela triagem da pessoa (ASQ positivo ou item 9 do PHQ-9). Avalie e ajuste.");

  return {
    profile: d.profile,
    gender_identity: d.gender_identity ?? "",
    meds: d.current_meds,
    history: d.history,
    text: d.relato ? `Relato da pessoa: ${d.relato}` : "",
    instruments,
    condition,
    severity,
    suicideRisk,
    concerns: d.priorities.filter((p) => FACT_CONCERNS.has(p)),
    notes,
  };
}
