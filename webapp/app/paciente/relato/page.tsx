"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dictation from "@/app/components/patient/Dictation";
import PatientShell, { StepButtons } from "@/app/components/patient/PatientShell";
import { PATIENT_SUGGESTIONS } from "@/app/lib/flags";
import { knowledgeBase } from "@/app/lib/kb";
import { nextStep } from "@/app/lib/patient/flow";
import { updatePatient, type PatientSessionV1 } from "@/app/lib/patient/store";
import { detectCrisis, summarizeCrisis } from "@/app/lib/safety/crisis";
import { crisisLexicon } from "@/app/lib/safety/lexicon";

const MAX_TEXT = 4000;
// Loaded only when the switch is on: without it, the patient journey never talks to the server.
const PatientSuggestions = dynamic(() => import("@/app/components/patient/PatientSuggestions"), { ssr: false });

// The person's own words go to the report exactly as written. The crisis lexicon runs here, in the
// browser. Language-model suggestions are optional, need consent each time and stay off until a
// model passes the promotion gates (eval/README.md, POLICY §15).
function Story({ session }: { session: PatientSessionV1 }) {
  const router = useRouter();
  const [text, setText] = useState(session.relato);
  const lexiconCrisis = useMemo(() => summarizeCrisis(detectCrisis(text, crisisLexicon, "patient")).crisis, [text]);
  const [modelRisk, setModelRisk] = useState(false); // the model can add a risk signal, never remove one
  const crisis = lexiconCrisis || modelRisk;

  function save() {
    updatePatient((s) => ({ ...s, relato: text.slice(0, MAX_TEXT) }));
    if (crisis && session.screening.repeat_reason !== "crisis_language") router.push("/paciente/seguranca?repetir=relato");
    else router.push(nextStep(knowledgeBase.data, "/paciente/relato"));
  }

  return (
    <div>
      <p className="text-slate-700">
        Conte com as suas palavras: o que você está sentindo, desde quando, o que piora ou melhora, como isso afeta seu dia a
        dia. Do jeito que sair. Isso vai para o relatório exatamente como você escrever.
      </p>
      <label htmlFor="relato" className="sr-only">O que você está sentindo</label>
      <textarea
        id="relato"
        rows={9}
        value={text}
        maxLength={MAX_TEXT}
        onChange={(e) => setText(e.target.value)}
        className="mt-4 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-200"
        placeholder="Ex.: faz uns dois meses que não consigo dormir direito, choro à toa e não tenho vontade de sair de casa…"
      />
      <p className="mt-1 text-right text-sm text-slate-600">
        {text.length.toLocaleString("pt-BR")} / {MAX_TEXT.toLocaleString("pt-BR")}
      </p>
      <Dictation onText={(spoken) => setText((current) => (current.trim() ? `${current.trim()} ${spoken}` : spoken).slice(0, MAX_TEXT))} />
      {crisis && (
        <div role="alert" className="mt-4 rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-rose-950">
          <p className="font-semibold">O que você escreveu nos preocupa.</p>
          <p className="mt-1">
            Se você está pensando em se machucar, ligue agora <a href="tel:188" className="font-semibold underline">188</a> (CVV, 24 horas) ou{" "}
            <a href="tel:192" className="font-semibold underline">192</a> (SAMU). <Link href="/ajuda-agora" className="underline">Mais formas de ajuda</Link>
          </p>
        </div>
      )}
      {PATIENT_SUGGESTIONS && <PatientSuggestions text={text} session={session} onRisk={() => setModelRisk(true)} />}
      <StepButtons onNext={save} nextLabel={text.trim() ? "Continuar" : "Pular por enquanto"} back="/paciente/perfil" />
    </div>
  );
}

export default function StoryPage() {
  return (
    <PatientShell path="/paciente/relato" title="O que você está sentindo">
      {(session) => <Story session={session} />}
    </PatientShell>
  );
}
