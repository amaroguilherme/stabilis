"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AlertList from "@/app/components/engine/AlertList";
import SourceRefs from "@/app/components/engine/SourceRefs";
import QuestionBox from "@/app/components/patient/QuestionBox";
import MedicationPicker from "@/app/components/professional/MedicationPicker";
import ProfileFields, { EMPTY_PROFILE, fromProfile, toProfile, type ProfileDraft } from "@/app/components/professional/ProfileFields";
import { evaluate } from "@/app/lib/engine/evaluate";
import { renderMessage } from "@/app/lib/engine/messages";
import type { DoseCheck, EngineOutput, MedEntry, MedReviewItem } from "@/app/lib/engine/types";
import { knowledgeBase } from "@/app/lib/kb";
import { createLabels } from "@/app/lib/kb/labels";
import { usePatient } from "@/app/lib/patient/store";
import { crisisLexicon } from "@/app/lib/safety/lexicon";

const kb = knowledgeBase.data;
const labels = createLabels(kb);
const bloodTests = new Set(kb.vocab.monitoring.monitoring.filter((m) => m.blood_test).map((m) => m.id));

const DOSE_TEXT: Record<DoseCheck, string> = {
  within_usual: "A dose está dentro da faixa usual da bula.",
  below_usual: "A dose está abaixo da faixa usual da bula. Pode ser de propósito (começo do tratamento, idade, outros remédios): vale perguntar.",
  above_usual: "A dose está acima da faixa usual da bula, mas não passa da máxima. Vale confirmar com o médico.",
  above_max: "A dose informada passa da dose máxima da bula. Confirme com o médico ou o farmacêutico.",
  no_label_data: "A bula de referência não traz uma faixa de dose para comparar.",
  no_dose_informed: "Você não informou a dose: sem ela, não dá para comparar com a bula.",
};

// Questions anyone can ask about a new prescription (not tied to a rule).
const GENERAL_QUESTIONS = [
  "Para que serve cada remédio e por quanto tempo vou tomar?",
  "Em quanto tempo devo sentir algum efeito?",
  "O que faço se esquecer uma dose?",
  "Posso parar quando melhorar, ou preciso diminuir aos poucos?",
];

