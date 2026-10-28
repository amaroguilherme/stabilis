import { renderMessage, type Variant } from "@/app/lib/engine/messages";
import type { KnowledgeBaseData, TreatmentReviewItem, TrialStatus } from "@/app/lib/engine/types";
import type { Labels } from "@/app/lib/kb/labels";
import SourceRefs from "./SourceRefs";

const STATUS: Record<TrialStatus, { clinical: string; plain: string; style: string }> = {
  adequate: { clinical: "Tentativa adequada", plain: "Tempo e dose suficientes para avaliar", style: "bg-emerald-100 text-emerald-900" },
  low_dose: { clinical: "Dose abaixo da mínima eficaz", plain: "Dose menor que a dose mínima de referência", style: "bg-amber-100 text-amber-900" },
  short_duration: { clinical: "Tempo curto para avaliar", plain: "Pouco tempo para saber se funciona", style: "bg-amber-100 text-amber-900" },
  beyond_recommended: { clinical: "Uso além do tempo recomendado", plain: "Uso por mais tempo do que o recomendado", style: "bg-rose-100 text-rose-900" },
  within_recommended: { clinical: "Dentro do tempo recomendado", plain: "Dentro do tempo recomendado", style: "bg-emerald-100 text-emerald-900" },
  unknown: { clinical: "Dose ou tempo não informados", plain: "Faltou informar a dose ou o tempo", style: "bg-slate-100 text-slate-800" },
  no_criteria: { clinical: "Sem critério de tentativa na base", plain: "Sem critério para avaliar este remédio", style: "bg-slate-100 text-slate-800" },
};

const RESPONSE = { good: "ajudou", partial: "ajudou um pouco", none: "não ajudou", unknown: "resposta não sabida" } as const;

export default function TreatmentReview({
  items,
  kb,
  labels,
  variant,
}: {
  items: TreatmentReviewItem[];
  kb: KnowledgeBaseData;
  labels: Labels;
  variant: Variant;
}) {
  if (items.length === 0) return null;
  const plain = variant === "plain";
  const size = plain ? "base" : "xs";
  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const status = STATUS[item.status];
        const name = item.drug_id ? labels.drugName(item.drug_id) : item.raw_text;
        const facts = [
          item.mg_per_day !== null ? `${item.mg_per_day.toLocaleString("pt-BR")} mg/dia` : null,
          item.min_mg_per_day !== null
            ? `${plain ? (item.dose_basis === "label" ? "dose mínima usual na bula" : "dose mínima de referência") : item.dose_basis === "label" ? "mínima usual (bula)" : "mínima eficaz (diretriz)"}: ${item.min_mg_per_day.toLocaleString("pt-BR")} mg/dia`
            : null,
          item.weeks !== null ? `${item.weeks} semanas` : null,
          item.min_weeks !== null ? `${plain ? "tempo mínimo para avaliar" : "mínimo"}: ${item.min_weeks} semanas` : null,
          item.max_weeks !== null ? `${plain ? "uso recomendado até" : "máximo recomendado"}: ${item.max_weeks} semanas` : null,
          item.response ? RESPONSE[item.response] : null,
        ].filter(Boolean);
        return (
          <li key={`${item.raw_text}-${i}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm break-inside-avoid">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className={`font-semibold text-slate-900 ${plain ? "text-lg" : ""}`}>{name}</p>
              <span className={`rounded-full px-2 py-0.5 ${plain ? "text-sm" : "text-xs"} font-medium ${status.style}`}>{plain ? status.plain : status.clinical}</span>
            </div>
            {facts.length > 0 && <p className={`mt-1 ${plain ? "text-base" : "text-sm"} text-slate-700`}>{facts.join(" · ")}</p>}
            {item.steps.length > 0 && (
              <ul className={`mt-3 space-y-2 ${plain ? "text-base" : "text-sm"} text-slate-800`}>
                {item.steps.map((step) => (
                  <li key={step.origin}>
                    <p>{renderMessage(kb, step.message, variant)}</p>
                    <SourceRefs cites={step.sources} labels={labels} className="mt-1" size={size} collapse={plain ? "De onde vem esta orientação" : undefined} />
                  </li>
                ))}
              </ul>
            )}
            {item.sources.length > 0 && (
              <details className="mt-2">
                <summary className={`cursor-pointer ${plain ? "text-base" : "text-xs"} text-slate-700`}>De onde vêm os critérios</summary>
                <SourceRefs cites={item.sources} labels={labels} className="mt-1" size={size} />
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
