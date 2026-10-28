# Política de escopo do Stabilis

Este documento registra decisões de produto que não são afirmações clínicas. Regras da base de conhecimento que dependem delas citam este arquivo (fonte `stabilis-escopo`) em vez de uma diretriz, para que fique claro de onde vêm.

## 1. Natureza da ferramenta
O Stabilis é uma ferramenta educacional e de organização de informações. Não faz diagnóstico, não prescreve e não substitui a avaliação de um profissional de saúde.

## 2. Menores de idade
No modo paciente, conteúdo sobre medicamentos só é mostrado para pessoas com 18 anos ou mais. Para menores de 18 anos, a ferramenta orienta a buscar avaliação no CAPSi ou na UBS, com um adulto responsável.

## 3. Risco de suicídio
Quando a triagem indica risco de suicídio, ou o texto da pessoa menciona pensamentos de morte ou de se machucar, o modo paciente oculta todo conteúdo sobre medicamentos e mostra recursos de ajuda imediata (CVV 188, SAMU 192, UPA ou pronto-socorro).

## 4. Triagem de bipolaridade
No modo paciente, conteúdo sobre antidepressivos só aparece depois que a pessoa responde às perguntas sobre períodos de muita energia ou euforia e todas as respostas são "não". Essas perguntas seguem a orientação de perguntar sobre períodos anteriores de hiperatividade ou comportamento desinibido, em vez de usar um questionário; não são um questionário validado nem fazem diagnóstico. Com qualquer resposta "sim", ou sem respostas, a ferramenta recomenda avaliação especializada antes de qualquer antidepressivo. Mesmo com todas as respostas "não", ela lembra que o médico precisa confirmar a história de mania antes de começar o antidepressivo.

## 5. Condições cobertas
O modo paciente mostra opções de tratamento apenas para depressão e ansiedade generalizada. Para transtorno bipolar, a ferramenta mostra informações de segurança e recomenda acompanhamento especializado. Psicose, mania aguda, transtornos alimentares, TDAH e dependência química recebem apenas orientação de encaminhamento.

## 6. Números exibidos
O modo paciente não mostra notas ou pontuações próprias para medicamentos. Os únicos números exibidos são os totais de questionários validados e, na revisão de tratamentos, a dose e o tempo informados pela pessoa ao lado das doses e dos tempos de referência citados.

## 7. Proveniência
Todo conteúdo clínico cita uma fonte pública com localizador e trecho literal. Itens marcados como rascunho ainda não passaram pela segunda conferência humana.

## 8. Dados obrigatórios e dados ausentes
Sem idade e sexo atribuído ao nascer, a ferramenta não mostra conteúdo sobre medicamentos, porque as regras de segurança dependem desses dados. Quando a situação de gravidez não é informada para alguém que pode engravidar, ela é tratada como "não sei". Dado ausente nunca é tratado como ausência de risco.

## 9. Questionários no modo paciente
Os questionários medem sintomas e servem de triagem; não fazem diagnóstico. As perguntas sobre bipolaridade são usadas apenas para decidir se informações sobre antidepressivos podem ser mostradas, e qualquer resposta positiva leva à recomendação de avaliação especializada. Quando o item 9 do PHQ-9 ou o texto da pessoa indicam pensamentos de morte ou de se machucar, as perguntas de segurança são feitas de novo.

## 10. Condições mostradas ao paciente
Opções para depressão aparecem quando o PHQ-9 soma 5 pontos ou mais, ou quando a pessoa informa que já recebeu esse diagnóstico. Opções para ansiedade generalizada aparecem quando o GAD-7 soma 5 pontos ou mais, ou com diagnóstico informado. Triagem de bipolaridade positiva ou diagnóstico informado de transtorno bipolar levam a orientações de segurança e de encaminhamento.

## 11. Dados no modo paciente
As respostas ficam no aparelho da pessoa, só na aba aberta por padrão ou guardadas no aparelho por escolha dela, e podem ser apagadas a qualquer momento. Nada é enviado a servidores. Imprimir, baixar ou compartilhar o relatório só acontece por ação da pessoa, com aviso de que os dados saem do aparelho. O diário do acompanhamento só existe quando a pessoa escolhe guardar as respostas no aparelho. O plano de segurança é guardado à parte, também só na aba por padrão, e "Apagar meus dados" apaga tudo, inclusive ele. O arquivo exportado para o profissional leva só as respostas do guia, sem o diário e sem o plano de segurança.

## 12. Acompanhamento
A ferramenta sugere refazer o PHQ-9 e o GAD-7 a cada 14 dias e registra humor, sono, efeitos colaterais e uso dos remédios em escalas simples. Ela não interpreta a evolução: mostra os totais e as faixas dos questionários e recomenda levar o relatório à consulta. Repetir o PHQ-9 com o item 9 acima de zero, ou escrever no diário palavras ligadas a risco, faz as perguntas de segurança de novo, a cada vez. O relatório de evolução destaca esses sinais sem mostrar o texto das anotações, que só entram nele se a pessoa escolher.

## 13. Revisão de tratamentos
A revisão diz se a dose e o tempo de um remédio já usado bastam para avaliar o efeito, segundo critérios citados de diretrizes e bulas; ela não diz se o remédio funciona. Critérios ligados a uma condição só valem quando ela é avaliada: no modo paciente, apenas para as condições mostradas à pessoa. Para remédios de uso curto, como os benzodiazepínicos, a revisão avalia só se o uso passou do tempo recomendado, sem julgar a dose. Com sinais de risco, os próximos passos não aparecem no modo paciente.

## 14. Plano de segurança
O plano de segurança segue as etapas gerais do planejamento de segurança descritas em fontes abertas, com perguntas e exemplos escritos pelo projeto. Não reproduz o formulário Stanley-Brown, cujos autores exigem permissão por escrito para uso em sites e aplicativos. O plano pode ser feito sem responder ao guia, e o que a pessoa escreve nele não passa pelo detector de palavras de crise, porque falar dos sinais de alerta é o objetivo do plano.

## 15. Modelo de linguagem no modo paciente
As sugestões do modelo de linguagem no relato do paciente ficam desligadas até que um modelo passe em todos os portões de promoção (`eval/README.md`). Ligadas, são opcionais e pedem consentimento a cada envio: o texto vai ao servidor do Stabilis, fora do Brasil, é usado só para a leitura e descartado, sem ser guardado nem registrado. Nada entra nas respostas sem a pessoa marcar. O modelo pode acrescentar um sinal de risco, que faz as perguntas de segurança de novo, mas nunca retirar um sinal encontrado pelas regras. Com as sugestões desligadas, a jornada do paciente não faz nenhuma chamada ao servidor.

## 16. Perguntas sobre remédios
As respostas às perguntas sobre remédios vêm só da base de conhecimento: fatos de bula e alertas que as regras mostrariam naquela situação, sempre com a fonte. Nenhum texto é gerado na hora. Sem resposta com fonte, a ferramenta diz que não sabe e sugere levar a pergunta ao médico ou ao farmacêutico; a falta de um alerta nunca é apresentada como garantia de segurança. Perguntas com palavras ligadas a risco de suicídio mostram ajuda imediata em vez de resposta. A pergunta é processada no navegador e não é enviada a nenhum servidor.
