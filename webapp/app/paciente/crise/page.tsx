"use client";

import Link from "next/link";
import PatientShell from "@/app/components/patient/PatientShell";

// Shown when the safety questions or the person's words point to risk. Medication information
// stays hidden for the rest of the session (the engine gate), but the report can still be built.
export default function CrisisPage() {
  return (
    <PatientShell path="/paciente/crise" title="Você não precisa passar por isso sozinho(a)">
      {() => (
        <div className="space-y-6">
          <section role="alert" className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-950">
            <p className="text-lg font-semibold">Pelo que você respondeu, é importante conversar com alguém agora.</p>
            <ul className="mt-4 space-y-4">
              <li>
                <a href="tel:188" className="flex min-h-14 items-center justify-between rounded-xl bg-white px-4 py-3 text-lg font-semibold text-rose-900 shadow-sm">
                  <span>CVV: ligue 188</span>
                  <span className="text-sm font-normal">24 horas, gratuito, sigiloso</span>
                </a>
              </li>
              <li>
                <a href="tel:192" className="flex min-h-14 items-center justify-between rounded-xl bg-white px-4 py-3 text-lg font-semibold text-rose-900 shadow-sm">
                  <span>SAMU: ligue 192</span>
                  <span className="text-sm font-normal">se houver risco imediato</span>
                </a>
              </li>
              <li className="rounded-xl bg-white px-4 py-3 shadow-sm">
                <span className="font-semibold">UPA ou pronto-socorro</span>: atendimento sem agendamento, 24 horas.
              </li>
            </ul>
            <p className="mt-4">Se puder, conte para alguém de confiança como você está e peça que fique com você.</p>
          </section>

          <section className="space-y-3 text-slate-800">
            <p>
              Por segurança, não vamos mostrar informações sobre remédios agora. Você pode continuar respondendo para montar um
              relatório e levá-lo ao atendimento; ele vai indicar que há sinais de risco.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/paciente/perfil" className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
                Continuar o relatório
              </Link>
              <Link href="/ajuda-agora" className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800">
                Mais formas de ajuda
              </Link>
            </div>
          </section>
        </div>
      )}
    </PatientShell>
  );
}
