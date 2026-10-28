"use client";

import { useState } from "react";
import type { Cite } from "@/app/lib/engine/types";
import type { Labels } from "@/app/lib/kb/labels";
import { loadQuotes, type QuoteEntry } from "@/app/lib/kb/quotes";

function Quote({ cite, entry }: { cite: Cite; entry: QuoteEntry | null | "error" }) {
  if (entry === "error") return <p>Não foi possível carregar o trecho agora.</p>;
  const data: QuoteEntry = cite.quote || cite.absent_term ? cite : (entry ?? {});
  if (!data.quote && !data.absent_term) return <p aria-live="polite">Carregando o trecho…</p>;
  return (
    <>
      {data.quote ? (
        <blockquote className="italic text-slate-700">“{data.quote}”</blockquote>
      ) : (
        <p>
          Termo procurado e não encontrado na fonte: <strong>{data.absent_term}</strong>
        </p>
      )}
      {data.note && <p>{data.note}</p>}
    </>
  );
}

// Each reference opens to show the exact quotes it rests on and a link to the source. Citations of
// the same place (source and locator) share one entry. With `collapse`, several references sit
// behind one link (on patient pages, long source lists bury the content).
export default function SourceRefs({
  cites,
  labels,
  className = "",
  size = "xs",
  collapse,
}: {
  cites: Cite[];
  labels: Labels;
  className?: string;
  size?: "xs" | "base"; // "base" on patient pages (text of at least 16 px)
  collapse?: string; // summary text, e.g. "De onde vem esta orientação" (or "Fontes" on clinical cards)
}) {
  const [quotes, setQuotes] = useState<Record<string, QuoteEntry> | "error" | null>(null);
  if (cites.length === 0) return null;

  const groups: { key: string; cites: Cite[] }[] = [];
  for (const cite of cites) {
    const key = `${cite.source}|${cite.locator}`;
    const group = groups.find((g) => g.key === key);
    if (group) group.cites.push(cite);
    else groups.push({ key, cites: [cite] });
  }

  function open(event: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || quotes) return;
    loadQuotes().then(setQuotes, () => setQuotes("error"));
  }

  if (collapse && groups.length > 1) {
    return (
      <details className={className}>
        <summary className={`cursor-pointer select-none py-1 text-slate-700 hover:text-slate-900 marker:text-slate-400 ${size === "base" ? "text-base" : "text-xs"}`}>
          {collapse === "Fontes" ? `Fontes (${groups.length})` : `${collapse} (${groups.length} fontes)`}
        </summary>
        <SourceRefs cites={cites} labels={labels} size={size} className="mt-1 ml-4" />
      </details>
    );
  }

  const entryOf = (cite: Cite) => (quotes === "error" ? "error" : cite.qid && quotes ? (quotes[cite.qid] ?? null) : null);
  return (
    <ul className={`space-y-1 ${size === "base" ? "text-base" : "text-xs"} text-slate-700 ${className}`}>
      {groups.map(({ key, cites: group }) => {
        const first = group[0];
        const source = labels.source(first.source);
        const external = source?.url.startsWith("http");
        const firstEntry = entryOf(first);
        const accessed = first.accessed ?? (firstEntry && firstEntry !== "error" ? firstEntry.accessed : undefined);
        return (
          <li key={key}>
            <details onToggle={open}>
              <summary className={`cursor-pointer select-none hover:text-slate-900 marker:text-slate-400 ${size === "xs" ? "py-1" : ""}`}>
                <span className="font-medium">{source?.title ?? first.source}</span>
                <span> — {first.locator}</span>
              </summary>
              <div className="mt-1 ml-4 border-l-2 border-slate-200 pl-3 space-y-1">
                {group.map((cite, i) => <Quote key={cite.qid ?? i} cite={cite} entry={entryOf(cite)} />)}
                <p>
                  {source?.publisher}
                  {source?.year ? `, ${source.year}` : ""}
                  {accessed ? ` · acesso em ${accessed}` : ""}
                  {external && (
                    <>
                      {" · "}
                      <a href={source?.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-indigo-700">
                        abrir fonte
                      </a>
                    </>
                  )}
                </p>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
