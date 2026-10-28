"use client";

import { knowledgeBase } from "@/app/lib/kb";
import { BAND_LABELS } from "@/app/lib/patient/report";
import type { PatientSessionV1 } from "@/app/lib/patient/store";
import { addDays, MOOD_LABELS, recent, scoreSeries, SLEEP_LABELS, type Checkin } from "@/app/lib/patient/tracking";
import TrendChart from "./TrendChart";

// The follow-up charts, shared by the tracking page and the evolution report: one chart per
// questionnaire (with its bands) and one per diary measure.

const kb = knowledgeBase.data;
const TITLES: Record<string, string> = { phq9: "Sintomas de depressão (PHQ-9)", gad7: "Sintomas de ansiedade (GAD-7)" };

export const trackedTitle = (id: string) => TITLES[id] ?? kb.instruments.find((i) => i.id === id)?.name ?? id;

export function scoreText(id: string, total: number): string {
  const band = kb.instruments.find((i) => i.id === id)?.scoring.bands?.find((b) => total >= b.min && total <= b.max);
  return band ? `${total} pontos (sintomas ${BAND_LABELS[band.id] ?? band.id})` : `${total} pontos`;
}

export function InstrumentChart({ session, id }: { session: PatientSessionV1; id: string }) {
  const bands = kb.instruments.find((i) => i.id === id)?.scoring.bands ?? [];
  const series = scoreSeries(kb, session, id);
  if (!series.length || !bands.length) return null;
  const max = bands[bands.length - 1].max;
  return (
    <TrendChart
      title={trackedTitle(id)}
      subtitle={`De 0 a ${max} pontos: quanto menor, menos sintomas.`}
      caption={`Faixas: ${bands.map((b) => `${b.min} a ${b.max}, ${BAND_LABELS[b.id] ?? b.id}`).join(" · ")}.`}
      points={series.map((p) => ({ date: p.date, value: p.total }))}
      yMin={0}
      yMax={max}
      yTicks={[...bands.map((b) => b.min), max]}
      format={(v) => scoreText(id, v)}
      valueHeader="Pontos"
    />
  );
}

export function DiaryCharts({ checkins, today, days }: { checkins: Checkin[]; today: string; days: number }) {
  const inRange = recent(checkins, today, days);
  if (!inRange.length) return null;
  const common = { subtitle: `Últimos ${days} dias`, yMin: 1, yMax: 5, yTicks: [1, 2, 3, 4, 5], xDomain: [addDays(today, -(days - 1)), today] as [string, string], gapDays: 1, endLabel: false };
  return (
    <>
      <TrendChart
        title="Humor"
        points={inRange.map((c) => ({ date: c.date, value: c.mood }))}
        tickLabel={(v) => MOOD_LABELS[v - 1] ?? String(v)}
        format={(v) => MOOD_LABELS[v - 1] ?? String(v)}
        valueHeader="Humor"
        {...common}
      />
      <TrendChart
        title="Sono"
        points={inRange.map((c) => ({ date: c.date, value: c.sleep }))}
        tickLabel={(v) => SLEEP_LABELS[v - 1] ?? String(v)}
        format={(v) => SLEEP_LABELS[v - 1] ?? String(v)}
        valueHeader="Sono"
        {...common}
      />
    </>
  );
}
