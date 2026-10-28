import Link from "next/link";
import AlertList from "@/app/components/engine/AlertList";
import SourceRefs from "@/app/components/engine/SourceRefs";
import { renderMessage } from "@/app/lib/engine/messages";
import type { DrugResult, EngineOutput, InstrumentResult, KnowledgeBaseData, OptionResult, Tier, TierGroup } from "@/app/lib/engine/types";
import type { Labels } from "@/app/lib/kb/labels";
import { MAX_QUESTIONS } from "@/app/lib/patient/report";

const TIER_TITLES: Record<Tier, { title: string; description: string }> = {
  first_line: { title: "Primeiras opções", description: "O que as diretrizes indicam primeiro para casos parecidos com o seu." },
  second_line: { title: "Se as primeiras não funcionarem", description: "Usadas quando as primeiras opções não ajudam ou não são bem toleradas." },
  alternative: { title: "Outras possibilidades", description: "Opções válidas em algumas situações." },
  not_recommended: { title: "Em geral não recomendados", description: "As diretrizes desaconselham para este problema." },
  avoid_for_profile: { title: "Pedem cuidado especial no seu caso", description: "Indicados pelas diretrizes, mas com um alerta importante para você. Veja o motivo." },
};

const SCORE_TEXT: Record<string, (r: InstrumentResult) => string> = {
  phq9: (r) => `Sintomas de depressão ${({ minimal: "mínimos", mild: "leves", moderate: "moderados", moderately_severe: "moderadamente graves", severe: "graves" } as Record<string, string>)[r.band ?? ""] ?? ""} (${r.total} de 27 pontos).`,
  gad7: (r) => `Sintomas de ansiedade ${({ minimal: "mínimos", mild: "leves", moderate: "moderados", severe: "graves" } as Record<string, string>)[r.band ?? ""] ?? ""} (${r.total} de 21 pontos).`,
  mdq: (r) => (r.band === "positive" ? "A triagem encontrou sinais que podem indicar transtorno bipolar. Isso precisa ser avaliado por um profissional." : "A triagem não encontrou sinais de transtorno bipolar."),
  auditc: (r) => (r.band === "positive" ? "O seu consumo de álcool merece atenção e vale conversar sobre ele na consulta." : "O questionário não indicou consumo de risco de álcool."),
};

export function ScoreSummary({ scores, kb }: { scores: Record<string, InstrumentResult>; kb: KnowledgeBaseData }) {
  const lines = kb.instruments.filter((i) => SCORE_TEXT[i.id] && scores[i.id]?.answered).map((i) => ({ name: i.name, text: SCORE_TEXT[i.id](scores[i.id]) }));
  if (!lines.length) return <p className="text-slate-700">Você não respondeu os questionários. Sem eles, mostramos menos opções.</p>;
  return (
    <ul className="space-y-2">
      {lines.map((l) => (
        <li key={l.name} className="rounded-xl bg-white px-4 py-3 shadow-sm">
          <span className="block text-sm text-slate-600">{l.name}</span>
          <span className="text-slate-900">{l.text}</span>
        </li>
      ))}
    </ul>
  );
}

