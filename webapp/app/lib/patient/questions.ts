// Questions about a medicine, answered only from the knowledge base (POLICY §16): the person's
// question is matched to a topic and to the medicines it mentions (or the ones on their list), and
// the answer is what the base already says with sources: label facts, or the alerts the engine
// would add in that situation ("what if I drink?", "what if I get pregnant?"). Nothing is generated;
// without a cited answer the reply is "não sei". Crisis words get help, not an answer.

import { evaluate } from "../engine/evaluate.ts";
import { renderMessage } from "../engine/messages.ts";
import type { Alert, Cite, Drug, EngineInput, EngineOutput, KnowledgeBase, MedEntry, Profile } from "../engine/types.ts";
import type { DrugSchedules } from "../kb/schedules.ts";
import { buildMedIndex, normalizeName } from "../meds/search.ts";
import { detectCrisis, summarizeCrisis, type CompiledLexicon } from "../safety/crisis.ts";

export type Topic = "time_to_work" | "monitoring" | "alcohol" | "pregnancy" | "breastfeeding" | "side_effects" | "sus" | "dose" | "interaction";

export interface AnswerBlock {
  drug_ids: string[];
  title: string;
  lines: string[];
  cites: Cite[];
  unknown: boolean;
}

export interface QuestionAnswer {
  kind: "crisis" | "answer" | "unknown_topic" | "no_drug";
  topic: Topic | null;
  blocks: AnswerBlock[];
}

// Checked in this order: the first topic whose words appear wins ("fazer efeito" before "efeito").
const TOPICS: [Topic, string[]][] = [
  ["time_to_work", ["fazer efeito", "faz efeito", "comeca a funcionar", "comecar a funcionar", "quanto tempo", "demora"]],
  ["monitoring", ["exame", "exames", "sangue", "litemia"]],
  ["alcohol", ["alcool", "beber", "bebo", "bebi", "bebida", "bebidas", "cerveja", "vinho", "cachaca", "pinga", "drink", "whisky", "vodka"]],
  ["pregnancy", ["gravida", "gravidez", "gestante", "gestacao", "engravidar"]],
  ["breastfeeding", ["amamentar", "amamentando", "amamentacao", "leite materno", "lactante"]],
  ["side_effects", ["efeito colateral", "efeitos colaterais", "colateral", "colaterais", "reacao", "reacoes", "faz mal", "engorda", "engordar", "da sono", "efeitos"]],
  ["sus", ["sus", "ubs", "de graca", "gratis", "gratuito", "farmacia popular", "posto de saude"]],
  ["dose", ["dose", "dosagem", "quantos mg", "miligramas", "quanto posso tomar", "maximo", "maxima"]],
];
const TOPIC_TITLES: Record<Topic, string> = {
  time_to_work: "tempo para avaliar o efeito",
  monitoring: "exames",
  alcohol: "bebida alcoólica",
  pregnancy: "gravidez",
  breastfeeding: "amamentação",
  side_effects: "efeitos colaterais",
  sus: "SUS",
  dose: "dose",
  interaction: "usar junto",
};
const MAX_DRUGS = 5;
const MIN_NAME = 4;

