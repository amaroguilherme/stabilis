import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { compileLexicon, type CrisisLexiconSource } from "../safety/crisis.ts";
import { evaluate } from "./evaluate.ts";
import { checkInvariants } from "./invariants.ts";
import { scoreInstrument } from "./instruments.ts";
import { renderMessage } from "./messages.ts";
import { evaluatePredicate, type PredicateContext } from "./predicates.ts";
import type { EngineInput, EngineOutput, KnowledgeBase, KnowledgeBaseData, Profile, Tier } from "./types.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

const bundle = readJson(path.join(here, "../kb/kb.generated.json"));
const kb: KnowledgeBase = { data: bundle.data as KnowledgeBaseData, version: bundle.kb_version, hash: bundle.content_hash };
const crisisLexicon = compileLexicon(readJson(path.join(here, "../kb/crisis.generated.json")).data as CrisisLexiconSource);
const run = (input: EngineInput, base: KnowledgeBase = kb) => evaluate(base, input, { crisisLexicon });

const POSITIVE: Tier[] = ["first_line", "second_line", "alternative"];
const drugsOut = (out: EngineOutput) => out.tiers.flatMap((g) => g.drugs);
const tierOf = (out: EngineOutput, id: string) => out.tiers.find((g) => g.drugs.some((d) => d.drug_id === id))?.tier;
const resultOf = (out: EngineOutput, id: string) => drugsOut(out).find((d) => d.drug_id === id);

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    age: 35,
    sex_at_birth: "male",
    reproductive: { pregnant: null, breastfeeding: null, planning: null },
    conditions: [],
    habits: [],
    current_meds: [],
    ...overrides,
  };
}

// ── Unit tests ───────────────────────────────────────────────────────────────

test("predicados: valor desconhecido nunca satisfaz comparação", () => {
  const ctx = (p: Profile): PredicateContext => ({
    input: { mode: "patient", condition: null, profile: p },
    scores: {},
    derived: {},
    signals: { crisis_language: false, crisis_language_negated_only: false, bipolar_screen_negative: false },
    currentMeds: [],
  });
  const unknown = ctx(profile({ age: null, sex_at_birth: null }));
  assert.equal(evaluatePredicate({ profile: "age", op: "lt", value: 18 }, unknown), false);
  assert.equal(evaluatePredicate({ profile: "age", op: "gte", value: 65 }, unknown), false);
  assert.equal(evaluatePredicate({ profile: "sex_at_birth", op: "ne", value: "male" }, unknown), false);
  assert.equal(evaluatePredicate({ not: { profile: "age", op: "exists" } }, unknown), true);
  assert.equal(evaluatePredicate({ profile: "age", op: "between", value: [12, 55] }, ctx(profile({ age: 55 }))), true);
});

test("PHQ-9: total, faixa e sinalizadores; respostas incompletas ou inválidas não pontuam", () => {
  const phq9 = kb.data.instruments.find((i) => i.id === "phq9");
  assert.ok(phq9);
  const answers = Object.fromEntries(phq9.items.map((item, i) => [item.id, i === 8 ? 1 : 2]));
  const scored = scoreInstrument(phq9, answers);
  assert.equal(scored.total, 17);
  assert.equal(scored.band, "moderately_severe");
  assert.deepEqual([...scored.flags].sort(), ["item9_positive", "nice_more_severe"]);

  const partial = { ...answers };
  delete partial.phq9_9;
  assert.equal(scoreInstrument(phq9, partial).answered, false);
  assert.equal(scoreInstrument(phq9, { ...answers, phq9_1: 4 }).answered, false);
});

