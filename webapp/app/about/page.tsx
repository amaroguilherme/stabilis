import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sobre — Stabilis",
  description: "Como o Stabilis funciona: metodologia, pontuação e limitações",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
        {title}
      </h2>
      <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-800 mb-1.5">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border mr-1.5 ${color}`}>
      {children}
    </span>
  );
}

function ScoreRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-4 font-medium text-slate-800 whitespace-nowrap">{label}</td>
      <td className="py-2 pr-4 font-mono text-indigo-700 whitespace-nowrap">{value}</td>
      {note && <td className="py-2 text-slate-500">{note}</td>}
    </tr>
  );
}

const TOC = [
  { id: "visao-geral",     label: "Visão Geral"             },
  { id: "pipeline",        label: "Pipeline de Análise"     },
  { id: "pontuacao",       label: "Sistema de Pontuação"    },
  { id: "contraindicacoes",label: "Contraindicações"        },
  { id: "diagnosticos",    label: "Diagnósticos Cobertos"   },
  { id: "tratamento",      label: "Reanálise de Tratamento" },
  { id: "toxicidade",      label: "Simulador de Toxicidade" },
  { id: "resultados",      label: "Como Ler os Resultados"  },
  { id: "limitacoes",      label: "Limitações"              },
];

export default function SobrePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">Como o Stabilis Funciona</h1>
        <p className="text-slate-500 mt-2 text-sm max-w-2xl">
          Documentação técnica do motor de recomendação psiquiátrica, escrita para
          quem desejam entender as decisões por trás de cada pontuação.
        </p>
      </div>

      <div className="flex gap-10 items-start">
        {/* Table of contents — sticky sidebar */}
        <nav className="hidden lg:block w-52 shrink-0 sticky top-20 self-start">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Nesta página
          </p>
          <ul className="space-y-1.5">
            {TOC.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-12">

          {/* ── Visão Geral ─────────────────────────────────────────── */}
          <Section id="visao-geral" title="Visão Geral">
            <p>
              O Stabilis é um motor de suporte à decisão clínica para psiquiatria. Ele não prescreve,
              ele rankeia. Dado um perfil de paciente (diagnóstico, peso, comorbidades, hábitos
              e resumo clínico), o sistema pontua cada medicamento curado de
              zero a cem e os ordena por adequação clínica individualizada.
            </p>
            <p>
              A pontuação combina três camadas de inteligência:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li><strong>Rede Neural</strong> — base bioquímica derivada de estrutura molecular e alvos genômicos.</li>
              <li><strong>Perfil de risco do paciente</strong> — penalizações e bônus aplicados às comorbidades e contraindicações relativas.</li>
              <li><strong>Contexto diagnóstico</strong> — ajustes específicos por diagnóstico que refletem diretrizes clínicas de primeira linha.</li>
            </ul>
          </Section>

          {/* ── Pipeline ────────────────────────────────────────────── */}
          <Section id="pipeline" title="Pipeline de Análise">
            <Sub title="1. Extração de perfil">
              <p>
                O resumo clínico do médico e o checklist estruturado são enviados a um modelo de linguagem
                local. O modelo
                extrai quatro campos:
              </p>
              <ul className="list-disc list-inside pl-1 space-y-1">
                <li><strong>Sintomas</strong> — descrição livre dos quadros clínicos relevantes.</li>
                <li><strong>Contraindicações relativas</strong> — tags de risco.</li>
                <li><strong>Perfil metabólico estimado</strong> — metabolizador lento, padrão ou rápido.</li>
                <li><strong>Alvos moleculares prioritários</strong> — receptores e transportadores que seria benéfico modular (ex.: DRD2, SERT, GSK3B).</li>
              </ul>
            </Sub>
            <Sub title="2. Fallback por palavras-chave">
              <p>
                Modelos de linguagem podem ignorar termos clínicos estruturados. O Stabilis aplica
                varredura determinística sobre comorbidades e resumo para garantir que contraindicações
                críticas não sejam perdidas.
              </p>
              <p>
                As contraindicações da IA e as do fallback são <em>unidas</em> — nunca substituídas.
              </p>
            </Sub>
            <Sub title="3. Suplemento de alvos por diagnóstico">
              <p>
                Independentemente do que a IA retornou, alvos mecanísticos não-negociáveis são injetados
                automaticamente conforme o diagnóstico:
              </p>
              <div className="overflow-x-auto">
                <table className="text-sm w-full border-collapse">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="pb-2 pr-6 font-semibold">Diagnóstico</th>
                      <th className="pb-2 font-semibold">Alvos garantidos</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    <tr className="border-b border-slate-100"><td className="py-2 pr-6">Episódio maníaco / misto</td><td className="py-2 font-mono text-xs">DRD2, 5HT2A, GSK3B, SCN, GABRA</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-2 pr-6">Episódio depressivo bipolar</td><td className="py-2 font-mono text-xs">SERT, NET, GSK3B</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-2 pr-6">Transtorno de Ansiedade Generalizada</td><td className="py-2 font-mono text-xs">5HT1A, SERT, GABRA</td></tr>
                  </tbody>
                </table>
              </div>
            </Sub>
            <Sub title="4. Rede Neural Artificial">
              <p>
                A pontuação de base de cada medicamento vem de uma Rede Neural treinada
                especificamente para psiquiatria. O processo de treinamento tem duas etapas:
              </p>
              <ol className="list-decimal list-inside pl-1 space-y-1">
                <li>
                  <strong>Geração de rótulos</strong>: um solucionador combinatório recebe uma matriz de cobertura
                  gene–droga construída a partir de scores de associação gene–doença da plataforma
                  OpenTargets (Bipolar I, Bipolar II, TDM, TAG). O solucionador seleciona o subconjunto de
                  drogas que maximiza a cobertura dos genes psiquiátricos relevantes com o menor número
                  de medicamentos possível. Essa seleção binária vira o rótulo de treino.
                </li>
                <li>
                  <strong>Treinamento da Rede Neural</strong>: a rede aprende a prever esses rótulos a partir das features moleculares
                  de cada droga e das conexões do grafo de similaridade química (limiar de similaridade
                  de Tanimoto: 0,65). O modelo final pontua cada droga com uma probabilidade 0–100.
                </li>
              </ol>
              <p>
                O modelo foi retreinado sobre alvos psiquiátricos específicos: Drogas clínica ou mecanisticamente inadequadas (anestésicos, ergotamínicos, suplementos)
                foram excluídas da seleção antes do treino.
              </p>
            </Sub>
          </Section>

          {/* ── Pontuação ────────────────────────────────────────────── */}
          <Section id="pontuacao" title="Sistema de Pontuação">
            <p>
              A pontuação final de cada medicamento é calculada pela fórmula:
            </p>
            <div className="bg-slate-900 text-emerald-300 font-mono text-sm rounded-xl px-5 py-4 overflow-x-auto">
              pontuação_final = base_IA + bônus_final + tie_breaker − penalidade_final
            </div>
            <p className="text-xs text-slate-500">Limitada ao intervalo [0, 100]. Após o cálculo, regras de teto duro podem reduzir adicionalmente.</p>

            <Sub title="Bônus">
              <div className="overflow-x-auto">
                <table className="text-sm w-full border-collapse">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="pb-2 pr-6 font-semibold">Componente</th>
                      <th className="pb-2 pr-4 font-semibold">Valor</th>
                      <th className="pb-2 font-semibold">Quando se aplica</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ScoreRow label="Afinidade a alvo molecular" value="+20 pts/alvo" note="Cada alvo do medicamento que coincide com um dos alvos prioritários do paciente." />
                    <ScoreRow label="Estabilizador de humor" value="+60 pts" note="Diagnóstico Bipolar I ou II" />
                    <ScoreRow label="Primeira linha para TAG" value="+30 pts" note="Diagnóstico TAG + medicamento SSRI, SNRI ou buspirona." />
                    <ScoreRow label="Tie-breaker" value="+0,5 pt" note="Desempate sutil para medicamentos marcados como clinicamente relevantes no dataset." />
                  </tbody>
                </table>
              </div>
            </Sub>
            <Sub title="Penalidades">
              <div className="overflow-x-auto">
                <table className="text-sm w-full border-collapse">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="pb-2 pr-6 font-semibold">Componente</th>
                      <th className="pb-2 pr-4 font-semibold">Valor</th>
                      <th className="pb-2 font-semibold">Quando se aplica</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ScoreRow label="Contraindicação relativa (SIDER)" value="−40 pts/tag" note="Cada tag de risco do medicamento que coincide com uma contraindicação ativa do paciente." />
                    <ScoreRow label="Antidepressivo sem estabilizador" value="−80 pts" note="Diagnóstico bipolar. Reflete risco de virada maníaca." />
                    <ScoreRow label="Antipsicótico na TAG" value="−40 pts" note="Diagnóstico TAG. Antipsicóticos não são primeira linha para TAG." />
                    <ScoreRow label="TCA na TAG" value="−20 pts" note="Diagnóstico TAG + tricíclico. Segunda linha; preferência clínica pelos SSRIs/SNRIs." />
                  </tbody>
                </table>
              </div>
            </Sub>
            <Sub title="Assimetria intencional entre bônus e penalidade">
              <p>
                O peso das penalidades (40 pts por contraindicação) é o dobro do peso dos bônus de alvo
                (20 pts por alvo). Essa assimetria é deliberada: um sinal de segurança deve superar um
                sinal terapêutico. Sem ela, o bônus de estabilizador de humor (+60 para bipolar) mascararia
                a contraindicação de lítio em paciente com insuficiência renal, algo clinicamente inaceitável.
              </p>
            </Sub>
          </Section>

          {/* ── Contraindicações ────────────────────────────────────── */}
          <Section id="contraindicacoes" title="Contraindicações e Regras de Segurança">
            <Sub title="Tags de risco (fonte: SIDER)">
              <p>
                O perfil de risco de cada medicamento é derivado do banco SIDER (Side Effect Resource),
                que mapeia efeitos adversos reportados em bulas e literatura. O Stabilis agrupa esses
                efeitos em sete categorias clínicas:
              </p>
              <div className="flex flex-wrap gap-2 my-3">
                <div className="flex items-center gap-2"><Tag color="bg-amber-50 text-amber-800 border-amber-200">HEPATIC</Tag><span>Hepatotoxicidade</span></div>
                <div className="flex items-center gap-2"><Tag color="bg-blue-50 text-blue-800 border-blue-200">RENAL</Tag><span>Nefrotoxicidade / sobrecarga renal</span></div>
                <div className="flex items-center gap-2"><Tag color="bg-rose-50 text-rose-800 border-rose-200">MOTOR</Tag><span>Efeitos extrapiramidais (acatisia, distonia, parkinsonismo)</span></div>
                <div className="flex items-center gap-2"><Tag color="bg-red-50 text-red-800 border-red-200">CARDIAC</Tag><span>Prolongamento de QT / arritmia</span></div>
                <div className="flex items-center gap-2"><Tag color="bg-purple-50 text-purple-800 border-purple-200">PROLACTIN</Tag><span>Hiperprolactinemia</span></div>
                <div className="flex items-center gap-2"><Tag color="bg-orange-50 text-orange-800 border-orange-200">METABOLIC</Tag><span>Ganho de peso / risco metabólico</span></div>
                <div className="flex items-center gap-2"><Tag color="bg-slate-100 text-slate-700 border-slate-200">SEDATION</Tag><span>Sedação diurna / embotamento cognitivo</span></div>
              </div>
            </Sub>
            <Sub title="Correções manuais">
              <p>
                O SIDER comete dois tipos de erro sistemático que o Stabilis corrige:
              </p>
              <ul className="list-disc list-inside pl-1 space-y-1">
                <li>
                  <strong>Subnotificação</strong>: medicamentos com risco clinicamente
                  estabelecido mas ausente no SIDER recebem a tag manualmente. Exemplo: lítio sempre
                  recebe RENAL; antipsicóticos típicos clássicos sempre recebem MOTOR.
                </li>
                <li>
                  <strong>Supernotificação</strong>: medicamentos que o SIDER rotula com uma tag
                  baseada em relatos isolados, mas sem relevância clínica prática, têm a tag removida.
                  Exemplos: lamotrigina, aripiprazol e SSRIs têm MOTOR removido (a raridade de tremores
                  leves não equivale ao risco extrapiramidal dos típicos); lamotrigina tem RENAL removido
                  (eliminação predominantemente hepática com excelente perfil renal).
                </li>
              </ul>
            </Sub>
            <Sub title="Tetos duros">
              <p>
                Algumas combinações medicamento + contraindicação representam contraindicações
                quase-absolutas, nenhum bônus terapêutico deve suplantar o risco. Para essas situações,
                a pontuação é limitada a um teto máximo independentemente do restante do cálculo:
              </p>
              <div className="overflow-x-auto">
                <table className="text-sm w-full border-collapse">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="pb-2 pr-6 font-semibold">Medicamento</th>
                      <th className="pb-2 pr-4 font-semibold">Contexto</th>
                      <th className="pb-2 font-semibold">Teto</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ScoreRow label="Lítio" value="≤ 15" note="Paciente com insuficiência ou vulnerabilidade renal" />
                    <ScoreRow label="Ácido valproico" value="≤ 15" note="Paciente com hepatopatia ativa" />
                    <ScoreRow label="Carbamazepina" value="≤ 15" note="Paciente com hepatopatia ativa" />
                    <ScoreRow label="Nefazodona" value="≤ 5" note="Paciente com hepatopatia ativa (hepatotoxicidade grave documentada)" />
                    <ScoreRow label="Antipsicóticos típicos" value="≤ 15" note="Paciente com histórico de efeitos extrapiramidais (tag MOTOR ativa)" />
                  </tbody>
                </table>
              </div>
              <p>
                O problema que os tetos resolvem: sem eles, um paciente bipolar com insuficiência renal
                receberia lítio com pontuação &gt;90 — o bônus de estabilizador de humor (+60) supera a
                penalidade renal (−40). O teto garante que o risco renal sobrepõe qualquer vantagem terapêutica.
              </p>
            </Sub>
          </Section>

          {/* ── Diagnósticos ────────────────────────────────────────── */}
          <Section id="diagnosticos" title="Diagnósticos Cobertos">
            <p>
              O Stabilis opera sobre três diagnósticos principais, cada um com ajustes de pontuação
              específicos derivados de diretrizes clínicas (CANMAT, BAP, APA):
            </p>
            <Sub title="Transtorno Bipolar I">
              <ul className="list-disc list-inside pl-1 space-y-1">
                <li>Estabilizadores de humor recebem bônus de +60 pts (primeira linha).</li>
                <li>Antidepressivos isolados recebem penalidade de −80 pts (risco de virada maníaca).</li>
                <li>Em episódio maníaco/misto: alvos DRD2, 5HT2A, GSK3B, SCN, GABRA são injetados automaticamente, favorecendo antipsicóticos atípicos e anticonvulsantes.</li>
                <li>Em episódio depressivo: alvos SERT, NET, GSK3B são priorizados, favorecendo lamotrigina, quetiapina e lítio.</li>
              </ul>
            </Sub>
            <Sub title="Transtorno Bipolar II">
              <p>
                Mesmo conjunto de regras do Bipolar I. A lamotrigina recebe pontuação elevada por sua
                eficácia documentada na depressão bipolar II com menor risco de virada maníaca comparado
                ao Bipolar I.
              </p>
            </Sub>
            <Sub title="Transtorno de Ansiedade Generalizada (TAG)">
              <ul className="list-disc list-inside pl-1 space-y-1">
                <li>SSRIs (escitalopram, sertralina, paroxetina, fluoxetina, fluvoxamina), SNRIs (venlafaxina, duloxetina) e buspirona recebem bônus de +30 pts (primeira linha baseada em evidências).</li>
                <li>Antipsicóticos recebem penalidade de −40 pts (não indicados como monoterapia em TAG).</li>
                <li>Tricíclicos recebem penalidade de −20 pts (segunda linha por perfil de efeitos colaterais).</li>
                <li>Alvos 5HT1A, SERT e GABRA são injetados para garantir que ansiolíticos e antidepressivos serotoninérgicos figurem no topo.</li>
              </ul>
            </Sub>
          </Section>

          {/* ── Reanálise de Tratamento ─────────────────────────────── */}
          <Section id="tratamento" title="Reanálise de Tratamento em Curso">
            <p>
              Quando um paciente já está em tratamento, o médico pode preencher a Seção 3 do formulário
              com os medicamentos em uso, doses e tempo de tratamento, além de uma anamnese descrevendo
              a evolução clínica.
            </p>
            <Sub title="O que muda na reanálise">
              <ul className="list-disc list-inside pl-1 space-y-1">
                <li>
                  A anamnese do tratamento atual é <em>concatenada</em> ao resumo clínico original
                  antes da extração de perfil pela IA. Isso significa que efeitos colaterais descritos
                  na anamnese (ex.: "acatisia intensa com risperidona") influenciam diretamente as
                  contraindicações detectadas.
                </li>
                <li>
                  Medicamentos já em uso recebem um <strong>bônus de continuidade terapêutica</strong>,
                  escalonado pelo tempo de tratamento:
                </li>
              </ul>
              <div className="overflow-x-auto mt-2">
                <table className="text-sm w-full border-collapse">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="pb-2 pr-6 font-semibold">Duração</th>
                      <th className="pb-2 font-semibold">Bônus</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ScoreRow label="Menos de 1 mês" value="+5 pts" note="Início recente — resposta ainda indeterminada" />
                    <ScoreRow label="1 a 3 meses" value="+10 pts" note="Em titulação / avaliação inicial de resposta" />
                    <ScoreRow label="3 a 6 meses" value="+15 pts" note="Resposta estabelecida — interrupção requer cautela" />
                    <ScoreRow label="Mais de 6 meses" value="+20 pts" note="Tratamento estabilizado — peso clínico significativo para manutenção" />
                  </tbody>
                </table>
              </div>
              <p className="mt-2">
                O bônus reflete o princípio clínico de que interromper um tratamento já estabelecido e
                bem tolerado tem custo e risco próprios. Ele <em>não</em> mascara contraindicações ativas:
                tetos duros e penalidades de segurança são aplicados após o bônus.
              </p>
            </Sub>
          </Section>

          {/* ── Toxicidade ──────────────────────────────────────────── */}
          <Section id="toxicidade" title="Simulador de Toxicidade">
            <p>
              Após selecionar medicamentos no ranking, o médico pode avançar para a tela de
              <strong> Auditoria de Prescrição</strong>, onde define doses e intervalos. O sistema
              então simula 14 dias de farmacocinética em passos de 1 hora por medicamento.
            </p>
            <Sub title="Modelo farmacocinético">
              <p>
                Para cada droga, o modelo usa os parâmetros: meia-vida (t½), volume de distribuição (Vd/kg),
                biodisponibilidade oral (F) e limiar de toxicidade (Cmax tóxico). A cada hora:
              </p>
              <ul className="list-disc list-inside pl-1 space-y-1">
                <li>O nível plasmático decai exponencialmente: <code className="bg-slate-100 px-1 rounded text-xs">C(t) = C₀ × e^(−kt)</code>, onde <code className="bg-slate-100 px-1 rounded text-xs">k = ln(2)/t½</code>.</li>
                <li>A cada dose programada, adiciona-se <code className="bg-slate-100 px-1 rounded text-xs">(dose × F) / (Vd × peso_kg)</code> ao nível atual.</li>
                <li>Se o nível superar o limiar em qualquer hora, a simulação retorna <strong>TOXICIDADE CRÍTICA</strong> identificando o fármaco culpado.</li>
              </ul>
            </Sub>
            <Sub title="Interações medicamentosas">
              <p>
                O simulador aplica multiplicadores de meia-vida baseados em interações farmacocinéticas
                conhecidas. Exemplos:
              </p>
              <ul className="list-disc list-inside pl-1 space-y-1">
                <li>Fluvoxamina + clozapina: meia-vida da clozapina multiplicada por 3× (inibição intensa de CYP1A2).</li>
                <li>Carbamazepina + quetiapina: nível da quetiapina reduzido a 15% (indução de CYP3A4).</li>
                <li>Lítio + AINEs / diuréticos: clearance renal reduzido, nível de lítio aumentado.</li>
              </ul>
            </Sub>
            <Sub title="Perfil metabólico do paciente">
              <p>
                O perfil metabólico estimado pela IA (lento, padrão, rápido) aplica um multiplicador
                à meia-vida de todos os medicamentos: metabolizador lento → t½ × 1,5; rápido → t½ × 0,6.
                Isso permite detectar toxicidade em situações que seriam seguras para um metabolizador padrão.
              </p>
            </Sub>
          </Section>

          {/* ── Resultados ──────────────────────────────────────────── */}
          <Section id="resultados" title="Como Ler os Resultados">
            <Sub title="Pontuação (0 – 100)">
              <p>
                Não é uma probabilidade de eficácia — é um índice de adequação clínica relativa para
                aquele paciente específico, naquele momento. Um medicamento com 85 pontos é mais adequado
                ao perfil do paciente do que um com 60 pontos, mas ambos podem ser clinicamente válidos.
              </p>
            </Sub>
            <Sub title="Badges">
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Tag color="bg-emerald-100 text-emerald-800 border-emerald-200">RECOMENDADO</Tag>
                  <span>Bônus &gt; penalidades — o perfil do medicamento favorece o paciente.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Tag color="bg-red-100 text-red-800 border-red-200">EVITAR</Tag>
                  <span>Penalidades &gt; bônus — o perfil representa risco para este paciente.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Tag color="bg-slate-100 text-slate-700 border-slate-200">NEUTRO</Tag>
                  <span>Sem modificadores significativos — pontuação reflete apenas a base da Rede Neural.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Tag color="bg-violet-100 text-violet-800 border-violet-200">EM USO</Tag>
                  <span>Medicamento presente no tratamento atual do paciente (reanálise).</span>
                </div>
              </div>
            </Sub>
            <Sub title="Justificativas (▼)">
              <p>
                Cada medicamento exibe as razões individuais para sua pontuação: quais alvos foram
                ativados, quais contraindicações foram detectadas e por quê. O objetivo é que o psiquiatra
                possa concordar ou discordar de cada fator individualmente, em vez de tratar a pontuação
                como uma caixa-preta.
              </p>
            </Sub>
          </Section>

          {/* ── Limitações ──────────────────────────────────────────── */}
          <Section id="limitacoes" title="Limitações e Uso Responsável">
            <p className="font-semibold text-slate-800">
              O Stabilis é uma ferramenta de suporte à decisão e não substitui o julgamento clínico.
            </p>
            <ul className="list-disc list-inside pl-1 space-y-2">
              <li>
                <strong>Cobertura diagnóstica limitada</strong>: o sistema foi validado para Transtorno
                Bipolar I, Bipolar II e TAG. Outros diagnósticos (esquizofrenia, TDAH, TOC, etc.)
                estão fora do escopo atual e podem gerar rankings inadequados.
              </li>
              <li>
                <strong>Sem dados individuais de farmacocinética</strong>: o perfil metabólico é uma
                estimativa baseada no texto clínico, não em genotipagem (CYP2D6, CYP2C19, etc.).
                O simulador de toxicidade usa parâmetros populacionais médios.
              </li>
              <li>
                <strong>Sem evidências de eficácia individual</strong>: a pontuação da Rede Neural reflete
                cobertura de alvos genômicos associados à doença e não prediz resposta clínica individual,
                que depende de fatores genéticos, ambientais e de trajetória terapêutica não capturados.
              </li>
              <li>
                <strong>Contraindicações absolutas não são modeladas</strong>: o sistema modela
                contraindicações <em>relativas</em> com tetos duros. Contraindicações absolutas
                devem ser tratadas pelo médico como veto explícito, não como penalidade pontuável.
              </li>
              <li>
                <strong>IA não é determinística</strong>: o modelo de linguagem pode ocasionalmente não detectar contraindicações
                presentes no texto. O fallback por palavras-chave mitiga os casos mais críticos, mas não elimina essa variabilidade.
              </li>
              <li>
                <strong>Aprovação regulatória</strong>: o Stabilis não é um dispositivo médico registrado
                e não deve ser usado como única fonte de decisão terapêutica em contexto clínico real.
              </li>
            </ul>
          </Section>

        </div>
      </div>
    </div>
  );
}
