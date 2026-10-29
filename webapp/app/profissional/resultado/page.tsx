"use client";

import Link from "next/link";
import { useMemo } from "react";
import EngineResult from "@/app/components/engine/EngineResult";
import TreatmentReview from "@/app/components/engine/TreatmentReview";
import { evaluate } from "@/app/lib/engine/evaluate";
import { knowledgeBase } from "@/app/lib/kb";
import { createLabels } from "@/app/lib/kb/labels";
import { BAND_LABELS } from "@/app/lib/patient/report";
import { professionalCase, type ProfessionalCase } from "@/app/lib/professional/store";
import { crisisLexicon } from "@/app/lib/safety/lexicon";

const kb = knowledgeBase.data;
const labels = createLabels(kb);
const SEX = { female: "feminino", male: "masculino", intersex: "intersexo" } as const;

function Summary({ saved }: { saved: ProfessionalCase }) {
  const { profile, condition } = saved.input;
  const items = [
    profile.age !== null ? `${profile.age} anos` : "idade não informada",
    profile.sex_at_birth ? `sexo ao nascer ${SEX[profile.sex_at_birth]}` : "sexo ao nascer não informado",
    saved.gender_identity ? `identidade de gênero: ${saved.gender_identity}` : null,
    profile.reproductive.pregnant === "yes" ? "gestante" : profile.reproductive.pregnant === "unsure" ? "gravidez possível" : null,
    profile.reproductive.breastfeeding ? "amamentando" : null,
    ...profile.conditions.map(labels.comorbidity),
    ...profile.habits.map(labels.comorbidity),
  ].filter(Boolean);
  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-[10rem_1fr]">
      <dt className="font-medium text-slate-600">Condição</dt>
      <dd className="text-slate-900">
        {condition ? labels.condition(condition.id) : "—"}
        {condition?.phase ? ` · ${labels.phase(condition.id, condition.phase)}` : ""}
        {profile.severity ? ` · ${profile.severity === "more_severe" ? "mais grave" : "menos grave"}` : ""}
      </dd>
      <dt className="font-medium text-slate-600">Perfil</dt>
      <dd className="text-slate-900">{items.join(" · ")}</dd>
      <dt className="font-medium text-slate-600">Gerado em</dt>
      <dd className="text-slate-900">{new Date(saved.saved_at).toLocaleString("pt-BR")}</dd>
      <dt className="font-medium text-slate-600">Em uso</dt>
      <dd className="text-slate-900">
        {profile.current_meds.length === 0
          ? "nenhum informado"
          : profile.current_meds.map((m) => `${m.drug_id ? labels.drugName(m.drug_id) : m.raw_text}${m.mg_per_day ? ` ${m.mg_per_day} mg/dia` : ""}`).join(" · ")}
      </dd>
    </dl>
  );
}

function Result({ saved }: { saved: ProfessionalCase }) {
  const output = useMemo(() => evaluate(knowledgeBase, saved.input, { crisisLexicon }), [saved]);
  const answered = kb.instruments.filter((i) => output.scores[i.id]?.answered);
  return (
    <div className="space-y-6">
      <Summary saved={saved} />
      {answered.length > 0 && (
        <section aria-labelledby="questionarios" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          <h2 id="questionarios" className="font-semibold text-slate-900">Questionários respondidos pela pessoa</h2>
          <ul className="mt-2 space-y-1 text-slate-800">
            {answered.map((i) => {
              const r = output.scores[i.id];
              return (
                <li key={i.id}>
                  {i.name}: {r.total !== null && i.scoring.type === "sum" ? `${r.total} pontos, ` : ""}
                  {r.band ? (BAND_LABELS[r.band] ?? r.band) : ""}
                  {r.flags.length > 0 ? ` (${r.flags.join(", ")})` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <EngineResult output={output} kb={kb} labels={labels} variant="clinical" />
      {output.treatment_review.length > 0 && (
        <section aria-labelledby="revisao" className="space-y-3">
          <h2 id="revisao" className="text-lg font-semibold text-slate-900">Revisão dos tratamentos anteriores</h2>
          <TreatmentReview items={output.treatment_review} kb={kb} labels={labels} variant="clinical" />
        </section>
      )}
    </div>
  );
}

export default function ProfessionalResultPage() {
  const stored = professionalCase.useValue();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-indigo-700">Modo profissional · experimental e não comercial</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Opções por diretriz</h1>
          <p className="mt-1 text-sm text-slate-600">Ordenado por linha da diretriz; não é uma nota nem uma prescrição.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Link href="/profissional" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
            Editar dados
          </Link>
          <button type="button" onClick={() => window.print()} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Imprimir
          </button>
        </div>
      </header>
      {stored.status === "loading" && <p aria-live="polite" className="text-sm text-slate-600">Carregando…</p>}
      {stored.status === "missing" && (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          Nenhum caso nesta aba. <Link href="/profissional" className="font-medium text-indigo-700 underline">Preencher os dados</Link>
        </p>
      )}
      {stored.status === "ready" && <Result saved={stored.value} />}
      {stored.status === "ready" && (
        <div className="mt-8 print:hidden">
          <button
            type="button"
            onClick={() => professionalCase.clear()}
            className="text-sm text-slate-600 underline underline-offset-2 hover:text-rose-700"
          >
            Apagar este caso do navegador
          </button>
        </div>
      )}
    </div>
  );
}
