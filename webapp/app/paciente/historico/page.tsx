"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import PatientShell, { StepButtons } from "@/app/components/patient/PatientShell";
import { knowledgeBase } from "@/app/lib/kb";
import { useBrands } from "@/app/lib/kb/brands";
import { buildMedIndex, parseDailyDoseMg, searchMeds, type MedMatch } from "@/app/lib/meds/search";
import { nextStep } from "@/app/lib/patient/flow";
import { updatePatient, type PatientSessionV1, type TreatmentHistoryEntry } from "@/app/lib/patient/store";

const kb = knowledgeBase.data;
const PSYCH_CLASSES = new Set(["antidepressant", "mood_stabilizer", "antipsychotic", "anxiolytic_hypnotic"]);
const RESPONSES: { value: NonNullable<TreatmentHistoryEntry["response"]>; label: string }[] = [
  { value: "good", label: "Ajudou" },
  { value: "partial", label: "Ajudou um pouco" },
  { value: "none", label: "Não ajudou" },
  { value: "unknown", label: "Não sei" },
];
const STOP_REASONS: { value: NonNullable<TreatmentHistoryEntry["stop_reason"]>; label: string }[] = [
  { value: "side_effects", label: "Efeitos colaterais" },
  { value: "no_effect", label: "Não fez efeito" },
  { value: "cost", label: "Custo" },
  { value: "ran_out", label: "Faltou o remédio" },
  { value: "doctor_changed", label: "O médico trocou" },
  { value: "felt_better", label: "Melhorei" },
  { value: "other", label: "Outro motivo" },
];

const nameOf = (entry: TreatmentHistoryEntry) => (entry.drug_id ? (kb.drugs.find((d) => d.id === entry.drug_id)?.names.display_pt ?? entry.raw_text) : entry.raw_text);

function blank(drugId: string | null, raw: string, stillUsing: boolean | null): TreatmentHistoryEntry {
  return { drug_id: drugId, raw_text: raw, still_using: stillUsing, mg_per_day: parseDailyDoseMg(raw), duration_months: null, response: null, side_effects: [], stop_reason: null };
}