test("mensagens: texto leigo cai no clínico e os parâmetros são preenchidos", () => {
  const clinicalOnly = Object.entries(kb.data.messages).find(([, m]) => m.plain === undefined);
  assert.ok(clinicalOnly, "a base deveria ter ao menos uma mensagem só clínica");
  assert.equal(renderMessage(kb.data, { key: clinicalOnly[0], params: {} }, "plain"), clinicalOnly[1].clinical);
  const text = renderMessage(kb.data, { key: "alert.teratogenic", params: { drug: "Valproato" } }, "plain");
  assert.match(text, /^Valproato /);
  assert.equal(renderMessage(kb.data, { key: "chave.inexistente", params: {} }, "plain"), "chave.inexistente");
});

test("potencial de gravidez: dado ausente é tratado com cautela", () => {
  const derived = (p: Partial<Profile>) => run({ mode: "professional", condition: null, profile: profile(p) }).derived;
  assert.equal(derived({ sex_at_birth: "male" }).childbearing_potential, false);
  assert.equal(derived({ sex_at_birth: "female", age: 60 }).childbearing_potential, false);
  assert.equal(derived({ sex_at_birth: "intersex", age: 30 }).childbearing_potential, true);
  assert.equal(derived({ sex_at_birth: "female", age: 30, reproductive: { pregnant: "no", breastfeeding: false, planning: false } }).pregnant_or_planning, false);
  assert.equal(derived({ sex_at_birth: "female", age: 30 }).pregnant_or_planning, true);
});

test("a entrada não é alterada e a saída é determinística", () => {
  const input: EngineInput = {
    mode: "professional",
    condition: { id: "bipolar_1", phase: "maintenance" },
    profile: profile({ sex_at_birth: "female", age: 33, current_meds: [{ drug_id: "litio", raw_text: "lítio 900", mg_per_day: 900 }] }),
    free_text: "nega ideação suicida",
  };
  const frozen = structuredClone(input);
  const first = run(input);
  assert.deepEqual(input, frozen);
  assert.deepEqual(run(input), first);
});

test("falha fechada: se uma regra de segurança some da base, os medicamentos são ocultados", () => {
  const broken: KnowledgeBase = {
    ...kb,
    data: { ...kb.data, rules: kb.data.rules.filter((r) => r.id !== "SR-GATE-CRISIS" && r.id !== "SR-GATE-BIPOLAR-SCREEN") },
  };
  const out = run({ mode: "patient", condition: { id: "gad" }, profile: profile(), free_text: "quero morrer" }, broken);
  assert.equal(out.fail_closed, true);
  assert.ok(out.violations.some((v) => v.startsWith("INV-01")));
  assert.equal(drugsOut(out).length, 0);
  assert.equal(out.alerts[0].message.key, "alert.fail_closed");
  assert.ok(out.tiers.every((g) => g.options.every((o) => o.kind !== "medication")));
});

test("falha fechada: teratogênico maior em linha recomendada é detectado", () => {
  const broken: KnowledgeBase = { ...kb, data: { ...kb.data, rules: kb.data.rules.filter((r) => r.id !== "SR-PREG-TERATOGEN" && r.id !== "SR-PREG-LACT-MOOD-STABILIZER") } };
  const out = run(
    { mode: "professional", condition: { id: "bipolar_1", phase: "mania" }, profile: profile({ sex_at_birth: "female", age: 30 }) },
    broken,
  );
  assert.equal(out.fail_closed, true);
  assert.ok(out.violations.some((v) => v.startsWith("INV-03")));
});

// ── Conformance vectors (knowledge/tests/engine/*.json) ──────────────────────

interface VectorCase {
  id: string;
  title: string;
  note?: string;
  input: Omit<EngineInput, "profile"> & { profile?: Partial<Profile> };
  expect: Record<string, unknown>;
}

const KNOWN_EXPECTATIONS = new Set([
  "fail_closed", "crisis", "derived", "tiers", "absent", "not_in_positive", "no_drugs", "in_use", "order",
  "drug_alerts", "drug_interactions", "no_drug_interactions", "alerts", "no_alerts", "referrals", "questions",
  "options", "no_options", "review", "interactions", "medications_excluded", "treatment",
]);

