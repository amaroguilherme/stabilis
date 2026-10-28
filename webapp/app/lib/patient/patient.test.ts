import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { evaluate } from "../engine/evaluate.ts";
import type { KnowledgeBase, KnowledgeBaseData } from "../engine/types.ts";
import { compileLexicon, type CrisisLexiconSource } from "../safety/crisis.ts";
import { engineInput, questionnaires, riskScreener, sections } from "./flow.ts";
import { buildDoctorReport, exportSession, MAX_QUESTIONS, reportText, SHARE_LIMIT, shortCite } from "./report.ts";
import type { PatientSessionV1 } from "./store.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const bundle = readJson(path.join(here, "../kb/kb.generated.json"));
const kb: KnowledgeBase = { data: bundle.data as KnowledgeBaseData, version: bundle.kb_version, hash: bundle.content_hash };
const crisisLexicon = compileLexicon(readJson(path.join(here, "../kb/crisis.generated.json")).data as CrisisLexiconSource);

function session(overrides: Partial<PatientSessionV1> = {}): PatientSessionV1 {
  return {
    started_at: "2026-10-27T12:00:00.000Z",
    storage: "session",
    consent: { version: "2026-10-27", accepted_at: "2026-10-27T12:00:00.000Z" },
    screening: { answers: {}, completed_at: null, repeat_reason: null },
    profile: { age: 34, sex_at_birth: "female", reproductive: { pregnant: "no", breastfeeding: false, planning: false }, conditions: [], habits: [] },
    gender_identity: "",
    known_diagnoses: [],
    current_meds: [],
    relato: "",
    instruments: {},
    skipped: [],
    history: [],
    priorities: [],
    ...overrides,
  };
}

function outputsFor(s: PatientSessionV1) {
  const parts = sections(kb.data, s).map((section) => ({ ...section, output: evaluate(kb, engineInput(kb.data, s, section.condition), { crisisLexicon }) }));
  const review = evaluate(kb, engineInput(kb.data, s, null), { crisisLexicon });
  return { parts, review };
}

const PHQ9_MODERATE = { phq9_1: 2, phq9_2: 2, phq9_3: 1, phq9_4: 2, phq9_5: 1, phq9_6: 1, phq9_7: 1, phq9_8: 1, phq9_9: 0 };

test("seções: diagnóstico informado ou escores acima do limiar", () => {
  assert.deepEqual(sections(kb.data, session()), []);
  assert.deepEqual(sections(kb.data, session({ known_diagnoses: ["depression"] })).map((s) => [s.condition, s.reason]), [["depression_unipolar", "known"]]);
  assert.deepEqual(sections(kb.data, session({ instruments: { phq9: PHQ9_MODERATE } })).map((s) => [s.condition, s.reason]), [["depression_unipolar", "scores"]]);
  assert.deepEqual(sections(kb.data, session({ known_diagnoses: ["bipolar_2"] })).map((s) => s.condition), ["bipolar_2"]);
  const maniaYes = { bipolar_hx: { bipolar_hx_1: 1, bipolar_hx_2: 0, bipolar_hx_3: 0, bipolar_hx_4: 0, bipolar_hx_5: 0 } };
  assert.deepEqual(sections(kb.data, session({ instruments: maniaYes })).map((s) => [s.condition, s.reason]), [["bipolar_1", "scores"]]);
});

test("entrada do motor: modo paciente, relato como texto livre e prioridades como preferências", () => {
  const input = engineInput(kb.data, session({ relato: "durmo mal", priorities: ["prefer_sus"] }), "depression_unipolar");
  assert.equal(input.mode, "patient");
  assert.equal(input.free_text, "durmo mal");
  assert.deepEqual(input.concerns, ["prefer_sus"]);
  const screener = riskScreener(kb.data);
  if (screener) assert.equal(screener.id in (input.instruments ?? {}), false, "triagem não feita não entra no motor");
});

test("relatório: crise no relato oculta remédios, avisa no topo e limita as perguntas", () => {
  const s = session({ relato: "não aguento mais, às vezes penso que queria morrer", instruments: { phq9: PHQ9_MODERATE } });
  const { parts, review } = outputsFor(s);
  const report = buildDoctorReport(kb, s, parts, review, new Date("2026-10-27T12:00:00Z"));
  assert.equal(report.crisis, true);
  assert.ok(parts.every((p) => p.output.tiers.every((t) => t.drugs.length === 0)), "nenhum medicamento com crise");
  assert.ok(report.questions.length <= MAX_QUESTIONS);
  assert.match(reportText(report), /ATENÇÃO: há sinais de risco/);
});

test("relatório: medicamentos em uso (inclusive não reconhecidos), histórico e prioridades", () => {
  const s = session({
    current_meds: [
      { drug_id: "sertralina", raw_text: "Zoloft 50", mg_per_day: 50 },
      { drug_id: null, raw_text: "remédio azul", mg_per_day: null },
    ],
    history: [{ drug_id: "fluoxetina", raw_text: "fluoxetina", still_using: false, mg_per_day: 20, duration_months: 3, response: "none", side_effects: ["nausea"], stop_reason: "no_effect" }],
    priorities: ["weight_gain_significant"],
    known_diagnoses: ["depression"],
  });
  const { parts, review } = outputsFor(s);
  const report = buildDoctorReport(kb, s, parts, review, new Date("2026-10-27T12:00:00Z"));
  assert.ok(report.current_meds.some((m) => m.startsWith("cloridrato de sertralina") || m.toLowerCase().includes("sertralina")));
  assert.ok(report.current_meds.some((m) => m.includes("remédio azul") && m.includes("não reconhecido")));
  assert.match(report.history[0], /Fluoxetina · 20 mg\/dia · 3 meses · parou · não ajudou · efeitos: náusea · motivo da parada: não fez efeito/);
  assert.deepEqual(report.priorities, ["Evitar ganho de peso"]);
  assert.equal(report.sections.length, 1);
});

test("resumo para compartilhar nunca passa do limite", () => {
  const s = session({ relato: "palavra ".repeat(600), known_diagnoses: ["depression", "anxiety"] });
  const { parts, review } = outputsFor(s);
  const text = reportText(buildDoctorReport(kb, s, parts, review, new Date("2026-10-27T12:00:00Z")));
  assert.ok(text.length <= SHARE_LIMIT, `${text.length} caracteres`);
  assert.match(text, /resumo cortado/);
});

test("códigos curtos de fonte", () => {
  assert.equal(shortCite(kb, { source: "nice-ng222", locator: "recomendação 1.4.23" }), "NICE NG222, recomendação 1.4.23");
  assert.equal(shortCite(kb, { source: "label-fluoxetina", locator: "seção 5.2" }), "Bula FDA (fluoxetina), seção 5.2");
});

test("arquivo exportado traz soma de verificação das respostas", async () => {
  const s = session({ relato: "texto" });
  const exported = JSON.parse(await exportSession(s, kb, new Date("2026-10-27T12:00:00Z")));
  assert.equal(exported.schema, "stabilis.patient-session");
  const expected = createHash("sha256").update(JSON.stringify(exported.data)).digest("hex");
  assert.equal(exported.checksum, `sha256:${expected}`);
  assert.equal(exported.data.relato, "texto");
});

test("só questionários com todos os textos verificados entram no fluxo", () => {
  for (const instrument of questionnaires(kb.data)) {
    assert.ok(instrument.items.every((i) => i.text_status === "verified" && i.text), instrument.id);
  }
});
