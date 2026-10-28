"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import SourceRefs from "@/app/components/engine/SourceRefs";
import PatientShell from "@/app/components/patient/PatientShell";
import { DiaryCharts, InstrumentChart, scoreText, trackedTitle } from "@/app/components/patient/TrackingCharts";
import { knowledgeBase } from "@/app/lib/kb";
import { createLabels } from "@/app/lib/kb/labels";
import { screeningPositive } from "@/app/lib/patient/flow";
import { updatePatient, type PatientSessionV1 } from "@/app/lib/patient/store";
import { addDays, dueInstruments, EMPTY_TRACKING, localDay, MOOD_LABELS, recent, scoreSeries, SLEEP_LABELS, upsertCheckin, type Checkin } from "@/app/lib/patient/tracking";
import { detectCrisis, summarizeCrisis } from "@/app/lib/safety/crisis";
import { crisisLexicon } from "@/app/lib/safety/lexicon";

// Follow-up between visits: a daily check-in, the symptom questionnaires every few weeks, charts
// and a report for the next visit. Needs the answers kept on the device, which stays opt-in.

const kb = knowledgeBase.data;
const labels = createLabels(kb);
const MAX_NOTE = 500;
const DEFAULT_EFFECTS = ["nausea", "headache", "sleepiness", "insomnia", "dizziness", "dry_mouth", "appetite_decrease", "appetite_increase", "sexual_dysfunction", "tremor"];
const ADHERENCE: { value: NonNullable<Checkin["adherence"]>; label: string }[] = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não (esqueci ou não tomei)" },
  { value: "not_applicable", label: "Hoje não era dia de tomar" },
];

const effectLabel = (id: string) => kb.vocab.effects.effects.find((e) => e.id === id)?.label_plain ?? id;
const hasCrisis = (text: string) => summarizeCrisis(detectCrisis(text, crisisLexicon, "patient")).crisis;
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const button = "min-h-12 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800 hover:border-indigo-400";

function dayOptions(today: string): { date: string; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, -i);
    const weekday = new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
    const name = i === 0 ? "Hoje" : i === 1 ? "Ontem" : weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return { date, label: `${name} (${shortDate(date)})` };
  });
}