function checkCase(out: EngineOutput, expect: Record<string, unknown>) {
  for (const key of Object.keys(expect)) assert.ok(KNOWN_EXPECTATIONS.has(key), `expectativa desconhecida no vetor: ${key}`);
  const e = expect as Record<string, never>;
  assert.equal(out.fail_closed, e.fail_closed ?? false, `violações: ${out.violations.join("; ")}`);
  if (!e.fail_closed) assert.deepEqual(out.violations, []);

  if (e.crisis) assert.deepEqual(out.crisis, e.crisis);
  for (const [id, value] of Object.entries((e.derived ?? {}) as Record<string, boolean>)) assert.equal(out.derived[id], value, `derived.${id}`);
  for (const [id, tier] of Object.entries((e.tiers ?? {}) as Record<string, Tier>)) assert.equal(tierOf(out, id), tier, `linha de ${id}`);
  for (const id of (e.absent ?? []) as string[]) assert.equal(tierOf(out, id), undefined, `${id} deveria estar ausente`);
  for (const id of (e.not_in_positive ?? []) as string[]) {
    const tier = tierOf(out, id);
    assert.ok(tier === undefined || !POSITIVE.includes(tier), `${id} não deveria estar em linha recomendada (${tier})`);
  }
  if (e.no_drugs) assert.deepEqual(drugsOut(out).map((d) => d.drug_id), []);
  for (const id of (e.in_use ?? []) as string[]) assert.equal(resultOf(out, id)?.in_use, true, `${id} deveria estar em uso`);
  for (const [a, b] of (e.order ?? []) as [string, string][]) {
    const list = drugsOut(out).map((d) => d.drug_id);
    assert.equal(tierOf(out, a), tierOf(out, b), `${a} e ${b} deveriam estar na mesma linha`);
    assert.ok(list.indexOf(a) >= 0 && list.indexOf(a) < list.indexOf(b), `${a} deveria vir antes de ${b}`);
  }
  for (const [id, keys] of Object.entries((e.drug_alerts ?? {}) as Record<string, string[]>)) {
    const got = resultOf(out, id)?.alerts.map((a) => a.message.key) ?? [];
    for (const key of keys) assert.ok(got.includes(key), `${id} sem alerta ${key} (tem: ${got.join(", ")})`);
  }
  for (const [id, ids] of Object.entries((e.drug_interactions ?? {}) as Record<string, string[]>)) {
    const got = resultOf(out, id)?.interactions.map((i) => i.interaction_id) ?? [];
    for (const ix of ids) assert.ok(got.includes(ix), `${id} sem interação ${ix} (tem: ${got.join(", ")})`);
  }
  for (const [id, ids] of Object.entries((e.no_drug_interactions ?? {}) as Record<string, string[]>)) {
    const got = resultOf(out, id)?.interactions.map((i) => i.interaction_id) ?? [];
    for (const ix of ids) assert.ok(!got.includes(ix), `${id} não deveria ter ${ix}`);
  }
  const alertKeys = out.alerts.map((a) => a.message.key);
  for (const key of (e.alerts ?? []) as string[]) assert.ok(alertKeys.includes(key), `alerta ausente: ${key} (tem: ${alertKeys.join(", ")})`);
  for (const key of (e.no_alerts ?? []) as string[]) assert.ok(!alertKeys.includes(key), `alerta inesperado: ${key}`);
  const referralKeys = out.referrals.map((r) => r.message.key);
  for (const key of (e.referrals ?? []) as string[]) assert.ok(referralKeys.includes(key), `encaminhamento ausente: ${key}`);
  const questionKeys = out.questions.map((q) => q.message.key);
  for (const key of (e.questions ?? []) as string[]) assert.ok(questionKeys.includes(key), `pergunta ausente: ${key} (tem: ${questionKeys.join(", ")})`);
  const optionIds = out.tiers.flatMap((g) => g.options.map((o) => o.option_id));
  for (const id of (e.options ?? []) as string[]) assert.ok(optionIds.includes(id), `opção ausente: ${id}`);
  for (const id of (e.no_options ?? []) as string[]) assert.ok(!optionIds.includes(id), `opção inesperada: ${id}`);
  for (const ix of (e.interactions ?? []) as string[]) {
    const got = out.interactions.map((i) => i.interaction_id);
    assert.ok(got.includes(ix), `interação ausente na revisão: ${ix} (tem: ${got.join(", ")})`);
  }
  if ("medications_excluded" in e) assert.deepEqual(out.medications_excluded, e.medications_excluded);
  for (const [i, expected] of ((e.review ?? []) as { raw_text: string; status?: string; dose_check?: string; alerts?: string[] }[]).entries()) {
    const item = out.medication_review[i];
    assert.ok(item, `item ${i} da revisão ausente`);
    assert.equal(item.raw_text, expected.raw_text);
    if (expected.status) assert.equal(item.status, expected.status, `status de ${expected.raw_text}`);
    if (expected.dose_check) assert.equal(item.dose_check, expected.dose_check, `dose de ${expected.raw_text}`);
    const got = item.alerts.map((a) => a.message.key);
    for (const key of expected.alerts ?? []) assert.ok(got.includes(key), `${expected.raw_text} sem alerta ${key} (tem: ${got.join(", ")})`);
  }
  for (const [i, expected] of ((e.treatment ?? []) as { raw_text: string; status: string; dose_basis?: string | null; steps?: string[] }[]).entries()) {
    const item = out.treatment_review[i];
    assert.ok(item, `item ${i} da revisão de tratamento ausente`);
    assert.equal(item.raw_text, expected.raw_text);
    assert.equal(item.status, expected.status, `situação de ${expected.raw_text}`);
    if ("dose_basis" in expected) assert.equal(item.dose_basis, expected.dose_basis, `origem da dose mínima de ${expected.raw_text}`);
    if (expected.steps) assert.deepEqual(item.steps.map((s) => s.origin), expected.steps, `próximos passos de ${expected.raw_text}`);
  }
}

