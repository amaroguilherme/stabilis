// Pre-visit report for the doctor: what the person said in their own words, validated scores, what
// they take and already tried, what matters to them, the guideline options with their sources, the
// alerts and up to eight questions. Pure: same session and knowledge base, same report.

import { renderMessage } from "../engine/messages.ts";
import type { Cite, EngineOutput, KnowledgeBase, KnowledgeBaseData, MedEntry, Tier } from "../engine/types.ts";
import { KNOWN_DIAGNOSES, patientTreatmentReview, riskScreener, scores, screeningResult } from "./flow.ts";
import type { PatientSessionV1, TreatmentHistoryEntry } from "./store.ts";

export const MAX_QUESTIONS = 8;
export const SHARE_LIMIT = 3500;

const TIER_TITLES: Record<Tier, string> = {
  first_line: "1ª linha",
  second_line: "2ª linha",
  alternative: "Alternativas",
  not_recommended: "Não recomendados pela diretriz",
  avoid_for_profile: "Evitar neste perfil",
};

export const BAND_LABELS: Record<string, string> = {
  minimal: "mínimos",
  mild: "leves",
  moderate: "moderados",
  moderately_severe: "moderadamente graves",
  severe: "graves",
  positive: "positiva",
  negative: "negativa",
  high: "risco alto",
  low: "risco presente",
  none: "sem sinais de risco",
};

const SEX = { female: "feminino", male: "masculino", intersex: "intersexo" } as const;
const TRIAL_STATUS = {
  adequate: "tentativa adequada",
  low_dose: "dose abaixo da mínima eficaz",
  short_duration: "tempo curto para avaliar",
  beyond_recommended: "uso além do tempo recomendado",
  within_recommended: "dentro do tempo recomendado",
  unknown: "dose ou tempo não informados",
  no_criteria: null,
} as const;
const RESPONSE = { good: "ajudou", partial: "ajudou um pouco", none: "não ajudou", unknown: "não sabe" } as const;
const STOP = {
  side_effects: "efeitos colaterais",
  no_effect: "não fez efeito",
  cost: "custo",
  ran_out: "faltou o remédio",
  doctor_changed: "o médico trocou",
  felt_better: "melhorou",
  other: "outro motivo",
} as const;
export const PRIORITY_LABELS: Record<string, string> = {
  weight_gain_significant: "Evitar ganho de peso",
  sedation_significant: "Evitar sonolência durante o dia",
  sexual_dysfunction: "Evitar efeitos na vida sexual",
  prefer_sus: "Preferir remédios oferecidos pelo SUS",
  fewer_blood_tests: "Preferir tratamentos com menos exames de sangue",
};

const SOURCE_SHORT: Record<string, string> = {
  "nice-ng222": "NICE NG222",
  "nice-cg113": "NICE CG113",
  "nice-cg185": "NICE CG185",
  "canmat-mdd-2023": "CANMAT 2023",
  "canmat-isbd-2018": "CANMAT/ISBD 2018",
  "mhgap-ig-2-pt": "MI-mhGAP 2.0",
  "pcdt-tab-2016": "PCDT TAB 2016",
  "rename-2024": "RENAME 2024",
  "stabilis-escopo": "Política Stabilis",
};

/** A short code for a citation, e.g. "NICE NG222, recomendação 1.4.23" or "Bula FDA (fluoxetina), seção 5.2". */
export function shortCite(kb: KnowledgeBase, cite: Cite): string {
  if (cite.source.startsWith("label-")) {
    const drug = kb.data.drugs.find((d) => d.id === cite.source.slice(6));
    return `Bula FDA (${drug?.names.display_pt.toLowerCase() ?? cite.source.slice(6)}), ${cite.locator}`;
  }
  const source = kb.data.sources.find((s) => s.id === cite.source);
  return `${SOURCE_SHORT[cite.source] ?? source?.title ?? cite.source}, ${cite.locator}`;
}

export interface DoctorReport {
  generated_at: string;
  kb: { version: string; hash: string };
  complaint: string;
  person: string[];
  known_diagnoses: string[];
  screening: string;
  crisis: boolean;
  scores: { name: string; text: string }[];
  current_meds: string[];
  history: string[];
  priorities: string[];
  sections: { title: string; reason: string; tiers: { title: string; items: { text: string; sources: string[] }[] }[] }[];
  alerts: { level: string; text: string; sources: string[] }[];
  questions: string[];
}

