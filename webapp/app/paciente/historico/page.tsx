"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PatientShell, { StepButtons } from "@/app/components/patient/PatientShell";
import HistoryEditor, { historyFromCurrent } from "@/app/components/shared/HistoryEditor";
import type { HistoryEntry } from "@/app/lib/engine/types";
import { knowledgeBase } from "@/app/lib/kb";
import { nextStep } from "@/app/lib/patient/flow";
import { updatePatient, type PatientSessionV1 } from "@/app/lib/patient/store";

function History({ session }: { session: PatientSessionV1 }) {
  const router = useRouter();
  // Psychiatric medicines already informed as current start the list, so the person can say how they are going.
  const [entries, setEntries] = useState<HistoryEntry[]>(() => (session.history.length ? session.history : historyFromCurrent(session.current_meds)));
  return (
    <div>
      <p className="mb-6 text-slate-700">
        Remédios para saúde mental que você já usou (ou usa): como foi, se ajudou e por que parou. Isso ajuda o médico a não
        repetir o que não funcionou. Pode pular se nunca usou.
      </p>
      <HistoryEditor value={entries} onChange={setEntries} variant="plain" />
      <StepButtons
        onNext={() => {
          updatePatient((s) => ({ ...s, history: entries }));
          router.push(nextStep(knowledgeBase.data, "/paciente/historico"));
        }}
        nextLabel={entries.length ? "Continuar" : "Nunca usei / pular"}
      />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <PatientShell path="/paciente/historico" title="Tratamentos que você já fez">
      {(session) => <History session={session} />}
    </PatientShell>
  );
}
