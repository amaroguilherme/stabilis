"use client";

import { renderMessage, type Variant } from "@/app/lib/engine/messages";
import type { Drug, DrugResult, KnowledgeBaseData, MonitoringItem } from "@/app/lib/engine/types";
import { SUS_LABELS, TIER_LABELS, type Labels } from "@/app/lib/kb/labels";
import { useSchedules } from "@/app/lib/kb/schedules";
import AlertList from "./AlertList";
import SourceRefs from "./SourceRefs";

function formatMg(value: number) {
  return value.toLocaleString("pt-BR");
}

export function DoseLine({ drug, labels, size = "xs" }: { drug: Drug; labels: Labels; size?: "xs" | "base" }) {
  const dose = drug.dose_adult;
  if (!dose) return <p className="text-sm text-slate-600">Bula de referência sem faixa de dose para esta indicação.</p>;
  const parts = [
    dose.start !== undefined ? `início ${formatMg(dose.start)} mg/dia` : null,
    dose.usual_min !== undefined && dose.usual_min === dose.usual_max
      ? `dose usual ${formatMg(dose.usual_min)} mg/dia`
      : dose.usual_min !== undefined || dose.usual_max !== undefined
        ? `faixa usual ${dose.usual_min !== undefined ? formatMg(dose.usual_min) : "?"}–${dose.usual_max !== undefined ? formatMg(dose.usual_max) : "?"} mg/dia`
        : null,
    dose.max !== undefined ? `máxima ${formatMg(dose.max)} mg/dia` : null,
  ].filter(Boolean);
  return (
    <div className="text-sm text-slate-700">
      <p>
        <span className="font-medium">Dose na bula</span>
        {dose.indication ? ` (${dose.indication})` : ""}: {parts.join(" · ")}
      </p>
      {dose.note && <p className="mt-1 text-xs text-slate-600">{dose.note}</p>}
      <SourceRefs cites={[dose.cite]} labels={labels} className="mt-1" size={size} />
    </div>
  );
}

/** How to start (titration) or stop (taper) the medicine, from the label or a guideline. */
export function Regimens({ drug, labels, size = "xs" }: { drug: Drug; labels: Labels; size?: "xs" | "base" }) {
  const loaded = useSchedules();
  const regimens = drug.titration ?? loaded?.[drug.id]?.titration ?? [];
  if (!regimens.length) return null;
  return (
    <div className="space-y-2 text-sm text-slate-700">
      {regimens.map((regimen) => (
        <div key={`${regimen.kind}-${regimen.indication}`}>
          <p>
            <span className="font-medium">{regimen.kind === "titration" ? "Titulação" : "Retirada gradual"}</span> · {regimen.indication}: {regimen.steps}
          </p>
          {regimen.note && <p className="mt-1 text-xs text-slate-600">{regimen.note}</p>}
          <SourceRefs cites={regimen.cites} labels={labels} className="mt-1" size={size} collapse="Fontes" />
        </div>
      ))}
    </div>
  );
}

/** Monitoring items with when to do each one, when a source gives the timing. */
export function MonitoringList({ drugId, items, labels, size = "xs" }: { drugId: string; items: MonitoringItem[]; labels: Labels; size?: "xs" | "base" }) {
  const loaded = useSchedules();
  return (
    <ul className="mt-1 space-y-1">
      {items.map((m) => {
        const schedule = m.schedule ?? loaded?.[drugId]?.schedules?.[m.id];
        return (
          <li key={m.id}>
            <span>• {labels.monitoring(m.id)}</span>
            {schedule && <span>: {schedule.text}</span>}
            {m.note && <span className="text-xs text-slate-600"> — {m.note}</span>}
            <SourceRefs cites={[m.cite, ...(schedule?.cites ?? [])]} labels={labels} className="ml-3" size={size} collapse="Fontes" />
          </li>
        );
      })}
    </ul>
  );
}

export default function DrugCard({
  result,
  kb,
  labels,
  variant,
}: {
  result: DrugResult;
  kb: KnowledgeBaseData;
  labels: Labels;
  variant: Variant;
}) {
  const drug = labels.drug(result.drug_id);
  if (!drug) return null;
  const moved = result.tier !== result.guideline_tier;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm break-inside-avoid">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{drug.names.display_pt}</h4>
          <p className="text-xs text-slate-600">
            {drug.names.dcb} · {labels.drugClass(drug)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {result.in_use && <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-800">Em uso</span>}
          {drug.sus && (
            <span
              title={drug.sus.component === "nao_consta" ? undefined : "Consta na RENAME; a disponibilidade varia por município."}
              className={`rounded-full px-2 py-0.5 font-medium ${drug.sus.component === "nao_consta" ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-800"}`}
            >
              {SUS_LABELS[drug.sus.component]}
            </span>
          )}
          {moved && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
              Diretriz: {TIER_LABELS[result.guideline_tier].title}
            </span>
          )}
        </div>
      </header>

      <div className="mt-3 space-y-3">
        <section aria-label="Motivos da diretriz" className="space-y-2">
          {result.reasons.map((reason) => (
            <div key={reason.option_id} className="text-sm text-slate-800">
              <p>
                {reason.kind === "guideline_caution" && <span className="font-semibold text-amber-800">Ressalva: </span>}
                {renderMessage(kb, reason.message, variant)}
              </p>
              <SourceRefs cites={reason.sources} labels={labels} className="mt-1" />
            </div>
          ))}
        </section>

        <AlertList alerts={result.alerts} kb={kb} labels={labels} variant={variant} compact />

        <DoseLine drug={drug} labels={labels} />
        <Regimens drug={drug} labels={labels} />

        {drug.common_effects && (
          <div className="text-sm text-slate-700">
            <p>
              <span className="font-medium">Efeitos adversos mais comuns na bula: </span>
              {kb.vocab.effects.effects.filter((e) => drug.common_effects?.effects.includes(e.id)).map((e) => (variant === "plain" ? e.label_plain : e.label_clinical).toLowerCase()).join(", ")}.
            </p>
            {drug.common_effects.note && <p className="mt-1 text-xs text-slate-600">{drug.common_effects.note}</p>}
            <SourceRefs cites={[drug.common_effects.cite]} labels={labels} className="mt-1" />
          </div>
        )}

        {result.monitoring.length > 0 && (
          <div className="text-sm text-slate-700">
            <p className="font-medium">Monitoramento</p>
            <MonitoringList drugId={result.drug_id} items={result.monitoring} labels={labels} />
          </div>
        )}

        {drug.sus?.note && <p className="text-xs text-slate-600">SUS: {drug.sus.note}</p>}
      </div>
    </article>
  );
}
