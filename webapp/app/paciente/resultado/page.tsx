"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AlertList from "@/app/components/engine/AlertList";
import MedicationReview from "@/app/components/engine/MedicationReview";
import TreatmentReview from "@/app/components/engine/TreatmentReview";
import PatientShell from "@/app/components/patient/PatientShell";
import { Questions, ScoreSummary, SectionResult, WhereToGo } from "@/app/components/patient/PatientResult";
import { knowledgeBase } from "@/app/lib/kb";
import { createLabels } from "@/app/lib/kb/labels";
import { patientTreatmentReview, REFERRAL_ONLY, scores, screeningPositive } from "@/app/lib/patient/flow";
import { usePatientOutputs } from "@/app/lib/patient/outputs";
import { clearAllData, type PatientSessionV1 } from "@/app/lib/patient/store";

const kb = knowledgeBase.data;
const labels = createLabels(kb);

function Result({ session }: { session: PatientSessionV1 }) {
  const router = useRouter();
  const { parts, review } = usePatientOutputs(session);
  const crisis = review.crisis.language || screeningPositive(kb, session) || parts.some((p) => p.output.crisis.language);
  const referralOnly = session.known_diagnoses.filter((d) => REFERRAL_ONLY.has(d));
  const caseAlerts = review.alerts;
  const treatmentReview = patientTreatmentReview(parts, review);

  return (
    <div className="space-y-10">
      {crisis && (
        <section role="alert" className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-950">
          <p className="text-lg font-semibold">Suas respostas mostram sinais de risco.</p>
          <p className="mt-2">
            Procure ajuda agora: CVV <a href="tel:188" className="font-semibold underline">188</a> (24 horas), SAMU{" "}
            <a href="tel:192" className="font-semibold underline">192</a> ou uma UPA. Por segurança, não mostramos informações sobre remédios.
          </p>
          <p className="mt-2">
            <Link href="/paciente/plano-de-seguranca" className="font-semibold underline">Fazer meu plano de segurança</Link>
          </p>
        </section>
      )}

      <section aria-labelledby="sugere">
        <h2 id="sugere" className="text-xl font-semibold text-slate-900">O que suas respostas sugerem</h2>
        <p className="mb-3 text-slate-600">Questionários ajudam a medir sintomas, mas não são diagnóstico.</p>
        <ScoreSummary scores={scores(kb, session)} kb={kb} />
      </section>

      {caseAlerts.length > 0 && (
        <section aria-labelledby="avisos">
          <h2 id="avisos" className="text-xl font-semibold text-slate-900">Avisos importantes</h2>
          <div className="mt-3"><AlertList alerts={caseAlerts} kb={kb} labels={labels} variant="plain" /></div>
        </section>
      )}

      {referralOnly.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-slate-800">
            Para esquizofrenia ou psicose, TDAH e dependência de álcool ou drogas, esta ferramenta não mostra opções de tratamento: o
            cuidado precisa ser planejado com um profissional. Procure a UBS ou o CAPS da sua região.
          </p>
        </section>
      )}

      {parts.length === 0 && !crisis && (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-800">
          Pelas suas respostas, não há opções de tratamento para mostrar agora. Se você está sofrendo, converse mesmo assim com
          um profissional: leve o relatório.
        </p>
      )}

      {parts.map(({ condition, reason, output }) => (
        <section key={condition} aria-labelledby={`sec-${condition}`} className="space-y-4">
          <div>
            <h2 id={`sec-${condition}`} className="text-2xl font-bold text-slate-900">
              {kb.vocab.conditions.conditions.find((c) => c.id === condition)?.label_plain ?? condition}
            </h2>
            <p className="text-slate-600">{reason === "known" ? "Porque você contou que já recebeu este diagnóstico." : "Porque seus questionários indicaram estes sintomas."}</p>
          </div>
          <AlertList alerts={output.alerts.filter((a) => !caseAlerts.some((c) => c.message.key === a.message.key))} kb={kb} labels={labels} variant="plain" />
          <SectionResult output={output} kb={kb} labels={labels} />
        </section>
      ))}

      {review.medication_review.length > 0 && (
        <section aria-labelledby="em-uso" className="space-y-3">
          <h2 id="em-uso" className="text-xl font-semibold text-slate-900">Os remédios que você usa</h2>
          <MedicationReview output={review} kb={kb} labels={labels} variant="plain" />
        </section>
      )}

      {treatmentReview.length > 0 && (
        <section aria-labelledby="tratamentos" className="space-y-3">
          <h2 id="tratamentos" className="text-xl font-semibold text-slate-900">Os tratamentos que você já fez</h2>
          <p className="text-slate-600">Se a dose e o tempo foram suficientes para saber se o remédio funciona, segundo as diretrizes.</p>
          <TreatmentReview items={treatmentReview} kb={kb} labels={labels} variant="plain" />
        </section>
      )}

      <section aria-labelledby="perguntas">
        <h2 id="perguntas" className="text-xl font-semibold text-slate-900">Perguntas para levar ao médico</h2>
        <div className="mt-3">
          <Questions outputs={[...parts.map((p) => p.output), review]} kb={kb} />
        </div>
      </section>

      <section aria-labelledby="onde">
        <h2 id="onde" className="text-xl font-semibold text-slate-900">Onde buscar atendimento</h2>
        <div className="mt-3"><WhereToGo /></div>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
        <Link href="/paciente/relatorio" className="min-h-12 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">
          Ver relatório para o médico
        </Link>
        <Link href="/paciente/perfil" className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800">
          Revisar respostas
        </Link>
        <Link href="/paciente/receita" className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800">
          Entender minha receita
        </Link>
        <Link href="/paciente/acompanhamento" className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800">
          Acompanhar entre as consultas
        </Link>
        <Link href="/paciente/plano-de-seguranca" className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800">
          Plano de segurança
        </Link>
        <button
          type="button"
          onClick={() => {
            clearAllData();
            router.push("/");
          }}
          className="min-h-12 px-3 py-3 text-slate-700 underline underline-offset-2"
        >
          Apagar meus dados
        </button>
      </div>
    </div>
  );
}

export default function PatientResultPage() {
  return (
    <PatientShell path="/paciente/resultado" title="Seu resultado">
      {(session) => <Result session={session} />}
    </PatientShell>
  );
}
