"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import ExtractionPanel, { type ExtractionChoice } from "@/app/components/professional/ExtractionPanel";
import ImportPatient from "@/app/components/professional/ImportPatient";
import MedicationPicker from "@/app/components/professional/MedicationPicker";
import ProfileFields, { EMPTY_PROFILE, fromProfile, parseAge, toProfile, type ProfileDraft } from "@/app/components/professional/ProfileFields";
import HistoryEditor from "@/app/components/shared/HistoryEditor";
import type { EngineInput, HistoryEntry, MedEntry } from "@/app/lib/engine/types";
import { knowledgeBase } from "@/app/lib/kb";
import type { ImportedCase } from "@/app/lib/patient/import";
import { professionalCase, type ProfessionalCase } from "@/app/lib/professional/store";
import { detectCrisis, summarizeCrisis } from "@/app/lib/safety/crisis";
import { crisisLexicon } from "@/app/lib/safety/lexicon";

const kb = knowledgeBase.data;
const CONDITIONS = kb.vocab.conditions.conditions;
const MAX_TEXT = 4000;
const CONCERNS = [
  { id: "weight_gain_significant", label: "Ganho de peso" },
  { id: "sedation_significant", label: "Sedação" },
  { id: "sexual_dysfunction", label: "Disfunção sexual" },
  { id: "prolactin_elevation", label: "Hiperprolactinemia" },
];

const sectionClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

interface FormState {
  profile: ProfileDraft;
  condition: string;
  phase: string;
  severity: "" | "less_severe" | "more_severe";
  suicideRisk: "" | "yes" | "no";
  meds: MedEntry[];
  history: HistoryEntry[];
  instruments: EngineInput["instruments"];
  concerns: string[];
  text: string;
}

function initialState(saved?: ProfessionalCase): FormState {
  if (!saved) return { profile: EMPTY_PROFILE, condition: "", phase: "", severity: "", suicideRisk: "", meds: [], history: [], instruments: undefined, concerns: [], text: "" };
  const { input } = saved;
  return {
    profile: fromProfile(input.profile, saved.gender_identity),
    condition: input.condition?.id ?? "",
    phase: input.condition?.phase ?? "",
    severity: input.profile.severity ?? "",
    suicideRisk: input.profile.suicide_risk_assessed === undefined || input.profile.suicide_risk_assessed === null ? "" : input.profile.suicide_risk_assessed ? "yes" : "no",
    meds: input.profile.current_meds,
    history: input.history ?? [],
    instruments: input.instruments,
    concerns: input.concerns ?? [],
    text: input.free_text ?? "",
  };
}

