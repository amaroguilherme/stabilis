"use client";

import Link from "next/link";
import { useState } from "react";
import SourceRefs from "@/app/components/engine/SourceRefs";
import type { SafetyPlan } from "@/app/lib/engine/types";
import { knowledgeBase } from "@/app/lib/kb";
import { createLabels } from "@/app/lib/kb/labels";
import planBundle from "@/app/lib/kb/safety_plan.client.generated.json";
import { addItem, deleteSafetyPlan, phoneParts, planItems, saveSafetyPlan, useSafetyPlan, type SafetyPlanDraft } from "@/app/lib/patient/safetyPlan";

// A personal safety plan for crises: the person writes each step in their own words (one item per
// line), reads it back with call links, and prints it. Steps, prompts and contacts come from the
// knowledge base, each with its sources. Not the Stanley-Brown form (see license_note).

const kb = knowledgeBase.data;
const labels = createLabels(kb);
// Generated apart from the rest of the knowledge base: only this page needs it.
const plan = planBundle.safety_plan as SafetyPlan | null;
const button = "min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300";
const secondary = "min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800 hover:border-indigo-400";

function Line({ text }: { text: string }) {
  return (
    <>
      {phoneParts(text).map((part, i) =>
        part.tel ? (
          <a key={i} href={`tel:${part.tel}`} className="font-semibold text-indigo-700 underline print:text-slate-900 print:no-underline">
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function Contacts() {
  if (!plan) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {plan.contacts.map((c) => (
        <li key={c.phone} className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
          <a href={`tel:${c.phone}`} className="text-lg font-semibold underline underline-offset-2">
            {c.label}: {c.phone}
          </a>
          <p className="mt-1 text-sm">{c.description}</p>
          <SourceRefs cites={c.sources} labels={labels} className="mt-1 print:hidden" size="base" collapse="De onde vem esta informação" />
        </li>
      ))}
    </ul>
  );
}

function ReadView({ draft }: { draft: SafetyPlanDraft | null }) {
  if (!plan) return null;
  return (
    <article aria-labelledby="plan-read" className="space-y-4">
      <h2 id="plan-read" className="sr-only text-xl font-semibold text-slate-900 print:not-sr-only">{plan.title}</h2>
      <ol className="space-y-4">
        {plan.steps.map((step, n) => {
          const items = planItems(draft?.answers[step.id]);
          return (
            <li key={step.id} className="break-inside-avoid rounded-xl border border-slate-200 bg-white p-4">
              <p className="font-semibold text-slate-900">
                {n + 1}. {step.title}
              </p>
              {items.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-6 text-slate-800">
                  {items.map((item) => (
                    <li key={item}>
                      <Line text={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-slate-600 print:min-h-16">Ainda em branco.</p>
              )}
            </li>
          );
        })}
      </ol>
      <section aria-label="Telefones para todo o Brasil" className="break-inside-avoid">
        <p className="mb-2 font-semibold text-slate-900">Telefones que funcionam em todo o Brasil</p>
        <Contacts />
      </section>
    </article>
  );
}

function Editor({ draft, storage }: { draft: SafetyPlanDraft | null; storage: SafetyPlanDraft["storage"] }) {
  if (!plan) return null;
  const save = (answers: Record<string, string>) => saveSafetyPlan({ storage, answers, updated_at: new Date().toISOString() });
  const answers = draft?.answers ?? {};
  return (
    <ol className="space-y-8">
      {plan.steps.map((step, n) => (
        <li key={step.id}>
          <section aria-labelledby={`step-${step.id}`}>
            <h2 id={`step-${step.id}`} className="text-lg font-semibold text-slate-900">
              {n + 1}. {step.title}
            </h2>
            <p id={`prompt-${step.id}`} className="mt-1 text-slate-700">{step.prompt}</p>
            <label htmlFor={`answer-${step.id}`} className="sr-only">{step.title}</label>
            <textarea
              id={`answer-${step.id}`}
              aria-describedby={`prompt-${step.id} hint-${step.id}`}
              rows={4}
              maxLength={2000}
              value={answers[step.id] ?? ""}
              onChange={(e) => save({ ...answers, [step.id]: e.target.value })}
              className="mt-3 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-200"
            />
            <p id={`hint-${step.id}`} className="text-sm text-slate-600">Escreva uma ideia por linha.</p>
            {step.examples && step.examples.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-slate-700">Ideias para começar (toque para adicionar):</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {step.examples.map((example) => (
                    <li key={example}>
                      <button
                        type="button"
                        onClick={() => save({ ...answers, [step.id]: addItem(answers[step.id], example) })}
                        className="min-h-11 rounded-full border border-slate-300 bg-white px-4 py-2 text-left text-sm text-slate-800 hover:border-indigo-400"
                      >
                        <span aria-hidden="true">+ </span>
                        {example}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <SourceRefs cites={step.sources} labels={labels} className="mt-2" size="base" collapse="De onde vem esta etapa" />
          </section>
        </li>
      ))}
    </ol>
  );
}

// Rendered once the stored plan is known, so the first view is decided once: reading when there is
// already a plan, writing otherwise (typing the first letter must not switch the view).
function PlanBody({ draft }: { draft: SafetyPlanDraft | null }) {
  const [view, setView] = useState<"edit" | "read">(() => (draft && Object.values(draft.answers).some((text) => planItems(text).length > 0) ? "read" : "edit"));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [chosenStorage, setChosenStorage] = useState<SafetyPlanDraft["storage"]>("session");
  const storage = draft?.storage ?? chosenStorage;

  function chooseStorage(next: SafetyPlanDraft["storage"]) {
    setChosenStorage(next);
    if (draft || next === "device") saveSafetyPlan({ storage: next, answers: draft?.answers ?? {}, updated_at: new Date().toISOString() });
  }

  return (
    <>
      <fieldset className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 print:hidden">
        <legend className="px-1 font-medium text-slate-900">Onde guardar o plano</legend>
        <div className="mt-2 grid gap-3">
          {(
            [
              ["session", "Só enquanto esta aba estiver aberta", "Some ao fechar a aba. Imprima ou salve como PDF para não perder."],
              ["device", "Guardar neste aparelho", "Para abrir de novo numa hora difícil. Quem usar este aparelho e este navegador poderá ver."],
            ] as const
          ).map(([value, title, hint]) => (
            <label key={value} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-4 ${storage === value ? "border-indigo-600 bg-indigo-50" : "border-slate-300"}`}>
              <input type="radio" name="plan-storage" checked={storage === value} onChange={() => chooseStorage(value)} className="mt-1 h-5 w-5 accent-indigo-600" />
              <span>
                <span className="font-medium">{title}</span>
                <span className="block text-sm text-slate-600">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div role="group" aria-label="Modo" className="mt-8 flex gap-2 print:hidden">
        <button type="button" aria-pressed={view === "edit"} onClick={() => setView("edit")} className={view === "edit" ? button : secondary}>
          Escrever
        </button>
        <button type="button" aria-pressed={view === "read"} onClick={() => setView("read")} className={view === "read" ? button : secondary}>
          Ver o plano
        </button>
      </div>

      <div className="mt-6 print:hidden">{view === "edit" ? <Editor draft={draft} storage={storage} /> : <ReadView draft={draft} />}</div>
      <div className="hidden print:block">
        <ReadView draft={draft} />
      </div>

      <section aria-labelledby="plan-actions" className="mt-10 space-y-3 print:hidden">
        <h2 id="plan-actions" className="sr-only">Imprimir ou apagar</h2>
        <p className="text-slate-700">
          Ao imprimir ou salvar como PDF, o plano sai deste aparelho: guarde a folha ou o arquivo num lugar seguro, e mostre só a quem
          você confia.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => window.print()} className={button}>Imprimir ou salvar como PDF</button>
          {draft && (
            <button type="button" onClick={() => setConfirmDelete(true)} className={secondary}>Apagar o plano</button>
          )}
        </div>
        {confirmDelete && (
          <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
            <p>Apagar tudo o que você escreveu no plano? Não tem volta.</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  deleteSafetyPlan();
                  setConfirmDelete(false);
                  setView("edit");
                }}
                className="min-h-12 rounded-xl bg-rose-700 px-5 py-3 font-semibold text-white hover:bg-rose-800"
              >
                Sim, apagar
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className={secondary}>Cancelar</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function SafetyPlanPage() {
  const stored = useSafetyPlan();

  if (!plan) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-slate-700">O plano de segurança não está disponível nesta versão. Em perigo, ligue 188 (CVV) ou 192 (SAMU).</p>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-base sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold text-slate-900 print:hidden">{plan.title}</h1>
      <p className="mt-3 text-slate-700 print:hidden">{plan.intro}</p>

      <section aria-label="Ajuda imediata" className="mt-6 print:hidden">
        <Contacts />
      </section>

      {stored.status === "loading" ? (
        <p aria-live="polite" className="mt-8 text-slate-700">Carregando…</p>
      ) : (
        <PlanBody draft={stored.status === "ready" ? stored.value : null} />
      )}

      <footer className="mt-10 space-y-2 text-sm text-slate-600 print:mt-6">
        {plan.license_note && <p>{plan.license_note}</p>}
        <SourceRefs cites={plan.sources} labels={labels} className="print:hidden" size="base" collapse="De onde vem este plano" />
        <p className="print:hidden">
          <Link href="/ajuda-agora" className="text-indigo-700 underline">Mais formas de ajuda</Link>
        </p>
      </footer>
    </div>
  );
}

export default SafetyPlanPage;
