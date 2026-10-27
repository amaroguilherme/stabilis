"use client";

import { useId, useMemo, useState } from "react";
import type { MedEntry } from "@/app/lib/engine/types";
import { knowledgeBase } from "@/app/lib/kb";
import { buildMedIndex, parseDailyDoseMg, searchMeds, type MedMatch } from "@/app/lib/meds/search";

const kb = knowledgeBase.data;
const labelOf = (id: string) => kb.drugs.find((d) => d.id === id)?.names.display_pt ?? id;

// Current medications: search by name, ingredient or brand; unknown names can still be added and
// are shown as "not recognized" in the result, never dropped.
export default function MedicationPicker({ value, onChange }: { value: MedEntry[]; onChange: (meds: MedEntry[]) => void }) {
  const index = useMemo(() => buildMedIndex(kb), []);
  const [text, setText] = useState("");
  const [dose, setDose] = useState("");
  const [selected, setSelected] = useState<MedMatch | null>(null);
  const [typed, setTyped] = useState(""); // what the person typed before choosing, kept as raw_text
  const [error, setError] = useState<string | null>(null);
  const ids = { search: useId(), dose: useId(), list: useId(), error: useId() };

  const suggestions = selected ? [] : searchMeds(kb, index, text, 8);

  function choose(match: MedMatch) {
    setSelected(match);
    setTyped(text.trim());
    setText(match.kind === "brand" ? `${match.matched} (${match.label})` : match.label);
    const parsed = parseDailyDoseMg(text);
    if (parsed !== null && dose === "") setDose(String(parsed));
    setError(null);
  }

  function add(unrecognized = false) {
    const raw = text.trim();
    if (!raw) {
      setError("Digite o nome do medicamento.");
      return;
    }
    const mg = dose.trim() === "" ? null : Number(dose.replace(",", "."));
    if (mg !== null && (!Number.isFinite(mg) || mg <= 0 || mg > 10000)) {
      setError("Informe a dose diária em mg (número maior que zero) ou deixe em branco.");
      return;
    }
    const drugId = unrecognized ? null : (selected?.drug_id ?? null);
    if (!unrecognized && !drugId) {
      setError("Escolha uma sugestão da lista, ou adicione como não reconhecido.");
      return;
    }
    if (drugId && value.some((m) => m.drug_id === drugId)) {
      setError(`${labelOf(drugId)} já está na lista.`);
      return;
    }
    onChange([...value, { drug_id: drugId, raw_text: drugId && typed ? typed : raw, mg_per_day: mg }]);
    setText("");
    setTyped("");
    setDose("");
    setSelected(null);
    setError(null);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <div className="relative">
          <label htmlFor={ids.search} className="block text-sm font-medium text-slate-800">Medicamento (nome, princípio ativo ou marca)</label>
          <input
            id={ids.search}
            type="text"
            value={text}
            autoComplete="off"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls={ids.list}
            aria-describedby={error ? ids.error : undefined}
            onChange={(e) => {
              setText(e.target.value);
              setSelected(null);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="ex.: sertralina, Rivotril, lítio"
          />
          {suggestions.length > 0 && (
            <ul id={ids.list} role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              {suggestions.map((match) => (
                <li key={`${match.drug_id}-${match.matched}`} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => choose(match)}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none"
                  >
                    <span className="font-medium text-slate-900">{match.kind === "brand" ? match.matched : match.label}</span>
                    <span className="text-xs text-slate-600">{match.kind === "brand" ? `marca de ${match.label}` : match.matched !== match.label ? match.matched : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label htmlFor={ids.dose} className="block text-sm font-medium text-slate-800">Dose total (mg/dia)</label>
          <input
            id={ids.dose}
            type="text"
            inputMode="decimal"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="opcional"
          />
        </div>
        <button
          type="button"
          onClick={() => add(false)}
          className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          Adicionar
        </button>
      </div>
      {error && (
        <p id={ids.error} role="alert" className="text-sm text-rose-700">
          {error}{" "}
          {!selected && text.trim() && (
            <button type="button" onClick={() => add(true)} className="font-medium underline underline-offset-2">
              Adicionar “{text.trim()}” como não reconhecido
            </button>
          )}
        </p>
      )}
      {value.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {value.map((med, i) => (
            <li key={`${med.raw_text}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-slate-900">{med.drug_id ? labelOf(med.drug_id) : med.raw_text}</span>
                {!med.drug_id && <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-900">não reconhecido</span>}
                {med.mg_per_day ? <span className="text-slate-600"> · {med.mg_per_day.toLocaleString("pt-BR")} mg/dia</span> : null}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="min-h-11 rounded px-2 text-sm text-slate-600 underline underline-offset-2 hover:text-rose-700"
                aria-label={`Remover ${med.drug_id ? labelOf(med.drug_id) : med.raw_text}`}
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
