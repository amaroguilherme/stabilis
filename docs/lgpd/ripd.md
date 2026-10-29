# Relatório de Impacto à Proteção de Dados Pessoais (RIPD): Stabilis

**Rascunho de 29/10/2026**, preparado a partir do código e do [mapa de dados](mapa-de-dados.md). Precisa
ser revisado e assinado pelo controlador, de preferência com orientação jurídica. Os artigos citados estão
transcritos em [base-legal.md](base-legal.md). Este documento não é parecer jurídico.

## 1. Identificação

| Item | Conteúdo |
|---|---|
| Controlador | **[preencher: nome completo do responsável pelo projeto]**, pessoa física, projeto sem fins comerciais |
| Contato para titulares | **[preencher: e-mail]** (configure também `NEXT_PUBLIC_CONTACT_EMAIL`, que aparece em /privacidade) |
| Encarregado | **[preencher]**. Provavelmente obrigatório: dado de saúde é critério de alto risco, e a dispensa para agentes de pequeno porte não vale para tratamento de alto risco (base-legal.md, §10 e §12). Não está claro se o próprio mantenedor pode acumular a função (Res. CD/ANPD nº 18/2024) |
| Operadores | Vercel (hospedagem do site e função de proxy); Hugging Face (servidor privado do modelo de linguagem); Upstash (contagens anônimas, só se configurado) |
| Data e versão | 29/10/2026, versão 1 (rascunho) |

## 2. Por que este relatório

O Stabilis trata **dados pessoais sensíveis referentes à saúde** (art. 5º, II), inclusive respostas sobre
risco de suicídio, e pode tratar dados de terceiros no modo profissional. A ANPD pode pedir o relatório
(art. 38), e o uso de dados de saúde por pessoas em sofrimento justifica a avaliação mesmo sem pedido.

## 3. Descrição do tratamento

- **Finalidade:** permitir que a própria pessoa organize o que sente e o que já tentou, compare com
  diretrizes públicas e leve um relatório à consulta; no modo profissional, organizar opções de diretrizes
  para o caso digitado pelo profissional.
- **Natureza:** o processamento acontece no navegador. Por padrão, nada é enviado a servidores e não há
  cadastro, login nem identificador.
- **Escopo:** respostas do guia, diário do acompanhamento e plano de segurança, todos no aparelho; envio de
  texto a um modelo de linguagem só por ação da pessoa, com consentimento a cada envio (no paciente, ainda
  desligado); áudio do ditado enviado à empresa do navegador, por escolha da pessoa; contagens anônimas
  opcionais.
- **Contexto:** público amplo, muitas vezes com celular compartilhado, baixa escolaridade e conexão ruim;
  pessoas possivelmente em crise. Por isso o padrão é guardar só na aba aberta.
- **Base legal:** consentimento específico e destacado do titular (art. 11, I), com finalidade informada
  e revogável (art. 8º), pedido no início do guia e, para cada envio de texto, no próprio botão. A base de
  "tutela da saúde" (art. 11, II, f) não serve, porque é restrita a profissionais, serviços e autoridades de
  saúde. Para transferência internacional no modo paciente, consentimento específico e em destaque com aviso
  de que o servidor fica fora do Brasil (art. 33, VIII). **No modo profissional não há mecanismo claro:** o
  titular é o paciente, e o clique do profissional não é o consentimento dele (ver o risco R3b). Confirmar
  tudo com orientação jurídica (base-legal.md, §4 e §8).

## 4. Partes interessadas consultadas

Nenhuma até esta versão. Recomendado: as sessões de usabilidade planejadas (docs/sessoes-de-usabilidade.md)
devem incluir perguntas sobre a compreensão dos avisos; e uma revisão jurídica antes de ampliar o uso.

## 5. Necessidade e proporcionalidade

| Princípio | Como o Stabilis atende |
|---|---|
| Finalidade e adequação | coleta só o que muda as orientações (idade, sexo ao nascer, gravidez, condições, remédios, respostas dos questionários); identidade de gênero é opcional |
| Necessidade (minimização) | sem cadastro, sem identificador, sem servidor por padrão; o arquivo exportado leva só as respostas do guia; o diário só entra no relatório se a pessoa marcar |
| Livre acesso e qualidade | a pessoa vê e edita tudo o que respondeu no próprio aparelho |
| Transparência | aviso versionado em /privacidade, com o que mudou; avisos antes de cada saída de dado |
| Segurança | dados só no navegador; tráfego por HTTPS; token do servidor só no lado do servidor; nada de conteúdo em log; resultados de extração apagados ao serem lidos |
| Prevenção | crise oculta conteúdo de remédios e mostra ajuda; padrão "só na aba" em aparelhos compartilhados |
| Responsabilização | este relatório, o mapa de dados, a política (knowledge/POLICY.md §11 e §15 a §20) e testes automáticos que conferem, por exemplo, que a jornada do paciente não chama o servidor |

Direitos do titular (art. 18): como o controlador não recebe as respostas, confirmação, acesso, correção e
eliminação são exercidos pela própria pessoa, no aparelho ("Apagar meus dados"). O contato do controlador
deve atender dúvidas e pedidos sobre os fluxos que saem do aparelho.

