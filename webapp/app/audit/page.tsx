"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrescriptionDrug, SessionData } from "@/app/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditResult {
  status: "SAFE" | "DANGEROUS";
  culprit?: string;
  blood_levels?: Record<string, number>;
}

interface EditableDrug extends PrescriptionDrug {
  dose: number;
  interval: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDrugName(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Drug Row ─────────────────────────────────────────────────────────────────

function DrugRow({
  drug,
  bloodLevel,
  isCulprit,
  onChange,
}: {
  drug: EditableDrug;
  bloodLevel?: number;
  isCulprit?: boolean;
  onChange: (field: "dose" | "interval", value: number) => void;
}) {
  const displayName = drug.name_pt ?? formatDrugName(drug.name);
  const subName = drug.name_pt ? formatDrugName(drug.name) : null;

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition-colors ${
        isCulprit
          ? "bg-red-50 border-red-300"
          : bloodLevel !== undefined
          ? "bg-emerald-50 border-emerald-200"
          : "bg-white border-slate-200"
      }`}
    >
      {/* Name */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-800 truncate">{displayName}</p>
        {subName && (
          <p className="text-xs text-slate-400 truncate">{subName}</p>
        )}
      </div>

      {/* Inputs */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <label className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
            Dose (mg)
          </span>
          <input
            type="number"
            min={1}
            value={drug.dose}
            onChange={(e) => onChange("dose", Number(e.target.value))}
            className="w-24 text-center rounded-lg border border-slate-300 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>
        <label className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
            Intervalo (h)
          </span>
          <input
            type="number"
            min={1}
            value={drug.interval}
            onChange={(e) => onChange("interval", Number(e.target.value))}
            className="w-20 text-center rounded-lg border border-slate-300 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>
      </div>

      {/* Result badge */}
      {isCulprit && (
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 flex-shrink-0">
          TOXICIDADE
        </span>
      )}
      {bloodLevel !== undefined && !isCulprit && (
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0 font-mono">
          {bloodLevel.toFixed(2)} mg/L
        </span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const router = useRouter();
  const [drugs, setDrugs] = useState<EditableDrug[]>([]);
  const [checklist, setChecklist] = useState<SessionData["checklist"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("stabilis_session");
      if (!raw) { router.replace("/"); return; }
      const session: SessionData = JSON.parse(raw);
      if (!session.prescription?.length) { router.replace("/results"); return; }
      setDrugs(session.prescription as EditableDrug[]);
      setChecklist(session.checklist);
    } catch {
      router.replace("/");
    }
  }, [router]);

  function updateDrug(index: number, field: "dose" | "interval", value: number) {
    setDrugs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function runAudit() {
    if (!checklist) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.NEXT_PUBLIC_HF_TOKEN}` },
        body: JSON.stringify({
          prescription: drugs.map(({ name, dose, interval }) => ({
            name,
            dose,
            interval,
          })),
          patient_profile: {
            peso_kg: checklist.weight,
            diagnostico_base: checklist.base_diagnosis,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data: AuditResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (!drugs.length) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-700 transition-colors text-sm"
          >
            ← Voltar
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Auditoria de Prescrição</h1>
            {checklist && (
              <p className="text-sm text-slate-500 mt-0.5">
                {checklist.base_diagnosis} · {checklist.weight} kg · {checklist.gender}
              </p>
            )}
          </div>
        </div>

        {/* Drug list */}
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest font-semibold text-slate-400">
            Medicamentos selecionados
          </h2>
          {drugs.map((drug, i) => (
            <DrugRow
              key={drug.name}
              drug={drug}
              bloodLevel={result?.status === "SAFE" ? result.blood_levels?.[drug.name] : undefined}
              isCulprit={result?.status === "DANGEROUS" && result.culprit === drug.name}
              onChange={(field, val) => updateDrug(i, field, val)}
            />
          ))}
        </section>

        {/* Result banner */}
        {result && (
          <div
            className={`rounded-xl p-4 border text-sm font-medium ${
              result.status === "SAFE"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-300 text-red-800"
            }`}
          >
            {result.status === "SAFE" ? (
              <>
                <span className="font-bold">Seguro.</span> Todos os fármacos estabilizaram
                abaixo do limiar de toxicidade após simulação de 14 dias.
              </>
            ) : (
              <>
                <span className="font-bold">Toxicidade crítica detectada.</span>{" "}
                {result.culprit && (
                  <>
                    O fármaco <span className="font-mono">{formatDrugName(result.culprit)}</span>{" "}
                    ultrapassou o limiar seguro durante a simulação. Revise dose e intervalo.
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-xl p-4 border bg-orange-50 border-orange-200 text-orange-800 text-sm">
            <span className="font-bold">Erro:</span> {error}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={runAudit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          {loading ? "Simulando…" : "Simular Toxicidade"}
        </button>
      </div>
    </main>
  );
}
