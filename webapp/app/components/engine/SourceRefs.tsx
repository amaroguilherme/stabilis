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

// Each citation opens to show the exact quote it rests on and a link to the source.
export default function SourceRefs({
  cites,
  labels,
  className = "",
  size = "xs",
}: {
  cites: Cite[];
  labels: Labels;
  className?: string;
  size?: "xs" | "base"; // "base" on patient pages (text of at least 16 px)
}) {
  const [quotes, setQuotes] = useState<Record<string, QuoteEntry> | "error" | null>(null);
  if (cites.length === 0) return null;

  function open(event: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || quotes) return;
    loadQuotes().then(setQuotes, () => setQuotes("error"));
  }

  return (
    <ul className={`space-y-1 ${size === "base" ? "text-base" : "text-xs"} text-slate-700 ${className}`}>
      {cites.map((cite, i) => {
        const source = labels.source(cite.source);
        const external = source?.url.startsWith("http");
        const entry = quotes === "error" ? "error" : cite.qid && quotes ? (quotes[cite.qid] ?? null) : null;
        const accessed = cite.accessed ?? (entry && entry !== "error" ? entry.accessed : undefined);
        return (
          <li key={`${cite.source}-${cite.locator}-${i}`}>
            <details onToggle={open}>
              <summary className="cursor-pointer select-none hover:text-slate-900 marker:text-slate-400">
                <span className="font-medium">{source?.title ?? cite.source}</span>
                <span> — {cite.locator}</span>
              </summary>
              <div className="mt-1 ml-4 border-l-2 border-slate-200 pl-3 space-y-1">
                <Quote cite={cite} entry={entry} />
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
