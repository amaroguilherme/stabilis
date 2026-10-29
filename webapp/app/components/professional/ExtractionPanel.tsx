"use client";

import { useEffect, useRef, useState } from "react";
import { BackendError, describeBackendError, describeProgress, runJob, type JobProgress } from "@/app/lib/api/client";
import type { ExtractedMedication, ExtractionResult } from "@/app/lib/api/extraction";
import { knowledgeBase } from "@/app/lib/kb";
import { createLabels } from "@/app/lib/kb/labels";

const labels = createLabels(knowledgeBase.data);
const REASONS = { negated: "negado no texto", other_person: "sobre outra pessoa", hypothetical: "hipotético" } as const;
const PREGNANCY = { pregnant: "gestante", not_pregnant: "não gestante", planning: "planeja engravidar", breastfeeding: "amamentando" } as const;

export interface ExtractionChoice {
  conditions: string[];
  habits: string[];
  medications: ExtractedMedication[];
  pregnancy: NonNullable<ExtractionResult["suggestions"]["pregnancy"]>["status"] | null;
}

// Shows the passage of the text that supports a suggestion, with some context around it.
function Evidence({ text, evidence }: { text: string; evidence: string }) {
  const at = text.toLowerCase().indexOf(evidence.toLowerCase());
  if (at < 0) return <q className="text-slate-700">{evidence}</q>;
  const start = Math.max(0, at - 30);
  const end = Math.min(text.length, at + evidence.length + 30);
  return (
    <span className="text-slate-700">
      {start > 0 ? "…" : ""}
      {text.slice(start, at)}
      <mark className="rounded bg-amber-100 px-0.5 text-slate-900">{text.slice(at, at + evidence.length)}</mark>
      {text.slice(at + evidence.length, end)}
      {end < text.length ? "…" : ""}
    </span>
  );
}

function Row({ checked, onChange, title, children }: { checked: boolean; onChange: () => void; title: string; children: React.ReactNode }) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
        <input type="checkbox" checked={checked} onChange={onChange} className="mt-1 accent-indigo-600" />
        <span>
          <span className="font-medium text-slate-900">{title}</span>
          <span className="mt-0.5 block text-xs">{children}</span>
        </span>
      </label>
    </li>
  );
}

/**
 * "Extract from text": sends the anamnesis to the language service, then lists what it found, each
 * item with its evidence, for the professional to confirm before anything reaches the form.
 */
