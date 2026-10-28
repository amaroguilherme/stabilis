// Evolution report for the next visit: the symptom questionnaires over time, a summary of the daily
// diary for a period, the medicines in use and anything that needs attention. Pure: same session,
// same day and options, same report. Notes stay out unless the person includes them.

import type { KnowledgeBase } from "../engine/types.ts";
import { detectCrisis, summarizeCrisis, type CompiledLexicon } from "../safety/crisis.ts";
import { riskScreener, screeningResult } from "./flow.ts";
import { BAND_LABELS, medLine } from "./report.ts";
import type { PatientSessionV1 } from "./store.ts";
import { addDays, EMPTY_TRACKING, MOOD_LABELS, recent, scoreSeries, SLEEP_LABELS, summarize, type Checkin } from "./tracking.ts";

export const PERIODS = [30, 60, 90] as const;

const SHORT_NAMES: Record<string, string> = { phq9: "PHQ-9 (depressão)", gad7: "GAD-7 (ansiedade)" };
const date = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface EvolutionReport {
  generated_at: string;
  kb: { version: string; hash: string };
  period: { from: string; to: string; days: number };
  attention: string[];
  current_meds: string[];
  instruments: { id: string; name: string }[];
  questionnaires: { date: string; baseline: boolean; cells: Record<string, string> }[];
  diary: {
    recorded: number;
    mood: string | null;
    sleep: string | null;
    adherence: string | null;
    side_effects: string[];
    notes: { date: string; text: string }[];
  };
}

function scaleLine(checkins: Checkin[], key: "mood" | "sleep", names: string[], average: number | null): string | null {
  if (average === null) return null;
  const days = names.map((name, i) => `${name.toLowerCase()} ${checkins.filter((c) => c[key] === i + 1).length}`).join(" · ");
  return `média ${average.toLocaleString("pt-BR")} de 5 (1 = ${names[0].toLowerCase()}, 5 = ${names[4].toLowerCase()}) · dias: ${days}`;
}

export function buildEvolutionReport(
  kb: KnowledgeBase,
  session: PatientSessionV1,
  options: { today: string; days: number; withNotes: boolean; lexicon: CompiledLexicon; now: Date },
): EvolutionReport {
  const data = kb.data;
  const tracking = session.tracking ?? EMPTY_TRACKING;
  const checkins = recent(tracking.checkins, options.today, options.days);
  const summary = summarize(checkins);
  const instruments = (data.tracking?.instruments ?? [])
    .map((id) => data.instruments.find((i) => i.id === id))
    .filter((i) => !!i && i.items.every((item) => item.text_status === "verified"))
    .map((i) => ({ id: i!.id, name: SHORT_NAMES[i!.id] ?? i!.name }));
  const series = Object.fromEntries(instruments.map(({ id }) => [id, scoreSeries(data, session, id)]));

  const rows = [...new Set(instruments.flatMap(({ id }) => series[id].map((p) => p.date)))].sort().map((day) => {
    const cells: Record<string, string> = {};
    let baseline = false;
    for (const { id } of instruments) {
      const point = series[id].find((p) => p.date === day);
      if (!point) continue;
      baseline ||= point.baseline;
      const band = point.band ? `, ${BAND_LABELS[point.band] ?? point.band}` : "";
      const item9 = id === "phq9" ? ` · item 9: ${point.answers.phq9_9 ?? "-"}` : "";
      cells[id] = `${point.total} pontos${band}${item9}`;
    }
    return { date: day, baseline, cells };
  });

  const attention: string[] = [];
  const screener = riskScreener(data);
  const screen = screeningResult(data, session);
  if (screener && screen?.answered && screen.band !== "none") {
    const when = session.screening.completed_at ? ` em ${new Date(session.screening.completed_at).toLocaleDateString("pt-BR")}` : "";
    attention.push(`Triagem de segurança (${screener.name})${when}: ${BAND_LABELS[screen.band ?? "none"]}.`);
  }
  const item9 = (series.phq9 ?? []).filter((p) => (p.answers.phq9_9 ?? 0) > 0);
  if (item9.length) attention.push(`PHQ-9 item 9 (pensamentos de morte ou de se ferir) acima de zero em ${item9.map((p) => date(p.date)).join(", ")}.`);
  const riskNotes = tracking.checkins.filter((c) => c.note && summarizeCrisis(detectCrisis(c.note, options.lexicon, "patient")).crisis);
  if (riskNotes.length) {
    attention.push(`Palavras associadas a risco de suicídio ou autolesão no diário em ${plural(riskNotes.length, "dia", "dias")} (último em ${date(riskNotes[riskNotes.length - 1].date)}).`);
  }

  const effect = (id: string) => data.vocab.effects.effects.find((e) => e.id === id)?.label_plain ?? id;
  const answeredAdherence = checkins.filter((c) => c.adherence === "yes" || c.adherence === "no");
  const took = answeredAdherence.filter((c) => c.adherence === "yes").length;

  return {
    generated_at: options.now.toISOString(),
    kb: { version: kb.version, hash: kb.hash },
    period: { from: addDays(options.today, -(options.days - 1)), to: options.today, days: options.days },
    attention,
    current_meds: session.current_meds.map((m) => medLine(data, m)),
    instruments,
    questionnaires: rows,
    diary: {
      recorded: summary.days,
      mood: scaleLine(checkins, "mood", MOOD_LABELS, summary.mood_average),
      sleep: scaleLine(checkins, "sleep", SLEEP_LABELS, summary.sleep_average),
      adherence: answeredAdherence.length
        ? `tomou como combinado em ${took} de ${plural(answeredAdherence.length, "dia", "dias")} com resposta (${Math.round((took / answeredAdherence.length) * 100)}%)`
        : null,
      side_effects: summary.side_effects.map((s) => `${effect(s.id)}: ${plural(s.days, "dia", "dias")}`),
      notes: options.withNotes ? checkins.filter((c) => c.note.trim()).map((c) => ({ date: c.date, text: c.note.trim() })) : [],
    },
  };
}
