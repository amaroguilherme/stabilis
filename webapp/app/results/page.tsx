"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DrugResult, SessionData, PatientChecklist } from "@/app/types";
import { getDefaultDosing } from "@/app/lib/dosing";

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
  RECOMMENDED: "RECOMENDADO",
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

// ─── Patient Summary Card ────────────────────────────────────────────────────

function PatientSummaryCard({ checklist }: { checklist: PatientChecklist }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex flex-wrap gap-4 items-start">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Paciente</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">{checklist.patient_id}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Diagnóstico</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">{checklist.base_diagnosis}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Peso</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">{checklist.weight} kg</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Gênero</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">{checklist.gender}</p>
      </div>
      {checklist.comorbidities.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Comorbidades</p>
          <div className="flex flex-wrap gap-1">
            {checklist.comorbidities.map((c) => (
              <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{c}</span>
            ))}
          </div>
        </div>
      )}
      {checklist.habits.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Hábitos</p>
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

function DrugRow({
  drug,
  rank,
  selected,
  onToggle,
}: {
  drug: DrugResult;
  rank: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = getStatus(drug);
  const barColor = scoreBarColor(drug.final_score);
  const hasReasons = drug.reasons && drug.reasons.length > 0;

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm transition-all ${
        selected ? "border-indigo-400 ring-1 ring-indigo-300" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        {/* Rank */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
          {rank}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div>
              <h3 className="font-semibold text-slate-900 text-base leading-tight">
                {drug.name_pt ?? formatDrugName(drug.name)}
              </h3>
              {drug.name_pt && (
                <p className="text-xs text-slate-400 leading-tight">{formatDrugName(drug.name)}</p>
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
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(100, Math.max(0, drug.final_score))}%` }}
              />
            </div>
            <span className="text-sm font-bold text-slate-700 w-12 text-right tabular-nums">
              {drug.final_score.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {hasReasons && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
              title="Ver justificativa"
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}
          <input
            type="checkbox"
            className="w-4 h-4 accent-indigo-600 cursor-pointer"
            checked={selected}
            onChange={onToggle}
            title="Selecionar para prescrição"
          />
        </div>
      </div>

      {/* Reasons panel */}
      {expanded && hasReasons && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 mt-3">
            Por que esta pontuação?
          </p>
          <ul className="space-y-1.5">
            {drug.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 shrink-0 text-base leading-none ${r.type === "bonus" ? "text-emerald-500" : "text-red-400"}`}>
                  {r.type === "bonus" ? "✓" : "✕"}
                </span>
                <span className={r.type === "bonus" ? "text-slate-700" : "text-slate-500"}>
                  {r.text}
                </span>
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
  const [session, setSession] = useState<SessionData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const raw = sessionStorage.getItem("stabilis_session");
    if (!raw) { setNotFound(true); return; }
    try {
      setSession(JSON.parse(raw) as SessionData);
    } catch {
      setNotFound(true);
    }
  }, []);

  // Reset pagination when search or filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, classFilter]);

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-8 py-12">
          <p className="text-4xl mb-4">⚠️</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Nenhum resultado encontrado</h2>
          <p className="text-slate-500 text-sm mb-6">Os dados da sessão não foram encontrados. Por favor, preencha o formulário novamente.</p>
          <button type="button" onClick={() => router.push("/")} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
            Voltar ao Formulário
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="inline-block w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Carregando resultados...</span>
        </div>
      </div>
    );
  }

  const { results, checklist } = session;

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
  const selectedDrugs = results.filter((d) => selected.has(d.name));

  return (
    <>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <button type="button" onClick={() => router.push("/")} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-2 flex items-center gap-1">
            ← Voltar ao Formulário
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Ranking de Medicamentos</h1>
          <p className="text-slate-500 text-sm mt-1">
            {results.length} medicamento{results.length !== 1 ? "s" : ""} analisado{results.length !== 1 ? "s" : ""} · Selecione para prescrever
          </p>
        </div>

        {/* Patient summary */}
        <div className="mb-5">
          <PatientSummaryCard checklist={checklist} />
        </div>

        {/* Search bar */}
        <div className="mb-4 relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar medicamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          )}
        </div>

        {/* Class filter pills */}
        {availableClasses.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setClassFilter(null)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                classFilter === null
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              Todos
            </button>
            {availableClasses.map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setClassFilter(classFilter === cls ? null : cls)}
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
            <p className="text-slate-500 text-sm">
              {search ? `Nenhum medicamento encontrado para "${search}".` : "O backend não retornou nenhum medicamento para esta análise."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((drug, idx) => (
              <DrugRow
                key={drug.name}
                drug={drug}
                rank={idx + 1}
                selected={selected.has(drug.name)}
                onToggle={() => toggleSelect(drug.name)}
              />
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

        {/* Finalize prescription bar */}
        {results.length > 0 && (
          <div className="mt-8 flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 sticky bottom-4">
            <p className="text-sm text-slate-600">
              {selected.size === 0 ? (
                "Nenhum medicamento selecionado"
              ) : (
                <><span className="font-semibold text-indigo-700">{selected.size}</span> medicamento{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}</>
              )}
            </p>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => {
                const session = JSON.parse(sessionStorage.getItem("stabilis_session") ?? "{}") as SessionData;
                session.prescription = selectedDrugs.map((d) => ({
                  name: d.name,
                  name_pt: d.name_pt,
                  ...getDefaultDosing(d.name),
                }));
                sessionStorage.setItem("stabilis_session", JSON.stringify(session));
                router.push("/audit");
              }}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              Definir Dosagem →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
