"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PatientShell from "@/app/components/patient/PatientShell";
import QuestionnaireRunner from "@/app/components/patient/QuestionnaireRunner";
import { scoreText, trackedTitle } from "@/app/components/patient/TrackingCharts";
import { scoreInstrument } from "@/app/lib/engine/instruments";
import { knowledgeBase } from "@/app/lib/kb";
import { questionnaires } from "@/app/lib/patient/flow";
import { updatePatient, type PatientSessionV1 } from "@/app/lib/patient/store";
import { addAssessment, EMPTY_TRACKING, localDay, scoreSeries, type ScorePoint } from "@/app/lib/patient/tracking";

const kb = knowledgeBase.data;
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// A repeat of a symptom questionnaire during follow-up. PHQ-9 item 9 above zero always repeats the
// safety questions: each repeat is a new moment.
function Repeat({ id, session }: { id: string; session: PatientSessionV1 }) {
  const router = useRouter();
  const instrument = questionnaires(kb).find((i) => i.id === id)!;
  const [result, setResult] = useState<{ total: number; previous: ScorePoint | null } | null>(null);

  if (session.storage !== "device") {
    return (
      <p className="text-slate-700">
        Para repetir os questionários, ative o acompanhamento. <Link href="/paciente/acompanhamento" className="text-indigo-700 underline">Ir para o acompanhamento</Link>
      </p>
    );
  }

  if (result) {
    const diff = result.previous ? result.total - result.previous.total : null;
    return (
      <div className="space-y-4 text-slate-800">
        <section aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-lg font-semibold text-slate-900">Hoje: {scoreText(id, result.total)}</p>
          {result.previous && diff !== null && (
            <p className="mt-1">
              Na vez anterior ({shortDate(result.previous.date)}): {scoreText(id, result.previous.total)}.{" "}
              {diff === 0 ? "A pontuação não mudou." : `A pontuação ${diff < 0 ? "diminuiu" : "aumentou"} ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "ponto" : "pontos"}.`}
            </p>
          )}
        </section>
        <p>Leve este resultado para a consulta: só um profissional pode dizer o que ele significa para o seu tratamento.</p>
        <p>
          Se você sentir que está piorando, não espere a próxima consulta: procure a UBS ou o CAPS, ou ligue{" "}
          <a href="tel:188" className="font-semibold underline">188</a> (CVV, 24 horas).
        </p>
        <Link href="/paciente/acompanhamento" className="inline-block min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
          Voltar ao acompanhamento
        </Link>
      </div>
    );
  }

  return (
    <QuestionnaireRunner
      instrument={instrument}
      onFinish={(answers) => {
        const date = localDay(new Date());
        const previous = scoreSeries(kb, session, id).filter((p) => p.date !== date).pop() ?? null;
        updatePatient((s) => ({ ...s, tracking: addAssessment(s.tracking ?? EMPTY_TRACKING, { date, instrument: id, answers }) }));
        if (id === "phq9" && (answers.phq9_9 ?? 0) > 0) {
          router.push("/paciente/seguranca?repetir=acompanhamento_phq9");
          return;
        }
        const scored = scoreInstrument(instrument, answers, { ...session.profile, current_meds: session.current_meds });
        setResult({ total: scored.total ?? 0, previous });
      }}
      onSkip={() => router.push("/paciente/acompanhamento")}
      skipLabel="Agora não"
    />
  );
}

export default function TrackingQuestionnaire({ id }: { id: string }) {
  return (
    <PatientShell path={`/paciente/acompanhamento/questionario/${id}`} title={trackedTitle(id)}>
      {(session) => <Repeat id={id} session={session} />}
    </PatientShell>
  );
}