export default function ExtractionPanel({ text, onApply }: { text: string; onApply: (choice: ExtractionChoice) => void }) {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; data: ExtractionResult } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function start() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const data = await runJob<ExtractionResult>("extract", { task: "professional", text }, { signal: controller.signal, onProgress: setProgress });
      const s = data.suggestions;
      setSelected(
        new Set([
          ...s.conditions.map((c) => `c:${c.id}`),
          ...s.habits.map((h) => `h:${h.id}`),
          ...s.medications.map((m, i) => (m.drug_id && m.status !== "past" ? `m:${i}` : "")).filter(Boolean),
          ...(s.pregnancy && s.pregnancy.status !== "not_pregnant" ? ["p"] : []),
        ]),
      );
      setResult({ text, data });
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
    if (!result) return;
    const s = result.data.suggestions;
    onApply({
      conditions: s.conditions.filter((c) => selected.has(`c:${c.id}`)).map((c) => c.id),
      habits: s.habits.filter((h) => selected.has(`h:${h.id}`)).map((h) => h.id),
      medications: s.medications.filter((_, i) => selected.has(`m:${i}`)),
      pregnancy: s.pregnancy && selected.has("p") ? s.pregnancy.status : null,
    });
    setResult(null);
  }

  const s = result?.data.suggestions;
  const nothing = s && !s.conditions.length && !s.habits.length && !s.medications.length && !s.pregnancy;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={running || text.trim().length < 20}
          className="min-h-11 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Extrair do texto
        </button>
        {running && (
          <button type="button" onClick={() => abortRef.current?.abort()} className="text-sm text-slate-600 underline underline-offset-2">
            cancelar
          </button>
        )}
      </div>
      <p className="text-xs text-slate-600">
        Envia o texto ao servidor do Stabilis, que fica fora do Brasil, só para esta extração (modelo de linguagem). Nada é
        armazenado nem registrado, e nada muda no formulário sem a sua confirmação. Não inclua nome, documentos nem outros
        dados que identifiquem a pessoa.
      </p>
      {running && (
        <p aria-live="polite" className="text-sm text-slate-700">
          {describeProgress(progress, "Lendo o texto. Isso pode levar até 1 ou 2 minutos...")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}

      {result && s && (
        <section aria-label="Sugestões extraídas do texto" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {result.data.degraded && (
            <p className="text-sm text-amber-900">
              O modelo de linguagem não respondeu. Abaixo, só o que foi encontrado sem ele (nomes de medicamentos e menção a risco).
            </p>
          )}
          {result.data.crisis.language && (
            <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-950">
              O texto menciona risco de suicídio ou autolesão. Avalie o risco e marque “Presente” em “Risco de suicídio na avaliação”, se for o caso.
            </p>
          )}
          {nothing && <p className="text-sm text-slate-700">Nenhuma informação para preencher foi encontrada no texto.</p>}

          {(s.conditions.length > 0 || s.habits.length > 0) && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Comorbidades e hábitos</h4>
              <ul className="mt-2 space-y-2">
                {s.conditions.map((c) => (
                  <Row key={c.id} checked={selected.has(`c:${c.id}`)} onChange={() => toggle(`c:${c.id}`)} title={labels.comorbidity(c.id)}>
                    <Evidence text={result.text} evidence={c.evidence} />
                  </Row>
                ))}
                {s.habits.map((h) => (
                  <Row key={h.id} checked={selected.has(`h:${h.id}`)} onChange={() => toggle(`h:${h.id}`)} title={labels.comorbidity(h.id)}>
                    <Evidence text={result.text} evidence={h.evidence} />
                  </Row>
                ))}
              </ul>
            </div>
          )}

          {s.medications.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Medicamentos</h4>
              <ul className="mt-2 space-y-2">
                {s.medications.map((m, i) => (
                  <Row
                    key={`${m.raw_text}-${i}`}
                    checked={selected.has(`m:${i}`)}
                    onChange={() => toggle(`m:${i}`)}
                    title={`${m.drug_id ? labels.drugName(m.drug_id) : `${m.raw_text} (não reconhecido)`}${m.mg_per_day ? ` · ${m.mg_per_day.toLocaleString("pt-BR")} mg/dia` : ""}${m.status === "past" ? " · uso anterior" : m.status === "unknown" ? " · confirme se ainda usa" : ""}`}
                  >
                    <Evidence text={result.text} evidence={m.evidence} />
                    {m.candidates.length > 1 && <span className="block text-amber-900">Nome ambíguo: {m.candidates.map(labels.drugName).join(" ou ")}.</span>}
                  </Row>
                ))}
              </ul>
            </div>
          )}

          {s.pregnancy && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Gravidez e amamentação</h4>
              <ul className="mt-2">
                <Row checked={selected.has("p")} onChange={() => toggle("p")} title={PREGNANCY[s.pregnancy.status]}>
                  {s.pregnancy.evidence ? <Evidence text={result.text} evidence={s.pregnancy.evidence} /> : null}
                </Row>
              </ul>
            </div>
          )}

          {result.data.excluded.length > 0 && (
            <details className="text-sm text-slate-700">
              <summary className="cursor-pointer">Itens ignorados ({result.data.excluded.length})</summary>
              <ul className="mt-2 space-y-1 pl-4 text-xs">
                {result.data.excluded.map((e, i) => (
                  <li key={i}>
                    “{e.evidence}”: {REASONS[e.reason]}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap gap-3">
            {!nothing && (
              <button type="button" onClick={apply} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Aplicar selecionados
              </button>
            )}
            <button type="button" onClick={() => setResult(null)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800">
              Descartar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
