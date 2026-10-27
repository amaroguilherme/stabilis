"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DrugResult, PatientChecklist, SafetySummary } from "@/app/types";
import { useStoredSession } from "@/app/lib/session";

const PAGE_SIZE = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDrugName(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatus(drug: DrugResult): "RECOMMENDED" | "AVOID" | "NEUTRAL" {
  if (drug.bonus > drug.penalty) return "RECOMMENDED";
  if (drug.penalty > drug.bonus) return "AVOID";
  return "NEUTRAL";
}

const STATUS_STYLES: Record<string, string> = {
  RECOMMENDED: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  AVOID: "bg-red-100 text-red-800 border border-red-200",
  NEUTRAL: "bg-slate-100 text-slate-700 border border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  RECOMMENDED: "FAVORECIDO",
  AVOID: "EVITAR",
  NEUTRAL: "NEUTRO",
};

const CLASS_LABELS: Record<string, string> = {
  ANTIDEPRESSANT:  "Antidepressivo",
  MOOD_STABILIZER: "Estabilizador de Humor",
  ANTIPSYCHOTIC:   "Antipsicótico",
  ANXIOLYTIC:      "Ansiolítico",
  OTHER:           "Outro",
};

const CLASS_STYLES: Record<string, string> = {
  ANTIDEPRESSANT:  "bg-sky-50 text-sky-700 border border-sky-200",
  MOOD_STABILIZER: "bg-violet-50 text-violet-700 border border-violet-200",
  ANTIPSYCHOTIC:   "bg-rose-50 text-rose-700 border border-rose-200",
  ANXIOLYTIC:      "bg-teal-50 text-teal-700 border border-teal-200",
  OTHER:           "bg-slate-100 text-slate-600 border border-slate-200",
};

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-yellow-400";
  return "bg-red-500";
}

// ─── Notices ─────────────────────────────────────────────────────────────────

function SafetyNotice({ safety }: { safety?: SafetySummary }) {
  if (safety?.crisis) {
    return (
      <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-950">
        <p className="font-semibold">A anamnese menciona risco de suicídio ou autolesão.</p>
        <p className="mt-1">
          Avalie o risco antes de qualquer decisão terapêutica. Em risco imediato: SAMU{" "}
          <a href="tel:192" className="font-semibold underline">192</a>. Apoio emocional 24h: CVV{" "}
          <a href="tel:188" className="font-semibold underline">188</a>.{" "}
          <Link href="/ajuda-agora" className="underline">Mais recursos</Link>
        </p>
      </div>
    );
  }
  if (safety?.negated_only) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700">
        A anamnese registra a ausência de ideação suicida (por exemplo, &quot;nega ideação suicida&quot;).
      </p>
    );
  }
  return null;
}

function DegradedNotice() {
  return (
    <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
      <p className="font-semibold">A leitura automática do texto clínico não estava disponível.</p>
      <p className="mt-1">
        Esta ordenação usou apenas os campos estruturados e as palavras-chave do texto. Sintomas e contraindicações
        descritos só em texto livre podem não ter sido considerados.
      </p>
    </div>
  );
}

function Legend() {
  return (
    <details className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 text-sm text-slate-700">
      <summary className="cursor-pointer font-semibold text-slate-800">Como ler esta tela</summary>
      <ul className="mt-3 space-y-2 list-disc pl-5">
        <li>
          A nota de 0 a 100 é um <strong>índice relativo de adequação às regras do sistema</strong>. Não é
          probabilidade de resposta ao medicamento e não é recomendação de tratamento.
        </li>
        <li>
          Cores da barra: verde a partir de 70, amarelo de 40 a 69, vermelho abaixo de 40. As regras ainda não
          passaram por validação clínica.
        </li>
        <li>
          <strong>EVITAR</strong>: as penalidades de segurança (contraindicações) superam os bônus.{" "}
          <strong>FAVORECIDO</strong>: os bônus superam as penalidades.
        </li>
        <li>
          Medicamentos com contraindicação grave ativa têm a nota limitada por um teto de segurança, mesmo quando
          já estão em uso.
        </li>
      </ul>
    </details>
  );
}

// ─── Patient Summary Card ────────────────────────────────────────────────────

