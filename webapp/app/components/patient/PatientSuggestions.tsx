"use client";

import { useEffect, useRef, useState } from "react";
import { BackendError, describeBackendError, describeProgress, runJob, type JobProgress } from "@/app/lib/api/client";
import type { ExtractedMedication, ExtractionResult } from "@/app/lib/api/extraction";
import type { HistoryEntry, MedEntry } from "@/app/lib/engine/types";
import { knowledgeBase } from "@/app/lib/kb";
import { createLabels } from "@/app/lib/kb/labels";
import { updatePatient, type PatientSessionV1 } from "@/app/lib/patient/store";

// Optional suggestions from the language model in the patient journey (POLICY §15). Shown only when
// the build switch is on; each run needs the person's consent; nothing reaches the answers without
// confirmation, and the model can raise a risk signal but never clear one.

const kb = knowledgeBase.data;
const labels = createLabels(kb);
const plainComorbidity = new Map([...kb.vocab.comorbidities.comorbidities, ...kb.vocab.comorbidities.habits].map((c) => [c.id, c.label_plain]));
const PREGNANCY = { pregnant: "Estou grávida", not_pregnant: "Não estou grávida", planning: "Planejo engravidar", breastfeeding: "Estou amamentando" } as const;

type Item = { key: string; title: string; evidence?: string; detail?: string };

function medTitle(m: ExtractedMedication): string {
  const name = m.drug_id ? labels.drugName(m.drug_id) : m.raw_text;
  const dose = m.mg_per_day ? ` · ${m.mg_per_day.toLocaleString("pt-BR")} mg por dia` : "";
  return `${m.status === "past" ? "Já usei" : "Uso"}: ${name}${dose}`;
}

