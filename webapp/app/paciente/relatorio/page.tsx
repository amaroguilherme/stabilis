"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PatientShell from "@/app/components/patient/PatientShell";
import { knowledgeBase } from "@/app/lib/kb";
import { track } from "@/app/lib/metrics";
import { usePatientOutputs } from "@/app/lib/patient/outputs";
import { buildDoctorReport, exportSession, reportText, type DoctorReport } from "@/app/lib/patient/report";
import { updatePatient, type PatientSessionV1 } from "@/app/lib/patient/store";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-slate-200 pt-3">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </section>
  );
}

function ReportBody({ report }: { report: DoctorReport }) {
  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header>
        <p className="text-lg font-bold text-slate-900">Relatório para a consulta</p>
        <p className="text-xs text-slate-600">
          Preparado pela própria pessoa com o Stabilis em {new Date(report.generated_at).toLocaleDateString("pt-BR")}. Material educativo baseado em
          diretrizes públicas; não é diagnóstico nem prescrição. Base de conhecimento v{report.kb.version} ({report.kb.hash.replace("sha256:", "").slice(0, 8)}).
        </p>
      </header>
      {report.crisis && (
        <p className="rounded border-2 border-rose-400 p-2 text-sm font-semibold text-rose-900">
          Atenção: há sinais de risco de suicídio ou autolesão nas respostas. Avaliar risco nesta consulta.
        </p>
      )}
      <Block title="Nas palavras da pessoa">{report.complaint ? <p className="whitespace-pre-wrap">“{report.complaint}”</p> : <p>Não escreveu um relato.</p>}</Block>
      <Block title="Dados">
        <p>{report.person.join(" · ")}</p>
        {report.known_diagnoses.length > 0 && <p>Diagnósticos informados pela pessoa: {report.known_diagnoses.join(", ")}.</p>}
      </Block>
      <Block title="Questionários e triagem de risco">
        <ul className="list-disc pl-5">
          {report.scores.map((s) => <li key={s.name}>{s.name}: {s.text}</li>)}
          <li>{report.screening}</li>
        </ul>
      </Block>
      <Block title="Medicamentos em uso">{report.current_meds.length ? <ul className="list-disc pl-5">{report.current_meds.map((m) => <li key={m}>{m}</li>)}</ul> : <p>Nenhum informado.</p>}</Block>
      {report.history.length > 0 && (
        <Block title="Tratamentos anteriores (relato da pessoa)">
          <ul className="list-disc pl-5">{report.history.map((h) => <li key={h}>{h}</li>)}</ul>
        </Block>
      )}
      {report.priorities.length > 0 && <Block title="O que é importante para a pessoa"><p>{report.priorities.join("; ")}.</p></Block>}
      {report.sections.map((section) => (
        <Block key={section.title} title={`Opções segundo diretrizes: ${section.title}`}>
          <p className="text-xs text-slate-600">{section.reason}</p>
          {section.tiers.map((tier) => (
            <div key={tier.title} className="mt-1">
              <p className="font-semibold">{tier.title}</p>
              <ul className="list-disc pl-5">
                {tier.items.map((item) => (
                  <li key={item.text}>
                    {item.text}
                    {item.sources.length > 0 && <span className="text-xs text-slate-600"> [{[...new Set(item.sources)].slice(0, 2).join("; ")}]</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Block>
      ))}
      {report.alerts.length > 0 && (
        <Block title="Alertas">
          <ul className="list-disc pl-5">
            {report.alerts.map((a) => (
              <li key={a.text}>
                {a.text}
                {a.sources.length > 0 && <span className="text-xs text-slate-600"> [{a.sources[0]}]</span>}
              </li>
            ))}
          </ul>
        </Block>
      )}
      {report.questions.length > 0 && (
        <Block title="Perguntas da pessoa">
          <ol className="list-decimal pl-5">{report.questions.map((q) => <li key={q}>{q}</li>)}</ol>
        </Block>
      )}
    </article>
  );
}

function Report({ session }: { session: PatientSessionV1 }) {
  const { parts, review } = usePatientOutputs(session);
  const report = useMemo(() => buildDoctorReport(knowledgeBase, session, parts, review, new Date()), [session, parts, review]);
  const [sharing, setSharing] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const text = reportText(report);

  // The first print, share or download marks that the report was made (asks "Depois da consulta" later).
  const madeReport = () => updatePatient((s) => (s.report_made_at ? s : { ...s, report_made_at: new Date().toISOString() }));

  function print() {
    madeReport();
    track("report_printed");
    window.print();
  }

  async function share() {
    madeReport();
    track("report_shared");
    if (navigator.share) {
      await navigator.share({ title: "Relatório para a consulta", text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    }
  }

  async function download() {
    madeReport();
    track("report_downloaded");
    const json = await exportSession(session, knowledgeBase, new Date());
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "stabilis-respostas.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 print:hidden">
        <button type="button" onClick={print} className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
          Imprimir ou salvar como PDF
        </button>
        <button type="button" onClick={() => setSharing(!sharing)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800">
          Compartilhar
        </button>
        <Link href="/paciente/resultado" className="min-h-12 px-3 py-3 text-slate-700 underline underline-offset-2">Voltar ao resultado</Link>
      </div>

      {sharing && (
        <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 print:hidden">
          <p className="font-semibold">Antes de compartilhar</p>
          <p>
            O resumo tem dados de saúde. Ao enviar por WhatsApp ou outro aplicativo, eles saem deste aparelho e passam a valer as regras
            daquele aplicativo. Envie só para quem você confia, como o próprio profissional que vai atender você.
          </p>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-1 h-5 w-5 accent-indigo-600" />
            <span>Entendi</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!understood} onClick={share} className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
              Enviar resumo
            </button>
            <button type="button" disabled={!understood} onClick={download} className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800 disabled:opacity-50">
              Baixar arquivo para o profissional
            </button>
          </div>
          <p className="text-sm">
            O arquivo leva só as respostas do guia (não leva o diário do acompanhamento nem o plano de segurança). O profissional pode
            abri-lo no Stabilis, na área do profissional, em “Respostas da pessoa”.
          </p>
        </section>
      )}

      <ReportBody report={report} />
    </div>
  );
}

export default function ReportPage() {
  return (
    <PatientShell path="/paciente/relatorio" title="Relatório para o médico">
      {(session) => <Report session={session} />}
    </PatientShell>
  );
}
