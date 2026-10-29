import { useSyncExternalStore } from "react";
import type { MetricEvent } from "./metricEvents.ts";

// Anonymous counts (knowledge/POLICY.md §19), off unless the person turns them on. Each event is a
// name from a closed list (metricEvents.ts), sent alone: no answers, no identifier, no date finer
// than the month (added on the server).

export type { MetricEvent };

export const METRICS_KEY = "stabilis_metrics";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function metricsEnabled(): boolean {
  return localStorage.getItem(METRICS_KEY) === "on";
}

export function setMetricsEnabled(on: boolean): void {
  if (on) localStorage.setItem(METRICS_KEY, "on");
  else localStorage.removeItem(METRICS_KEY);
  listeners.forEach((listener) => listener());
}

export function useMetricsEnabled(): boolean | null {
  return useSyncExternalStore(subscribe, metricsEnabled, () => null);
}

export function track(event: MetricEvent): void {
  if (!metricsEnabled()) return;
  const body = JSON.stringify({ event });
  if (!navigator.sendBeacon?.("/api/metrics", body)) {
    fetch("/api/metrics", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
  }
}