export default function PatientSuggestions({ text, session, onRisk }: { text: string; session: PatientSessionV1; onRisk: () => void }) {
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const s = result?.suggestions;
  const known = new Set(session.current_meds.map((m) => m.drug_id).filter(Boolean));
  const tried = new Set(session.history.map((h) => h.drug_id).filter(Boolean));
  const meds = (s?.medications ?? []).map((m, i) => ({ m, key: `m:${i}` })).filter(({ m }) => m.drug_id && !(m.status === "past" ? tried : known).has(m.drug_id));
  const items: Item[] = s
    ? [
        ...meds.map(({ m, key }) => ({ key, title: medTitle(m), evidence: m.evidence, detail: m.status === "unknown" ? "Confira se ainda usa." : undefined })),
        ...s.conditions.filter((c) => !session.profile.conditions.includes(c.id)).map((c) => ({ key: `c:${c.id}`, title: plainComorbidity.get(c.id) ?? c.id, evidence: c.evidence })),
        ...s.habits.filter((h) => !session.profile.habits.includes(h.id)).map((h) => ({ key: `h:${h.id}`, title: plainComorbidity.get(h.id) ?? h.id, evidence: h.evidence })),
        ...(s.pregnancy ? [{ key: "p", title: PREGNANCY[s.pregnancy.status], evidence: s.pregnancy.evidence }] : []),
      ]
    : [];

  async function start() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setResult(null);
    setApplied(null);
    try {
      const data = await runJob<ExtractionResult>("extract", { task: "patient", text }, { signal: controller.signal, onProgress: setProgress });
      if (data.crisis.language || data.crisis.llm_risk) onRisk();
      setResult(data);
      setSelected(new Set());
    } catch (err) {
      if (!(err instanceof BackendError && err.code === "aborted")) setError(describeBackendError(err));
    } finally {
      setRunning(false);
    }
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function apply() {
    if (!s) return;
    const chosen = items.filter((item) => selected.has(item.key));
    const pickedMeds = meds.filter(({ key }) => selected.has(key)).map(({ m }) => m);
    updatePatient((current) => {
      const newCurrent: MedEntry[] = pickedMeds.filter((m) => m.status !== "past").map((m) => ({ drug_id: m.drug_id, raw_text: m.raw_text, mg_per_day: m.mg_per_day }));
      const newHistory: HistoryEntry[] = pickedMeds
        .filter((m) => m.status === "past")
        .map((m) => ({ drug_id: m.drug_id, raw_text: m.raw_text, still_using: false, mg_per_day: m.mg_per_day, duration_months: null, response: null, side_effects: [], stop_reason: null }));
      const conditions = s.conditions.filter((c) => selected.has(`c:${c.id}`)).map((c) => c.id);
      const habits = s.habits.filter((h) => selected.has(`h:${h.id}`)).map((h) => h.id);
      const pregnancy = s.pregnancy && selected.has("p") ? s.pregnancy.status : null;
      const reproductive = { ...current.profile.reproductive };
      if (pregnancy === "pregnant") reproductive.pregnant = "yes";
      if (pregnancy === "not_pregnant") reproductive.pregnant = "no";
      if (pregnancy === "planning") reproductive.planning = true;
      if (pregnancy === "breastfeeding") reproductive.breastfeeding = true;
      return {
        ...current,
        current_meds: [...current.current_meds, ...newCurrent],
        history: [...current.history, ...newHistory],
        profile: {
          ...current.profile,
          reproductive,
          conditions: [...new Set([...current.profile.conditions, ...conditions])],
          habits: [...new Set([...current.profile.habits, ...habits])],
        },
      };
    });
    setApplied(chosen.length);
    setResult(null);
  }

  return (
    <section aria-labelledby="sugestoes" className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 id="sugestoes" className="text-lg font-semibold text-slate-900">Quer ajuda para organizar o que você escreveu? (opcional)</h2>
      <p className="text-slate-700">
        Um programa pode ler o seu texto e sugerir remédios, problemas de saúde, hábitos e gravidez para você conferir. Nada entra nas
        suas respostas sem você marcar.
      </p>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-indigo-600" />
        <span className="text-slate-800">
          Concordo em enviar este texto ao servidor do Stabilis, que fica fora do Brasil, para ser lido por um modelo de linguagem. O texto é
          usado só para isso e descartado em seguida: não é guardado nem registrado.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={!consent || running || text.trim().length < 20}
          className="min-h-12 rounded-xl border border-indigo-300 bg-indigo-50 px-5 py-3 font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ler meu texto
        </button>
        {running && (
          <button type="button" onClick={() => abortRef.current?.abort()} className="min-h-12 px-3 py-3 text-slate-700 underline underline-offset-2">
            Cancelar
          </button>
        )}
      </div>
      {text.trim().length < 20 && <p className="text-sm text-slate-600">Escreva um pouco mais para usar esta ajuda.</p>}
      <p aria-live="polite" className="text-slate-700">
        {running ? describeProgress(progress, "Lendo o seu texto. Isso pode levar um ou dois minutos...") : applied !== null ? `${applied} ${applied === 1 ? "item adicionado" : "itens adicionados"} às suas respostas. Você pode revisar em "Sobre você".` : ""}
      </p>
      {error && <p role="alert" className="text-rose-800">{error}</p>}
      {result && (
        <div className="space-y-3">
          {result.degraded && <p className="text-amber-900">O programa não conseguiu ler o texto agora. Você pode continuar normalmente.</p>}
          {items.length === 0 ? (
            <p className="text-slate-700">Não encontramos nada novo para sugerir.</p>
          ) : (
            <fieldset>
              <legend className="font-medium text-slate-900">Marque o que estiver certo</legend>
              <ul className="mt-2 space-y-2">
                {items.map((item) => (
                  <li key={item.key}>
                    <label className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 ${selected.has(item.key) ? "border-indigo-600 bg-indigo-50" : "border-slate-300 bg-white"}`}>
                      <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggle(item.key)} className="mt-1 h-5 w-5 shrink-0 accent-indigo-600" />
                      <span>
                        <span className="font-medium text-slate-900">{item.title}</span>
                        {item.evidence && <span className="block text-sm text-slate-700">Você escreveu: “{item.evidence}”</span>}
                        {item.detail && <span className="block text-sm text-amber-900">{item.detail}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <div className="flex flex-wrap gap-3">
            {items.length > 0 && (
              <button type="button" onClick={apply} className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
                Adicionar os marcados
              </button>
            )}
            <button type="button" onClick={() => setResult(null)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800">
              Descartar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
