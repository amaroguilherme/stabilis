"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyzeRequest, SessionData, CurrentMedication } from "@/app/types";
import { CURATED_DRUGS, DRUG_NAME_PT, formatDrugLabel } from "@/app/lib/drugs";

const BASE_DIAGNOSES = [
  "Transtorno Bipolar I",
  "Transtorno Bipolar II",
  "Transtorno de Ansiedade Generalizada",
];

const COMORBIDITIES = [
  "Hipertensão",
  "Diabetes Tipo 2",
  "Obesidade",
  "Hipotireoidismo",
  "Hepatite C",
  "Insuficiência Renal Crônica",
];

const HABITS = ["Tabagismo", "Consumo de Álcool", "Uso de Cannabis"];

function generatePatientId(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `STB-${digits}`;
}

export default function IntakePage() {
  const router = useRouter();

  const [weight, setWeight] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [baseDiagnosis, setBaseDiagnosis] = useState<string>("");
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [habits, setHabits] = useState<string[]>([]);
  const [otherComorbidity, setOtherComorbidity] = useState<string>("");
  const [otherHabit, setOtherHabit] = useState<string>("");
  const [doctorSummary, setDoctorSummary] = useState<string>("");

  // Section 3 — current treatment
  const [currentMeds, setCurrentMeds] = useState<CurrentMedication[]>([]);
  const [medSearch, setMedSearch] = useState<string>("");
  const [medDose, setMedDose] = useState<string>("");
  const [medDuration, setMedDuration] = useState<string>("");
  const [treatmentAnamnesis, setTreatmentAnamnesis] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const medSearchLower = medSearch.trim().toLowerCase();
  const drugSuggestions = medSearchLower.length >= 2
    ? CURATED_DRUGS.filter(
        (d) =>
          (d.includes(medSearchLower) || formatDrugLabel(d).toLowerCase().includes(medSearchLower)) &&
          !currentMeds.some((m) => m.name === d)
      ).slice(0, 6)
    : [];

  function addMed(name: string) {
    const dose = parseFloat(medDose);
    const duration = parseFloat(medDuration);
    if (!name || isNaN(dose) || dose <= 0 || isNaN(duration) || duration < 0) return;
    setCurrentMeds((prev) => [...prev, { name, dose, duration_months: duration }]);
    setMedSearch("");
    setMedDose("");
    setMedDuration("");
  }

  function removeMed(name: string) {
    setCurrentMeds((prev) => prev.filter((m) => m.name !== name));
  }

  function toggleMultiSelect(
    list: string[],
    setList: (v: string[]) => void,
    value: string
  ) {
    setList(
      list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!weight || !gender || !baseDiagnosis) {
      setError("Preencha peso, gênero e diagnóstico principal.");
      return;
    }

    const checklist = {
      patient_id: generatePatientId(),
      weight: parseFloat(weight),
      gender,
      base_diagnosis: baseDiagnosis,
      comorbidities,
      habits,
    };

    const hasCurrentTreatment = currentMeds.length > 0;

    setLoading(true);
    try {
      let results;
      if (hasCurrentTreatment) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reanalyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checklist,
            doctor_summary: doctorSummary,
            current_medications: currentMeds,
            treatment_anamnesis: treatmentAnamnesis,
          }),
        });
        if (!res.ok) throw new Error(`Servidor retornou erro ${res.status}: ${res.statusText}`);
        results = await res.json();
      } else {
        const payload: AnalyzeRequest = { checklist, doctor_summary: doctorSummary };
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Servidor retornou erro ${res.status}: ${res.statusText}`);
        results = await res.json();
      }

      const session: SessionData = {
        results,
        checklist,
        doctor_summary: doctorSummary,
        ...(hasCurrentTreatment && {
          current_medications: currentMeds,
          treatment_anamnesis: treatmentAnamnesis,
        }),
      };

      sessionStorage.setItem("stabilis_session", JSON.stringify(session));
      router.push("/results");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro desconhecido ao conectar ao servidor.";
      setError(
        `Não foi possível conectar ao servidor de análise. Verifique se o backend está rodando em ${process.env.NEXT_PUBLIC_API_URL}.\n\nDetalhe: ${message}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Nova Avaliação de Paciente
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Preencha os dados do paciente e o resumo clínico para receber a
          recomendação de medicamentos.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className={`space-y-8 ${loading ? "pointer-events-none opacity-60 select-none" : ""}`}>
        {/* Section 1 */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-800 text-base">
              Seção 1 — Dados do Paciente
            </h2>
          </div>
          <div className="px-6 py-6 space-y-6">
            {/* Weight + Gender row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="weight"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Peso (kg)
                </label>
                <input
                  id="weight"
                  type="number"
                  min="1"
                  max="500"
                  step="0.1"
                  placeholder="ex: 72.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label
                  htmlFor="gender"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Gênero
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                >
                  <option value="">Selecione...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                </select>
              </div>
            </div>

            {/* Base diagnosis */}
            <div>
              <label
                htmlFor="baseDiagnosis"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Diagnóstico Principal
              </label>
              <select
                id="baseDiagnosis"
                value={baseDiagnosis}
                onChange={(e) => setBaseDiagnosis(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              >
                <option value="">Selecione o diagnóstico...</option>
                {BASE_DIAGNOSES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Comorbidities */}
            <div>
              <p className="block text-sm font-medium text-slate-700 mb-2">
                Comorbidades
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {COMORBIDITIES.map((c) => (
                  <label
                    key={c}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition-colors select-none ${
                      comorbidities.includes(c)
                        ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-indigo-600 shrink-0"
                      checked={comorbidities.includes(c)}
                      onChange={() =>
                        toggleMultiSelect(comorbidities, setComorbidities, c)
                      }
                    />
                    {c}
                  </label>
                ))}
                {comorbidities.filter((c) => !COMORBIDITIES.includes(c)).map((c) => (
                  <span
                    key={c}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-indigo-400 bg-indigo-50 text-indigo-800 text-sm select-none"
                  >
                    <span className="flex-1 truncate">{c}</span>
                    <button
                      type="button"
                      onClick={() => setComorbidities(comorbidities.filter((x) => x !== c))}
                      className="text-indigo-400 hover:text-indigo-700 leading-none shrink-0"
                      title="Remover"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-2.5">
                <input
                  type="text"
                  placeholder="Outros..."
                  value={otherComorbidity}
                  onChange={(e) => setOtherComorbidity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = otherComorbidity.trim();
                      if (val && !comorbidities.includes(val)) setComorbidities([...comorbidities, val]);
                      setOtherComorbidity("");
                    }
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = otherComorbidity.trim();
                    if (val && !comorbidities.includes(val)) setComorbidities([...comorbidities, val]);
                    setOtherComorbidity("");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:border-indigo-400 transition"
                >
                  Adicionar
                </button>
              </div>
            </div>

            {/* Habits */}
            <div>
              <p className="block text-sm font-medium text-slate-700 mb-2">
                Hábitos
              </p>
              <div className="flex flex-wrap gap-2.5">
                {HABITS.map((h) => (
                  <label
                    key={h}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition-colors select-none ${
                      habits.includes(h)
                        ? "border-amber-400 bg-amber-50 text-amber-800"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-amber-500 shrink-0"
                      checked={habits.includes(h)}
                      onChange={() => toggleMultiSelect(habits, setHabits, h)}
                    />
                    {h}
                  </label>
                ))}
                {habits.filter((h) => !HABITS.includes(h)).map((h) => (
                  <span
                    key={h}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-amber-400 bg-amber-50 text-amber-800 text-sm select-none"
                  >
                    <span>{h}</span>
                    <button
                      type="button"
                      onClick={() => setHabits(habits.filter((x) => x !== h))}
                      className="text-amber-400 hover:text-amber-700 leading-none"
                      title="Remover"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-2.5">
                <input
                  type="text"
                  placeholder="Outros..."
                  value={otherHabit}
                  onChange={(e) => setOtherHabit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = otherHabit.trim();
                      if (val && !habits.includes(val)) setHabits([...habits, val]);
                      setOtherHabit("");
                    }
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = otherHabit.trim();
                    if (val && !habits.includes(val)) setHabits([...habits, val]);
                    setOtherHabit("");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:border-amber-400 transition"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2 */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-800 text-base">
              Seção 2 — Resumo Clínico
            </h2>
          </div>
          <div className="px-6 py-6">
            <label
              htmlFor="doctorSummary"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Anotação do Médico
            </label>
            <textarea
              id="doctorSummary"
              rows={7}
              placeholder="Descreva o histórico clínico relevante, sintomas atuais, tratamentos anteriores e qualquer informação adicional pertinente..."
              value={doctorSummary}
              onChange={(e) => setDoctorSummary(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition resize-y"
            />
          </div>
        </section>

        {/* Section 3 */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-800 text-base">
              Seção 3 — Tratamento em Curso{" "}
              <span className="text-slate-400 font-normal text-sm">(opcional)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Preencha se o paciente já estiver em tratamento. O sistema reajustará os
              escores considerando os medicamentos em uso e a evolução clínica.
            </p>
          </div>
          <div className="px-6 py-6 space-y-6">

            {/* Drug search + inputs */}
            <div>
              <p className="block text-sm font-medium text-slate-700 mb-2">
                Medicamentos em uso
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_110px_auto] gap-2 items-end">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar medicamento..."
                    value={medSearch}
                    onChange={(e) => setMedSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                  {drugSuggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {drugSuggestions.map((d) => (
                        <li
                          key={d}
                          onMouseDown={() => setMedSearch(d)}
                          className="px-3 py-2 text-sm text-slate-800 hover:bg-indigo-50 cursor-pointer"
                        >
                          {DRUG_NAME_PT[d] ?? formatDrugLabel(d)}
                          <span className="ml-1.5 text-xs text-slate-400">{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Dose (mg)</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="ex: 300"
                    value={medDose}
                    onChange={(e) => setMedDose(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Duração (meses)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="ex: 6"
                    value={medDuration}
                    onChange={(e) => setMedDuration(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addMed(medSearch.trim().toLowerCase())}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:border-indigo-400 transition self-end"
                >
                  Adicionar
                </button>
              </div>

              {/* Added meds list */}
              {currentMeds.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {currentMeds.map((m) => (
                    <li
                      key={m.name}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-indigo-800">{DRUG_NAME_PT[m.name] ?? formatDrugLabel(m.name)}</span>
                        <span className="ml-2 text-indigo-500 text-xs">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-indigo-700 text-xs">
                        <span>{m.dose} mg</span>
                        <span>{m.duration_months} {m.duration_months === 1 ? "mês" : "meses"}</span>
                        <button
                          type="button"
                          onClick={() => removeMed(m.name)}
                          className="text-indigo-400 hover:text-indigo-700 leading-none text-base"
                          title="Remover"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Treatment anamnesis */}
            <div>
              <label
                htmlFor="treatmentAnamnesis"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Anamnese do Tratamento Atual
              </label>
              <textarea
                id="treatmentAnamnesis"
                rows={5}
                placeholder="Descreva a evolução clínica sob o tratamento atual: resposta aos medicamentos, efeitos colaterais, adesão, mudanças de dose, intercorrências..."
                value={treatmentAnamnesis}
                onChange={(e) => setTreatmentAnamnesis(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition resize-y"
              />
            </div>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analisando...
              </>
            ) : (
              "Analisar e Ver Resultados"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
