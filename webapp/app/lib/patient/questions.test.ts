import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import type { KnowledgeBase, KnowledgeBaseData, MedEntry, Profile } from "../engine/types.ts";
import { compileLexicon, type CrisisLexiconSource } from "../safety/crisis.ts";
import { answerQuestion, detectTopic, drugsInQuestion } from "./questions.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(here, file), "utf8"));
const bundle = readJson("../kb/kb.generated.json");
const kb: KnowledgeBase = { data: bundle.data as KnowledgeBaseData, version: bundle.kb_version, hash: bundle.content_hash };
const lexicon = compileLexicon(readJson("../kb/crisis.generated.json").data as CrisisLexiconSource);
const profile: Profile = { age: 34, sex_at_birth: "female", reproductive: { pregnant: "no", breastfeeding: false, planning: false }, conditions: [], habits: [], current_meds: [] };
const ask = (question: string, meds: MedEntry[] = []) => answerQuestion(kb, question, { meds, profile, lexicon });

test("tópico e remédios da pergunta, inclusive por marca", () => {
  assert.equal(detectTopic("Quanto tempo demora pra fazer efeito?", 0), "time_to_work");
  assert.equal(detectTopic("dá muitos efeitos colaterais?", 0), "side_effects");
  assert.equal(detectTopic("posso tomar ibuprofeno e litio", 2), "interaction");
  assert.equal(detectTopic("posso dirigir?", 1), null);
  assert.deepEqual(drugsInQuestion(kb, "posso beber tomando Rivotril?"), ["clonazepam"]);
  assert.deepEqual(drugsInQuestion(kb, "e o lítio com ibuprofeno?").sort(), ["ibuprofeno", "litio"]);
});

test("álcool: só os alertas que o hábito acrescenta, com fonte", () => {
  const answer = ask("posso beber cerveja tomando clonazepam?");
  assert.equal(answer.kind, "answer");
  assert.equal(answer.topic, "alcohol");
  const [b] = answer.blocks;
  assert.equal(b.unknown, false);
  assert.ok(b.cites.length > 0);
  assert.ok(b.lines.every((line) => line.length > 20));
});

test("gravidez: alerta do valproato vem do motor, com fonte", () => {
  const answer = ask("posso tomar valproato se estiver grávida?");
  assert.equal(answer.topic, "pregnancy");
  assert.equal(answer.blocks[0].unknown, false);
  assert.ok(answer.blocks[0].cites.length > 0);
});

test("efeitos, exames, SUS e dose respondem com a base; sem a pergunta citar o remédio, usa a lista", () => {
  const effects = ask("quais os efeitos colaterais da sertralina?");
  assert.match(effects.blocks[0].lines[0], /^Os efeitos colaterais mais comuns, segundo a bula: /);
  const exams = ask("preciso fazer exame de sangue?", [{ drug_id: "litio", raw_text: "lítio", mg_per_day: 900 }]);
  assert.equal(exams.blocks[0].drug_ids[0], "litio");
  assert.equal(exams.blocks[0].unknown, false);
  assert.match(ask("tem sertralina no SUS?").blocks[0].lines[0], /Não está na lista nacional/);
  const dose = ask("qual a dose máxima de fluoxetina?");
  assert.match(dose.blocks[0].lines[0], /dose máxima 80 mg por dia/);
  assert.match(dose.blocks[0].lines[1], /não mude por conta própria/);
});

test("interação entre dois remédios citados, ou não sei sem fonte", () => {
  const answer = ask("posso tomar ibuprofeno com lítio?");
  assert.equal(answer.topic, "interaction");
  assert.equal(answer.blocks[0].unknown, false);
  assert.ok(answer.blocks[0].cites.length > 0);
});

test("palavras de crise: ajuda em vez de resposta; sem tópico ou sem remédio: não sei", () => {
  assert.equal(ask("quantos comprimidos de rivotril preciso tomar para morrer").kind, "crisis");
  assert.equal(ask("posso dirigir tomando sertralina?").kind, "unknown_topic");
  assert.equal(ask("posso beber?").kind, "no_drug");
  const listed = ask("posso beber?", [{ drug_id: "clonazepam", raw_text: "Rivotril", mg_per_day: 2 }]);
  assert.equal(listed.blocks[0].drug_ids[0], "clonazepam");
});

test("não ter alerta vira 'não sei', nunca 'é seguro'", () => {
  const answer = ask("posso beber tomando fluoxetina?");
  for (const b of answer.blocks) {
    if (b.unknown) assert.match(b.lines[0], /não quer dizer que seja seguro/);
  }
});