function historyLine(kb: KnowledgeBase, entry: TreatmentHistoryEntry): string {
  const name = entry.drug_id ? (kb.data.drugs.find((d) => d.id === entry.drug_id)?.names.display_pt ?? entry.raw_text) : entry.raw_text;
  const effects = kb.data.vocab.effects.effects.filter((e) => entry.side_effects.includes(e.id)).map((e) => e.label_clinical.toLowerCase());
  return [
    name,
    entry.mg_per_day ? `${entry.mg_per_day.toLocaleString("pt-BR")} mg/dia` : null,
    entry.duration_months !== null ? `${entry.duration_months} ${entry.duration_months === 1 ? "mês" : "meses"}` : null,
    entry.still_using === true ? "em uso" : entry.still_using === false ? "parou" : null,
    entry.response ? RESPONSE[entry.response] : null,
    effects.length ? `efeitos: ${effects.join(", ")}` : null,
    entry.stop_reason ? `motivo da parada: ${STOP[entry.stop_reason]}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildDoctorReport(
  kb: KnowledgeBase,
  session: PatientSessionV1,
  outputs: { condition: string; reason: "known" | "scores"; output: EngineOutput }[],
  review: EngineOutput,
  now: Date,
): DoctorReport {
  const data = kb.data;
  const s = scores(data, session);
  const p = session.profile;
  const screener = riskScreener(data);
  const screen = screeningResult(data, session);
  const conditionLabel = (id: string) => data.vocab.conditions.conditions.find((c) => c.id === id)?.label_clinical ?? id;
  const comorbidity = (id: string) => [...data.vocab.comorbidities.comorbidities, ...data.vocab.comorbidities.habits].find((c) => c.id === id)?.label_clinical ?? id;

  const person = [
    p.age !== null ? `${p.age} anos` : "idade não informada",
    p.sex_at_birth ? `sexo ao nascer ${SEX[p.sex_at_birth]}` : "sexo ao nascer não informado",
    session.gender_identity ? `identidade de gênero: ${session.gender_identity}` : null,
    p.reproductive.pregnant === "yes" ? "gestante" : p.reproductive.pregnant === "unsure" ? "pode estar grávida" : null,
    p.reproductive.planning ? "planeja engravidar" : null,
    p.reproductive.breastfeeding ? "amamentando" : null,
    ...p.conditions.map(comorbidity),
    ...p.habits.map(comorbidity),
  ].filter((x): x is string => !!x);

  const scoreLines = data.instruments
    .filter((i) => i.scoring.type !== "risk_screener" && s[i.id]?.answered)
    .map((i) => {
      const r = s[i.id];
      const band = r.band ? BAND_LABELS[r.band] ?? r.band : "";
      const extra = i.id === "phq9" ? ` · item 9 (pensamentos de morte ou de se ferir): ${session.instruments.phq9?.phq9_9 ?? "-"}` : "";
      const total = r.total !== null && i.scoring.type === "sum" ? `${r.total} pontos, ` : "";
      return { name: i.name, text: `${total}${i.scoring.type === "mdq" || i.scoring.type === "any_positive" ? "triagem " : ""}${band}${extra}` };
    });
  const FALLBACK_NAMES: Record<string, string> = { phq9: "PHQ-9", gad7: "GAD-7", mdq: "Triagem de bipolaridade (MDQ)", bipolar_hx: "Perguntas sobre períodos de muita energia ou euforia", auditc: "AUDIT-C" };
  const skipped = session.skipped.map((id) => data.instruments.find((i) => i.id === id)?.name ?? FALLBACK_NAMES[id] ?? id).map((name) => ({ name, text: "não respondido" }));

  const crisis = outputs.some((o) => o.output.crisis.language) || review.crisis.language || (screen?.answered === true && screen.band !== "none");
  const reviewNames = new Map(data.drugs.map((d) => [d.id, d]));
  const currentMeds = session.current_meds.map((m) => medLine(data, m));

  const reportSections = outputs.map(({ condition, reason, output }) => ({
    title: conditionLabel(condition),
    reason: reason === "known" ? "diagnóstico informado pela pessoa" : "sugerido pelos questionários (não é diagnóstico)",
    tiers: output.tiers.map((group) => ({
      title: TIER_TITLES[group.tier],
      items: [
        ...group.options
          .filter((o) => o.kind !== "medication" || group.tier === "not_recommended")
          .map((o) => ({ text: renderMessage(data, o.message, "clinical") + (o.drug_ids.length && group.tier === "not_recommended" ? ` (${o.drug_ids.map((id) => reviewNames.get(id)?.names.display_pt ?? id).join(", ")})` : ""), sources: o.sources.map((c) => shortCite(kb, c)) })),
        ...(group.tier === "not_recommended"
          ? []
          : group.drugs.map((d) => ({
              text: `${reviewNames.get(d.drug_id)?.names.display_pt ?? d.drug_id}${d.in_use ? " (em uso)" : ""}`,
              sources: d.reasons.flatMap((r) => r.sources.map((c) => shortCite(kb, c))),
            }))),
      ],
    })),
  }));

  const treatmentReview = patientTreatmentReview(outputs, review);

  const seenAlerts = new Set<string>();
  const alerts = [...outputs.flatMap((o) => o.output.alerts), ...review.alerts, ...review.medication_review.flatMap((m) => m.alerts)]
    .map((a) => ({ level: a.level, text: renderMessage(data, a.message, "clinical"), sources: a.sources.map((c) => shortCite(kb, c)) }))
    .filter((a) => !seenAlerts.has(a.text) && !!seenAlerts.add(a.text));

  const seenQuestions = new Set<string>();
  const questions = [...outputs.flatMap((o) => o.output.questions), ...review.questions]
    .map((q) => renderMessage(data, q.message, "plain"))
    .filter((q) => !seenQuestions.has(q) && !!seenQuestions.add(q))
    .slice(0, MAX_QUESTIONS);

  return {
    generated_at: now.toISOString(),
    kb: { version: kb.version, hash: kb.hash },
    complaint: session.relato.trim(),
    person,
    known_diagnoses: session.known_diagnoses.map((id) => KNOWN_DIAGNOSES.find((k) => k.id === id)?.label ?? id),
    screening: !screener
      ? "triagem de risco indisponível"
      : !screen?.answered
        ? "triagem de risco não realizada"
        : `${screener.name}: ${BAND_LABELS[screen.band ?? "none"]}${session.screening.completed_at ? ` (${new Date(session.screening.completed_at).toLocaleDateString("pt-BR")})` : ""}`,
    crisis,
    scores: [...scoreLines, ...skipped],
    current_meds: currentMeds,
    history: session.history.map((h, i) => {
      const status = treatmentReview[i]?.status;
      const label = status ? TRIAL_STATUS[status] : null;
      return `${historyLine(kb, h)}${label ? ` · revisão: ${label}` : ""}`;
    }),
    priorities: session.priorities.map((id) => PRIORITY_LABELS[id] ?? id),
    sections: reportSections,
    alerts,
    questions,
  };
}

/** Plain-text version for sharing (WhatsApp limits long messages): never longer than SHARE_LIMIT. */
export function reportText(report: DoctorReport): string {
  const parts: string[] = [
    "RELATÓRIO PARA A CONSULTA (Stabilis — material educativo, não é diagnóstico nem prescrição)",
    `Pessoa: ${report.person.join(", ")}`,
  ];
  if (report.crisis) parts.push("ATENÇÃO: há sinais de risco de suicídio ou autolesão. Em risco imediato: SAMU 192; apoio emocional: CVV 188.");
  if (report.complaint) parts.push(`Nas palavras da pessoa: “${report.complaint}”`);
  if (report.scores.length) parts.push(`Questionários: ${report.scores.map((s) => `${s.name}: ${s.text}`).join("; ")}`);
  parts.push(`Triagem de risco: ${report.screening}`);
  if (report.current_meds.length) parts.push(`Em uso: ${report.current_meds.join("; ")}`);
  if (report.history.length) parts.push(`Já usou: ${report.history.join("; ")}`);
  if (report.priorities.length) parts.push(`Prioridades: ${report.priorities.join("; ")}`);
  for (const section of report.sections) {
    const tiers = section.tiers.map((t) => `${t.title}: ${t.items.map((i) => i.text).join(", ")}`).join(" | ");
    parts.push(`${section.title} (${section.reason}): ${tiers}`);
  }
  if (report.questions.length) parts.push(`Perguntas: ${report.questions.map((q, i) => `${i + 1}) ${q}`).join(" ")}`);
  parts.push(`Base de conhecimento v${report.kb.version}. Fontes e detalhes no relatório completo.`);
  const text = parts.join("\n\n");
  if (text.length <= SHARE_LIMIT) return text;
  const suffix = "…\n\n(resumo cortado: veja o relatório completo)";
  return `${text.slice(0, SHARE_LIMIT - suffix.length).trimEnd()}${suffix}`;
}

/** JSON for the patient → professional bridge: inputs only, with a SHA-256 checksum. */
/** A medicine in use as the reports show it: generic name (DCB), what the person typed, the daily dose. */
export function medLine(data: KnowledgeBaseData, med: MedEntry): string {
  const drug = med.drug_id ? data.drugs.find((d) => d.id === med.drug_id) : undefined;
  const dose = med.mg_per_day ? ` ${med.mg_per_day.toLocaleString("pt-BR")} mg/dia` : "";
  return drug ? `${drug.names.dcb} (informado: “${med.raw_text}”)${dose}` : `“${med.raw_text}” (não reconhecido)${dose}`;
}

export async function exportSession(session: PatientSessionV1, kb: KnowledgeBase, now: Date): Promise<string> {
  const data = {
    profile: session.profile,
    gender_identity: session.gender_identity,
    known_diagnoses: session.known_diagnoses,
    current_meds: session.current_meds,
    relato: session.relato,
    instruments: session.instruments,
    screening: session.screening,
    history: session.history,
    priorities: session.priorities,
  };
  const canonical = JSON.stringify(data);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const checksum = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return JSON.stringify({ schema: "stabilis.patient-session", version: 1, kb_version: kb.version, kb_hash: kb.hash, exported_at: now.toISOString(), data, checksum: `sha256:${checksum}` }, null, 2);
}
