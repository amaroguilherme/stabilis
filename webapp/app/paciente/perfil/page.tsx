"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PatientShell, { StepButtons } from "@/app/components/patient/PatientShell";
import MedicationPicker from "@/app/components/professional/MedicationPicker";
import ProfileFields, { fromProfile, parseAge, toProfile, type ProfileDraft } from "@/app/components/professional/ProfileFields";
import type { MedEntry } from "@/app/lib/engine/types";
import { knowledgeBase } from "@/app/lib/kb";
import { KNOWN_DIAGNOSES, nextStep } from "@/app/lib/patient/flow";
import { updatePatient, type PatientSessionV1 } from "@/app/lib/patient/store";

function ProfileForm({ session }: { session: PatientSessionV1 }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProfileDraft>(() => fromProfile({ ...session.profile, current_meds: session.current_meds }, session.gender_identity));
  const [known, setKnown] = useState<string[]>(session.known_diagnoses);
  const [meds, setMeds] = useState<MedEntry[]>(session.current_meds);
  const [errors, setErrors] = useState<string[]>([]);

  function save() {
    const problems = [];
    if (parseAge(draft) === null) problems.push("Informe sua idade.");
    if (draft.sex === "") problems.push("Informe o sexo atribuído ao nascer.");
    setErrors(problems);
    if (problems.length) return;
    const full = toProfile(draft, { current_meds: meds });
    const profile = { age: full.age, sex_at_birth: full.sex_at_birth, reproductive: full.reproductive, conditions: full.conditions, habits: full.habits };
    updatePatient((s) => ({ ...s, profile, gender_identity: draft.genderIdentity.trim(), known_diagnoses: known, current_meds: meds }));
    router.push(nextStep(knowledgeBase.data, "/paciente/perfil"));
  }

  return (
    <div className="space-y-8">
      <ProfileFields value={draft} onChange={setDraft} variant="plain" />

      <fieldset>
        <legend className="font-medium text-slate-900">Algum profissional de saúde já disse que você tem…</legend>
        <p className="text-sm text-slate-600">Marque só o que já foi dito por um médico ou psicólogo. Pode deixar em branco.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {KNOWN_DIAGNOSES.map((d) => (
            <label key={d.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2">
              <input
                type="checkbox"
                checked={known.includes(d.id)}
                onChange={() => setKnown(known.includes(d.id) ? known.filter((x) => x !== d.id) : [...known, d.id])}
                className="h-5 w-5 accent-indigo-600"
              />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby="remedios">
        <h2 id="remedios" className="font-medium text-slate-900">Remédios que você usa hoje</h2>
        <p className="text-sm text-slate-600">Todos, não só os de saúde mental: anticoncepcional, remédio de pressão, anti-inflamatório…</p>
        <div className="mt-3">
          <MedicationPicker value={meds} onChange={setMeds} variant="plain" />
        </div>
      </section>

      {errors.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-900">
          {errors.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}
      <StepButtons onNext={save} back="/paciente/seguranca" />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <PatientShell path="/paciente/perfil" title="Sobre você">
      {(session) => <ProfileForm session={session} />}
    </PatientShell>
  );
}