function DrugItem({ result, kb, labels }: { result: DrugResult; kb: KnowledgeBaseData; labels: Labels }) {
  const drug = labels.drug(result.drug_id);
  if (!drug) return null;
  const effects = drug.common_effects ? kb.vocab.effects.effects.filter((e) => drug.common_effects?.effects.includes(e.id)) : [];
  const bloodTests = new Set(kb.vocab.monitoring.monitoring.filter((m) => m.blood_test).map((m) => m.id));
  const exams = result.monitoring.filter((m) => bloodTests.has(m.id) || m.id === "ecg");
  const sus = drug.sus?.component;
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <details>
        <summary className="flex min-h-14 cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-lg font-semibold text-slate-900">{drug.names.display_pt}</span>
          {result.in_use && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-sm text-indigo-800">você já usa</span>}
          {sus && sus !== "nao_consta" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-sm text-emerald-800">no SUS</span>}
          {result.alerts.some((a) => a.level !== "info") && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-900">tem alerta para você</span>}
          <span className="ml-auto text-sm text-indigo-700 underline">ver detalhes</span>
        </summary>
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 text-slate-800">
          <p className="text-sm text-slate-600">{labels.drugClass(drug)}</p>
          {result.alerts.length > 0 && (
            <div>
              <p className="font-medium">Cuidados no seu caso</p>
              <div className="mt-2">
                <AlertList alerts={result.alerts} kb={kb} labels={labels} variant="plain" compact />
              </div>
            </div>
          )}
          {effects.length > 0 && drug.common_effects && (
            <div>
              <p className="font-medium">Efeitos colaterais mais comuns (segundo a bula)</p>
              <p className="mt-1">{effects.map((e) => e.label_plain).join(", ")}.</p>
              <SourceRefs cites={[drug.common_effects.cite]} labels={labels} className="mt-1" size="base" />
            </div>
          )}
          {exams.length > 0 && (
            <p>
              <span className="font-medium">Exames durante o uso: </span>
              {exams.map((m) => labels.monitoring(m.id)).join("; ")}.
            </p>
          )}
          <p className="text-sm">
            {sus === undefined || sus === "nao_consta"
              ? "Não está na lista nacional de remédios do SUS (RENAME 2024)."
              : "Está na lista nacional de remédios do SUS (RENAME 2024). A disponibilidade varia por município: pergunte na UBS ou na farmácia do SUS."}
          </p>
          {drug.sus && <SourceRefs cites={[drug.sus.cite]} labels={labels} size="base" />}
        </div>
      </details>
    </li>
  );
}

function OptionBlock({ option, group, kb, labels }: { option: OptionResult; group: TierGroup; kb: KnowledgeBaseData; labels: Labels }) {
  const drugs = group.drugs.filter((d) => option.drug_ids.includes(d.drug_id));
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-slate-900">{renderMessage(kb, option.message, "plain")}</p>
      <SourceRefs cites={option.sources} labels={labels} className="mt-2" size="base" />
      {drugs.length > 0 && group.tier !== "not_recommended" && (
        <ul className="mt-3 space-y-2">
          {drugs.map((d) => <DrugItem key={d.drug_id} result={d} kb={kb} labels={labels} />)}
        </ul>
      )}
      {drugs.length > 0 && group.tier === "not_recommended" && (
        <p className="mt-2 text-slate-700">Inclui: {drugs.map((d) => labels.drugName(d.drug_id) + (d.in_use ? " (você já usa)" : "")).join(", ")}.</p>
      )}
    </article>
  );
}

export function SectionResult({ output, kb, labels }: { output: EngineOutput; kb: KnowledgeBaseData; labels: Labels }) {
  return (
    <div className="space-y-6">
      {output.tiers.map((group) => {
        // Drugs moved to "avoid" keep their guideline option as a reason; show them one by one.
        const orphan = group.drugs.filter((d) => !group.options.some((o) => o.drug_ids.includes(d.drug_id)));
        return (
          <section key={group.tier} aria-labelledby={`t-${group.tier}`}>
            <h3 id={`t-${group.tier}`} className="text-xl font-semibold text-slate-900">{TIER_TITLES[group.tier].title}</h3>
            <p className="text-slate-600">{TIER_TITLES[group.tier].description}</p>
            <div className="mt-3 space-y-3">
              {group.options.map((option) => <OptionBlock key={option.option_id} option={option} group={group} kb={kb} labels={labels} />)}
              {orphan.length > 0 && (
                <ul className="space-y-2">
                  {orphan.map((d) => <DrugItem key={d.drug_id} result={d} kb={kb} labels={labels} />)}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function Questions({ outputs, kb }: { outputs: EngineOutput[]; kb: KnowledgeBaseData }) {
  const seen = new Set<string>();
  const questions = outputs
    .flatMap((o) => o.questions)
    .map((q) => renderMessage(kb, q.message, "plain"))
    .filter((q) => !seen.has(q) && !!seen.add(q))
    .slice(0, MAX_QUESTIONS);
  if (!questions.length) return null;
  return (
    <ol className="list-decimal space-y-2 pl-6 text-slate-900">
      {questions.map((q) => <li key={q}>{q}</li>)}
    </ol>
  );
}

export function WhereToGo() {
  return (
    <ul className="space-y-3 text-slate-800">
      <li><strong>Unidade Básica de Saúde (UBS, “postinho”)</strong>: a porta de entrada do SUS. Leve o relatório e peça para conversar sobre saúde mental.</li>
      <li><strong>CAPS (Centro de Atenção Psicossocial)</strong>: para sofrimento intenso ou que não melhora. Muitos atendem sem encaminhamento; pergunte na UBS qual é o seu.</li>
      <li><strong>Crise ou risco imediato</strong>: SAMU <a href="tel:192" className="font-semibold underline">192</a>, UPA ou pronto-socorro. Apoio emocional 24 horas: CVV <a href="tel:188" className="font-semibold underline">188</a>.</li>
      <li><Link href="/ajuda-agora" className="text-indigo-700 underline">Mais formas de ajuda</Link></li>
    </ul>
  );
}
