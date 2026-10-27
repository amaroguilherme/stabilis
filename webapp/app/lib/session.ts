import { useMemo, useSyncExternalStore } from "react";
import type { SessionData } from "@/app/types";

// The analysis result lives only in this tab's sessionStorage (cleared when the tab closes).

const KEY = "stabilis_session";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const getSnapshot = (): string | null | undefined => sessionStorage.getItem(KEY);
const getServerSnapshot = (): string | null | undefined => undefined;

export function saveSession(session: SessionData) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
  listeners.forEach((listener) => listener());
}

export type StoredSession =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; session: SessionData };

export function useStoredSession(): StoredSession {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo((): StoredSession => {
    if (raw === undefined) return { status: "loading" };
    if (raw === null) return { status: "missing" };
    try {
      return { status: "ready", session: JSON.parse(raw) as SessionData };
    } catch {
      return { status: "missing" };
    }
  }, [raw]);
}
