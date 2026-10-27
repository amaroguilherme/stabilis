"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisResult, AnalyzeRequest, CurrentMedication, ReanalyzeRequest } from "@/app/types";
import { CURATED_DRUGS, DRUG_NAME_PT, formatDrugLabel } from "@/app/lib/drugs";
import { describeBackendError, runJob, type JobProgress } from "@/app/lib/api/client";
import { saveSession } from "@/app/lib/session";
import { detectCrisis, summarizeCrisis } from "@/app/lib/safety/crisis";
import { crisisLexicon } from "@/app/lib/safety/lexicon";

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

// The two free-text fields share the backend's 4,000-character budget (it must fit the LLM context).
const MAX_SUMMARY_CHARS = 3000;
const MAX_ANAMNESIS_CHARS = 1000;
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 300;

function generatePatientId(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `STB-${digits}`;
}

function drugLabel(drug: string): string {
  return DRUG_NAME_PT[drug] ?? formatDrugLabel(drug);
}

function progressMessage(progress: JobProgress | null): string {
  if (!progress) return "Enviando para análise...";
  if (progress.phase === "starting") {
    return "Acordando o servidor de análise. Na primeira vez do dia isso pode levar alguns minutos...";
  }
  if (progress.phase === "running") return "Analisando o texto clínico. Isso pode levar até 1 ou 2 minutos...";
  return progress.position ? `Na fila de análise (posição ${progress.position})...` : "Aguardando vaga no servidor...";
}

