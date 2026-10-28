"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PatientShell from "@/app/components/patient/PatientShell";
import { DiaryCharts, InstrumentChart } from "@/app/components/patient/TrackingCharts";
import { knowledgeBase } from "@/app/lib/kb";
import { buildEvolutionReport, PERIODS } from "@/app/lib/patient/evolution";
import type { PatientSessionV1 } from "@/app/lib/patient/store";
import { EMPTY_TRACKING, localDay } from "@/app/lib/patient/tracking";
import { crisisLexicon } from "@/app/lib/safety/lexicon";

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const longDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-slate-200 pt-3">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </section>
  );
}

function Evolution({ session }: { session: PatientSessionV1 }) {
  const [days, setDays] = useState<number>(PERIODS[0]);
  const [withNotes, setWithNotes] = useState(false);
  const today = localDay(new Date());
  const report = useMemo(
    () => buildEvolutionReport(knowledgeBase, session, { today, days, withNotes, lexicon: crisisLexicon, now: new Date() }),
    [session, today, days, withNotes],
  );
  const empty = report.questionnaires.length === 0 && (session.tracking ?? EMPTY_TRACKING).checkins.length === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-4 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="font-medium text-slate-900">Período do diário</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 block min-h-12 rounded-xl border-2 border-slate-300 bg-white px-3">
              {PERIODS.map((p) => <option key={p} value={p}>Últimos {p} dias</option>)}
            </select>
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={withNotes} onChange={(e) => setWithNotes(e.target.checked)} className="h-5 w-5 accent-indigo-600" />
            <span className="text-slate-800">Incluir minhas anotações</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => window.print()} className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
            Imprimir ou salvar como PDF
          </button>
          <Link href="/paciente/acompanhamento" className="min-h-12 px-3 py-3 text-slate-700 underline underline-offset-2">Voltar ao acompanhamento</Link>
        </div>
      </div>

      {empty ? (
        <p className="text-slate-700">Ainda não há registros. Use o acompanhamento por alguns dias e volte aqui.</p>
      ) : (
        <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header>
            <p className="text-lg font-bold text-slate-900">Relatório de acompanhamento</p>
            <p className="text-xs text-slate-600">
              Preparado pela própria pessoa com o Stabilis em {new Date(report.generated_at).toLocaleDateString("pt-BR")}. Diário de{" "}
              {longDate(report.period.from)} a {longDate(report.period.to)}. Material educativo; não é diagnóstico. Base de conhecimento v{report.kb.version} (
              {report.kb.hash.replace("sha256:", "").slice(0, 8)}).
            </p>
          </header>
          {report.attention.length > 0 && (
            <div className="rounded border-2 border-rose-400 p-2 text-sm text-rose-900">
              <p className="font-semibold">Atenção: avaliar risco nesta consulta.</p>
              <ul className="list-disc pl-5">{report.attention.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          )}
          <Block title="Medicamentos em uso">
            {report.current_meds.length ? <ul className="list-disc pl-5">{report.current_meds.map((m) => <li key={m}>{m}</li>)}</ul> : <p>Nenhum informado.</p>}
          </Block>
          <Block title="Questionários">
            {report.questionnaires.length ? (
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="py-1 pr-3 font-semibold">Data</th>
                    {report.instruments.map((i) => <th key={i.id} className="py-1 pr-3 font-semibold">{i.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.questionnaires.map((row) => (
                    <tr key={row.date} className="border-t border-slate-100 align-top">
                      <td className="py-1 pr-3 whitespace-nowrap">
                        {longDate(row.date)}
                        {row.baseline && <span className="text-slate-600"> (início)</span>}
                      </td>
                      {report.instruments.map((i) => <td key={i.id} className="py-1 pr-3">{row.cells[i.id] ?? "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Nenhum questionário respondido.</p>
            )}
          </Block>
          <div className="space-y-3">
            {report.instruments.map((i) => <InstrumentChart key={i.id} session={session} id={i.id} />)}
            <DiaryCharts checkins={(session.tracking ?? EMPTY_TRACKING).checkins} today={today} days={days} />
          </div>
          <Block title={`Diário de ${shortDate(report.period.from)} a ${shortDate(report.period.to)}`}>
            {report.diary.recorded === 0 ? (
              <p>Nenhum dia registrado no período.</p>
            ) : (
              <ul className="list-disc pl-5">
                <li>{report.diary.recorded} de {report.period.days} dias registrados.</li>
                {report.diary.mood && <li>Humor: {report.diary.mood}.</li>}
                {report.diary.sleep && <li>Sono: {report.diary.sleep}.</li>}
                {report.diary.adherence && <li>Remédios: {report.diary.adherence}.</li>}
                <li>Efeitos marcados: {report.diary.side_effects.length ? report.diary.side_effects.join("; ") : "nenhum"}.</li>
              </ul>
            )}
          </Block>
          {report.diary.notes.length > 0 && (
            <Block title="Anotações da pessoa">
              <ul className="space-y-1">
                {report.diary.notes.map((n) => (
                  <li key={n.date}>
                    <span className="font-medium">{shortDate(n.date)}:</span> “{n.text}”
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </article>
      )}
    </div>
  );
}

export default function EvolutionReportPage() {
  return (
    <PatientShell path="/paciente/acompanhamento/relatorio" title="Relatório de evolução">
      {(session) => <Evolution session={session} />}
    </PatientShell>
  );
}
