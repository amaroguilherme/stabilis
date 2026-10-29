"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AlertList from "@/app/components/engine/AlertList";
import MedicationReview from "@/app/components/engine/MedicationReview";
import MedicationPicker from "@/app/components/professional/MedicationPicker";
import ProfileFields, { EMPTY_PROFILE, toProfile, type ProfileDraft } from "@/app/components/professional/ProfileFields";
import { evaluate } from "@/app/lib/engine/evaluate";
import { renderMessage } from "@/app/lib/engine/messages";
import type { MedEntry } from "@/app/lib/engine/types";
import { knowledgeBase } from "@/app/lib/kb";
import { createLabels } from "@/app/lib/kb/labels";
import { crisisLexicon } from "@/app/lib/safety/lexicon";

const kb = knowledgeBase.data;
const labels = createLabels(kb);

// Deterministic prescription review: dose against the reference label, profile-based label alerts
// and interactions between the medications. Replaces the old pharmacokinetic "audit".
export default function PrescriptionReviewPage() {
  const [profile, setProfile] = useState<ProfileDraft>(EMPTY_PROFILE);
  const [meds, setMeds] = useState<MedEntry[]>([]);

  const output = useMemo(
    () => evaluate(knowledgeBase, { mode: "professional", condition: null, profile: toProfile(profile, { current_meds: meds }) }, { crisisLexicon }),
    [profile, meds],
  );
  const caseAlerts = output.alerts.filter((a) => a.message.key !== "alert.missing_profile");
  const missingProfile = output.alerts.some((a) => a.message.key === "alert.missing_profile");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-indigo-700">Modo profissional · experimental e não comercial</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Revisão de receita</h1>
        <p className="mt-2 text-sm text-slate-700">
          Confere cada medicamento contra a bula de referência (dose, alertas para o perfil, monitoramento) e as interações
          entre eles. Não calcula concentração no sangue e não substitui a avaliação farmacêutica.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="rx-meds">
          <h2 id="rx-meds" className="text-lg font-semibold text-slate-900">Medicamentos</h2>
          <div className="mt-4">
            <MedicationPicker value={meds} onChange={setMeds} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="rx-profile">
          <h2 id="rx-profile" className="text-lg font-semibold text-slate-900">Pessoa</h2>
          <p className="mt-1 text-sm text-slate-600">Os alertas de gravidez, idade e comorbidades dependem destes dados.</p>
          <div className="mt-4">
            <ProfileFields value={profile} onChange={setProfile} />
          </div>
        </section>

        <section aria-labelledby="rx-result" aria-live="polite" className="space-y-4">
          <h2 id="rx-result" className="text-lg font-semibold text-slate-900">Resultado</h2>
          {meds.length === 0 ? (
            <p className="text-sm text-slate-600">Adicione ao menos um medicamento.</p>
          ) : (
            <>
              {missingProfile && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Sem idade e sexo ao nascer, os alertas que dependem do perfil (gravidez, idade) podem faltar.
                </p>
              )}
              <AlertList alerts={caseAlerts} kb={kb} labels={labels} variant="clinical" />
              <MedicationReview output={output} kb={kb} labels={labels} variant="clinical" />
              {output.questions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Pontos a definir</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {output.questions.map((q, i) => (
                      <li key={i}>{renderMessage(kb, q.message, "clinical")}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        <p className="text-sm">
          <Link href="/profissional" className="text-indigo-700 underline underline-offset-2">Ver opções de tratamento por diretriz</Link>
        </p>
      </div>
    </div>
  );
}
