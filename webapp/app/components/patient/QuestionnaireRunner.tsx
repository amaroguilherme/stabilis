"use client";

import { useId, useState } from "react";
import { isAsked } from "@/app/lib/engine/instruments";
import type { Instrument, InstrumentAnswers } from "@/app/lib/engine/types";

// One question per screen, with big answer targets. Skip logic comes from the instrument (ask_if).
export default function QuestionnaireRunner({
  instrument,
  initial,
  onFinish,
  onSkip,
  skipLabel,
}: {
  instrument: Instrument;
  initial?: InstrumentAnswers;
  onFinish: (answers: InstrumentAnswers) => void;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const id = useId();
  const [answers, setAnswers] = useState<InstrumentAnswers>(initial ?? {});
  const [position, setPosition] = useState(0);

  // An item counts while it may still be asked: its trigger questions are unanswered or positive.
  const asked = instrument.items.filter((item) => {
    if (!item.ask_if) return true;
    const pending = item.ask_if.items.filter((id) => answers[id] === undefined).length;
    return pending > 0 ? isAsked(item, answers) || pending + item.ask_if.items.filter((id) => (answers[id] ?? 0) > 0).length >= item.ask_if.min_yes : isAsked(item, answers);
  });
  const item = asked[Math.min(position, asked.length - 1)];
  const options = item.options ?? instrument.options;
  const value = answers[item.id];
  const last = position >= asked.length - 1;

  function next() {
    if (value === undefined) return;
    if (last) {
      const kept: InstrumentAnswers = {};
      for (const a of asked) kept[a.id] = answers[a.id];
      onFinish(kept);
    } else setPosition(position + 1);
  }

  return (
    <div>
      {instrument.instructions && position === 0 && <p className="mb-4 whitespace-pre-line rounded-xl bg-slate-100 px-4 py-3 text-slate-800">{instrument.instructions}</p>}
      <p className="text-sm text-slate-600" aria-live="polite">
        Pergunta {position + 1} de {asked.length}
      </p>
      <fieldset className="mt-2">
        <legend className="text-lg font-semibold text-slate-900">
          {instrument.stem && <span className="mb-2 block text-base font-normal text-slate-700">{instrument.stem}</span>}
          {item.text}
        </legend>
        <div className="mt-4 grid gap-3">
          {options.map((option) => (
            <label
              key={option.value}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-base ${value === option.value ? "border-indigo-600 bg-indigo-50" : "border-slate-300 bg-white"}`}
            >
              <input
                type="radio"
                name={`${id}-${item.id}`}
                value={option.value}
                checked={value === option.value}
                onChange={() => setAnswers({ ...answers, [item.id]: option.value })}
                className="h-5 w-5 accent-indigo-600"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={next}
          disabled={value === undefined}
          className="min-h-12 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {last ? "Concluir" : "Próxima"}
        </button>
        {position > 0 && (
          <button type="button" onClick={() => setPosition(position - 1)} className="min-h-12 px-4 py-3 text-slate-700 underline underline-offset-2">
            Pergunta anterior
          </button>
        )}
        {onSkip && (
          <button type="button" onClick={onSkip} className="min-h-12 px-4 py-3 text-slate-600 underline underline-offset-2">
            {skipLabel ?? "Pular este questionário"}
          </button>
        )}
      </div>
      {instrument.license_note && <p className="mt-8 text-sm text-slate-600">{instrument.name}. {instrument.license_note}</p>}
    </div>
  );
}
