"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import PatientShell, { StepButtons } from "@/app/components/patient/PatientShell";
import QuestionnaireRunner from "@/app/components/patient/QuestionnaireRunner";
import { scoreInstrument } from "@/app/lib/engine/instruments";
import { knowledgeBase } from "@/app/lib/kb";
import { nextStep, riskScreener } from "@/app/lib/patient/flow";
import { updatePatient } from "@/app/lib/patient/store";

const kb = knowledgeBase.data;
const screener = riskScreener(kb);
const REASONS = {
  phq9: "Uma das suas respostas no questionário falou de pensamentos de morte ou de se machucar. Vamos repetir as perguntas de segurança.",
  relato: "Você escreveu algo que nos preocupa. Vamos repetir as perguntas de segurança.",
} as const;

function Safety() {
  const router = useRouter();
  const params = useSearchParams();
  const repeat = params.get("repetir") as keyof typeof REASONS | null;
  const after = repeat === "phq9" ? nextStep(kb, "/paciente/questionarios/phq9") : repeat === "relato" ? nextStep(kb, "/paciente/relato") : "/paciente/perfil";

  return (
    <PatientShell path="/paciente/seguranca" title="Antes de tudo, sua segurança">
      {(session) => (
        <>
          <p className="text-slate-700">
            {repeat && REASONS[repeat]
              ? REASONS[repeat]
              : "Algumas perguntas rápidas sobre pensamentos de morte. Responda com sinceridade: elas servem para mostrar ajuda imediata, se for preciso."}
          </p>
          <div className="mt-6">
            {screener ? (
              <QuestionnaireRunner
                instrument={screener}
                initial={repeat ? undefined : session.screening.answers}
                onFinish={(answers) => {
                  const result = scoreInstrument(screener, answers);
                  updatePatient((s) => ({
                    ...s,
                    screening: {
                      answers,
                      completed_at: new Date().toISOString(),
                      repeat_reason: repeat === "phq9" ? "phq9_item9" : repeat === "relato" ? "crisis_language" : s.screening.repeat_reason,
                    },
                  }));
                  router.push(result.band && result.band !== "none" ? "/paciente/crise" : after);
                }}
              />
            ) : (
              <>
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  As perguntas de segurança ainda não estão disponíveis nesta versão. Se você está pensando em se machucar, ligue
                  188 (CVV) ou 192 (SAMU) agora.
                </p>
                <StepButtons onNext={() => router.push(after)} />
              </>
            )}
          </div>
        </>
      )}
    </PatientShell>
  );
}

export default function SafetyPage() {
  return (
    <Suspense fallback={null}>
      <Safety />
    </Suspense>
  );
}