const vectorDir = path.join(root, "knowledge/tests/engine");
for (const file of readdirSync(vectorDir).filter((f) => f.endsWith(".json")).sort()) {
  const doc = readJson(path.join(vectorDir, file)) as { profile_defaults: Profile; cases: VectorCase[] };
  for (const c of doc.cases) {
    test(`vetor ${file.replace(".json", "")} ${c.id}: ${c.title}`, () => {
      const p = c.input.profile ?? {};
      const input: EngineInput = {
        ...c.input,
        profile: { ...doc.profile_defaults, ...p, reproductive: p.reproductive ?? doc.profile_defaults.reproductive },
      };
      checkCase(run(input), c.expect);
    });
  }
}

// ── Seeded random profiles: invariants and determinism ───────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEXTS = [
  "",
  "ando muito triste e sem energia",
  "quero morrer",
  "nega ideação suicida",
  "Pcte refere insônia, nega IS, nega planos.",
  "tenho vontade de me machucar às vezes",
  "morrendo de rir com meus filhos",
  "ideação passiva de morte",
];

function randomInput(rand: () => number): EngineInput {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
  const some = <T,>(items: readonly T[], p: number): T[] => items.filter(() => rand() < p);
  const data = kb.data;
  const vocabCondition = rand() < 0.1 ? null : pick(data.vocab.conditions.conditions);
  const phase = vocabCondition && vocabCondition.phases.length > 0 && rand() < 0.9 ? pick(vocabCondition.phases).id : null;
  const sex = pick(["female", "male", "intersex", null] as const);
  const meds = Array.from({ length: Math.floor(rand() * 4) }, () =>
    rand() < 0.1 ? { drug_id: null, raw_text: "remédio desconhecido" } : (() => {
      const drug = pick(data.drugs);
      return { drug_id: drug.id, raw_text: drug.names.display_pt, mg_per_day: rand() < 0.7 ? Math.round(rand() * 1000) : null };
    })(),
  );
  const instruments: EngineInput["instruments"] = {};
  for (const instrument of data.instruments) {
    if (rand() < 0.5) {
      instrument.items.forEach((item) => {
        if (rand() < 0.95) (instruments[instrument.id] ??= {})[item.id] = pick((item.options ?? instrument.options).map((o) => o.value));
      });
    }
  }
  return {
    mode: rand() < 0.5 ? "patient" : "professional",
    condition: vocabCondition ? { id: vocabCondition.id, phase } : null,
    profile: {
      age: rand() < 0.05 ? null : 10 + Math.floor(rand() * 85),
      sex_at_birth: sex,
      reproductive: {
        pregnant: pick(["yes", "no", "unsure", null] as const),
        breastfeeding: pick([true, false, null]),
        planning: pick([true, false, null]),
      },
      conditions: some(data.vocab.comorbidities.comorbidities.map((c) => c.id), 0.12),
      habits: some(data.vocab.comorbidities.habits.map((h) => h.id), 0.25),
      severity: pick(["less_severe", "more_severe", null] as const),
      suicide_risk_assessed: pick([true, false, null]),
      current_meds: meds,
    },
    instruments,
    free_text: pick(TEXTS),
    concerns: some(["weight_gain_significant", "sedation_significant", "sexual_dysfunction", "prolactin_elevation"], 0.3),
    // Treatments already tried, with the numbers the person reports (dose, months): never a "score".
    history: Array.from({ length: Math.floor(rand() * 3) }, () => {
      const drug = rand() < 0.1 ? null : pick(data.drugs);
      return {
        drug_id: drug?.id ?? null,
        raw_text: drug?.names.display_pt ?? "remédio antigo",
        still_using: pick([true, false, null]),
        mg_per_day: rand() < 0.7 ? Math.round(rand() * 600) / 2 : null,
        duration_months: rand() < 0.8 ? pick([0.25, 0.5, 1, 2, 3, 6, 12, 24]) : null,
        response: pick(["good", "partial", "none", "unknown", null] as const),
        side_effects: [],
        stop_reason: null,
      };
    }),
  };
}

