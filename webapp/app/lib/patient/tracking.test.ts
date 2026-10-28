import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import type { KnowledgeBase, KnowledgeBaseData } from "../engine/types.ts";
import { compileLexicon, type CrisisLexiconSource } from "../safety/crisis.ts";
import { buildEvolutionReport } from "./evolution.ts";
import type { PatientSessionV1 } from "./store.ts";
import { addAssessment, addDays, daysBetween, dueInstruments, EMPTY_TRACKING, recent, scoreSeries, summarize, upsertCheckin, type Checkin } from "./tracking.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(here, file), "utf8"));
const bundle = readJson("../kb/kb.generated.json");
const kb = bundle.data as KnowledgeBaseData;
const kbFull: KnowledgeBase = { data: kb, version: bundle.kb_version, hash: bundle.content_hash };
const lexicon = compileLexicon(readJson("../kb/crisis.generated.json").data as CrisisLexiconSource);

const PHQ9 = { phq9_1: 2, phq9_2: 2, phq9_3: 2, phq9_4: 2, phq9_5: 1, phq9_6: 1, phq9_7: 1, phq9_8: 1, phq9_9: 0 };
const PHQ9_BETTER = { phq9_1: 1, phq9_2: 1, phq9_3: 1, phq9_4: 1, phq9_5: 0, phq9_6: 0, phq9_7: 0, phq9_8: 0, phq9_9: 0 };

function session(overrides: Partial<PatientSessionV1> = {}): PatientSessionV1 {
  return {
    started_at: "2026-10-01T12:00:00.000Z",
    storage: "device",
    consent: { version: "2026-10-27", accepted_at: "2026-10-01T12:00:00.000Z" },
    screening: { answers: {}, completed_at: null, repeat_reason: null },
    profile: { age: 34, sex_at_birth: "female", reproductive: { pregnant: "no", breastfeeding: false, planning: false }, conditions: [], habits: [] },
    gender_identity: "",
    known_diagnoses: [],
    current_meds: [],
    relato: "",
    instruments: { phq9: PHQ9 },
    skipped: [],
    history: [],
    priorities: [],
    ...overrides,
  };
}

const checkin = (date: string, mood: number, extra: Partial<Checkin> = {}): Checkin => ({ date, mood, sleep: 3, side_effects: [], adherence: "yes", note: "", ...extra });

test("um registro por dia: salvar de novo no mesmo dia substitui", () => {
  let data = upsertCheckin(EMPTY_TRACKING, checkin("2026-10-02", 2));
  data = upsertCheckin(data, checkin("2026-10-02", 4));
  data = upsertCheckin(data, checkin("2026-10-01", 3));
  assert.deepEqual(data.checkins.map((c) => [c.date, c.mood]), [["2026-10-01", 3], ["2026-10-02", 4]]);
});

test("série do PHQ-9: resposta da jornada como base, seguida das repetições", () => {
  const tracking = addAssessment(EMPTY_TRACKING, { date: "2026-10-15", instrument: "phq9", answers: PHQ9_BETTER });
  const series = scoreSeries(kb, session({ tracking }), "phq9");
  assert.deepEqual(series.map((p) => [p.date, p.total, p.baseline]), [["2026-10-01", 12, true], ["2026-10-15", 4, false]]);
  assert.equal(series[1].band, "minimal");
  const sameDay = addAssessment(EMPTY_TRACKING, { date: "2026-10-01", instrument: "phq9", answers: PHQ9_BETTER });
  assert.deepEqual(scoreSeries(kb, session({ tracking: sameDay }), "phq9").map((p) => [p.date, p.total, p.baseline]), [["2026-10-01", 4, false]], "um ponto por dia");
});

test("questionário volta a ser pedido depois do intervalo da base", () => {
  const due = (today: string, s = session()) => dueInstruments(kb, s, today).map((d) => d.instrument);
  assert.deepEqual(due("2026-10-10"), ["gad7"], "GAD-7 nunca respondido; PHQ-9 respondido há 9 dias");
  assert.ok(due("2026-10-15").includes("phq9"), "14 dias depois, o PHQ-9 volta");
  const tracking = addAssessment(EMPTY_TRACKING, { date: "2026-10-15", instrument: "phq9", answers: PHQ9_BETTER });
  assert.ok(!due("2026-10-20", session({ tracking })).includes("phq9"));
});

