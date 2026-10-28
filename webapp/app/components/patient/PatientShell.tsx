"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { knowledgeBase } from "@/app/lib/kb";
import { steps } from "@/app/lib/patient/flow";
import { usePatient, type PatientSessionV1 } from "@/app/lib/patient/store";

const allSteps = steps(knowledgeBase.data);

// Frame of every step of the patient journey: guards against a missing session (back to the start),
// shows where the person is, and keeps the text size and spacing comfortable on a phone.
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
          children(stored.value)
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