function ProfessionalForm({ saved }: { saved?: ProfessionalCase }) {
  const router = useRouter();
  const id = useId();
  const [state, setState] = useState<FormState>(() => initialState(saved));
  const [errors, setErrors] = useState<string[]>([]);
  const set = (patch: Partial<FormState>) => setState((s) => ({ ...s, ...patch }));

  const condition = CONDITIONS.find((c) => c.id === state.condition);

  function applyImport(imported: ImportedCase) {
    setState((s) => ({
      ...s,
      profile: fromProfile({ ...imported.profile, current_meds: imported.meds }, imported.gender_identity),
      meds: imported.meds,
      history: imported.history,
      instruments: imported.instruments,
      condition: imported.condition,
      phase: "",
      severity: imported.severity,
      suicideRisk: imported.suicideRisk || s.suicideRisk,
      concerns: imported.concerns,
      text: imported.text || s.text,
    }));
  }
  const crisis = useMemo(() => summarizeCrisis(detectCrisis(state.text, crisisLexicon, "professional")), [state.text]);

  function applyExtraction(choice: ExtractionChoice) {
    setState((s) => {
      const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
      const meds = [...s.meds];
      for (const m of choice.medications) {
        const known = m.drug_id ? meds.some((x) => x.drug_id === m.drug_id) : meds.some((x) => x.raw_text === m.raw_text);
        if (!known) meds.push({ drug_id: m.drug_id, raw_text: m.evidence || m.raw_text, mg_per_day: m.mg_per_day });
      }
      const profile = { ...s.profile, conditions: union(s.profile.conditions, choice.conditions), habits: union(s.profile.habits, choice.habits) };
      if (choice.pregnancy === "pregnant") profile.pregnant = "yes";
      if (choice.pregnancy === "not_pregnant") profile.pregnant = "no";
      if (choice.pregnancy === "planning") profile.planning = "yes";
      if (choice.pregnancy === "breastfeeding") profile.breastfeeding = "yes";
      return { ...s, profile, meds };
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problems: string[] = [];
    if (parseAge(state.profile) === null) problems.push("Informe a idade (0 a 120 anos).");
    if (state.profile.sex === "") problems.push("Informe o sexo atribuído ao nascer.");
    if (!condition) problems.push("Escolha a condição.");
    if (condition && condition.phases.length > 0 && !state.phase) problems.push("Escolha a fase atual.");
    if (state.text.length > MAX_TEXT) problems.push(`A anamnese passou de ${MAX_TEXT.toLocaleString("pt-BR")} caracteres.`);
    setErrors(problems);
    if (problems.length > 0) return;

    const input: EngineInput = {
      mode: "professional",
      condition: { id: state.condition, phase: condition && condition.phases.length > 0 ? state.phase : null },
      profile: toProfile(state.profile, {
        current_meds: state.meds,
        severity: state.severity === "" ? null : state.severity,
        suicide_risk_assessed: state.suicideRisk === "" ? null : state.suicideRisk === "yes",
      }),
      free_text: state.text,
      history: state.history,
      instruments: state.instruments,
      concerns: state.concerns,
    };
    professionalCase.save({ input, gender_identity: state.profile.genderIdentity.trim() || undefined, saved_at: new Date().toISOString() });
    router.push("/profissional/resultado");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <section className={sectionClass} aria-labelledby={`${id}-i`}>
        <h2 id={`${id}-i`} className="text-lg font-semibold text-slate-900">Respostas da pessoa (opcional)</h2>
        <p className="mt-1 text-sm text-slate-600">Se a pessoa preencheu o modo paciente e trouxe o arquivo de respostas, importe-o para pré-preencher o formulário.</p>
        <div className="mt-4">
          <ImportPatient onImport={applyImport} />
        </div>
      </section>

      <section className={sectionClass} aria-labelledby={`${id}-p`}>
        <h2 id={`${id}-p`} className="text-lg font-semibold text-slate-900">1. Pessoa</h2>
        <div className="mt-4">
          <ProfileFields value={state.profile} onChange={(profile) => set({ profile })} />
        </div>
      </section>

      <section className={sectionClass} aria-labelledby={`${id}-c`}>
        <h2 id={`${id}-c`} className="text-lg font-semibold text-slate-900">2. Condição</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-cond`} className="block text-sm font-medium text-slate-800">Hipótese diagnóstica</label>
            <select
              id={`${id}-cond`}
              value={state.condition}
              onChange={(e) => set({ condition: e.target.value, phase: "", severity: "" })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
            >
              <option value="">Escolha…</option>
              {CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label_clinical}</option>
              ))}
            </select>
          </div>
          {condition && condition.phases.length > 0 && (
            <div>
              <label htmlFor={`${id}-phase`} className="block text-sm font-medium text-slate-800">Fase atual</label>
              <select id={`${id}-phase`} value={state.phase} onChange={(e) => set({ phase: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base">
                <option value="">Escolha…</option>
                {condition.phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.label_clinical}</option>
                ))}
              </select>
            </div>
          )}
          {state.condition === "depression_unipolar" && (
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium text-slate-800">Gravidade (NICE NG222)</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {[
                  { value: "less_severe", label: "Menos grave (PHQ-9 < 16)" },
                  { value: "more_severe", label: "Mais grave (PHQ-9 ≥ 16)" },
                ].map((o) => (
                  <label key={o.value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${state.severity === o.value ? "border-indigo-500 bg-indigo-50" : "border-slate-300"}`}>
                    <input type="radio" name={`${id}-sev`} checked={state.severity === o.value} onChange={() => set({ severity: o.value as FormState["severity"] })} className="accent-indigo-600" />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-slate-800">Risco de suicídio na avaliação</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {[
                { value: "yes", label: "Presente" },
                { value: "no", label: "Ausente" },
                { value: "", label: "Não avaliado" },
              ].map((o) => (
                <label key={o.value || "na"} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${state.suicideRisk === o.value ? "border-indigo-500 bg-indigo-50" : "border-slate-300"}`}>
                  <input type="radio" name={`${id}-sr`} checked={state.suicideRisk === o.value} onChange={() => set({ suicideRisk: o.value as FormState["suicideRisk"] })} className="accent-indigo-600" />
                  {o.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-600">Com risco presente, tricíclicos vão para “evitar” e há alerta de toxicidade em superdosagem (NICE NG222 1.4.23).</p>
          </fieldset>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby={`${id}-m`}>
        <h2 id={`${id}-m`} className="text-lg font-semibold text-slate-900">3. Medicamentos em uso</h2>
        <p className="mt-1 text-sm text-slate-600">Inclua todos, também os não psiquiátricos (anticoncepcional, anti-inflamatório, anti-hipertensivo…).</p>
        <div className="mt-4">
          <MedicationPicker value={state.meds} onChange={(meds) => set({ meds })} />
        </div>
      </section>

      <section className={sectionClass} aria-labelledby={`${id}-h`}>
        <h2 id={`${id}-h`} className="text-lg font-semibold text-slate-900">Tratamentos anteriores (opcional)</h2>
        <p className="mt-1 text-sm text-slate-600">Dose, tempo e resposta de cada tentativa: o resultado indica se a tentativa foi adequada segundo as diretrizes.</p>
        <div className="mt-4">
          <HistoryEditor value={state.history} onChange={(history) => set({ history })} variant="clinical" />
        </div>
      </section>

      <section className={sectionClass} aria-labelledby={`${id}-x`}>
        <h2 id={`${id}-x`} className="text-lg font-semibold text-slate-900">4. Anamnese e preferências (opcional)</h2>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-800">Efeitos que a pessoa quer evitar (ordena dentro de cada linha)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CONCERNS.map((c) => (
              <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.concerns.includes(c.id)}
                  onChange={() => set({ concerns: state.concerns.includes(c.id) ? state.concerns.filter((x) => x !== c.id) : [...state.concerns, c.id] })}
                  className="accent-indigo-600"
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4">
          <label htmlFor={`${id}-text`} className="block text-sm font-medium text-slate-800">Anamnese</label>
          <textarea
            id={`${id}-text`}
            rows={7}
            value={state.text}
            maxLength={MAX_TEXT}
            onChange={(e) => set({ text: e.target.value })}
            aria-describedby={`${id}-text-help`}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <p id={`${id}-text-help`} className="mt-1 text-xs text-slate-600">
            O texto fica no seu navegador e só sai dele se você usar “Extrair do texto”. {state.text.length.toLocaleString("pt-BR")} / {MAX_TEXT.toLocaleString("pt-BR")}
          </p>
          {crisis.crisis && (
            <p role="alert" className="mt-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-950">
              O texto menciona risco de suicídio ou autolesão. Avalie o risco antes de qualquer decisão; em risco imediato, SAMU <a href="tel:192" className="font-semibold underline">192</a>.
            </p>
          )}
          {!crisis.crisis && crisis.negated_only && (
            <p className="mt-2 text-sm text-slate-600">O texto registra ausência de ideação suicida.</p>
          )}
          <ExtractionPanel text={state.text} onApply={applyExtraction} />
        </div>
      </section>

      {errors.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="min-h-11 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          Ver opções por diretriz
        </button>
        <Link href="/profissional/receita" className="text-sm text-slate-700 underline underline-offset-2 hover:text-indigo-700">
          Só revisar uma receita
        </Link>
      </div>
    </form>
  );
}

export default function ProfessionalPage() {
  const stored = professionalCase.useValue();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-indigo-700">Modo profissional · experimental</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Opções de tratamento por diretriz</h1>
        <p className="mt-2 text-sm text-slate-700">
          Organiza as opções das diretrizes citadas (NICE, CANMAT, MI-mhGAP, PCDT) para o perfil informado, com
          alertas de bula, interações e disponibilidade no SUS. Não é prescrição e não substitui o julgamento clínico.
        </p>
      </header>
      {stored.status === "loading" ? (
        <p aria-live="polite" className="text-sm text-slate-600">Carregando…</p>
      ) : (
        <ProfessionalForm saved={stored.status === "ready" ? stored.value : undefined} />
      )}
    </div>
  );
}