test("resumo do período: médias, adesão e efeitos mais frequentes", () => {
  const checkins = [
    checkin("2026-10-01", 2, { side_effects: ["nausea"], adherence: "yes" }),
    checkin("2026-10-02", 3, { side_effects: ["nausea", "insomnia"], adherence: "no" }),
    checkin("2026-10-03", 4, { adherence: "not_applicable" }),
  ];
  const s = summarize(checkins);
  assert.equal(s.days, 3);
  assert.equal(s.mood_average, 3);
  assert.equal(s.adherence_rate, 0.5);
  assert.deepEqual(s.side_effects, [{ id: "nausea", days: 2 }, { id: "insomnia", days: 1 }]);
  assert.deepEqual(recent(checkins, "2026-10-03", 2).map((c) => c.date), ["2026-10-02", "2026-10-03"]);
  assert.equal(daysBetween("2026-10-30", "2026-11-02"), 3);
});

test("relatório de evolução: tabela dos questionários, resumo do diário e anotações só com escolha", () => {
  let tracking = addAssessment(EMPTY_TRACKING, { date: "2026-10-15", instrument: "phq9", answers: PHQ9_BETTER });
  tracking = upsertCheckin(tracking, checkin("2026-10-20", 2, { side_effects: ["nausea"], adherence: "yes", note: "dia difícil no trabalho" }));
  tracking = upsertCheckin(tracking, checkin("2026-10-21", 4, { adherence: "no" }));
  tracking = upsertCheckin(tracking, checkin("2026-08-01", 1));
  const s = session({ tracking, current_meds: [{ drug_id: "sertralina", raw_text: "sertralina 50", mg_per_day: 50 }] });
  const options = { today: "2026-10-21", days: 30, withNotes: false, lexicon, now: new Date("2026-10-21T12:00:00Z") };
  const report = buildEvolutionReport(kbFull, s, options);

  assert.deepEqual(report.questionnaires.map((r) => [r.date, r.baseline, r.cells.phq9]), [
    ["2026-10-01", true, "12 pontos, moderados · item 9: 0"],
    ["2026-10-15", false, "4 pontos, mínimos · item 9: 0"],
  ]);
  assert.equal(report.period.from, addDays("2026-10-21", -29));
  assert.equal(report.diary.recorded, 2, "o registro de agosto fica fora do período");
  assert.match(report.diary.mood ?? "", /^média 3 de 5 .* muito mal 0 · mal 1 · mais ou menos 0 · bem 1 · muito bem 0$/);
  assert.equal(report.diary.adherence, "tomou como combinado em 1 de 2 dias com resposta (50%)");
  assert.deepEqual(report.diary.side_effects, ["Enjoo: 1 dia"]);
  assert.deepEqual(report.diary.notes, [], "anotações ficam fora por padrão");
  assert.deepEqual(report.attention, []);
  assert.match(report.current_meds[0], /sertralina/);

  const withNotes = buildEvolutionReport(kbFull, s, { ...options, withNotes: true });
  assert.deepEqual(withNotes.diary.notes, [{ date: "2026-10-20", text: "dia difícil no trabalho" }]);
});

test("relatório de evolução: item 9 e palavras de risco no diário pedem atenção", () => {
  let tracking = addAssessment(EMPTY_TRACKING, { date: "2026-10-15", instrument: "phq9", answers: { ...PHQ9_BETTER, phq9_9: 1 } });
  tracking = upsertCheckin(tracking, checkin("2026-10-16", 1, { note: "às vezes penso que queria morrer" }));
  const report = buildEvolutionReport(kbFull, session({ tracking }), { today: "2026-10-21", days: 30, withNotes: false, lexicon, now: new Date() });
  assert.equal(report.attention.length, 2);
  assert.match(report.attention[0], /item 9 .* 15\/10\/2026/);
  assert.match(report.attention[1], /no diário em 1 dia \(último em 16\/10\/2026\)/);
  assert.deepEqual(report.diary.notes, [], "o alerta não expõe o texto da anotação");
});