const padded = (text: string) => ` ${normalizeName(text).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
const has = (question: string, word: string) => question.includes(` ${word} `);

export function detectTopic(question: string, drugCount: number): Topic | null {
  const q = padded(question);
  for (const [topic, words] of TOPICS) if (words.some((w) => has(q, w))) return topic;
  return drugCount >= 2 ? "interaction" : null;
}

/** Medicines named in the question (Portuguese name, DCB, aliases, ANVISA names or brands). */
export function drugsInQuestion(kb: KnowledgeBase, question: string, brands: Record<string, string[]> = kb.data.brands): string[] {
  const q = padded(question);
  const found: string[] = [];
  for (const entry of buildMedIndex(kb.data, brands)) {
    const key = padded(entry.key).trim();
    if (key.length >= MIN_NAME && has(q, key) && !found.includes(entry.drug_id)) found.push(entry.drug_id);
  }
  return found;
}

const alertKey = (a: Alert) => `${a.message.key}|${JSON.stringify(a.message.params)}`;

function run(kb: KnowledgeBase, profile: Profile, lexicon: CompiledLexicon): EngineOutput {
  const input: EngineInput = { mode: "patient", condition: null, profile };
  return evaluate(kb, input, { crisisLexicon: lexicon });
}

function drugAlerts(out: EngineOutput, drugId: string): Alert[] {
  return [...out.medication_review.filter((m) => m.drug_id === drugId).flatMap((m) => m.alerts), ...out.alerts.filter((a) => a.drug_id === drugId)];
}

/** Alerts the engine adds for this medicine only when the situation changes (the rest was already true). */
function whatIf(kb: KnowledgeBase, drug: Drug, base: Profile, change: (p: Profile) => Profile, lexicon: CompiledLexicon): Alert[] {
  const meds: MedEntry[] = [{ drug_id: drug.id, raw_text: drug.names.display_pt, mg_per_day: null }];
  const before = new Set(drugAlerts(run(kb, { ...base, current_meds: meds }, lexicon), drug.id).map(alertKey));
  const after = drugAlerts(run(kb, change({ ...base, current_meds: meds }), lexicon), drug.id);
  const seen = new Set<string>();
  return after.filter((a) => !before.has(alertKey(a)) && !seen.has(alertKey(a)) && !!seen.add(alertKey(a)));
}

function unknownBlock(drug: Drug, topic: Topic): AnswerBlock {
  return {
    drug_ids: [drug.id],
    title: `${drug.names.display_pt}: ${TOPIC_TITLES[topic]}`,
    lines: ["Não temos uma informação com fonte sobre isso. Isso não quer dizer que seja seguro: leve a pergunta ao médico ou ao farmacêutico."],
    cites: [],
    unknown: true,
  };
}

function block(drug: Drug, topic: Topic, lines: string[], cites: Cite[]): AnswerBlock {
  return lines.length ? { drug_ids: [drug.id], title: `${drug.names.display_pt}: ${TOPIC_TITLES[topic]}`, lines, cites, unknown: false } : unknownBlock(drug, topic);
}

function answerFor(kb: KnowledgeBase, drug: Drug, topic: Topic, base: Profile, lexicon: CompiledLexicon, schedules?: Record<string, DrugSchedules>): AnswerBlock {
  const data = kb.data;
  const fromAlerts = (alerts: Alert[]) => block(drug, topic, alerts.map((a) => renderMessage(data, a.message, "plain")), alerts.flatMap((a) => a.sources));
  // Only the difference between the two situations is shown, so a stand-in age or sex changes nothing.
  const filled = { ...base, age: base.age ?? 30, sex_at_birth: base.sex_at_birth ?? ("female" as const) };
  const adult = { ...filled, sex_at_birth: "female" as const };
  switch (topic) {
    case "alcohol":
      return fromAlerts(whatIf(kb, drug, { ...filled, habits: filled.habits.filter((h) => h !== "alcohol") }, (p) => ({ ...p, habits: [...p.habits, "alcohol"] }), lexicon));
    case "pregnancy":
      return fromAlerts(whatIf(kb, drug, { ...adult, reproductive: { pregnant: "no", breastfeeding: false, planning: false } }, (p) => ({ ...p, reproductive: { ...p.reproductive, pregnant: "yes" } }), lexicon));
    case "breastfeeding":
      return fromAlerts(whatIf(kb, drug, { ...adult, reproductive: { pregnant: "no", breastfeeding: false, planning: false } }, (p) => ({ ...p, reproductive: { ...p.reproductive, breastfeeding: true } }), lexicon));
    case "side_effects": {
      const effects = drug.common_effects ? data.vocab.effects.effects.filter((e) => drug.common_effects?.effects.includes(e.id)).map((e) => e.label_plain.toLowerCase()) : [];
      return block(drug, topic, effects.length ? [`Os efeitos colaterais mais comuns, segundo a bula: ${effects.join(", ")}.`] : [], drug.common_effects ? [drug.common_effects.cite] : []);
    }
    case "monitoring": {
      const items = drug.monitoring ?? [];
      const label = (id: string) => data.vocab.monitoring.monitoring.find((m) => m.id === id)?.label_pt ?? id;
      const timing = (id: string) => items.find((m) => m.id === id)?.schedule ?? schedules?.[drug.id]?.schedules?.[id];
      const lines = items.map((m) => `${label(m.id)}${timing(m.id) ? `: ${timing(m.id)!.text}` : "."}`);
      return block(drug, topic, lines.length ? ["Exames e cuidados durante o uso:", ...lines] : [], items.flatMap((m) => [m.cite, ...(timing(m.id)?.cites ?? [])]));
    }
    case "dose": {
      const d = drug.dose_adult;
      const parts = d
        ? [
            d.start ? `dose inicial ${d.start.toLocaleString("pt-BR")} mg por dia` : null,
            d.usual_min && d.usual_max ? `faixa usual de ${d.usual_min.toLocaleString("pt-BR")} a ${d.usual_max.toLocaleString("pt-BR")} mg por dia` : null,
            d.max ? `dose máxima ${d.max.toLocaleString("pt-BR")} mg por dia` : null,
          ].filter(Boolean)
        : [];
      const lines = parts.length ? [`Na bula${d?.indication ? ` (para ${d.indication.charAt(0).toLowerCase()}${d.indication.slice(1)})` : ""}: ${parts.join("; ")}.`, "A dose certa para você é a da sua receita: não mude por conta própria."] : [];
      return block(drug, topic, lines, d ? [d.cite] : []);
    }
    case "sus": {
      const sus = drug.sus;
      if (!sus) return unknownBlock(drug, topic);
      const line = sus.component === "nao_consta"
        ? "Não está na lista nacional de remédios do SUS (RENAME 2024)."
        : "Está na lista nacional de remédios do SUS (RENAME 2024). A disponibilidade varia por município: pergunte na UBS ou na farmácia do SUS.";
      return block(drug, topic, [line], sus.cite ? [sus.cite] : []);
    }
    case "time_to_work": {
      const conditionLabel = (id: string) => data.vocab.conditions.conditions.find((c) => c.id === id)?.label_plain ?? id;
      const trials = data.trials.filter((t) => "drug" in t.selector ? t.selector.drug === drug.id : "class" in t.selector && t.selector.class === drug.class && (!t.selector.subclass || t.selector.subclass === drug.subclass));
      const lines = trials.map((t) =>
        t.min_weeks !== undefined
          ? `${t.conditions ? `Para ${t.conditions.map(conditionLabel).join(" ou ").toLowerCase()}, as` : "As"} diretrizes usam pelo menos ${t.min_weeks} ${t.min_weeks === 1 ? "semana" : "semanas"} na dose indicada para saber se o remédio funciona.`
          : `É indicado só por pouco tempo: até ${t.max_weeks} semanas.`,
      );
      return block(drug, topic, [...new Set(lines)], trials.flatMap((t) => t.sources));
    }
    case "interaction":
      return unknownBlock(drug, topic);
  }
}

function interactionBlock(kb: KnowledgeBase, a: Drug, b: Drug, base: Profile, lexicon: CompiledLexicon): AnswerBlock {
  const meds: MedEntry[] = [a, b].map((d) => ({ drug_id: d.id, raw_text: d.names.display_pt, mg_per_day: null }));
  const found = run(kb, { ...base, current_meds: meds }, lexicon).interactions.filter((ix) => ix.drugs.includes(a.id) && ix.drugs.includes(b.id));
  const title = `${a.names.display_pt} e ${b.names.display_pt}: usar junto`;
  if (!found.length) {
    return { drug_ids: [a.id, b.id], title, lines: ["Não temos uma informação com fonte sobre usar estes dois juntos. Isso não quer dizer que seja seguro: pergunte ao farmacêutico ou ao médico."], cites: [], unknown: true };
  }
  return { drug_ids: [a.id, b.id], title, lines: found.map((ix) => renderMessage(kb.data, ix.message, "plain")), cites: found.flatMap((ix) => ix.sources), unknown: false };
}

export function answerQuestion(
  kb: KnowledgeBase,
  question: string,
  context: { meds: MedEntry[]; profile: Profile; lexicon: CompiledLexicon; brands?: Record<string, string[]>; schedules?: Record<string, DrugSchedules> },
): QuestionAnswer {
  if (summarizeCrisis(detectCrisis(question, context.lexicon, "patient")).crisis) return { kind: "crisis", topic: null, blocks: [] };
  const drugs = new Map(kb.data.drugs.map((d) => [d.id, d]));
  const named = drugsInQuestion(kb, question, context.brands);
  const listed = context.meds.map((m) => m.drug_id).filter((id): id is string => !!id && !named.includes(id));
  const topic = detectTopic(question, named.length);
  if (!topic) return { kind: "unknown_topic", topic: null, blocks: [] };
  const base: Profile = { ...context.profile, current_meds: [] };

  if (topic === "interaction") {
    const ids = named.slice(0, MAX_DRUGS);
    const pairs: [Drug, Drug][] = [];
    ids.forEach((a, i) => ids.slice(i + 1).forEach((b) => pairs.push([drugs.get(a)!, drugs.get(b)!])));
    return { kind: "answer", topic, blocks: pairs.map(([a, b]) => interactionBlock(kb, a, b, base, context.lexicon)) };
  }
  const targets = (named.length ? named : listed).slice(0, MAX_DRUGS).map((id) => drugs.get(id)).filter((d): d is Drug => !!d);
  if (!targets.length) return { kind: "no_drug", topic, blocks: [] };
  return { kind: "answer", topic, blocks: targets.map((drug) => answerFor(kb, drug, topic, base, context.lexicon, context.schedules)) };
}
