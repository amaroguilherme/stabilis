import { useMemo, useSyncExternalStore } from "react";
import type { Stored } from "../storage/sessionStore.ts";

// The person's own safety plan: free text per step, one item per line. Independent of the guide, so
// it can be written straight from the crisis page. Kept in this tab by default; on the device only
// if the person chooses. "Apagar meus dados" removes it too (it listens for DATA_CLEARED_EVENT).

export interface SafetyPlanDraft {
  storage: "session" | "device";
  answers: Record<string, string>; // step id → text
  updated_at: string;
}

export const SAFETY_PLAN_KEY = "stabilis_safety_plan";
export const DATA_CLEARED_EVENT = "stabilis:data-cleared";
const VERSION = 1;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  window.addEventListener(DATA_CLEARED_EVENT, listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener(DATA_CLEARED_EVENT, listener);
  };
}

const getSnapshot = (): string | null | undefined => localStorage.getItem(SAFETY_PLAN_KEY) ?? sessionStorage.getItem(SAFETY_PLAN_KEY);
const getServerSnapshot = (): string | null | undefined => undefined;

export function saveSafetyPlan(plan: SafetyPlanDraft): void {
  const [target, other] = plan.storage === "device" ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
  target.setItem(SAFETY_PLAN_KEY, JSON.stringify({ version: VERSION, value: plan }));
  other.removeItem(SAFETY_PLAN_KEY);
  notify();
}

export function deleteSafetyPlan(): void {
  localStorage.removeItem(SAFETY_PLAN_KEY);
  sessionStorage.removeItem(SAFETY_PLAN_KEY);
  notify();
}

export function useSafetyPlan(): Stored<SafetyPlanDraft> {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo((): Stored<SafetyPlanDraft> => {
    if (raw === undefined) return { status: "loading" };
    if (raw === null) return { status: "missing" };
    try {
      const parsed = JSON.parse(raw) as { version: number; value: SafetyPlanDraft };
      return parsed.version === VERSION ? { status: "ready", value: parsed.value } : { status: "missing" };
    } catch {
      return { status: "missing" };
    }
  }, [raw]);
}

/** The lines the person wrote for a step, without blanks. */
export function planItems(text: string | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Adds an example as a new line, unless the step already has it. */
export function addItem(text: string | undefined, item: string): string {
  const lines = planItems(text);
  return lines.includes(item) ? lines.join("\n") : [...lines, item].join("\n");
}

/** Splits a line around phone numbers (8 digits or more) so they can become call links. */
export function phoneParts(line: string): { text: string; tel: string | null }[] {
  const parts: { text: string; tel: string | null }[] = [];
  let last = 0;
  for (const match of line.matchAll(/\+?\d[\d\s().-]{6,}\d/g)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length < 8) continue;
    if (match.index > last) parts.push({ text: line.slice(last, match.index), tel: null });
    parts.push({ text: match[0], tel: digits });
    last = match.index + match[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), tel: null });
  return parts;
}