function EntryEditor({ entry, onChange, onRemove }: { entry: TreatmentHistoryEntry; onChange: (e: TreatmentHistoryEntry) => void; onRemove: () => void }) {
  const set = (patch: Partial<TreatmentHistoryEntry>) => onChange({ ...entry, ...patch });
  const choice = "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm";
  return (
    <li className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-semibold text-slate-900">{nameOf(entry)}</p>
        <button type="button" onClick={onRemove} className="min-h-11 px-2 text-sm text-slate-600 underline">remover</button>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Ainda usa?</legend>
        <div className="mt-1 flex gap-2">
          {[{ v: true, l: "Sim" }, { v: false, l: "Não" }].map((o) => (
            <label key={o.l} className={`${choice} ${entry.still_using === o.v ? "border-indigo-600 bg-indigo-50" : "border-slate-300"}`}>
              <input type="radio" checked={entry.still_using === o.v} onChange={() => set({ still_using: o.v, stop_reason: o.v ? null : entry.stop_reason })} className="accent-indigo-600" />
              {o.l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">
          Por quanto tempo (meses)
          <input type="number" min={0} max={600} value={entry.duration_months ?? ""} onChange={(e) => set({ duration_months: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Quantos mg por dia (se souber)
          <input type="number" min={0} value={entry.mg_per_day ?? ""} onChange={(e) => set({ mg_per_day: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Ajudou?</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {RESPONSES.map((o) => (
            <label key={o.value} className={`${choice} ${entry.response === o.value ? "border-indigo-600 bg-indigo-50" : "border-slate-300"}`}>
              <input type="radio" checked={entry.response === o.value} onChange={() => set({ response: o.value })} className="accent-indigo-600" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Teve algum destes efeitos?</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {kb.vocab.effects.effects.map((e) => (
            <label key={e.id} className={`${choice} ${entry.side_effects.includes(e.id) ? "border-indigo-600 bg-indigo-50" : "border-slate-200"}`}>
              <input
                type="checkbox"
                checked={entry.side_effects.includes(e.id)}
                onChange={() => set({ side_effects: entry.side_effects.includes(e.id) ? entry.side_effects.filter((x) => x !== e.id) : [...entry.side_effects, e.id] })}
                className="accent-indigo-600"
              />
              {e.label_plain}
            </label>
          ))}
        </div>
      </fieldset>
      {entry.still_using === false && (
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">Por que parou?</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {STOP_REASONS.map((o) => (
              <label key={o.value} className={`${choice} ${entry.stop_reason === o.value ? "border-indigo-600 bg-indigo-50" : "border-slate-300"}`}>
                <input type="radio" checked={entry.stop_reason === o.value} onChange={() => set({ stop_reason: o.value })} className="accent-indigo-600" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </li>
  );
}

function History({ session }: { session: PatientSessionV1 }) {
  const router = useRouter();
  const brands = useBrands();
  const index = useMemo(() => buildMedIndex(kb, brands ?? {}), [brands]);
  // Psychiatric medicines already informed as current start the list, so the person can say how they are going.
  const [entries, setEntries] = useState<TreatmentHistoryEntry[]>(() => {
    if (session.history.length) return session.history;
    return session.current_meds
      .filter((m) => m.drug_id && PSYCH_CLASSES.has(kb.drugs.find((d) => d.id === m.drug_id)?.class ?? ""))
      .map((m) => ({ ...blank(m.drug_id, m.raw_text, true), mg_per_day: m.mg_per_day ?? null }));
  });
  const [query, setQuery] = useState("");
  const suggestions: MedMatch[] = searchMeds(kb, index, query, 6).filter((m) => PSYCH_CLASSES.has(kb.drugs.find((d) => d.id === m.drug_id)?.class ?? ""));

  function add(match: MedMatch | null) {
    const raw = query.trim();
    if (!raw) return;
    setEntries([...entries, blank(match?.drug_id ?? null, match ? (match.kind === "brand" ? match.matched : match.label) : raw, false)]);
    setQuery("");
  }

  return (
    <div>
      <p className="text-slate-700">
        Remédios para saúde mental que você já usou (ou usa): como foi, se ajudou e por que parou. Isso ajuda o médico a não
        repetir o que não funcionou. Pode pular se nunca usou.
      </p>
      <ul className="mt-6 space-y-4">
        {entries.map((entry, i) => (
          <EntryEditor key={i} entry={entry} onChange={(e) => setEntries(entries.map((x, j) => (j === i ? e : x)))} onRemove={() => setEntries(entries.filter((_, j) => j !== i))} />
        ))}
      </ul>
      <div className="relative mt-6">
        <label htmlFor="hist-search" className="block font-medium text-slate-900">Adicionar um remédio que você já usou</label>
        <input
          id="hist-search"
          type="text"
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          className="mt-1 w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-base focus:border-indigo-500 focus:outline-none"
          placeholder="ex.: fluoxetina, Rivotril"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {suggestions.map((m) => (
              <li key={`${m.drug_id}-${m.matched}`}>
                <button type="button" onClick={() => add(m)} className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left hover:bg-indigo-50">
                  <span>{m.kind === "brand" ? m.matched : m.label}</span>
                  {m.kind === "brand" && <span className="text-sm text-slate-600">{m.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && suggestions.length === 0 && (
          <button type="button" onClick={() => add(null)} className="mt-2 min-h-11 text-sm text-indigo-700 underline">
            Adicionar “{query.trim()}” mesmo assim
          </button>
        )}
      </div>
      <StepButtons
        onNext={() => {
          updatePatient((s) => ({ ...s, history: entries }));
          router.push(nextStep(kb, "/paciente/historico"));
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
