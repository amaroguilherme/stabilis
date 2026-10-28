"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PatientShell, { StepButtons } from "@/app/components/patient/PatientShell";
import { PREFERENCE_CONCERNS } from "@/app/lib/engine/evaluate";
import { knowledgeBase } from "@/app/lib/kb";
import { nextStep } from "@/app/lib/patient/flow";
import { PRIORITY_LABELS } from "@/app/lib/patient/report";
import { updatePatient, type PatientSessionV1 } from "@/app/lib/patient/store";

const OPTIONS = [
  { id: "weight_gain_significant", hint: "Alguns remédios aumentam o apetite e o peso." },
  { id: "sedation_significant", hint: "Alguns remédios dão sono, o que atrapalha trabalho e estudo." },
  { id: "sexual_dysfunction", hint: "Alguns remédios diminuem o desejo ou atrapalham o orgasmo." },
  { id: PREFERENCE_CONCERNS.prefer_sus, hint: "Remédios da lista nacional do SUS (RENAME) costumam estar na UBS ou na Farmácia Popular." },
  { id: PREFERENCE_CONCERNS.fewer_blood_tests, hint: "Alguns remédios exigem exames de sangue regulares." },
];

function Priorities({ session }: { session: PatientSessionV1 }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(session.priorities);
  return (
    <div>
      <p className="text-slate-700">
        O que é mais importante para você? Isso só muda a ordem dentro de cada grupo de opções; não muda o que a diretriz
        recomenda.
      </p>
      <div className="mt-6 grid gap-3">
        {OPTIONS.map((o) => (
          <label key={o.id} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-4 ${selected.includes(o.id) ? "border-indigo-600 bg-indigo-50" : "border-slate-300 bg-white"}`}>
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={() => setSelected(selected.includes(o.id) ? selected.filter((x) => x !== o.id) : [...selected, o.id])}
              className="mt-1 h-5 w-5 accent-indigo-600"
            />
            <span>
              <span className="font-medium text-slate-900">{PRIORITY_LABELS[o.id]}</span>
              <span className="block text-sm text-slate-600">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <StepButtons
        nextLabel="Ver meu resultado"
        onNext={() => {
          updatePatient((s) => ({ ...s, priorities: selected }));
          router.push(nextStep(knowledgeBase.data, "/paciente/prioridades"));
        }}
      />
    </div>
  );
}

export default function PrioritiesPage() {
  return (
    <PatientShell path="/paciente/prioridades" title="O que importa para você">
      {(session) => <Priorities session={session} />}
    </PatientShell>
  );
}
