import type { Cite } from "@/app/lib/engine/types";
import type { Labels } from "@/app/lib/kb/labels";

// Each citation opens to show the exact quote it rests on and a link to the source.
export default function SourceRefs({ cites, labels, className = "" }: { cites: Cite[]; labels: Labels; className?: string }) {
  if (cites.length === 0) return null;
  return (
    <ul className={`space-y-1 text-xs text-slate-600 ${className}`}>
      {cites.map((cite, i) => {
        const source = labels.source(cite.source);
        const external = source?.url.startsWith("http");
        return (
          <li key={`${cite.source}-${cite.locator}-${i}`}>
            <details className="group">
              <summary className="cursor-pointer select-none hover:text-slate-900 marker:text-slate-400">
                <span className="font-medium">{source?.title ?? cite.source}</span>
                <span className="text-slate-500"> — {cite.locator}</span>
              </summary>
              <div className="mt-1 ml-4 border-l-2 border-slate-200 pl-3 space-y-1">
                {cite.quote ? (
                  <blockquote className="italic text-slate-700">“{cite.quote}”</blockquote>
                ) : (
                  <p>
                    Termo procurado e não encontrado na fonte: <strong>{cite.absent_term}</strong>
                  </p>
                )}
                {cite.note && <p>{cite.note}</p>}
                <p>
                  {source?.publisher}
                  {source?.year ? `, ${source.year}` : ""} · acesso em {cite.accessed}
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
