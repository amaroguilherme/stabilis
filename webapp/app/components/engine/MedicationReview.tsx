import { renderMessage, type Variant } from "@/app/lib/engine/messages";
import type { DoseCheck, EngineOutput, KnowledgeBaseData } from "@/app/lib/engine/types";
import type { Labels } from "@/app/lib/kb/labels";
import AlertList from "./AlertList";
import { DoseLine } from "./DrugCard";
import SourceRefs from "./SourceRefs";

const DOSE_LABELS: Record<DoseCheck, { text: string; style: string }> = {
  within_usual: { text: "Dentro da faixa usual da bula", style: "bg-emerald-100 text-emerald-800" },
  below_usual: { text: "Abaixo da faixa usual", style: "bg-amber-100 text-amber-900" },
  above_usual: { text: "Acima da faixa usual", style: "bg-amber-100 text-amber-900" },
  above_max: { text: "Acima da dose máxima", style: "bg-rose-100 text-rose-900" },
  no_label_data: { text: "Sem faixa de dose na bula de referência", style: "bg-slate-100 text-slate-700" },
  no_dose_informed: { text: "Dose não informada", style: "bg-slate-100 text-slate-700" },
};

const SEVERITY_LABELS = { contraindicated: "Contraindicado", major: "Grave", warning: "Atenção", info: "Nota" } as const;

export default function MedicationReview({
  output,
  kb,
  labels,
  variant,
}: {
  output: EngineOutput;
  kb: KnowledgeBaseData;
  labels: Labels;
  variant: Variant;
}) {
  if (output.medication_review.length === 0) return null;
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {output.medication_review.map((item, i) => {
          const drug = item.drug_id ? labels.drug(item.drug_id) : undefined;
          const dose = DOSE_LABELS[item.dose_check];
          return (
            <li key={`${item.raw_text}-${i}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm break-inside-avoid">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{drug ? drug.names.display_pt : item.raw_text}</p>
                  <p className="text-xs text-slate-600">
                    Informado: “{item.raw_text}”{drug ? ` · ${labels.drugClass(drug)}` : ""}
                  </p>
                </div>
                {item.status === "recognized" ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dose.style}`}>{dose.text}</span>
                ) : (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-900">Não reconhecido</span>
                )}
              </div>
              <div className="mt-3 space-y-3">
                <AlertList alerts={item.alerts} kb={kb} labels={labels} variant={variant} compact />
                {drug && item.dose_check !== "no_label_data" && <DoseLine drug={drug} labels={labels} />}
                {item.monitoring.length > 0 && (
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">Monitoramento: </span>
                    {item.monitoring.map((m) => labels.monitoring(m.id)).join(" · ")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {output.interactions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Interações entre os medicamentos em uso</h4>
          <ul className="mt-2 space-y-2">
            {output.interactions.map((ix, i) => (
              <li
                key={`${ix.interaction_id}-${i}`}
                role={ix.severity === "contraindicated" ? "alert" : undefined}
                className={`rounded-lg border px-3 py-2 text-sm ${ix.severity === "contraindicated" ? "border-rose-300 bg-rose-50" : ix.severity === "info" ? "border-slate-200 bg-white" : "border-amber-300 bg-amber-50"}`}
              >
                <p>
                  <span className="font-semibold">{SEVERITY_LABELS[ix.severity]}: </span>
                  {renderMessage(kb, ix.message, variant)}
                </p>
                <SourceRefs cites={ix.sources} labels={labels} className="mt-1" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
