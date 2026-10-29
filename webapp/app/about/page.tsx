import type { Metadata } from "next";
import Link from "next/link";
import { knowledgeBase } from "@/app/lib/kb";

export const metadata: Metadata = {
  title: "Sobre — Stabilis",
  description: "Como o Stabilis funciona: de onde vêm as opções, regras de segurança, uso de IA, privacidade e limitações.",
};

// Server component: the knowledge base is read at build time and not sent to the browser here.
const kb = knowledgeBase.data;
const counts = {
  drugs: kb.drugs.filter((d) => !d.scope.interaction_only).length,
  interactionOnly: kb.drugs.filter((d) => d.scope.interaction_only).length,
  rules: kb.rules.length,
  interactions: kb.interactions.length,
  brands: Object.keys(kb.brands).length,
};
const KIND_LABELS: Record<string, string> = {
  guideline: "Diretrizes clínicas",
  essential_medicines_list: "Lista de medicamentos essenciais",
  drug_label: "Bulas",
  dataset: "Dados abertos",
  instrument: "Instrumentos",
  review: "Artigos de revisão",
  service_info: "Serviços de saúde e de apoio",
  terms_of_use: "Termos de uso de terceiros",
  policy: "Política do projeto",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20">
      <h2 id={`${id}-t`} className="mb-3 border-b border-slate-200 pb-2 text-lg font-bold text-slate-900">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  const sourcesByKind = Object.entries(
    kb.sources.reduce<Record<string, typeof kb.sources>>((acc, s) => {
      (acc[s.kind] ??= []).push(s);
      return acc;
    }, {}),
  );
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Sobre o Stabilis</h1>
        <p className="mt-2 text-slate-700">
          Um guia, baseado em diretrizes públicas, do que costuma ser indicado em saúde mental, para levar à consulta.
          Feito para quem depende do SUS e muitas vezes tem pouco tempo com o médico. Não faz diagnóstico, não prescreve
          e não substitui a avaliação de um profissional.
        </p>
      </header>

      <Section id="fontes" title="De onde vem cada opção">
        <p>
          Nada é inventado pelo sistema. As opções, os alertas e as interações vêm de uma base de conhecimento montada a
          partir de documentos públicos, e <strong>cada afirmação aponta para a fonte, o local exato e o trecho literal</strong> em
          que se baseia. Um verificador automático confere se cada trecho realmente está no documento.
        </p>
        <p>
          Hoje a base tem {counts.drugs} medicamentos psiquiátricos registrados na ANVISA, mais {counts.interactionOnly} usados
          só para checar interações (anti-inflamatórios, anti-hipertensivos, anticoncepcional, opioides…),{" "}
          {counts.rules} regras de segurança, {counts.interactions} regras de interação e {counts.brands.toLocaleString("pt-BR")} nomes
          comerciais. A disponibilidade no SUS vem da RENAME 2024; ela varia por município.
        </p>
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
          Todo o conteúdo foi extraído com ajuda de IA e está marcado como <strong>rascunho</strong>: ainda não passou pela segunda
          conferência humana nem por revisão de profissional de saúde.
        </p>
      </Section>

      <Section id="linhas" title="Como as opções são organizadas">
        <p>
          Não há nota nem ranking. As opções aparecem na ordem das diretrizes: <strong>1ª linha</strong>, <strong>2ª linha</strong>,{" "}
          <strong>alternativas</strong>, <strong>não recomendados pela diretriz</strong> e <strong>evitar neste perfil</strong> (indicados pela
          diretriz, mas com alerta forte para aquela pessoa, por exemplo um teratogênico quando há possibilidade de gravidez).
          Dentro de uma mesma linha, os efeitos que a pessoa quer evitar ajudam a ordenar; nunca mudam a linha.
        </p>
        <p>
          Condições cobertas: depressão (adultos), ansiedade generalizada e transtorno bipolar tipos I e II, com opções por fase
          no modo profissional.
        </p>
      </Section>

      <Section id="seguranca" title="Regras de segurança">
        <ul className="list-disc space-y-2 pl-5">
          <li>Menção a pensamentos de morte ou de se machucar mostra ajuda imediata (CVV 188, SAMU 192) e, no modo paciente, oculta todo conteúdo sobre remédios.</li>
          <li>No modo paciente, antidepressivos só aparecem depois de uma triagem de bipolaridade negativa; menores de 18 anos recebem só orientação de encaminhamento (CAPSi ou UBS).</li>
          <li>Dado ausente nunca vira “sem risco”: sem idade e sexo ao nascer não há conteúdo sobre remédios, e gravidez não informada é tratada como “não sei”.</li>
          <li>
            Toda resposta passa por verificações independentes das regras (por exemplo: nunca um teratogênico maior em linha recomendada
            com possibilidade de gravidez). Se alguma falha, as informações sobre remédios são ocultadas.
          </li>
        </ul>
      </Section>

      <Section id="receita" title="Interações e revisão de receita">
        <p>
          As interações são verificadas por propriedades documentadas em bula (por exemplo, “serotoninérgico”, “prolonga o QT”,
          “contraindicado com IMAO”, “aumenta o lítio”). A <Link href="/profissional/receita" className="text-indigo-700 underline">revisão de receita</Link>{" "}
          compara cada dose com a faixa da bula de referência e lista alertas para o perfil e monitoramento indicado. Ela não
          calcula concentração no sangue: o antigo simulador farmacocinético foi desativado porque dava falsa segurança.
        </p>
      </Section>

      <Section id="ia" title="Onde entra a inteligência artificial">
        <p>
          A IA <strong>só lida com linguagem</strong>: no botão “Extrair do texto”, um modelo de linguagem lê a anamnese e sugere
          comorbidades, hábitos e medicamentos para o formulário. Cada sugestão precisa citar um trecho que esteja no texto (as
          que não citam são descartadas), itens negados ou sobre outra pessoa são ignorados, e nada entra no formulário sem
          confirmação. O detector de crise é determinístico e sempre roda; o modelo pode acrescentar um sinal de risco, nunca
          retirá-lo. Nenhuma opção de tratamento sai do modelo.
        </p>
        <p>
          A próxima etapa é ajustar (fine-tuning) um modelo aberto para o português do dia a dia. Ele só substitui o atual se
          passar por metas medidas num conjunto de textos escrito por pessoas, como recall de risco de pelo menos 98%. Só então a
          ajuda para organizar o relato pode ser ligada no modo paciente, e mesmo assim cada envio pede consentimento.
        </p>
        <p>
          As respostas a perguntas sobre remédios (em “Entender minha receita”) <strong>não usam IA</strong>: vêm da base de
          conhecimento, com fonte, ou dizem que não sabem.
        </p>
      </Section>

      <Section id="privacidade" title="Privacidade">
        <p>
          As regras rodam no seu navegador. Os dados ficam só nesta aba (são apagados ao fechá-la), ou no aparelho se você
          escolher, e não são enviados a nenhum servidor, com uma exceção: o texto que você mesmo envia para um modelo de
          linguagem (“Extrair do texto”, ou a ajuda do relato quando estiver disponível), que é processado e descartado, sem ser
          armazenado nem registrado em log.
        </p>
      </Section>

      <Section id="limitacoes" title="Limitações">
        <ul className="list-disc space-y-2 pl-5">
          <li>Sem validação clínica: não é possível afirmar acurácia clínica. Use como material para conversar com quem cuida de você.</li>
          <li>
            O Stabilis não foi avaliado nem regularizado pela Anvisa como dispositivo médico. O modo profissional é experimental e
            de uso não comercial.
          </li>
          <li>As diretrizes usadas são para adultos; crianças e adolescentes têm recomendações diferentes.</li>
          <li>As bulas de referência são as aprovadas pela FDA (EUA), de domínio público; a bula brasileira pode diferir em detalhes.</li>
          <li>Psicose, mania aguda grave, transtornos alimentares, TDAH e dependência química recebem apenas orientação de encaminhamento.</li>
          <li>Ferramenta experimental, de uso não comercial.</li>
        </ul>
      </Section>

      <Section id="licencas" title="Fontes e licenças">
        <p>Base de conhecimento v{knowledgeBase.version} ({knowledgeBase.hash.replace("sha256:", "").slice(0, 12)}).</p>
        {sourcesByKind.map(([kind, sources]) => (
          <div key={kind}>
            <h3 className="font-semibold text-slate-800">
              {KIND_LABELS[kind] ?? kind} ({sources.length})
            </h3>
            {kind === "drug_label" ? (
              <p className="mt-1">Bulas aprovadas pela FDA, obtidas no DailyMed (U.S. National Library of Medicine). Domínio público nos EUA.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {sources.map((s) => (
                  <li key={s.id}>
                    {s.url.startsWith("http") ? (
                      <a href={s.url} className="text-indigo-700 underline underline-offset-2" target="_blank" rel="noreferrer">{s.title}</a>
                    ) : (
                      s.title
                    )}{" "}
                    — {s.publisher}, {s.year}. <span className="text-slate-500">{s.license_note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Section>

      <Section id="legado" title="Versão antiga">
        <p>
          A primeira versão do modo profissional ordenava medicamentos com uma nota de 0 a 100, calculada por uma rede neural e
          por pesos manuais, sem fonte para cada afirmação. Ela foi removida: a base de dados daquela rede (Broad Drug
          Repurposing Hub) é licenciada só para pesquisa e proíbe o uso em decisões de tratamento, e a nota não era uma
          probabilidade de resposta.
        </p>
      </Section>
    </div>
  );
}
