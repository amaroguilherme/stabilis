import { useMemo, useSyncExternalStore } from "react";

// A versioned value kept only in this tab's sessionStorage (cleared when the tab closes). Read with
// useSyncExternalStore so the server render and the first client render agree ("loading").

export type Stored<T> = { status: "loading" } | { status: "missing" } | { status: "ready"; value: T };

export interface SessionStore<T> {
  save(value: T): void;
  clear(): void;
  useValue(): Stored<T>;
}

export function createSessionStore<T>(key: string, version: number): SessionStore<T> {
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
  const getSnapshot = (): string | null | undefined => sessionStorage.getItem(key);
  const getServerSnapshot = (): string | null | undefined => undefined;

  return {
    save(value) {
      sessionStorage.setItem(key, JSON.stringify({ version, value }));
      notify();
    },
    clear() {
      sessionStorage.removeItem(key);
      notify();
    },
    useValue() {
      const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
      return useMemo((): Stored<T> => {
        if (raw === undefined) return { status: "loading" };
        if (raw === null) return { status: "missing" };
        try {
          const parsed = JSON.parse(raw) as { version: number; value: T };
          return parsed.version === version ? { status: "ready", value: parsed.value } : { status: "missing" };
        } catch {
          return { status: "missing" };
        }
      }, [raw]);
    },
  };
}
