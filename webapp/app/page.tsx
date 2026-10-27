import Link from "next/link";

// Landing page: two entries. Server component, works without JavaScript.
export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Stabilis</h1>
        <p className="mt-3 text-lg text-slate-700">
          Um guia baseado em diretrizes públicas de saúde mental, para levar à consulta e conversar com quem cuida de você.
        </p>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section aria-labelledby="entrada-paciente" className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 id="entrada-paciente" className="text-xl font-semibold text-slate-900">Para você, paciente</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Em construção</span>
          </div>
          <p className="mt-3 text-slate-700">
            Você vai poder contar o que está sentindo, responder questionários validados e sair com um relatório para
            mostrar ao médico: o que as diretrizes indicam, o que existe no SUS e quais perguntas fazer.
          </p>
          <p className="mt-4 text-sm text-slate-600">
            Se você está pensando em se machucar ou em crise, não espere:{" "}
            <Link href="/ajuda-agora" className="font-medium text-rose-700 underline underline-offset-2">veja onde buscar ajuda agora</Link>.
          </p>
        </section>

        <section aria-labelledby="entrada-profissional" className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="entrada-profissional" className="text-xl font-semibold text-slate-900">Para profissionais de saúde</h2>
          <p className="mt-3 flex-1 text-slate-700">
            Informe o perfil e a hipótese diagnóstica e veja as opções por linha de diretriz, com alertas de bula,
            interações, monitoramento, disponibilidade no SUS e a fonte de cada afirmação.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/profissional" className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              Opções por diretriz
            </Link>
            <Link href="/profissional/receita" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
              Revisar uma receita
            </Link>
          </div>
        </section>
      </div>

      <section aria-labelledby="como-funciona" className="mt-10 max-w-3xl space-y-3 text-sm text-slate-700">
        <h2 id="como-funciona" className="text-base font-semibold text-slate-900">Como funciona</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            As opções vêm de diretrizes e documentos públicos (NICE, CANMAT, MI-mhGAP da OPAS, PCDT e RENAME do
            Ministério da Saúde, bulas aprovadas). Cada item mostra a fonte e o trecho em que se baseia.
          </li>
          <li>As regras rodam no seu navegador: os dados que você digita não são enviados a nenhum servidor, a não ser o texto que você mesmo enviar em “Extrair do texto”.</li>
          <li>
            Nada aqui foi revisado por um profissional de saúde ainda. É um material para conversar com quem cuida de
            você, não um diagnóstico nem uma prescrição.
          </li>
        </ul>
      </section>
    </div>
  );
}
