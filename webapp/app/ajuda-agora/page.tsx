import type { Metadata } from "next";

// Static page rendered on the server: it must work even with JavaScript disabled.

export const metadata: Metadata = {
  title: "Ajuda agora — Stabilis",
  description: "Onde buscar ajuda imediata em uma crise de saúde mental no Brasil.",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
      <h2 className="text-lg font-bold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-3 text-base text-slate-700 leading-relaxed">{children}</div>
    </section>
  );
}

function CallButton({ number, label }: { number: string; label: string }) {
  return (
    <a
      href={`tel:${number}`}
      className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold text-base"
    >
      {label}
    </a>
  );
}

export default function AjudaAgoraPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Precisa de ajuda agora?</h1>
        <p className="mt-3 text-base text-slate-700 leading-relaxed">
          Se você está pensando em se machucar ou em tirar a própria vida, ou se alguém perto de você
          está em perigo, procure ajuda agora. Você não precisa passar por isso sozinho.
        </p>
      </div>

      <Card title="Risco imediato">
        <p>
          Se existe perigo agora, ligue para o <strong>SAMU (192)</strong> ou vá à <strong>UPA</strong> ou ao
          pronto-socorro mais próximo.
        </p>
        <CallButton number="192" label="Ligar para o SAMU — 192" />
      </Card>

      <Card title="Para conversar agora">
        <p>
          O <strong>CVV (Centro de Valorização da Vida)</strong> oferece apoio emocional gratuito e sigiloso,
          24 horas por dia, todos os dias. Ligue <strong>188</strong> ou use o chat no site{" "}
          <a href="https://cvv.org.br" className="font-semibold text-indigo-700 underline underline-offset-2" rel="noopener noreferrer">
            cvv.org.br
          </a>
          .
        </p>
        <CallButton number="188" label="Ligar para o CVV — 188" />
      </Card>

      <Card title="Acompanhamento pelo SUS">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>UBS (posto de saúde)</strong> do seu bairro: porta de entrada para consulta e encaminhamento.
          </li>
          <li>
            <strong>CAPS (Centro de Atenção Psicossocial)</strong>: atende crises e faz acompanhamento em saúde
            mental. Em muitos municípios é possível procurar o CAPS diretamente, sem encaminhamento.
          </li>
        </ul>
      </Card>

      <Card title="Plano de segurança">
        <p>
          Um roteiro curto, escrito por você num momento mais calmo, com os sinais de que está ficando mal e o que fazer, passo a
          passo, até se sentir em segurança. Fica só neste aparelho e pode ser impresso.
        </p>
        <a href="/paciente/plano-de-seguranca" className="font-semibold text-indigo-700 underline underline-offset-2">
          Fazer meu plano de segurança
        </a>
      </Card>

      <Card title="Se outra pessoa está em risco">
        <ul className="list-disc pl-5 space-y-2">
          <li>Fique com a pessoa e não a deixe sozinha.</li>
          <li>Afaste objetos e medicamentos que possam ser usados para se machucar.</li>
          <li>Ouça sem julgar; leve a sério o que ela diz.</li>
          <li>Ligue para o SAMU (192) ou acompanhe a pessoa até um pronto-socorro.</li>
        </ul>
      </Card>
    </div>
  );
}