function MedicineCard({ item, output }: { item: MedReviewItem; output: EngineOutput }) {
  const drug = item.drug_id ? labels.drug(item.drug_id) : undefined;
  if (!drug) {
    return (
      <li className="rounded-2xl border border-rose-200 bg-white p-5">
        <p className="text-lg font-semibold text-slate-900">“{item.raw_text}”</p>
        <p className="mt-2 text-slate-800">
          Não reconhecemos este nome. Mostre o remédio ao farmacêutico ou ao médico: não conseguimos verificar dose, interações nem cuidados.
        </p>
      </li>
    );
  }
  const effects = drug.common_effects ? kb.vocab.effects.effects.filter((e) => drug.common_effects?.effects.includes(e.id)) : [];
  const exams = item.monitoring.filter((m) => bloodTests.has(m.id) || m.id === "ecg");
  const interactions = output.interactions.filter((ix) => ix.drugs.includes(drug.id));
  return (
    <li className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-lg font-semibold text-slate-900">{drug.names.display_pt}</p>
        <p className="text-slate-600">
          {labels.drugClass(drug)} · você escreveu “{item.raw_text}”
        </p>
      </div>
      <p className="text-slate-800">{DOSE_TEXT[item.dose_check]}</p>
      {item.alerts.length > 0 && <AlertList alerts={item.alerts} kb={kb} labels={labels} variant="plain" compact />}
      {interactions.length > 0 && (
        <div>
          <p className="font-medium text-slate-900">Junto com os outros remédios</p>
          <ul className="mt-1 space-y-2">
            {interactions.map((ix, i) => (
              <li key={`${ix.interaction_id}-${i}`} className="text-slate-800">
                {renderMessage(kb, ix.message, "plain")}
                <SourceRefs cites={ix.sources} labels={labels} className="mt-1" size="base" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {effects.length > 0 && drug.common_effects && (
        <div>
          <p className="font-medium text-slate-900">Efeitos colaterais mais comuns (segundo a bula)</p>
          <p className="mt-1 text-slate-800">{effects.map((e) => e.label_plain).join(", ")}.</p>
          <SourceRefs cites={[drug.common_effects.cite]} labels={labels} className="mt-1" size="base" />
        </div>
      )}
      {exams.length > 0 && (
        <p className="text-slate-800">
          <span className="font-medium">Exames durante o uso: </span>
          {exams.map((m) => labels.monitoring(m.id)).join("; ")}.
        </p>
      )}
      <p className="text-slate-800">
        {!drug.sus || drug.sus.component === "nao_consta"
          ? "Não está na lista nacional de remédios do SUS (RENAME 2024)."
          : "Está na lista nacional de remédios do SUS (RENAME 2024). A disponibilidade varia por município: pergunte na UBS ou na farmácia do SUS."}
      </p>
    </li>
  );
}

export default function UnderstandPrescriptionPage() {
  const [profile, setProfile] = useState<ProfileDraft>(EMPTY_PROFILE);
  const [meds, setMeds] = useState<MedEntry[]>([]);
  const [ownQuestions, setOwnQuestions] = useState<string[]>([]);
  const stored = usePatient();
  const saved = stored.status === "ready" ? stored.value : null;

  const output = useMemo(
    () => evaluate(knowledgeBase, { mode: "patient", condition: null, profile: toProfile(profile, { current_meds: meds }) }, { crisisLexicon }),
    [profile, meds],
  );
  const seen = new Set<string>();
  const questions = [...output.questions.map((q) => renderMessage(kb, q.message, "plain")), ...GENERAL_QUESTIONS].filter((q) => !seen.has(q) && !!seen.add(q)).slice(0, 8);
  const allQuestions = [...questions, ...ownQuestions.filter((q) => !seen.has(q))];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-base sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold text-slate-900">Entender minha receita</h1>
      <p className="mt-3 text-slate-700">
        Digite os remédios da sua receita (o nome que está na caixa serve). Mostramos o que cada um é, se a dose bate com a bula,
        os cuidados para o seu caso e o que perguntar. Nada fica guardado: ao sair da página, some.
      </p>

      {saved && (
        <button
          type="button"
          onClick={() => {
            setProfile(fromProfile({ ...saved.profile, current_meds: saved.current_meds }, saved.gender_identity));
            setMeds(saved.current_meds);
          }}
          className="mt-4 min-h-12 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 font-medium text-indigo-800"
        >
          Usar os dados que você já preencheu
        </button>
      )}

      <section aria-labelledby="rx-meds" className="mt-8">
        <h2 id="rx-meds" className="text-lg font-semibold text-slate-900">Remédios da receita</h2>
        <div className="mt-3">
          <MedicationPicker value={meds} onChange={setMeds} variant="plain" />
        </div>
      </section>

      <section aria-labelledby="rx-you" className="mt-8">
        <h2 id="rx-you" className="text-lg font-semibold text-slate-900">Sobre você</h2>
        <p className="text-slate-600">Idade, sexo ao nascer, gravidez e outros problemas de saúde mudam os cuidados com cada remédio.</p>
        <div className="mt-3">
          <ProfileFields value={profile} onChange={setProfile} variant="plain" />
        </div>
      </section>

      <section aria-labelledby="rx-result" aria-live="polite" className="mt-10 space-y-4">
        <h2 id="rx-result" className="text-xl font-semibold text-slate-900">O que a receita diz</h2>
        {meds.length === 0 ? (
          <p className="text-slate-600">Adicione pelo menos um remédio.</p>
        ) : (
          <>
            {(profile.age === "" || profile.sex === "") && (
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                Sem idade e sexo ao nascer, alguns cuidados (gravidez, idade) podem não aparecer.
              </p>
            )}
            <ul className="space-y-4">
              {output.medication_review.map((item, i) => <MedicineCard key={`${item.raw_text}-${i}`} item={item} output={output} />)}
            </ul>
            <div>
              <h3 className="font-semibold text-slate-900">Perguntas para o médico ou o farmacêutico</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-6 text-slate-800">{allQuestions.map((q) => <li key={q}>{q}</li>)}</ol>
            </div>
            <p className="text-slate-700">
              Não pare nem mude a dose por conta própria. Se algo aqui preocupa você, leve a receita e esta página ao médico ou à farmácia.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="rx-ask" className="mt-10 space-y-3">
        <h2 id="rx-ask" className="text-xl font-semibold text-slate-900">Tire uma dúvida</h2>
        <p className="text-slate-700">
          Pergunte sobre álcool, gravidez, amamentação, efeitos colaterais, exames, dose, SUS ou sobre usar dois remédios juntos.
          Respondemos só com o que tem fonte; quando não houver, dizemos que não sabemos.
        </p>
        <QuestionBox meds={meds} profile={toProfile(profile, { current_meds: meds })} onKeep={meds.length > 0 ? (q) => setOwnQuestions((list) => (list.includes(q) ? list : [...list, q])) : undefined} />
      </section>

      <p className="mt-10">
        <Link href="/paciente" className="text-indigo-700 underline">Montar o relatório completo para a consulta</Link>
      </p>
    </div>
  );
}
