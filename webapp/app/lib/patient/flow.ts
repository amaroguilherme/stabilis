// Patient journey: which steps exist, which questionnaires can be shown, and how the answers become
// engine inputs. Pure functions over the knowledge base and the stored session.

import { scoreInstrument } from "../engine/instruments.ts";
import type { EngineInput, Instrument, InstrumentResult, KnowledgeBaseData } from "../engine/types.ts";
import type { PatientSessionV1 } from "./store.ts";

/** Questionnaires of the patient flow, in order. Only those with all item texts verified are shown. */
const QUESTIONNAIRE_ORDER = ["phq9", "gad7", "mdq", "auditc"];

export const KNOWN_DIAGNOSES = [
  { id: "depression", label: "Depressão" },
  { id: "anxiety", label: "Ansiedade generalizada" },
  { id: "bipolar_1", label: "Transtorno bipolar tipo 1" },
  { id: "bipolar_2", label: "Transtorno bipolar tipo 2" },
  { id: "bipolar_unknown", label: "Transtorno bipolar (não sei o tipo)" },
  { id: "psychosis", label: "Esquizofrenia ou outra psicose" },
  { id: "adhd", label: "TDAH" },
  { id: "substance_use", label: "Dependência de álcool ou outras drogas" },
  { id: "other", label: "Outro" },
] as const;

/** Conditions the patient mode only refers (POLICY §5). */
export const REFERRAL_ONLY = new Set(["psychosis", "adhd", "substance_use"]);

/** Short titles for the patient screens (the full instrument names are long). */
export const PATIENT_TITLES: Record<string, string> = {
  phq9: "Como você tem se sentido (PHQ-9)",
  gad7: "Ansiedade (GAD-7)",
  mdq: "Variações de humor (MDQ)",
  auditc: "Bebidas alcoólicas (AUDIT-C)",
};

export function isShowable(instrument: Instrument): boolean {
  return instrument.items.every((item) => item.text_status === "verified" && item.text);
}

export function riskScreener(kb: KnowledgeBaseData): Instrument | undefined {
  return kb.instruments.find((i) => i.scoring.type === "risk_screener" && isShowable(i));
}

export function questionnaires(kb: KnowledgeBaseData): Instrument[] {
  return QUESTIONNAIRE_ORDER.map((id) => kb.instruments.find((i) => i.id === id)).filter((i): i is Instrument => !!i && isShowable(i));
}

export type Step = { path: string; label: string };

export function steps(kb: KnowledgeBaseData): Step[] {
  return [
    { path: "/paciente/seguranca", label: "Segurança" },
    { path: "/paciente/perfil", label: "Sobre você" },
    { path: "/paciente/relato", label: "O que você sente" },
    ...questionnaires(kb).map((i) => ({ path: `/paciente/questionarios/${i.id}`, label: PATIENT_TITLES[i.id] ?? i.name })),
    { path: "/paciente/historico", label: "Tratamentos" },
    { path: "/paciente/prioridades", label: "Prioridades" },
    { path: "/paciente/resultado", label: "Resultado" },
  ];
}

export function nextStep(kb: KnowledgeBaseData, path: string): string {
  const list = steps(kb);
  const index = list.findIndex((s) => s.path === path);
  return list[Math.min(index + 1, list.length - 1)]?.path ?? "/paciente/resultado";
}

export function screeningResult(kb: KnowledgeBaseData, session: PatientSessionV1): InstrumentResult | null {
  const screener = riskScreener(kb);
  if (!screener || !session.screening.completed_at) return null;
  return scoreInstrument(screener, session.screening.answers);
}

export function screeningPositive(kb: KnowledgeBaseData, session: PatientSessionV1): boolean {
  const result = screeningResult(kb, session);
  return !!result && result.answered && result.band !== "none";
}

function profileOf(session: PatientSessionV1) {
  return { ...session.profile, current_meds: session.current_meds };
}

export function scores(kb: KnowledgeBaseData, session: PatientSessionV1): Record<string, InstrumentResult> {
  const out: Record<string, InstrumentResult> = {};
  for (const instrument of kb.instruments) {
    const answers = instrument.scoring.type === "risk_screener" ? session.screening.answers : session.instruments[instrument.id];
    out[instrument.id] = scoreInstrument(instrument, answers, profileOf(session));
  }
  return out;
}

export interface PatientSection {
  condition: string;
  reason: "known" | "scores";
}

/** Which conditions to show options for: what a professional already said, or what the scores suggest. */
export function sections(kb: KnowledgeBaseData, session: PatientSessionV1): PatientSection[] {
  const known = new Set(session.known_diagnoses);
  const s = scores(kb, session);
  const out: PatientSection[] = [];
  const bipolarKnown = known.has("bipolar_1") || known.has("bipolar_2") || known.has("bipolar_unknown");
  if (bipolarKnown || (s.mdq?.answered && s.mdq.band === "positive")) {
    out.push({ condition: known.has("bipolar_2") ? "bipolar_2" : "bipolar_1", reason: bipolarKnown ? "known" : "scores" });
  }
  if (known.has("depression") || (s.phq9?.answered && (s.phq9.total ?? 0) >= 5)) {
    out.push({ condition: "depression_unipolar", reason: known.has("depression") ? "known" : "scores" });
  }
  if (known.has("anxiety") || (s.gad7?.answered && (s.gad7.total ?? 0) >= 5)) {
    out.push({ condition: "gad", reason: known.has("anxiety") ? "known" : "scores" });
  }
  return out.filter((section) => kb.conditions.some((c) => c.id === section.condition));
}

export function engineInput(kb: KnowledgeBaseData, session: PatientSessionV1, condition: string | null): EngineInput {
  const screener = riskScreener(kb);
  return {
    mode: "patient",
    condition: condition ? { id: condition, phase: null } : null,
    profile: profileOf(session),
    instruments: { ...session.instruments, ...(screener && session.screening.completed_at ? { [screener.id]: session.screening.answers } : {}) },
    free_text: session.relato,
    concerns: session.priorities,
  };
}

/** PHQ-9 item 9 above zero after a negative screening asks for the screening again. */
export function phq9AsksRescreen(session: PatientSessionV1): boolean {
  return (session.instruments.phq9?.phq9_9 ?? 0) > 0 && session.screening.repeat_reason !== "phq9_item9";
}
