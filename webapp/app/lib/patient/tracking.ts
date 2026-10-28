// Follow-up between visits: a daily check-in (mood, sleep, side effects, taking the medicine) and the
// symptom questionnaires repeated every few weeks. Pure functions over the stored session.

import { scoreInstrument } from "../engine/instruments.ts";
import type { KnowledgeBaseData } from "../engine/types.ts";
import type { PatientSessionV1 } from "./store.ts";

export interface Checkin {
  date: string; // YYYY-MM-DD, local day
  mood: number; // 1–5
  sleep: number; // 1–5
  side_effects: string[]; // ids from vocab/effects.json
  adherence: "yes" | "no" | "not_applicable" | null;
  note: string;
}

export interface Assessment {
  date: string; // YYYY-MM-DD
  instrument: string;
  answers: Record<string, number>;
}

export interface TrackingData {
  checkins: Checkin[];
  assessments: Assessment[];
}

export const EMPTY_TRACKING: TrackingData = { checkins: [], assessments: [] };
export const MOOD_LABELS = ["Muito mal", "Mal", "Mais ou menos", "Bem", "Muito bem"];
export const SLEEP_LABELS = ["Muito ruim", "Ruim", "Regular", "Bom", "Muito bom"];
const DAY_MS = 86_400_000;

export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(day: string, n: number): string {
  return localDay(new Date(Date.parse(`${day}T12:00:00`) + n * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / DAY_MS);
}

/** One check-in per day: saving again on the same day replaces it. */
export function upsertCheckin(data: TrackingData, checkin: Checkin): TrackingData {
  const checkins = [...data.checkins.filter((c) => c.date !== checkin.date), checkin].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { ...data, checkins };
}

export function addAssessment(data: TrackingData, assessment: Assessment): TrackingData {
  const assessments = [...data.assessments.filter((a) => !(a.date === assessment.date && a.instrument === assessment.instrument)), assessment];
  return { ...data, assessments: assessments.sort((a, b) => (a.date < b.date ? -1 : 1)) };
}

export interface ScorePoint {
  date: string;
  total: number;
  band: string | null;
  baseline: boolean; // answered in the first journey
  answers: Record<string, number>;
}

/** The questionnaire answered in the journey (baseline) followed by the repeats. */
export function scoreSeries(kb: KnowledgeBaseData, session: PatientSessionV1, instrumentId: string): ScorePoint[] {
  const def = kb.instruments.find((i) => i.id === instrumentId);
  if (!def) return [];
  const points: ScorePoint[] = [];
  const profile = { ...session.profile, current_meds: session.current_meds };
  const baseline = scoreInstrument(def, session.instruments[instrumentId], profile);
  const journey = session.instruments[instrumentId];
  if (journey && baseline.answered && baseline.total !== null) points.push({ date: localDay(new Date(session.started_at)), total: baseline.total, band: baseline.band, baseline: true, answers: journey });
  for (const a of (session.tracking ?? EMPTY_TRACKING).assessments.filter((x) => x.instrument === instrumentId)) {
    const r = scoreInstrument(def, a.answers, profile);
    if (r.answered && r.total !== null) points.push({ date: a.date, total: r.total, band: r.band, baseline: false, answers: a.answers });
  }
  // One point per day: a repeat answered on the day of the journey replaces the journey's answer.
  const byDate = new Map(points.map((p) => [p.date, p]));
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Questionnaires due again: never answered, or answered at least `reassess_days` ago. */
export function dueInstruments(kb: KnowledgeBaseData, session: PatientSessionV1, today: string): { instrument: string; last: string | null }[] {
  if (!kb.tracking) return [];
  return kb.tracking.instruments
    .filter((id) => kb.instruments.some((i) => i.id === id && i.items.every((item) => item.text_status === "verified")))
    .map((id) => {
      const series = scoreSeries(kb, session, id);
      const last = series.length ? series[series.length - 1].date : null;
      return { instrument: id, last };
    })
    .filter(({ last }) => last === null || daysBetween(last, today) >= (kb.tracking?.reassess_days ?? 14));
}

export interface PeriodSummary {
  days: number;
  mood_average: number | null;
  sleep_average: number | null;
  adherence_rate: number | null; // share of days with "yes" among days that answered yes/no
  side_effects: { id: string; days: number }[];
}

export function summarize(checkins: Checkin[]): PeriodSummary {
  const avg = (values: number[]) => (values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null);
  const adherenceDays = checkins.filter((c) => c.adherence === "yes" || c.adherence === "no");
  const counts = new Map<string, number>();
  for (const c of checkins) for (const e of c.side_effects) counts.set(e, (counts.get(e) ?? 0) + 1);
  return {
    days: checkins.length,
    mood_average: avg(checkins.map((c) => c.mood)),
    sleep_average: avg(checkins.map((c) => c.sleep)),
    adherence_rate: adherenceDays.length ? Math.round((adherenceDays.filter((c) => c.adherence === "yes").length / adherenceDays.length) * 100) / 100 : null,
    side_effects: [...counts.entries()].map(([id, days]) => ({ id, days })).sort((a, b) => b.days - a.days || (a.id < b.id ? -1 : 1)),
  };
}

/** Check-ins in the last `days` days up to `today` (inclusive). */
export function recent(checkins: Checkin[], today: string, days: number): Checkin[] {
  return checkins.filter((c) => {
    const age = daysBetween(c.date, today);
    return age >= 0 && age < days;
  });
}
