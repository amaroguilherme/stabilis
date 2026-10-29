"use client";

import { useState } from "react";
import { setMetricsEnabled, track, useMetricsEnabled, type MetricEvent } from "@/app/lib/metrics";
import { updatePatient, type PatientSessionV1 } from "@/app/lib/patient/store";
import { daysBetween, localDay } from "@/app/lib/patient/tracking";

// "Depois da consulta": did the report reach the doctor, and did the person feel heard? The answer
// stays on the device; it becomes an anonymous count only if the person turned counts on (§19).
// "Ainda não" asks again two weeks later.

type Took = NonNullable<PatientSessionV1["visit_feedback"]>["took_to_doctor"];
type Heard = NonNullable<PatientSessionV1["visit_feedback"]>["felt_heard"];
const ASK_AGAIN_DAYS = 14;
const choice = "min-h-12 rounded-xl border-2 border-slate-300 bg-white px-5 py-3 text-slate-800 hover:border-indigo-400";

export function shouldAskVisitFeedback(session: PatientSessionV1, today = localDay(new Date())): boolean {
  if (!session.report_made_at) return false;
  const answer = session.visit_feedback;
  if (!answer) return true;
  return answer.took_to_doctor === "not_yet" && daysBetween(answer.answered_at.slice(0, 10), today) >= ASK_AGAIN_DAYS;
}

export default function VisitFeedback({ session }: { session: PatientSessionV1 }) {
  const counts = useMetricsEnabled();
  const [took, setTook] = useState<Took | null>(null);
  const [done, setDone] = useState(false);
  if (done) return <p aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-800">Obrigado pela resposta.</p>;
  if (!shouldAskVisitFeedback(session)) return null;

  function finish(tookValue: Took, heard: Heard) {
    updatePatient((s) => ({ ...s, visit_feedback: { took_to_doctor: tookValue, felt_heard: heard, answered_at: localDay(new Date()) } }));
    track(`took_to_doctor_${tookValue}` as MetricEvent);
    if (heard) track(`felt_heard_${heard}` as MetricEvent);
    setDone(true);
  }

  return (
    <section aria-labelledby="visit-feedback" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 id="visit-feedback" className="text-lg font-semibold text-slate-900">Depois da consulta</h2>
      {took !== "yes" ? (
        <fieldset>
          <legend className="font-medium text-slate-900">Você levou o relatório ao médico?</legend>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => setTook("yes")} className={choice}>Sim</button>
            <button type="button" onClick={() => finish("not_yet", null)} className={choice}>Ainda não</button>
            <button type="button" onClick={() => finish("no", null)} className={choice}>Não</button>
          </div>
        </fieldset>
      ) : (
        <fieldset>
          <legend className="font-medium text-slate-900">Você sentiu que te ouviram na consulta?</legend>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => finish("yes", "yes")} className={choice}>Sim</button>
            <button type="button" onClick={() => finish("yes", "partly")} className={choice}>Em parte</button>
            <button type="button" onClick={() => finish("yes", "no")} className={choice}>Não</button>
          </div>
        </fieldset>
      )}
      {counts !== null && (
        <label className="flex cursor-pointer items-start gap-3 text-slate-800">
          <input type="checkbox" checked={counts} onChange={(e) => setMetricsEnabled(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-indigo-600" />
          <span>
            Contar minhas respostas de forma anônima, para ajudar a melhorar o Stabilis. Vai só a resposta, sem nenhum dado seu.
          </span>
        </label>
      )}
    </section>
  );
}
