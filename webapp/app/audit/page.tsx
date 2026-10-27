import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Auditoria de prescrição (desativada) — Stabilis",
};

export default function AuditPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-8 py-10 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Auditoria de prescrição temporariamente desativada</h1>
        <p className="text-base text-slate-700 leading-relaxed">
          A simulação de toxicidade usava parâmetros farmacocinéticos sem fonte publicada e podia indicar
          &quot;seguro&quot; para medicamentos sem nenhum dado — ou marcar doses usuais como tóxicas. Por isso ela foi
          desligada.
        </p>
        <p className="text-base text-slate-700 leading-relaxed">
          Ela será substituída por uma revisão de receita determinística: dose comparada à faixa da bula,
          interações com fonte citada e orientações de monitoramento (por exemplo, dosagem de lítio no sangue).
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          Voltar ao formulário
        </Link>
      </div>
    </div>
  );
}
