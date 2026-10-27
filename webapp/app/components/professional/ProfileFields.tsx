"use client";

import { useId } from "react";
import type { Profile } from "@/app/lib/engine/types";
import { knowledgeBase } from "@/app/lib/kb";

const vocab = knowledgeBase.data.vocab.comorbidities;

export interface ProfileDraft {
  age: string;
  sex: "" | "female" | "male" | "intersex";
  genderIdentity: string;
  pregnant: "" | "yes" | "no" | "unsure";
  breastfeeding: "" | "yes" | "no";
  planning: "" | "yes" | "no";
  conditions: string[];
  habits: string[];
}

export const EMPTY_PROFILE: ProfileDraft = {
  age: "",
  sex: "",
  genderIdentity: "",
  pregnant: "",
  breastfeeding: "",
  planning: "",
  conditions: [],
  habits: [],
};

const yesNo = (value: "" | "yes" | "no") => (value === "" ? null : value === "yes");

export function parseAge(draft: ProfileDraft): number | null {
  const age = Number(draft.age);
  return draft.age.trim() !== "" && Number.isInteger(age) && age >= 0 && age <= 120 ? age : null;
}

/** Reproductive questions apply to anyone not male at birth within (or near) reproductive age. */
export function asksReproductive(draft: ProfileDraft): boolean {
  const age = parseAge(draft);
  return draft.sex !== "" && draft.sex !== "male" && (age === null || (age >= 10 && age <= 60));
}

export function toProfile(draft: ProfileDraft, rest: Pick<Profile, "current_meds"> & Partial<Profile>): Profile {
  const reproductive = asksReproductive(draft);
  return {
    age: parseAge(draft),
    sex_at_birth: draft.sex === "" ? null : draft.sex,
    reproductive: {
      pregnant: reproductive && draft.pregnant !== "" ? draft.pregnant : reproductive ? null : "no",
      breastfeeding: reproductive ? yesNo(draft.breastfeeding) : false,
      planning: reproductive ? yesNo(draft.planning) : false,
    },
    conditions: draft.conditions,
    habits: draft.habits,
    ...rest,
  };
}

export function fromProfile(profile: Profile, genderIdentity = ""): ProfileDraft {
  const yn = (value: boolean | null) => (value === null ? "" : value ? "yes" : "no");
  return {
    age: profile.age === null ? "" : String(profile.age),
    sex: profile.sex_at_birth ?? "",
    genderIdentity,
    pregnant: profile.reproductive.pregnant ?? "",
    breastfeeding: yn(profile.reproductive.breastfeeding),
    planning: yn(profile.reproductive.planning),
    conditions: profile.conditions,
    habits: profile.habits,
  };
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

function Radio<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${value === option.value ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white"}`}
        >
          <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="accent-indigo-600" />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export default function ProfileFields({ value, onChange }: { value: ProfileDraft; onChange: (draft: ProfileDraft) => void }) {
  const id = useId();
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <div>
          <label htmlFor={`${id}-age`} className="block text-sm font-medium text-slate-800">Idade (anos)</label>
          <input id={`${id}-age`} type="number" min={0} max={120} required value={value.age} onChange={(e) => set({ age: e.target.value })} className={inputClass} />
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">Sexo atribuído ao nascer</legend>
          <Radio
            name={`${id}-sex`}
            value={value.sex}
            onChange={(sex) => set({ sex })}
            options={[
              { value: "female", label: "Feminino" },
              { value: "male", label: "Masculino" },
              { value: "intersex", label: "Intersexo" },
            ]}
          />
        </fieldset>
      </div>
      <div>
        <label htmlFor={`${id}-gender`} className="block text-sm font-medium text-slate-800">Identidade de gênero (opcional)</label>
        <input id={`${id}-gender`} type="text" value={value.genderIdentity} onChange={(e) => set({ genderIdentity: e.target.value })} className={inputClass} />
        <p className="mt-1 text-xs text-slate-600">Não entra nas regras; as regras de gravidez usam o sexo ao nascer.</p>
      </div>

      {asksReproductive(value) && (
        <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">Gravidez e amamentação</legend>
          <p className="text-xs text-slate-600">Sem resposta, a gravidez é tratada como “não sei” (regra de segurança).</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-800">Gravidez</p>
              <Radio name={`${id}-preg`} value={value.pregnant} onChange={(pregnant) => set({ pregnant })} options={[{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }, { value: "unsure", label: "Não sei" }]} />
            </div>
            <div>
              <p className="text-sm text-slate-800">Planeja engravidar</p>
              <Radio name={`${id}-plan`} value={value.planning} onChange={(planning) => set({ planning })} options={[{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }]} />
            </div>
            <div>
              <p className="text-sm text-slate-800">Amamentando</p>
              <Radio name={`${id}-bf`} value={value.breastfeeding} onChange={(breastfeeding) => set({ breastfeeding })} options={[{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }]} />
            </div>
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Comorbidades</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {vocab.comorbidities.map((c) => (
            <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={value.conditions.includes(c.id)} onChange={() => set({ conditions: toggle(value.conditions, c.id) })} className="accent-indigo-600" />
              {c.label_clinical}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Hábitos</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {vocab.habits.map((h) => (
            <label key={h.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={value.habits.includes(h.id)} onChange={() => set({ habits: toggle(value.habits, h.id) })} className="accent-indigo-600" />
              {h.label_clinical}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
