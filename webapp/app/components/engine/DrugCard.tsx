import { renderMessage, type Variant } from "@/app/lib/engine/messages";
import type { Drug, DrugResult, KnowledgeBaseData } from "@/app/lib/engine/types";
import { SUS_LABELS, TIER_LABELS, type Labels } from "@/app/lib/kb/labels";
import AlertList from "./AlertList";
import SourceRefs from "./SourceRefs";

function formatMg(value: number) {
  return value.toLocaleString("pt-BR");
}

export function DoseLine({ drug, labels }: { drug: Drug; labels: Labels }) {
  const dose = drug.dose_adult;
  if (!dose) return <p className="text-sm text-slate-600">Bula de referência sem faixa de dose para esta indicação.</p>;
  const parts = [
    dose.start !== undefined ? `início ${formatMg(dose.start)} mg/dia` : null,
    dose.usual_min !== undefined || dose.usual_max !== undefined
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
      <SourceRefs cites={[dose.cite]} labels={labels} className="mt-1" />
    </div>
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

        {result.monitoring.length > 0 && (
          <div className="text-sm text-slate-700">
            <p className="font-medium">Monitoramento indicado na bula</p>
            <ul className="mt-1 space-y-1">
              {result.monitoring.map((m) => (
                <li key={m.id}>
                  <span>• {labels.monitoring(m.id)}</span>
                  {m.note && <span className="text-xs text-slate-600"> — {m.note}</span>}
                  <SourceRefs cites={[m.cite]} labels={labels} className="ml-3" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {drug.sus?.note && <p className="text-xs text-slate-600">SUS: {drug.sus.note}</p>}
      </div>
    </article>
  );
}
