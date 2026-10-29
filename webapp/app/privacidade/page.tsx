import type { Metadata } from "next";
import Link from "next/link";
import MetricsToggle from "@/app/components/MetricsToggle";

export const metadata: Metadata = {
  title: "Privacidade — Stabilis",
  description: "Como o Stabilis trata os seus dados de saúde.",
};

// Identification and contact of the person responsible for the project (LGPD art. 9 and 41), set on
// Vercel so that no personal data lives in the repository.
const CONTROLLER = process.env.NEXT_PUBLIC_CONTROLLER_NAME;
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

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
          <li>
            O diário do acompanhamento (humor, sono, efeitos e anotações) só é guardado se você escolher guardar no aparelho. O plano
            de segurança fica à parte, também só na aba, a não ser que você escolha guardá-lo.
          </li>
          <li>Os resultados são calculados no seu navegador. Nenhum servidor recebe suas respostas.</li>
          <li>
            Para funcionar sem internet, o navegador guarda cópias das páginas e dos arquivos do site que você já abriu. Essas cópias
            não têm nenhuma resposta sua.
          </li>
          <li>O site não usa cookies de rastreamento nem ferramentas de publicidade.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Quando os dados saem do aparelho</h2>
        <p>Só quando você decide, e sempre com aviso antes:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Ao imprimir, salvar em PDF, baixar o arquivo de respostas ou compartilhar o resumo (por WhatsApp, por exemplo). A partir daí,
            valem as regras do aplicativo ou da pessoa que recebe. O arquivo de respostas leva só as respostas do guia, sem o diário e
            sem o plano de segurança; as anotações do diário só entram no relatório de evolução se você marcar essa opção.
          </li>
          <li>
            No ditado por voz: para virar texto, o que você fala é enviado pelo navegador à empresa que o faz (no Chrome, ao Google; no
            Safari, à Apple), fora do Brasil. O Stabilis não recebe nem guarda o áudio.
          </li>
          <li>
            Na ajuda para organizar o relato (quando estiver disponível) e em “Extrair do texto”, no modo profissional: o texto vai ao
            servidor do Stabilis, que fica fora do Brasil, para ser lido por um modelo de linguagem, e é descartado em seguida, sem ser
            guardado nem registrado. No modo paciente, isso só acontece se você marcar que concorda, a cada vez.
          </li>
          <li>As perguntas sobre remédios são respondidas no seu navegador e não saem do aparelho.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Contagens anônimas (opcional)</h2>
        <p>
          Se você ligar, o Stabilis conta quantas vezes os relatórios são impressos, baixados ou compartilhados e as respostas a “levou
          o relatório ao médico?” e “sentiu que te ouviram?”. Vai só o nome do que aconteceu: nenhuma resposta do guia, nenhum
          identificador e nenhuma data além do mês. São contagens de respostas, não de pessoas. Fica desligado até você ligar.
        </p>
        <MetricsToggle />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Como apagar</h2>
        <p>
          Use “Apagar meus dados” no resultado ou na página inicial do paciente. Isso remove tudo o que o Stabilis guardou neste
          navegador, inclusive o diário, o plano de segurança e a escolha sobre as contagens. Também dá para apagar só o diário (no
          acompanhamento) ou só o plano (na página do plano). Fechar a aba também apaga, se você escolheu não guardar no aparelho.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Quem é responsável</h2>
        <p>
          O Stabilis é um projeto sem fins comerciais, mantido por {CONTROLLER ? `${CONTROLLER}, pessoa física, responsável pelo tratamento dos dados` : "uma pessoa física"}.
          {CONTACT ? (
            <>
              {" "}Para dúvidas sobre os seus dados ou para exercer os seus direitos (LGPD, art. 18), escreva para{" "}
              <a href={`mailto:${CONTACT}`} className="text-indigo-700 underline">{CONTACT}</a>.
            </>
          ) : null}
        </p>
      </section>

      <section className="space-y-2 text-sm text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">Versão deste aviso: 29/10/2026</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>29/10/2026: ditado por voz, ajuda para organizar o relato, contagens anônimas e uso sem internet, todos opcionais.</li>
          <li>27/10/2026: primeira versão.</li>
        </ul>
      </section>

      <p className="text-sm text-slate-600">
        Ferramenta experimental, educacional e de uso não comercial. Veja também <Link href="/about" className="text-indigo-700 underline">Sobre</Link> e{" "}
        <Link href="/fontes" className="text-indigo-700 underline">Fontes</Link>.
      </p>
    </div>
  );
}
