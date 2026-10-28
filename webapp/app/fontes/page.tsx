import type { Metadata } from "next";
import { knowledgeBase } from "@/app/lib/kb";

export const metadata: Metadata = {
  title: "Fontes — Stabilis",
  description: "Todas as fontes públicas usadas pelo Stabilis, com a versão da base de conhecimento.",
};

const KIND_LABELS: Record<string, string> = {
  guideline: "Diretrizes clínicas",
  essential_medicines_list: "Lista de medicamentos essenciais do SUS",
  instrument: "Questionários e estudos de validação",
  drug_label: "Bulas (FDA, via DailyMed)",
  dataset: "Dados abertos",
  review: "Artigos de revisão",
  service_info: "Serviços de saúde e de apoio",
  terms_of_use: "Termos de uso e licenças de terceiros",
  policy: "Política do projeto",
};

// Server component: rendered at build time from the knowledge base.
export default function SourcesPage() {
  const kb = knowledgeBase.data;
  const groups = Object.entries(
    kb.sources.reduce<Record<string, typeof kb.sources>>((acc, s) => {
      (acc[s.kind] ??= []).push(s);
      return acc;
    }, {}),
  );
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Fontes</h1>
        <p className="mt-2 text-slate-700">
          Toda opção, alerta e interação mostrada pelo Stabilis cita uma destas fontes, com o local e o trecho literal. Base de
          conhecimento versão {knowledgeBase.version}, código {knowledgeBase.hash.replace("sha256:", "").slice(0, 16)}.
        </p>
      </header>
      {groups.map(([kind, sources]) => (
        <section key={kind} aria-labelledby={`k-${kind}`}>
          <h2 id={`k-${kind}`} className="text-lg font-semibold text-slate-900">
            {KIND_LABELS[kind] ?? kind} ({sources.length})
          </h2>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {sources.map((s) => (
              <li key={s.id}>
                {s.url.startsWith("http") ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 underline underline-offset-2">{s.title}</a>
                ) : (
                  <span className="font-medium">{s.title}</span>
                )}
                <span> — {s.publisher}, {s.year}.</span> <span className="text-slate-500">{s.license_note}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