function PatientSummaryCard({ checklist }: { checklist: PatientChecklist }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex flex-wrap gap-4 items-start">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Paciente</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">{checklist.patient_id}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Diagnóstico</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">{checklist.base_diagnosis}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Peso</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">{checklist.weight} kg</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Gênero</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">{checklist.gender}</p>
      </div>
      {checklist.comorbidities.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Comorbidades</p>
          <div className="flex flex-wrap gap-1">
            {checklist.comorbidities.map((c) => (
              <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{c}</span>
            ))}
          </div>
        </div>
      )}
      {checklist.habits.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Hábitos</p>
          <div className="flex flex-wrap gap-1">
            {checklist.habits.map((h) => (
              <span key={h} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{h}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Drug Row ────────────────────────────────────────────────────────────────

function DrugRow({ drug, rank }: { drug: DrugResult; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const status = getStatus(drug);
  const barColor = scoreBarColor(drug.final_score);
  const hasReasons = drug.reasons && drug.reasons.length > 0;
  const displayName = drug.name_pt ?? formatDrugName(drug.name);
  const reasonsId = `reasons-${drug.name}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 px-4 py-4">
        {/* Rank */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
          {rank}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div>
              <h3 className="font-semibold text-slate-900 text-base leading-tight">{displayName}</h3>
              {drug.name_pt && (
                <p className="text-xs text-slate-500 leading-tight">{formatDrugName(drug.name)}</p>
              )}
            </div>
            {drug.in_use && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                EM USO
              </span>
            )}
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
              {STATUS_LABELS[status]}
            </span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${CLASS_STYLES[drug.drug_class] ?? CLASS_STYLES.OTHER}`}>
              {CLASS_LABELS[drug.drug_class] ?? drug.drug_class}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(100, Math.max(0, drug.final_score))}%` }}
              />
            </div>
            <span className="text-sm font-bold text-slate-700 w-16 text-right tabular-nums">
              {drug.final_score.toFixed(1)}
              <span className="sr-only"> de 100</span>
            </span>
          </div>
        </div>

        {/* Reasons toggle */}
        {hasReasons && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={reasonsId}
            aria-label={`${expanded ? "Ocultar" : "Ver"} justificativa de ${displayName}`}
            className="flex-shrink-0 min-w-11 min-h-11 rounded-lg text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-medium"
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>

      {/* Reasons panel */}
      {expanded && hasReasons && (
        <div id={reasonsId} className="px-4 pb-4 pt-0 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-3">
            Por que esta pontuação?
          </p>
          <ul className="space-y-1.5">
            {drug.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  aria-label={r.type === "bonus" ? "bônus" : "penalidade"}
                  className={`mt-0.5 shrink-0 text-base leading-none ${r.type === "bonus" ? "text-emerald-600" : "text-red-500"}`}
                >
                  {r.type === "bonus" ? "✓" : "✕"}
                </span>
                <span className="text-slate-700">{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Results Page ────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const router = useRouter();
  const stored = useStoredSession();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  function updateSearch(value: string) {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  }

  function updateClassFilter(value: string | null) {
    setClassFilter(value);
    setVisibleCount(PAGE_SIZE);
  }

  if (stored.status === "missing") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-8 py-12">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Nenhum resultado encontrado</h2>
          <p className="text-slate-600 text-sm mb-6">Os dados da sessão não foram encontrados. Por favor, preencha o formulário novamente.</p>
          <button type="button" onClick={() => router.push("/")} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
            Voltar ao Formulário
          </button>
        </div>
      </div>
    );
  }

  if (stored.status === "loading") {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex items-center gap-3 text-slate-600" role="status">
          <span className="inline-block w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          <span className="text-sm">Carregando resultados...</span>
        </div>
      </div>
    );
  }

  const { results, checklist, degraded, safety } = stored.session;

  const availableClasses = Array.from(new Set(results.map((d) => d.drug_class))).sort();

  const filtered = results.filter((d) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      formatDrugName(d.name).toLowerCase().includes(q) ||
      (d.name_pt ?? "").toLowerCase().includes(q);
    const matchesClass = !classFilter || d.drug_class === classFilter;
    return matchesSearch && matchesClass;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-6">
        <button type="button" onClick={() => router.push("/")} className="text-sm text-indigo-700 hover:text-indigo-900 font-medium mb-2 flex items-center gap-1">
          ← Voltar ao Formulário
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Ordenação experimental de medicamentos</h1>
        <p className="text-slate-600 text-sm mt-1">
          {results.length} medicamento{results.length !== 1 ? "s" : ""} analisado{results.length !== 1 ? "s" : ""} · não é prescrição
        </p>
      </div>

      <div className="space-y-4 mb-5">
        <SafetyNotice safety={safety} />
        {degraded && <DegradedNotice />}
        <PatientSummaryCard checklist={checklist} />
        <Legend />
      </div>

      {/* Search bar */}
      <div className="mb-4 relative">
        <label htmlFor="drug-search" className="sr-only">Buscar medicamento</label>
        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </span>
        <input
          id="drug-search"
          type="text"
          placeholder="Buscar medicamento..."
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
          className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => updateSearch("")}
            aria-label="Limpar busca"
            className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-700"
          >
            ×
          </button>
        )}
      </div>

      {/* Class filter pills */}
      {availableClasses.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filtrar por classe">
          <button
            type="button"
            onClick={() => updateClassFilter(null)}
            aria-pressed={classFilter === null}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              classFilter === null
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700"
            }`}
          >
            Todos
          </button>
          {availableClasses.map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => updateClassFilter(classFilter === cls ? null : cls)}
              aria-pressed={classFilter === cls}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                classFilter === cls
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : `${CLASS_STYLES[cls] ?? CLASS_STYLES.OTHER} hover:border-indigo-300`
              }`}
            >
              {CLASS_LABELS[cls] ?? cls}
            </button>
          ))}
        </div>
      )}

      {/* Drug list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-8 py-12 text-center">
          <p className="text-slate-600 text-sm">
            {search ? `Nenhum medicamento encontrado para "${search}".` : "O servidor não retornou nenhum medicamento para esta análise."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((drug, idx) => (
            <DrugRow key={drug.name} drug={drug} rank={idx + 1} />
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="w-full py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
            >
              Ver mais {Math.min(PAGE_SIZE, filtered.length - visibleCount)} medicamentos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