## 6. Riscos e medidas

Escala: probabilidade e impacto **baixo / médio / alto**, antes das medidas.

| # | Risco | Prob. | Impacto | Medidas | Risco que resta |
|---|---|---|---|---|---|
| R1 | Outra pessoa vê as respostas num aparelho compartilhado | alta | alto | padrão só na aba; guardar no aparelho é escolha explícita, com aviso; "Apagar meus dados" em várias telas | médio: depende da escolha da pessoa |
| R2 | O relatório compartilhado vaza no aplicativo de mensagem | média | alto | aviso antes de compartilhar; resumo limitado; compartilhar é opcional | médio |
| R3a | Transferência internacional do relato enviado ao modelo (paciente) | média (quando ligado) | alto | desligado até a promoção; consentimento do próprio titular a cada envio, com aviso de "fora do Brasil"; texto descartado; resultado apagado ao ser lido; sem logs | baixo |
| R3b | Transferência internacional da anamnese em "Extrair do texto" (profissional) | média (quando ligado) | alto | **desligado desde 29/10/2026** (chave `NEXT_PUBLIC_PROFESSIONAL_EXTRACTION`), até haver um mecanismo legal: anonimização efetiva antes do envio (art. 12), processamento no Brasil ou no navegador, ou cláusulas-padrão da ANPD (Res. 19/2024). Quando ligado: aviso de "fora do Brasil" e de não incluir nome nem documentos; texto descartado; resultado apagado ao ser lido; sem logs | baixo enquanto desligado; alto se for ligado sem mecanismo |
| R4 | Áudio do ditado tratado pela empresa do navegador | média | médio | opcional; aviso antes do primeiro uso na aba; alternativa de escrever | baixo a médio |
| R5 | Dados de terceiros (pacientes) no modo profissional | média | alto | o caso fica no navegador do profissional; aviso para não incluir nome nem documentos na extração; processamento transitório | médio: depende do profissional |
| R6 | Registros técnicos das plataformas (IP, navegador, página) | alta | baixo | endereços das páginas sem dados de saúde; nenhum conteúdo nos logs do Stabilis | baixo |
| R7 | Reidentificação pelas contagens | baixa | baixo | opt-in; lista fechada de eventos; só o mês; sem identificador | muito baixo |
| R8 | Script malicioso no site lê o armazenamento do navegador | baixa | alto | React escapa o conteúdo; sem HTML vindo de usuários; cabeçalhos de segurança (sem enquadramento por outros sites, sem adivinhar o tipo de arquivo, sem enviar a página de origem, só o microfone entre os recursos sensíveis) | baixo; ver plano de ação |
| R9 | Pessoa em crise usa o site sem conexão | média | alto | a página de ajuda imediata funciona offline desde a primeira visita | baixo |
| R10 | Crianças e adolescentes usam o guia (art. 14) | média | alto | abaixo de 18 anos, só orientação de encaminhamento, sem conteúdo de remédios; aviso para usar com um adulto de confiança; nada sai do aparelho | médio: não há verificação de idade antes do aceite; Estatuto Digital da Criança e do Adolescente não analisado |

## 7. Plano de ação

| Ação | Situação |
|---|---|
| Preencher controlador, contato e encarregado | **pendente: responsável** |
| Configurar `NEXT_PUBLIC_CONTROLLER_NAME` e `NEXT_PUBLIC_CONTACT_EMAIL` na Vercel (aparecem em /privacidade) | **pendente: responsável** |
| Desligar "Extrair do texto" no modo profissional até decidir o mecanismo (R3b) | feito em 29/10/2026 |
| Escolher o mecanismo para religar "Extrair do texto": anonimização efetiva, processamento no Brasil ou no navegador, ou cláusulas-padrão | **pendente: responsável, com revisão jurídica** |
| Confirmar as bases legais (art. 11, I e art. 33, VIII), o alto risco e o papel do mantenedor no modo profissional (operador ou controlador) | **pendente: revisão jurídica** |
| Verificar o que Vercel, Hugging Face e Upstash registram (IP, página, horário) e por quanto tempo | pendente: responsável |
| Escrever um plano curto de resposta a incidentes (art. 48) | pendente |
| Decidir o tratamento de crianças e adolescentes (art. 14) e analisar o Estatuto Digital da Criança e do Adolescente | **pendente: revisão jurídica** |
| Pedir à ANVISA o enquadramento dos dois modos como dispositivo médico (docs/regulatorio/anvisa-samd.md, §6) | **pendente: responsável** |
| Concluir e assinar este relatório antes de ligar a ajuda ao relato no modo paciente | pendente: responsável |
| Cabeçalhos de segurança básicos (enquadramento, tipo de arquivo, referência, permissões) | feito em 29/10/2026 |
| Content-Security-Policy restritiva para scripts, com nonce por requisição (deixa as páginas dinâmicas; avaliar o custo) | pendente: desenvolvimento |
| Rever este relatório a cada mudança de fluxo de dados e, no mínimo, uma vez por ano | contínuo |

## 8. Aprovação

Controlador: ____________________________  Data: ___/___/______
