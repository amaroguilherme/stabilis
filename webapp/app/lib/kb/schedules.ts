import { useEffect, useState } from "react";
import type { Drug, MonitoringItem } from "../engine/types.ts";

// Titration/taper schemes and monitoring timing (knowledge/drugs/*.json) are long and shown only on
// a few screens, so they come in a separate chunk, loaded on demand (like the brand names).

export interface DrugSchedules {
  titration?: NonNullable<Drug["titration"]>;
  schedules?: Record<string, NonNullable<MonitoringItem["schedule"]>>; // by monitoring id
}

let pending: Promise<Record<string, DrugSchedules>> | null = null;

export function loadSchedules(): Promise<Record<string, DrugSchedules>> {
  pending ??= import("./schedules.client.generated.json").then((module) => module.default.drugs as Record<string, DrugSchedules>);
  return pending;
}

/** Drug id → schemes and timing, or null while loading. */
export function useSchedules(): Record<string, DrugSchedules> | null {
  const [schedules, setSchedules] = useState<Record<string, DrugSchedules> | null>(null);
  useEffect(() => {
    let active = true;
    loadSchedules().then((loaded) => active && setSchedules(loaded), () => {});
    return () => {
      active = false;
    };
  }, []);
  return schedules;
}
