import { useMemo, useSyncExternalStore } from "react";
import type { MedEntry, Profile } from "../engine/types.ts";
import type { Stored } from "../storage/sessionStore.ts";

// The patient's answers, and nothing else: results are recomputed from the current knowledge base.
// Kept in this tab's sessionStorage by default; in localStorage only when the person chooses to
// keep them on the device (shared phones are common, so it is opt-in).

export const CONSENT_VERSION = "2026-10-27";

export interface TreatmentHistoryEntry {
  drug_id: string | null;
  raw_text: string;
  still_using: boolean | null;
  mg_per_day: number | null;
  duration_months: number | null;
  response: "good" | "partial" | "none" | "unknown" | null;
  side_effects: string[]; // ids from vocab/effects.json
  stop_reason: "side_effects" | "no_effect" | "cost" | "ran_out" | "doctor_changed" | "felt_better" | "other" | null;
}

export interface PatientSessionV1 {
  started_at: string;
  storage: "session" | "device";
  consent: { version: string; accepted_at: string };
  screening: { answers: Record<string, number>; completed_at: string | null; repeat_reason: "phq9_item9" | "crisis_language" | null };
  profile: Omit<Profile, "current_meds" | "severity" | "suicide_risk_assessed">;
  gender_identity: string;
  known_diagnoses: string[];
  current_meds: MedEntry[];
  relato: string;
  instruments: Record<string, Record<string, number>>;
  skipped: string[]; // questionnaires the person chose to skip
  history: TreatmentHistoryEntry[];
  priorities: string[];
}

const KEY = "stabilis_patient";
const VERSION = 1;
const PROFESSIONAL_KEY = "stabilis_professional_case";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const getSnapshot = (): string | null | undefined => localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
const getServerSnapshot = (): string | null | undefined => undefined;

export function newPatientSession(storage: PatientSessionV1["storage"]): PatientSessionV1 {
  const now = new Date().toISOString();
  return {
    started_at: now,
    storage,
    consent: { version: CONSENT_VERSION, accepted_at: now },
    screening: { answers: {}, completed_at: null, repeat_reason: null },
    profile: { age: null, sex_at_birth: null, reproductive: { pregnant: null, breastfeeding: null, planning: null }, conditions: [], habits: [] },
    gender_identity: "",
    known_diagnoses: [],
    current_meds: [],
    relato: "",
    instruments: {},
    skipped: [],
    history: [],
    priorities: [],
  };
}

export function savePatient(session: PatientSessionV1): void {
  const [target, other] = session.storage === "device" ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
  target.setItem(KEY, JSON.stringify({ version: VERSION, value: session }));
  other.removeItem(KEY);
  notify();
}

export function readPatient(): PatientSessionV1 | null {
  const raw = getSnapshot();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version: number; value: PatientSessionV1 };
    return parsed.version === VERSION ? parsed.value : null;
  } catch {
    return null;
  }
}

export function updatePatient(change: (session: PatientSessionV1) => PatientSessionV1): void {
  const current = readPatient();
  if (current) savePatient(change(current));
}

/** "Apagar meus dados": everything this site keeps in the browser. */
export function clearAllData(): void {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(KEY);
    storage.removeItem(PROFESSIONAL_KEY);
  }
  notify();
}

export function usePatient(): Stored<PatientSessionV1> {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo((): Stored<PatientSessionV1> => {
    if (raw === undefined) return { status: "loading" };
    if (raw === null) return { status: "missing" };
    try {
      const parsed = JSON.parse(raw) as { version: number; value: PatientSessionV1 };
      return parsed.version === VERSION ? { status: "ready", value: parsed.value } : { status: "missing" };
    } catch {
      return { status: "missing" };
    }
  }, [raw]);
}
