import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidade — Stabilis",
  description: "Como o Stabilis trata os seus dados de saúde.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 text-base text-slate-800 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Privacidade</h1>
      <p>
        As respostas que você dá ao Stabilis são dados de saúde, que a Lei Geral de Proteção de Dados (LGPD, art. 11) trata como
        dados pessoais sensíveis. Por isso, a regra aqui é simples: <strong>eles ficam no seu aparelho</strong>.
      </p>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">O que fica onde</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>As respostas ficam guardadas no navegador: só enquanto a aba estiver aberta, ou neste aparelho, se você escolher.</li>
          <li>Os resultados são calculados no seu navegador. Nenhum servidor recebe suas respostas.</li>
          <li>
            Exceção, só no modo profissional: o botão “Extrair do texto” envia a anamnese ao servidor do Stabilis para ser lida por um
            modelo de linguagem. O texto é processado e descartado, sem ser guardado nem registrado em log.
          </li>
          <li>O site não usa cookies de rastreamento nem ferramentas de publicidade.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Quando os dados saem do aparelho</h2>
        <p>
          Só quando você decide: ao imprimir, salvar em PDF, baixar o arquivo de respostas ou compartilhar o resumo (por WhatsApp,
          por exemplo). A partir daí, valem as regras do aplicativo ou da pessoa que recebe.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Como apagar</h2>
        <p>
          Use “Apagar meus dados” no resultado ou na página inicial do paciente. Isso remove tudo o que o Stabilis guardou neste
          navegador. Fechar a aba também apaga, se você escolheu não guardar no aparelho.
        </p>
      </section>
      <p className="text-sm text-slate-600">
        Ferramenta experimental, educacional e de uso não comercial. Veja também <Link href="/about" className="text-indigo-700 underline">Sobre</Link> e{" "}
        <Link href="/fontes" className="text-indigo-700 underline">Fontes</Link>.
      </p>
    </div>
  );
}