function Scale({ legend, name, names, value, onChange }: { legend: string; name: string; names: string[]; value: number | null; onChange: (v: number) => void }) {
  return (
    <fieldset>
      <legend className="font-medium text-slate-900">{legend}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-5">
        {[5, 4, 3, 2, 1].map((v) => (
          <label key={v} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 ${value === v ? "border-indigo-600 bg-indigo-50" : "border-slate-300 bg-white"}`}>
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="h-5 w-5 shrink-0 accent-indigo-600" />
            {names[v - 1]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EffectBox({ id, checked, onToggle }: { id: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 ${checked ? "border-indigo-600 bg-indigo-50" : "border-slate-200 bg-white"}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="h-5 w-5 shrink-0 accent-indigo-600" />
      {effectLabel(id)}
    </label>
  );
}

function CheckinForm({ session, date }: { session: PatientSessionV1; date: string }) {
  const router = useRouter();
  const existing = (session.tracking ?? EMPTY_TRACKING).checkins.find((c) => c.date === date);
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [sleep, setSleep] = useState<number | null>(existing?.sleep ?? null);
  const [effects, setEffects] = useState<string[]>(existing?.side_effects ?? []);
  const [adherence, setAdherence] = useState<Checkin["adherence"]>(existing?.adherence ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [saved, setSaved] = useState(false);
  const crisis = useMemo(() => hasCrisis(note), [note]);
  const takesMeds = session.current_meds.length > 0;

  // Effects listed in the labels of the person's medicines come first (or a short general list);
  // the list is fixed when the form opens so a box never jumps while the person is choosing.
  const [main, others] = useMemo(() => {
    const fromLabels = new Set(session.current_meds.flatMap((m) => kb.drugs.find((d) => d.id === m.drug_id)?.common_effects?.effects ?? []));
    const order = kb.vocab.effects.effects.map((e) => e.id);
    const first = order.filter((id) => (fromLabels.size ? fromLabels.has(id) : DEFAULT_EFFECTS.includes(id)) || existing?.side_effects.includes(id));
    return [first, order.filter((id) => !first.includes(id))];
  }, [session.current_meds, existing]);
  const toggle = (id: string) => {
    setEffects(effects.includes(id) ? effects.filter((e) => e !== id) : [...effects, id]);
    setSaved(false);
  };
  const othersChecked = others.filter((id) => effects.includes(id)).length;

  function save() {
    if (mood === null || sleep === null) return;
    const checkin: Checkin = { date, mood, sleep, side_effects: effects, adherence: takesMeds ? adherence : null, note: note.trim().slice(0, MAX_NOTE) };
    updatePatient((s) => ({ ...s, tracking: upsertCheckin(s.tracking ?? EMPTY_TRACKING, checkin) }));
    if (crisis && !(existing && hasCrisis(existing.note))) router.push("/paciente/seguranca?repetir=acompanhamento_nota");
    else setSaved(true);
  }

  return (
    <div className="mt-4 space-y-6">
      <Scale legend="Como foi o seu humor?" name={`mood-${date}`} names={MOOD_LABELS} value={mood} onChange={(v) => { setMood(v); setSaved(false); }} />
      <Scale legend="Como você dormiu?" name={`sleep-${date}`} names={SLEEP_LABELS} value={sleep} onChange={(v) => { setSleep(v); setSaved(false); }} />
      <fieldset>
        <legend className="font-medium text-slate-900">Sentiu algum destes efeitos? (opcional)</legend>
        {main.length > 0 && <div className="mt-2 grid gap-2 sm:grid-cols-2">{main.map((id) => <EffectBox key={id} id={id} checked={effects.includes(id)} onToggle={() => toggle(id)} />)}</div>}
        <details className="mt-2">
          <summary className="cursor-pointer py-2 text-slate-700">Outros efeitos{othersChecked > 0 ? ` (${othersChecked} marcado${othersChecked > 1 ? "s" : ""})` : ""}</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{others.map((id) => <EffectBox key={id} id={id} checked={effects.includes(id)} onToggle={() => toggle(id)} />)}</div>
        </details>
      </fieldset>
      {takesMeds && (
        <fieldset>
          <legend className="font-medium text-slate-900">Tomou os remédios como combinado?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {ADHERENCE.map((o) => (
              <label key={o.value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 ${adherence === o.value ? "border-indigo-600 bg-indigo-50" : "border-slate-300 bg-white"}`}>
                <input type="radio" name={`adherence-${date}`} checked={adherence === o.value} onChange={() => { setAdherence(o.value); setSaved(false); }} className="h-5 w-5 shrink-0 accent-indigo-600" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <label htmlFor={`note-${date}`} className="font-medium text-slate-900">Quer anotar algo? (opcional)</label>
        <p id={`note-hint-${date}`} className="text-sm text-slate-600">Fica só neste aparelho. Só entra no relatório se você escolher.</p>
        <textarea
          id={`note-${date}`}
          aria-describedby={`note-hint-${date}`}
          rows={3}
          maxLength={MAX_NOTE}
          value={note}
          onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-200"
        />
      </div>
      {crisis && (
        <div role="alert" className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-rose-950">
          <p className="font-semibold">O que você escreveu nos preocupa.</p>
          <p className="mt-1">
            Se você está pensando em se machucar, ligue agora <a href="tel:188" className="font-semibold underline">188</a> (CVV, 24 horas) ou{" "}
            <a href="tel:192" className="font-semibold underline">192</a> (SAMU). <Link href="/ajuda-agora" className="underline">Mais formas de ajuda</Link>
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={mood === null || sleep === null} className={button}>
          {existing ? "Atualizar este dia" : "Salvar este dia"}
        </button>
        <p aria-live="polite" className="text-slate-700">{saved ? "Registro salvo." : ""}</p>
      </div>
    </div>
  );
}

function DeviceOptIn() {
  return (
    <section aria-labelledby="optin" className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-slate-800">
      <h2 id="optin" className="text-lg font-semibold text-slate-900">Para acompanhar, as respostas precisam ficar neste aparelho</h2>
      <p>
        Hoje suas respostas ficam só enquanto esta aba estiver aberta. Para registrar como você está a cada dia e comparar ao longo das
        semanas, elas precisam ficar guardadas neste aparelho.
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>Continuam sem sair do aparelho: nada é enviado a nenhum servidor.</li>
        <li>Quem usar este aparelho e este navegador poderá ver as respostas.</li>
        <li>Você pode apagar tudo quando quiser.</li>
      </ul>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => updatePatient((s) => ({ ...s, storage: "device", tracking: s.tracking ?? EMPTY_TRACKING }))} className={button}>
          Guardar neste aparelho e começar
        </button>
        <Link href="/paciente/resultado" className="min-h-12 px-3 py-3 text-slate-700 underline underline-offset-2">Agora não</Link>
      </div>
    </section>
  );
}

function DataControls() {
  const [confirm, setConfirm] = useState<null | "records" | "device">(null);
  function apply() {
    if (confirm === "records") updatePatient((s) => ({ ...s, tracking: EMPTY_TRACKING }));
    if (confirm === "device")
      updatePatient((s) => {
        const next: PatientSessionV1 = { ...s, storage: "session" };
        delete next.tracking;
        return next;
      });
    setConfirm(null);
  }
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
      <summary className="cursor-pointer font-medium text-slate-900">Seus dados do acompanhamento</summary>
      <p className="mt-2 text-slate-700">Os registros ficam só neste aparelho. Apagar não tem volta.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => setConfirm("records")} className={secondary}>Apagar os registros do acompanhamento</button>
        <button type="button" onClick={() => setConfirm("device")} className={secondary}>Parar de guardar neste aparelho</button>
      </div>
      {confirm && (
        <div className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
          <p>
            {confirm === "records"
              ? "Apagar o diário e os questionários repetidos? As respostas do guia continuam."
              : "O diário e os questionários repetidos serão apagados, e as respostas do guia voltam a ficar só nesta aba."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={apply} className="min-h-12 rounded-xl bg-rose-700 px-5 py-3 font-semibold text-white hover:bg-rose-800">Sim, apagar</button>
            <button type="button" onClick={() => setConfirm(null)} className={secondary}>Cancelar</button>
          </div>
        </div>
      )}
    </details>
  );
}

function Hub({ session }: { session: PatientSessionV1 }) {
  const today = localDay(new Date());
  const [date, setDate] = useState(today);
  const tracking = session.tracking ?? EMPTY_TRACKING;
  const instruments = (kb.tracking?.instruments ?? []).filter((id) => kb.instruments.some((i) => i.id === id && i.items.every((item) => item.text_status === "verified")));
  const due = new Set(dueInstruments(kb, session, today).map((d) => d.instrument));
  const reassess = kb.tracking?.reassess_days ?? 14;
  const week = recent(tracking.checkins, today, 7).reverse();
  const hasCharts = tracking.checkins.length > 0 || instruments.some((id) => scoreSeries(kb, session, id).length > 0);

  return (
    <div className="space-y-10">
      {screeningPositive(kb, session) && (
        <section aria-label="Sinais de risco" className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-950">
          <p className="font-semibold">Suas últimas respostas de segurança mostraram sinais de risco.</p>
          <p className="mt-1">
            Se você está pensando em se machucar, ligue <a href="tel:188" className="font-semibold underline">188</a> (CVV, 24 horas) ou{" "}
            <a href="tel:192" className="font-semibold underline">192</a> (SAMU), ou vá a uma UPA. <Link href="/ajuda-agora" className="underline">Mais formas de ajuda</Link>
          </p>
          <p className="mt-2">
            <Link href="/paciente/plano-de-seguranca" className="font-semibold underline">Meu plano de segurança</Link>
          </p>
        </section>
      )}

      <p className="text-slate-700">
        Registre como você está a cada dia e refaça os questionários de tempos em tempos. Na consulta, o relatório de evolução mostra ao
        profissional como foram as semanas, e não só como você está naquele dia.
      </p>

      <section aria-labelledby="t-day">
        <h2 id="t-day" className="text-xl font-semibold text-slate-900">Como foi o seu dia</h2>
        <label className="mt-3 block">
          <span className="font-medium text-slate-900">Dia do registro</span>
          <select value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 sm:w-auto">
            {dayOptions(today).map((d) => (
              <option key={d.date} value={d.date}>
                {d.label}
                {tracking.checkins.some((c) => c.date === d.date) ? " ✓ registrado" : ""}
              </option>
            ))}
          </select>
        </label>
        <CheckinForm key={date} session={session} date={date} />
      </section>

      <section aria-labelledby="t-q">
        <h2 id="t-q" className="text-xl font-semibold text-slate-900">Questionários</h2>
        <ul className="mt-3 space-y-3">
          {instruments.map((id) => {
            const series = scoreSeries(kb, session, id);
            const last = series[series.length - 1];
            return (
              <li key={id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">{trackedTitle(id)}</p>
                <p className="text-slate-700">{last ? `Última vez em ${shortDate(last.date)}: ${scoreText(id, last.total)}.` : "Ainda não respondido."}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {due.has(id) || !last ? (
                    <Link href={`/paciente/acompanhamento/questionario/${id}`} className={button}>Responder agora</Link>
                  ) : (
                    <>
                      <p className="text-slate-700">Próxima vez: a partir de {shortDate(addDays(last.date, reassess))}.</p>
                      <Link href={`/paciente/acompanhamento/questionario/${id}`} className="min-h-12 py-3 text-indigo-700 underline underline-offset-2">Responder antes</Link>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {kb.tracking && (
          <div className="mt-3 text-slate-700">
            <p>
              Sugerimos refazer a cada {reassess} dias: a diretriz do NICE recomenda rever com a pessoa como o tratamento está funcionando
              entre 2 e 4 semanas depois de começar.
            </p>
            <SourceRefs cites={kb.tracking.sources} labels={labels} className="mt-1" size="base" />
          </div>
        )}
      </section>

      <section aria-labelledby="t-evo" className="space-y-4">
        <h2 id="t-evo" className="text-xl font-semibold text-slate-900">Sua evolução</h2>
        {hasCharts ? (
          <>
            {instruments.map((id) => <InstrumentChart key={id} session={session} id={id} />)}
            <DiaryCharts checkins={tracking.checkins} today={today} days={30} />
          </>
        ) : (
          <p className="text-slate-700">Os gráficos aparecem depois dos primeiros registros.</p>
        )}
      </section>

      {week.length > 0 && (
        <section aria-labelledby="t-week">
          <h2 id="t-week" className="text-xl font-semibold text-slate-900">Últimos 7 dias</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {week.map((c) => (
              <li key={c.date} className="px-4 py-3 text-slate-800">
                <span className="font-medium">{shortDate(c.date)}</span>: humor {MOOD_LABELS[c.mood - 1].toLowerCase()} · sono {SLEEP_LABELS[c.sleep - 1].toLowerCase()}
                {c.side_effects.length > 0 && ` · ${c.side_effects.map((e) => effectLabel(e).toLowerCase()).join(", ")}`}
                {c.adherence === "yes" && " · tomou os remédios"}
                {c.adherence === "no" && " · não tomou os remédios"}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="t-next">
        <h2 id="t-next" className="text-xl font-semibold text-slate-900">Para a próxima consulta</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/paciente/acompanhamento/relatorio" className={button}>Relatório de evolução</Link>
          <Link href="/paciente/receita" className={secondary}>Entender minha receita</Link>
          <Link href="/paciente/resultado" className={secondary}>Meu resultado</Link>
        </div>
      </section>

      <section aria-labelledby="t-hard">
        <h2 id="t-hard" className="text-xl font-semibold text-slate-900">Se ficar difícil</h2>
        <p className="mt-2 text-slate-700">
          O plano de segurança é um roteiro, escrito por você, com o que fazer numa crise.{" "}
          <Link href="/paciente/plano-de-seguranca" className="text-indigo-700 underline">Abrir meu plano de segurança</Link>
        </p>
      </section>

      <DataControls />
    </div>
  );
}

export default function TrackingPage() {
  return (
    <PatientShell
      path="/paciente/acompanhamento"
      title="Acompanhamento"
      missing={
        <div className="space-y-4 text-slate-700">
          <p>
            O acompanhamento ajuda a registrar como você está entre uma consulta e outra: humor, sono, efeitos dos remédios e os
            questionários de sintomas a cada duas semanas.
          </p>
          <p>Ele começa depois do guia, que leva uns 15 minutos: as respostas do guia são o ponto de partida.</p>
          <Link href="/paciente" className={`inline-block ${button}`}>Começar o guia</Link>
        </div>
      }
    >
      {(session) => (session.storage === "device" ? <Hub session={session} /> : <DeviceOptIn />)}
    </PatientShell>
  );
}