test("5.000 perfis aleatórios com semente: nenhuma invariante violada e saída determinística", () => {
  const rand = mulberry32(20261027);
  let withDrugs = 0;
  for (let i = 0; i < 5000; i++) {
    const input = randomInput(rand);
    const out = run(input);
    assert.deepEqual(out.violations, [], `perfil ${i}: ${JSON.stringify(input)}`);
    assert.deepEqual(checkInvariants(kb, input, out), []);
    if (i % 10 === 0) assert.deepEqual(run(input), out, `perfil ${i} não determinístico`);
    if (drugsOut(out).length > 0) withDrugs++;
  }
  // The sample must exercise the medication paths, not only gates.
  assert.ok(withDrugs > 500, `poucos perfis com medicamentos: ${withDrugs}`);
});

test("todo texto que o modo paciente pode mostrar tem versão em linguagem simples", () => {
  const keys = new Set<string>();
  for (const rule of kb.data.rules) if (rule.modes.includes("patient")) for (const a of rule.then) if ("message_key" in a) keys.add(a.message_key);
  for (const c of kb.data.conditions) for (const o of c.options) if (o.modes.includes("patient")) keys.add(o.text_key);
  for (const ix of kb.data.interactions) keys.add(ix.message_key);
  for (const key of ["alert.missing_profile", "alert.unrecognized_med", "alert.dose_above_max", "alert.dose_above_usual", "alert.dose_below_usual", "alert.fail_closed"]) keys.add(key);
  const missing = [...keys].filter((k) => !kb.data.messages[k]?.plain);
  assert.deepEqual(missing, []);
});
