"use client";

import { useId, useState } from "react";
import SourceRefs from "@/app/components/engine/SourceRefs";
import type { MedEntry, Profile } from "@/app/lib/engine/types";
import { knowledgeBase } from "@/app/lib/kb";
import { useBrands } from "@/app/lib/kb/brands";
import { createLabels } from "@/app/lib/kb/labels";
import { useSchedules } from "@/app/lib/kb/schedules";
import { answerQuestion, type QuestionAnswer } from "@/app/lib/patient/questions";
import { crisisLexicon } from "@/app/lib/safety/lexicon";

// "Tire uma dúvida": answers come only from the knowledge base, with sources, or say "não sei"
// (POLICY §16). Runs in the browser; the question goes nowhere.

const labels = createLabels(knowledgeBase.data);
const EXAMPLES = ["Posso beber álcool?", "Posso tomar se estiver grávida?", "Quais os efeitos mais comuns?", "Preciso fazer exames?", "Tem no SUS?"];

export default function QuestionBox({ meds, profile, onKeep }: { meds: MedEntry[]; profile: Profile; onKeep?: (question: string) => void }) {
  const id = useId();
  const brands = useBrands();
  const schedules = useSchedules();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<{ question: string; answer: QuestionAnswer } | null>(null);
  const [kept, setKept] = useState<string[]>([]);

  function ask(text: string) {
    const q = text.trim();
    if (q.length < 3) return;
    setQuestion(q);
    setAsked({ question: q, answer: answerQuestion(knowledgeBase, q, { meds, profile, lexicon: crisisLexicon, brands: brands ?? undefined, schedules: schedules ?? undefined }) });
  }

  function keep(q: string) {
    onKeep?.(q);
    setKept([...kept, q]);
  }

  // Kept questions join the list for the doctor, shown on the page only when there are medicines.
  const keepButton = (q: string) =>
    !onKeep ? null : kept.includes(q) ? (
      <p className="text-slate-700">Pergunta adicionada à lista para o médico ou o farmacêutico.</p>
    ) : (
      <button type="button" onClick={() => keep(q)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-800 hover:border-indigo-400">
        Adicionar às perguntas para o médico
      </button>
    );

  const answer = asked?.answer;
  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="space-y-3"
      >
        <label htmlFor={`${id}-q`} className="block font-medium text-slate-900">Sua pergunta</label>
        <div className="flex flex-wrap gap-2">
          <input
            id={`${id}-q`}
            type="text"
            maxLength={300}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex.: posso beber cerveja tomando esse remédio?"
            className="min-h-12 flex-1 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-200"
          />
          <button type="submit" className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">Perguntar</button>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Exemplos de perguntas">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button type="button" onClick={() => ask(example)} className="min-h-11 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:border-indigo-400">
                {example}
              </button>
            </li>
          ))}
        </ul>
      </form>

      <div aria-live="polite">
        {asked && answer && (
          <section aria-label="Resposta" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-600">Você perguntou: “{asked.question}”</p>
            {answer.kind === "crisis" && (
              <div role="alert" className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-rose-950">
                <p className="font-semibold">Sua pergunta nos preocupa, e não vamos respondê-la.</p>
                <p className="mt-1">
                  Se você está pensando em se machucar, ligue agora <a href="tel:188" className="font-semibold underline">188</a> (CVV, 24 horas) ou{" "}
                  <a href="tel:192" className="font-semibold underline">192</a> (SAMU), ou vá a uma UPA.
                </p>
              </div>
            )}
            {answer.kind === "no_drug" && <p className="text-slate-800">Diga o nome do remédio na pergunta, ou adicione-o à lista de remédios acima.</p>}
            {answer.kind === "unknown_topic" && (
              <>
                <p className="text-slate-800">Ainda não sabemos responder a esse tipo de pergunta com uma fonte confiável. Leve-a ao médico ou ao farmacêutico.</p>
                {keepButton(asked.question)}
              </>
            )}
            {answer.kind === "answer" &&
              answer.blocks.map((block) => (
                <div key={block.title} className="space-y-2 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                  <p className="font-semibold text-slate-900">{block.title}</p>
                  {block.lines.map((line) => <p key={line} className="text-slate-800">{line}</p>)}
                  {block.unknown ? keepButton(asked.question) : <SourceRefs cites={block.cites} labels={labels} size="base" collapse="De onde vem esta resposta" />}
                </div>
              ))}
            <p className="text-sm text-slate-600">
              As respostas vêm só da base do Stabilis, com a fonte de cada informação. Elas não substituem o médico ou o farmacêutico.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