function CharCounter({ value, max, id }: { value: string; max: number; id: string }) {
  return (
    <p id={id} className="mt-1 text-xs text-slate-600 text-right tabular-nums">
      {value.length.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")} caracteres
    </p>
  );
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
  const [medError, setMedError] = useState<string | null>(null);
  const [treatmentAnamnesis, setTreatmentAnamnesis] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abandon the polling (and free the server slot) if the user leaves the page mid-analysis.
  useEffect(() => () => abortRef.current?.abort(), []);

  const crisis = useMemo(
    () => summarizeCrisis(detectCrisis(`${doctorSummary}\n${treatmentAnamnesis}`, crisisLexicon, "professional")),
    [doctorSummary, treatmentAnamnesis],
  );

  const medSearchLower = medSearch.trim().toLowerCase();
  const drugSuggestions = medSearchLower.length >= 2
    ? CURATED_DRUGS.filter(
        (d) =>
          (d.includes(medSearchLower) ||
            formatDrugLabel(d).toLowerCase().includes(medSearchLower) ||
            (DRUG_NAME_PT[d] ?? "").toLowerCase().includes(medSearchLower)) &&
          !currentMeds.some((m) => m.name === d) &&
          d !== medSearchLower
      ).slice(0, 6)
    : [];

  function addMed() {
    const name = medSearch.trim().toLowerCase();
    const dose = parseFloat(medDose);
    const duration = parseFloat(medDuration);
    if (!CURATED_DRUGS.includes(name)) {
      setMedError("Escolha um medicamento da lista de sugestões.");
      return;
    }
    if (currentMeds.some((m) => m.name === name)) {
      setMedError("Este medicamento já foi adicionado.");
      return;
    }
    if (isNaN(dose) || dose <= 0) {
      setMedError("Informe a dose em mg (maior que zero).");
      return;
    }
    if (isNaN(duration) || duration < 0) {
      setMedError("Informe há quantos meses o medicamento é usado (0 ou mais).");
      return;
    }
    setCurrentMeds((prev) => [...prev, { name, dose, duration_months: duration }]);
    setMedSearch("");
    setMedDose("");
    setMedDuration("");
    setMedError(null);
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

    const weightKg = parseFloat(weight);
    if (!weight || !gender || !baseDiagnosis) {
      setError("Preencha peso, gênero e diagnóstico principal.");
      return;
    }
    if (isNaN(weightKg) || weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
      setError(`Informe um peso entre ${MIN_WEIGHT_KG} e ${MAX_WEIGHT_KG} kg.`);
      return;
    }

    const checklist = {
      patient_id: generatePatientId(),
      weight: weightKg,
      gender,
      base_diagnosis: baseDiagnosis,
      comorbidities,
      habits,
    };

    // The treatment anamnesis is only used by the reanalysis, so send it there even without medications.
    const hasTreatmentContext = currentMeds.length > 0 || treatmentAnamnesis.trim().length > 0;

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setProgress(null);
    try {
      const options = { signal: controller.signal, onProgress: setProgress };
      const result = hasTreatmentContext
        ? await runJob<AnalysisResult>("legacy_reanalyze", {
            checklist,
            doctor_summary: doctorSummary,
            current_medications: currentMeds,
            treatment_anamnesis: treatmentAnamnesis,
          } satisfies ReanalyzeRequest, options)
        : await runJob<AnalysisResult>("legacy_analyze", {
            checklist,
            doctor_summary: doctorSummary,
          } satisfies AnalyzeRequest, options);

      saveSession({
        results: result.results,
        checklist,
        doctor_summary: doctorSummary,
        degraded: result.degraded,
        safety: result.safety,
        ...(hasTreatmentContext && {
          current_medications: currentMeds,
          treatment_anamnesis: treatmentAnamnesis,
        }),
      });
      router.push("/results");
    } catch (err: unknown) {
      const message = describeBackendError(err);
      if (message) setError(message);
    } finally {
      setLoading(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Modo profissional · experimental</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">
          Nova Avaliação de Paciente
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          Para profissionais de saúde. Preencha os dados do paciente e a anamnese para ver uma ordenação
          experimental de medicamentos baseada em regras. Não é prescrição.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate aria-busy={loading} className={`space-y-8 ${loading ? "pointer-events-none opacity-60 select-none" : ""}`}>
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
                  min={MIN_WEIGHT_KG}
                  max={MAX_WEIGHT_KG}
                  step="0.1"
                  placeholder="ex: 72.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
            <fieldset>
              <legend className="block text-sm font-medium text-slate-700 mb-2">
                Comorbidades
              </legend>
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
                      className="text-indigo-500 hover:text-indigo-800 leading-none shrink-0"
                      aria-label={`Remover ${c}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-2.5">
                <label htmlFor="otherComorbidity" className="sr-only">Outra comorbidade</label>
                <input
                  id="otherComorbidity"
                  type="text"
                  placeholder="Outros..."
                  maxLength={80}
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
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
            </fieldset>

            {/* Habits */}
            <fieldset>
              <legend className="block text-sm font-medium text-slate-700 mb-2">
                Hábitos
              </legend>
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
                      className="text-amber-600 hover:text-amber-800 leading-none"
                      aria-label={`Remover ${h}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-2.5">
                <label htmlFor="otherHabit" className="sr-only">Outro hábito</label>
                <input
                  id="otherHabit"
                  type="text"
                  placeholder="Outros..."
                  maxLength={80}
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
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
            </fieldset>
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
              Anamnese
            </label>
            <textarea
              id="doctorSummary"
              rows={7}
              maxLength={MAX_SUMMARY_CHARS}
              aria-describedby="doctorSummaryCount"
              placeholder="Descreva o histórico clínico relevante, sintomas atuais, tratamentos anteriores e qualquer informação adicional pertinente. Não inclua nome, CPF ou outros dados que identifiquem o paciente."
              value={doctorSummary}
              onChange={(e) => setDoctorSummary(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition resize-y"
            />
            <CharCounter id="doctorSummaryCount" value={doctorSummary} max={MAX_SUMMARY_CHARS} />
          </div>
        </section>

        {/* Section 3 */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-800 text-base">
              Seção 3 — Tratamento em Curso{" "}
              <span className="text-slate-500 font-normal text-sm">(opcional)</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Preencha se o paciente já estiver em tratamento. O sistema reajustará os
              escores considerando os medicamentos em uso e a evolução clínica.
            </p>
          </div>
          <div className="px-6 py-6 space-y-6">

            {/* Drug search + inputs */}
            <fieldset>
              <legend className="block text-sm font-medium text-slate-700 mb-2">
                Medicamentos em uso
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_110px_auto] gap-2 items-end">
                <div className="relative">
                  <label htmlFor="medSearch" className="block text-xs text-slate-600 mb-1">Medicamento</label>
                  <input
                    id="medSearch"
                    type="text"
                    placeholder="Buscar medicamento..."
                    autoComplete="off"
                    value={medSearch}
                    onChange={(e) => { setMedSearch(e.target.value); setMedError(null); }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                  {drugSuggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {drugSuggestions.map((d) => (
                        <li key={d}>
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setMedSearch(d); }}
                            onClick={() => setMedSearch(d)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none"
                          >
                            {drugLabel(d)}
                            <span className="ml-1.5 text-xs text-slate-500">{d}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label htmlFor="medDose" className="block text-xs text-slate-600 mb-1">Dose (mg)</label>
                  <input
                    id="medDose"
                    type="number"
                    min={1}
                    placeholder="ex: 300"
                    value={medDose}
                    onChange={(e) => { setMedDose(e.target.value); setMedError(null); }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label htmlFor="medDuration" className="block text-xs text-slate-600 mb-1">Duração (meses)</label>
                  <input
                    id="medDuration"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="ex: 6"
                    value={medDuration}
                    onChange={(e) => { setMedDuration(e.target.value); setMedError(null); }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={addMed}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:border-indigo-400 transition self-end"
                >
                  Adicionar
                </button>
              </div>
              {medError && (
                <p role="alert" className="mt-2 text-sm text-red-700">{medError}</p>
              )}

              {/* Added meds list */}
              {currentMeds.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {currentMeds.map((m) => (
                    <li
                      key={m.name}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-indigo-800">{drugLabel(m.name)}</span>
                        <span className="ml-2 text-indigo-600 text-xs">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-indigo-700 text-xs">
                        <span>{m.dose} mg</span>
                        <span>{m.duration_months} {m.duration_months === 1 ? "mês" : "meses"}</span>
                        <button
                          type="button"
                          onClick={() => removeMed(m.name)}
                          className="text-indigo-500 hover:text-indigo-800 leading-none text-base"
                          aria-label={`Remover ${drugLabel(m.name)}`}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

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
                maxLength={MAX_ANAMNESIS_CHARS}
                aria-describedby="treatmentAnamnesisCount"
                placeholder="Descreva a evolução clínica sob o tratamento atual: resposta aos medicamentos, efeitos colaterais, adesão, mudanças de dose, intercorrências..."
                value={treatmentAnamnesis}
                onChange={(e) => setTreatmentAnamnesis(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition resize-y"
              />
              <CharCounter id="treatmentAnamnesisCount" value={treatmentAnamnesis} max={MAX_ANAMNESIS_CHARS} />
            </div>
          </div>
        </section>

        {/* Crisis language in the free text */}
        {crisis.crisis && (
          <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-950">
            <p className="font-semibold">O texto menciona risco de suicídio ou autolesão.</p>
            <p className="mt-1">
              Avalie o risco antes de seguir. Em risco imediato: SAMU <a href="tel:192" className="font-semibold underline">192</a>.
              Apoio emocional 24h: CVV <a href="tel:188" className="font-semibold underline">188</a>.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-800 whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col items-end gap-3">
          <p aria-live="polite" className="text-sm text-slate-700 text-right min-h-5">
            {loading ? progressMessage(progress) : ""}
          </p>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
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
