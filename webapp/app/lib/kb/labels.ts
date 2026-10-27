// Display names for ids of the knowledge base (drugs, classes, conditions, sources...).

import type { Drug, KnowledgeBaseData, Source, Tier } from "../engine/types.ts";

export const TIER_LABELS: Record<Tier, { title: string; description: string }> = {
  first_line: { title: "1ª linha", description: "Primeira escolha segundo as diretrizes citadas." },
  second_line: { title: "2ª linha", description: "Quando a 1ª linha não serve, não funcionou ou não é tolerada." },
  alternative: { title: "Alternativas", description: "Opções válidas em situações específicas." },
  not_recommended: { title: "Não recomendados pela diretriz", description: "A diretriz desaconselha para esta condição." },
  avoid_for_profile: { title: "Evitar neste perfil", description: "Indicados pela diretriz, mas com alerta forte para este perfil (veja os motivos)." },
};

export const SUS_LABELS: Record<NonNullable<Drug["sus"]>["component"], string> = {
  basico: "SUS: Componente Básico (UBS)",
  estrategico: "SUS: Componente Estratégico",
  especializado: "SUS: Componente Especializado (com PCDT)",
  nao_consta: "Não consta na RENAME",
};

export function createLabels(kb: KnowledgeBaseData) {
  const drugs = new Map(kb.drugs.map((d) => [d.id, d]));
  const sources = new Map(kb.sources.map((s) => [s.id, s]));
  const classes = new Map(kb.vocab.classes.classes.map((c) => [c.id, c]));
  const monitoring = new Map(kb.vocab.monitoring.monitoring.map((m) => [m.id, m.label_pt]));
  const conditions = new Map(kb.vocab.conditions.conditions.map((c) => [c.id, c]));
  const comorbidities = new Map([...kb.vocab.comorbidities.comorbidities, ...kb.vocab.comorbidities.habits].map((c) => [c.id, c]));
  const facts = new Map(kb.vocab.facts.facts.map((f) => [f.id, f.label_pt]));

  return {
    drug: (id: string): Drug | undefined => drugs.get(id),
    drugName: (id: string) => drugs.get(id)?.names.display_pt ?? id,
    drugClass(drug: Drug) {
      const cls = classes.get(drug.class);
      const sub = cls?.subclasses.find((s) => s.id === drug.subclass);
      return sub ? `${cls?.label_pt} · ${sub.label_pt}` : (cls?.label_pt ?? drug.class);
    },
    source: (id: string): Source | undefined => sources.get(id),
    monitoring: (id: string) => monitoring.get(id) ?? id,
    fact: (id: string) => facts.get(id) ?? id,
    condition: (id: string) => conditions.get(id)?.label_clinical ?? id,
    phase: (conditionId: string, phaseId: string | null) =>
      phaseId ? (conditions.get(conditionId)?.phases.find((p) => p.id === phaseId)?.label_clinical ?? phaseId) : null,
    comorbidity: (id: string) => comorbidities.get(id)?.label_clinical ?? id,
  };
}

export type Labels = ReturnType<typeof createLabels>;
