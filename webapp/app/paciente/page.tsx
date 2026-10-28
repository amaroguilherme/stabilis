"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearAllData, newPatientSession, savePatient, usePatient } from "@/app/lib/patient/store";

export default function PatientIntroPage() {
  const router = useRouter();
  const stored = usePatient();
  const [storage, setStorage] = useState<"session" | "device">("session");
  const [agreed, setAgreed] = useState(false);

  function start() {
    savePatient(newPatientSession(storage));
    router.push("/paciente/seguranca");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-base sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold text-slate-900">Um guia para levar à sua consulta</h1>
      <p className="mt-4 text-lg text-slate-700">
        Em uns 15 minutos, você responde algumas perguntas e sai com um relatório para mostrar ao médico: o que você está
        sentindo, o resultado de questionários usados no mundo todo, o que as diretrizes de saúde indicam para casos parecidos
        e perguntas para fazer na consulta.
      </p>

      <ul className="mt-6 space-y-3 text-slate-800">
        <li className="flex gap-3"><span aria-hidden="true">✓</span>Não é diagnóstico nem receita. Quem decide o tratamento é você, junto com um profissional de saúde.</li>
        <li className="flex gap-3"><span aria-hidden="true">✓</span>Tudo vem de fontes públicas (diretrizes, bulas, lista de remédios do SUS), e cada informação mostra de onde veio.</li>
        <li className="flex gap-3"><span aria-hidden="true">✓</span>O conteúdo ainda não foi revisado por um profissional de saúde. Use como apoio para conversar.</li>
      </ul>

      {stored.status === "ready" && (
        <section className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Você já começou antes</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/paciente/seguranca" className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
              Continuar
            </Link>
            <Link href="/paciente/resultado" className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800">
              Ver meu resultado
            </Link>
            <button type="button" onClick={clearAllData} className="min-h-12 px-3 py-3 text-slate-700 underline underline-offset-2">
              Apagar e começar de novo
            </button>
          </div>
        </section>
      )}

      {stored.status === "missing" && (
        <section aria-labelledby="privacidade" className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="privacidade" className="text-lg font-semibold text-slate-900">Seus dados</h2>
          <p className="text-slate-700">
            Suas respostas são dados de saúde. Elas ficam só neste aparelho e não são enviadas a nenhum servidor. Você pode
            apagar tudo a qualquer momento. <Link href="/privacidade" className="text-indigo-700 underline">Como tratamos seus dados</Link>
          </p>
          <fieldset>
            <legend className="font-medium text-slate-900">Onde guardar as respostas</legend>
            <div className="mt-3 grid gap-3">
              <label className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-4 ${storage === "session" ? "border-indigo-600 bg-indigo-50" : "border-slate-300"}`}>
                <input type="radio" name="storage" checked={storage === "session"} onChange={() => setStorage("session")} className="mt-1 h-5 w-5 accent-indigo-600" />
                <span>
                  <span className="font-medium">Só enquanto esta aba estiver aberta</span>
                  <span className="block text-sm text-slate-600">Recomendado se outras pessoas usam este celular ou computador.</span>
                </span>
              </label>
              <label className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-4 ${storage === "device" ? "border-indigo-600 bg-indigo-50" : "border-slate-300"}`}>
                <input type="radio" name="storage" checked={storage === "device"} onChange={() => setStorage("device")} className="mt-1 h-5 w-5 accent-indigo-600" />
                <span>
                  <span className="font-medium">Guardar neste aparelho</span>
                  <span className="block text-sm text-slate-600">Para continuar depois. Quem usar este aparelho poderá ver as respostas.</span>
                </span>
              </label>
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 accent-indigo-600" />
            <span className="text-slate-800">
              Entendi que isto não é diagnóstico nem receita, e concordo em usar minhas respostas para montar o relatório.
            </span>
          </label>
          <button
            type="button"
            onClick={start}
            disabled={!agreed}
            className="min-h-12 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Começar
          </button>
        </section>
      )}

      <p className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
        Se você está pensando em se machucar ou em tirar a própria vida, não espere: ligue <a href="tel:188" className="font-semibold underline">188</a> (CVV,
        24 horas, gratuito) ou <a href="tel:192" className="font-semibold underline">192</a> (SAMU), ou vá a uma UPA.
      </p>
    </div>
  );
}
