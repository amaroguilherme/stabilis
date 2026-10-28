"use client";

import { useRouter } from "next/navigation";
import PatientShell from "@/app/components/patient/PatientShell";
import QuestionnaireRunner from "@/app/components/patient/QuestionnaireRunner";
import { knowledgeBase } from "@/app/lib/kb";
import { nextStep, PATIENT_TITLES, questionnaires } from "@/app/lib/patient/flow";
import { updatePatient } from "@/app/lib/patient/store";

const kb = knowledgeBase.data;

const WHY: Record<string, string> = {
  phq9: "Este questionário mede sintomas de depressão nas últimas duas semanas.",
  gad7: "Este questionário mede sintomas de ansiedade nas últimas duas semanas.",
  mdq: "Estas perguntas procuram sinais de transtorno bipolar. Elas importam porque, nesse caso, antidepressivo sozinho pode piorar o quadro. Sem elas, não mostramos antidepressivos.",
  auditc: "Estas perguntas são sobre bebida alcoólica, que interfere no humor, no sono e em vários remédios.",
};

export default function Questionnaire({ id }: { id: string }) {
  const router = useRouter();
  const instrument = questionnaires(kb).find((i) => i.id === id);
  if (!instrument) return null;
  const path = `/paciente/questionarios/${id}`;

  return (
    <PatientShell path={path} title={PATIENT_TITLES[id] ?? instrument.name}>
      {(session) => (
        <>
          {WHY[id] && <p className="mb-6 text-slate-700">{WHY[id]}</p>}
          <QuestionnaireRunner
            key={id}
            instrument={instrument}
            initial={session.instruments[id]}
            onFinish={(answers) => {
              updatePatient((s) => ({ ...s, instruments: { ...s.instruments, [id]: answers }, skipped: s.skipped.filter((x) => x !== id) }));
              const asksRescreen = id === "phq9" && (answers.phq9_9 ?? 0) > 0 && session.screening.repeat_reason !== "phq9_item9";
              router.push(asksRescreen ? "/paciente/seguranca?repetir=phq9" : nextStep(kb, path));
            }}
            onSkip={() => {
              updatePatient((s) => {
                const instruments = { ...s.instruments };
                delete instruments[id];
                return { ...s, instruments, skipped: [...new Set([...s.skipped, id])] };
              });
              router.push(nextStep(kb, path));
            }}
          />
        </>
      )}
    </PatientShell>
  );
}
