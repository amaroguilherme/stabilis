import { renderMessage, type Variant } from "@/app/lib/engine/messages";
import type { EngineOutput, KnowledgeBaseData, OptionResult, TierGroup } from "@/app/lib/engine/types";
import { TIER_LABELS, type Labels } from "@/app/lib/kb/labels";
import AlertList from "./AlertList";
import DrugCard from "./DrugCard";
import MedicationReview from "./MedicationReview";
import SourceRefs from "./SourceRefs";

const KIND_LABELS: Record<OptionResult["kind"], string> = {
  psychotherapy: "Psicoterapia",
  self_care: "Autocuidado",
  referral: "Encaminhamento",
  medication: "Medicamentos",
};

function OptionCard({ option, kb, labels, variant }: { option: OptionResult; kb: KnowledgeBaseData; labels: Labels; variant: Variant }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm break-inside-avoid">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{KIND_LABELS[option.kind]}</p>
      <p className="mt-1 text-sm text-slate-800">{renderMessage(kb, option.message, variant)}</p>
      <SourceRefs cites={option.sources} labels={labels} className="mt-2" />
    </article>
  );
}

// "Not recommended" lists can be long (every antidepressant in bipolar I): one line per guideline
// statement, with the drugs it covers, instead of a card per drug. Alerts are expanded only for the
// drugs the person already takes.
function NotRecommended({ group, kb, labels, variant }: { group: TierGroup; kb: KnowledgeBaseData; labels: Labels; variant: Variant }) {
  return (
    <ul className="space-y-3">
      {group.options.map((option) => (
        <li key={option.option_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm break-inside-avoid">
          <p className="text-sm text-slate-800">{renderMessage(kb, option.message, variant)}</p>
          {option.drug_ids.length > 0 && (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-medium">Inclui: </span>
              {option.drug_ids.map((id) => {
                const result = group.drugs.find((d) => d.drug_id === id);
                return `${labels.drugName(id)}${result?.in_use ? " (em uso)" : ""}`;
              }).join(", ")}
            </p>
          )}
          <SourceRefs cites={option.sources} labels={labels} className="mt-2" />
          {group.drugs
            .filter((d) => option.drug_ids.includes(d.drug_id) && d.in_use)
            .map((d) => (
              <div key={d.drug_id} className="mt-3">
                <p className="text-xs font-semibold text-slate-700">{labels.drugName(d.drug_id)}</p>
                <AlertList alerts={d.alerts} kb={kb} labels={labels} variant={variant} compact />
              </div>
            ))}
        </li>
      ))}
    </ul>
  );
}

export default function EngineResult({
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
  const urgent = output.referrals.filter((r) => r.urgent);
  const otherReferrals = output.referrals.filter((r) => !r.urgent);
  return (
    <div className="space-y-8">
      {output.alerts.length > 0 && (
        <section aria-labelledby="alertas">
          <h3 id="alertas" className="sr-only">Alertas do caso</h3>
          <AlertList alerts={output.alerts} kb={kb} labels={labels} variant={variant} />
        </section>
      )}

      {urgent.length > 0 && (
        <section role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950">
          {urgent.map((r, i) => (
            <p key={i} className="font-medium">{renderMessage(kb, r.message, variant)}</p>
          ))}
        </section>
      )}

      {output.tiers.length === 0 && output.condition && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Nenhuma opção de tratamento para mostrar com estes dados. Veja os alertas acima.
        </p>
      )}

      {output.tiers.map((group) => (
        <section key={group.tier} aria-labelledby={`tier-${group.tier}`} className="space-y-3">
          <div>
            <h3 id={`tier-${group.tier}`} className="text-lg font-semibold text-slate-900">{TIER_LABELS[group.tier].title}</h3>
            <p className="text-sm text-slate-600">{TIER_LABELS[group.tier].description}</p>
          </div>
          {group.tier === "not_recommended" ? (
            <NotRecommended group={group} kb={kb} labels={labels} variant={variant} />
          ) : (
            <div className="grid gap-3">
              {group.options.filter((o) => o.kind !== "medication").map((option) => (
                <OptionCard key={option.option_id} option={option} kb={kb} labels={labels} variant={variant} />
              ))}
              {group.drugs.map((result) => (
                <DrugCard key={result.drug_id} result={result} kb={kb} labels={labels} variant={variant} />
              ))}
            </div>
          )}
        </section>
      ))}

      {output.medication_review.length > 0 && (
        <section aria-labelledby="em-uso" className="space-y-3">
          <h3 id="em-uso" className="text-lg font-semibold text-slate-900">Medicamentos em uso</h3>
          <MedicationReview output={output} kb={kb} labels={labels} variant={variant} />
        </section>
      )}

      {(output.questions.length > 0 || otherReferrals.length > 0) && (
        <section aria-labelledby="pontos" className="space-y-2">
          <h3 id="pontos" className="text-lg font-semibold text-slate-900">
            {variant === "clinical" ? "Pontos a definir com a pessoa" : "Perguntas para levar ao médico"}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
            {otherReferrals.map((r, i) => (
              <li key={`r${i}`}>{renderMessage(kb, r.message, variant)}</li>
            ))}
            {output.questions.map((q, i) => (
              <li key={`q${i}`}>{renderMessage(kb, q.message, variant)}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-slate-500">
        Base de conhecimento v{output.kb_version} ({output.kb_hash.replace("sha256:", "").slice(0, 12)}). Todo o conteúdo
        foi extraído de fontes públicas com citação literal e ainda está em rascunho: não passou por revisão clínica.
      </p>
    </div>
  );
}
