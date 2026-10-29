"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { knowledgeBase } from "@/app/lib/kb";
import { steps } from "@/app/lib/patient/flow";
import { CONSENT_VERSION, updatePatient, usePatient, type PatientSessionV1 } from "@/app/lib/patient/store";

const allSteps = steps(knowledgeBase.data);

// Frame of every step of the patient journey: guards against a missing session (back to the start),
// shows where the person is, and keeps the text size and spacing comfortable on a phone.
// Sessions saved under an older privacy notice see what changed and can agree again; nothing new
// starts without its own opt-in, so the notice does not block the journey.
function ConsentUpdate() {
  return (
    <section aria-labelledby="consent-update" className="mb-6 space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-slate-800">
      <h2 id="consent-update" className="font-semibold text-slate-900">Atualizamos o aviso sobre os seus dados</h2>
      <p>
        Agora ele explica o ditado por voz, a ajuda para organizar o seu texto e as contagens anônimas. Tudo isso é opcional e só
        começa se você escolher. Suas respostas continuam só neste aparelho.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => updatePatient((s) => ({ ...s, consent: { version: CONSENT_VERSION, accepted_at: new Date().toISOString() } }))}
          className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          Entendi e concordo
        </button>
        <Link href="/privacidade" className="min-h-12 py-3 text-indigo-700 underline underline-offset-2">Ver o que mudou</Link>
      </div>
      <p className="text-sm text-slate-600">Se não concordar, apague suas respostas na página inicial do paciente.</p>
    </section>
  );
}

export default function PatientShell({
  path,
  title,
  children,
  missing,
}: {
  path: string;
  title: string;
  children: (session: PatientSessionV1) => React.ReactNode;
  missing?: React.ReactNode; // shown instead of sending the person back to the start
}) {
  const router = useRouter();
  const stored = usePatient();
  const index = allSteps.findIndex((s) => s.path === path);

  useEffect(() => {
    if (stored.status === "missing" && !missing) router.replace("/paciente");
  }, [stored.status, router, missing]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 text-base sm:px-6 sm:py-10">
      {index >= 0 && (
        <nav aria-label="Etapas" className="mb-6">
          <p className="text-sm font-medium text-slate-700">
            Etapa {index + 1} de {allSteps.length}: {allSteps[index].label}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${((index + 1) / allSteps.length) * 100}%` }} />
          </div>
        </nav>
      )}
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <div className="mt-4">
        {stored.status === "ready" ? (
          <>
            {stored.value.consent.version !== CONSENT_VERSION && <ConsentUpdate />}
            {children(stored.value)}
          </>
        ) : stored.status === "missing" ? (
          (missing ?? <p className="text-slate-700">
            Voltando para o início… <Link href="/paciente" className="text-indigo-700 underline">ir agora</Link>
          </p>)
        ) : (
          <p aria-live="polite" className="text-slate-700">Carregando…</p>
        )}
      </div>
    </div>
  );
}

export function StepButtons({ onNext, nextLabel = "Continuar", back, disabled }: { onNext: () => void; nextLabel?: string; back?: string; disabled?: boolean }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className="min-h-12 rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {nextLabel}
      </button>
      {back && (
        <Link href={back} className="min-h-12 rounded-xl px-4 py-3 text-base text-slate-700 underline underline-offset-2 hover:text-indigo-700">
          Voltar
        </Link>
      )}
    </div>
  );
}
