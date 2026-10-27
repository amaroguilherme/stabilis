import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { compileLexicon, detectCrisis, normalize, summarizeCrisis, type CrisisLexiconSource, type CrisisMode } from "./crisis.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

const canonical = readJson(path.join(root, "knowledge/lexicons/crisis.pt-BR.json")) as CrisisLexiconSource;
const lexicon = compileLexicon(canonical);
const { cases } = readJson(path.join(root, "knowledge/tests/crisis.vectors.json")) as {
  cases: { text: string; mode: CrisisMode; expect_hit: boolean; expect_negated_only?: boolean }[];
};

for (const c of cases) {
  test(`vetor ${c.mode}: ${c.text.slice(0, 40) || "<vazio>"}`, () => {
    const hits = detectCrisis(c.text, lexicon, c.mode);
    assert.equal(hits.length > 0, c.expect_hit);
    if (c.expect_hit) assert.equal(summarizeCrisis(hits).negated_only, c.expect_negated_only);
  });
}

test("o arquivo gerado para o webapp está igual ao léxico canônico", () => {
  const bundle = readJson(path.join(here, "../kb/crisis.generated.json"));
  assert.deepEqual(bundle.data, canonical);
});

test("normalize remove acentos, caixa e pontuação", () => {
  assert.equal(normalize("  Ideação SUICIDA!!  "), "ideacao suicida");
  assert.equal(normalize(""), "");
});

test("modo paciente nunca aplica negação", () => {
  const hits = detectCrisis("nega ideação suicida", lexicon, "patient");
  assert.ok(hits.length > 0 && hits.every((h) => !h.negated));
});
