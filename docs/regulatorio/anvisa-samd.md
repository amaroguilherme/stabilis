# Stabilis e as regras da Anvisa para software como dispositivo médico (SaMD)

> **Isto não é aconselhamento jurídico nem regulatório.** É uma leitura de textos oficiais, feita por pesquisa
> documental, para que o mantenedor do projeto (um desenvolvedor, não um advogado) saiba o que perguntar e a quem.
> Quem decide se um software é dispositivo médico, e em que classe, é a Anvisa. Todas as fontes foram acessadas em
> 29/10/2026. Trechos entre aspas curvas (“ ”) são cópias literais; o resto é leitura minha e está marcado como tal
> quando é interpretação.

## Resumo

- **Não há exclusão expressa para software *educativo*.** A RDC 657/2022 lista cinco tipos de software fora do seu
  alcance (bem-estar, lista de não regulados, gestão administrativa e financeira de serviços de saúde, dados
  demográficos e epidemiológicos sem finalidade clínica, software embarcado). Na minha leitura, o Stabilis não se
  encaixa com clareza em nenhum deles (seção 2).
- **O que conta é a finalidade e o que o software faz.** Nos exemplos oficiais da Anvisa (perguntas e respostas de
  2022, não vinculantes), funções que só registram, guardam ou consultam uma base de dados ou a literatura tendem a
  ficar fora. Avaliação de sintomas, triagem, sugestão de tratamento por protocolo e cálculo de dose tendem a ser
  SaMD (seção 2.4).
- **O modo profissional é o que mais se parece com os exemplos de SaMD.** Mostrar opções por linha de tratamento a
  partir do diagnóstico e do perfil, e montar esquemas de titulação, se parece com eles. Se for SaMD, a Regra 11 da
  RDC 751/2022 o põe na **classe II** no mínimo, ou na **classe III** se a Anvisa entender que uma decisão errada
  pode causar deterioração grave (seções 3 e 5.3).
- **O modo paciente é zona cinzenta.** Algumas funções se aproximam dos exemplos de SaMD: pontuar questionários
  com faixas de gravidade, marcar a condição como `sugerido pelos questionários`, fazer triagem de risco de suicídio
  e filtrar opções por perfil. O Manual da Anvisa põe o exemplo “diagnóstico de depressão com base em uma
  pontuação” na linha da **classe III** da tabela da Regra 11 (seção 5.2).
- **Se for SaMD, uma pessoa física não consegue regularizá-lo sozinha.** Só uma pessoa jurídica com Autorização
  de Funcionamento (AFE) e licença sanitária pode pedir notificação (classes I e II) ou registro (classes III e
  IV). Ser gratuito não isenta (seção 4).
- **O caminho previsto nas normas para tirar a dúvida é pedir o enquadramento à Anvisa.** Isso se faz pelo Fale
  Conosco, com o formulário de enquadramento. O canal de audiências é só para pessoa jurídica (seção 6).
- **As regras podem mudar.** A revisão da RDC 657/2022, com inclusão de inteligência artificial, está na Agenda
  Regulatória 2026-2027 da Anvisa (seção 5.5).

## 0. Fontes e limitações

- **Diário Oficial (in.gov.br): não consegui acessar.** A conexão foi encerrada sem resposta tanto pelo `curl`
  quanto pela ferramenta de leitura de páginas. Não tentei contornar o bloqueio. Por isso não li as publicações no
  DOU.
- **Texto em português das resoluções: AnvisaLegis.** O endereço de legislação da Anvisa no gov.br
  (<https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/legislacao>) redireciona para o AnvisaLegis
  (anvisalegis.datalegis.net), o sistema de normas da própria agência. Os textos das RDC 657/2022 e 751/2022 foram
  copiados de lá. O próprio AnvisaLegis avisa: “Este texto não substitui a Publicação Oficial.” (rodapé das duas
  RDC; [RDC 657 no AnvisaLegis][rdc657], acesso em 29/10/2026). Conferi a numeração dos artigos e a Regra 11 com as
  traduções oficiais em inglês no gov.br/anvisa ([RDC 657 em inglês][rdc657en] e [RDC 751 em inglês][rdc751en],
  acesso em 29/10/2026) e com os trechos reproduzidos no Manual e nas perguntas e respostas da Anvisa.
- **Situação das normas, segundo o AnvisaLegis em 29/10/2026.** A RDC 657/2022 aparece como “Vigente”, com uma
  retificação no art. 22 (“RET., 08/06/2022 - Seção 1”). A RDC 751/2022 aparece como “Vigente com Alterações”, com
  notas como “(Redação dada pela Resolução 777/2023)” e “(Incluído pela Resolução 810/2023)”. Na minha leitura do
  texto consolidado, nenhuma dessas alterações mexe nos arts. 4º a 8º nem na Regra 11.
- **As perguntas e respostas sobre a RDC 657 (versão 1, de 01/09/2022) são anteriores à RDC 751/2022**, que entrou
  em vigor em 01/03/2023 e revogou a RDC 185/2001: “Ficam revogados, a partir da data da entrada em vigor desta
  Resolução:” […] “I - a Resolução de Diretoria Colegiada - RDC nº 185, de 22 de outubro de 2001;” (RDC 751/2022,
  art. 66; [AnvisaLegis][rdc751], acesso em 29/10/2026). Quando esse documento classifica um software pelas regras 9,
  10 ou 12 da RDC 185/2001, a classe citada não vale mais como está. Uso os exemplos só para entender o
  raciocínio da Anvisa.
- **Perguntas e respostas e Manual são orientação, não norma.** O documento diz de si mesmo: “este documento é um
  instrumento de esclarecimento, não-regulatório, de caráter não-vinculante, destinado unicamente a esclarecer
  dúvidas sobre a Resolução de Diretoria Colegiada - RDC nº 657, de 24 de março de 2022.” (Perguntas & Respostas RDC
  657, Introdução; [gov.br/anvisa][pr657], acesso em 29/10/2026).
- **Como descrevi o Stabilis.** Usei a descrição do projeto e a leitura do código do repositório (arquivos citados na
  seção 5.1). Não foi uma revisão jurídica do produto.

## 1. O que a Anvisa considera dispositivo médico e SaMD

**Dispositivo médico.** “dispositivo médico (produto médico); qualquer instrumento, aparelho, equipamento, implante,
dispositivo médico para diagnóstico in vitro, software, material ou outro artigo, destinado pelo fabricante a ser
usado, isolado ou conjuntamente, em seres humanos, para algum dos seguintes propósitos médicos específicos” (RDC
751/2022, art. 4º, X; [AnvisaLegis][rdc751], acesso em 29/10/2026). O primeiro propósito listado é: “a) diagnóstico,
prevenção, monitoramento, tratamento (ou alívio) de uma doença;” (idem, art. 4º, X, a).

**Software como dispositivo médico (SaMD).** “Software que atende à definição de dispositivo médico, podendo ser de
diagnóstico in vitro (IVD) ou não, sendo destinado a uma ou mais indicações médicas, e que realizam essas
finalidades sem fazer parte de hardware de dispositivo médico.” (RDC 657/2022, art. 2º, VII; [AnvisaLegis][rdc657],
acesso em 29/10/2026). O mesmo inciso continua: “Incluem-se nesta definição, entre outros, o software licenciado por
assinatura e hospedado centralmente (Software as a Service), que se enquadre na definição de dispositivos médicos;”
(idem).

A RDC 751/2022 acrescenta características do SaMD: “a) o SaMD pode ser executado em uma plataforma computacional de
propósito geral (finalidade não médica);” e “g) os aplicativos móveis (apps) que atendem à definição são
considerados SaMD;” (RDC 751/2022, art. 4º, XLIII, a e g; [AnvisaLegis][rdc751], acesso em 29/10/2026). Um site que
roda no navegador, como o Stabilis, roda em plataforma de propósito geral. **Leitura minha:** isso não o tira da
definição.

**Usuário leigo também conta.** “XLIX - usuário: profissional de saúde ou leigo, podendo ser o próprio paciente, que
utiliza um dispositivo médico, conforme as instruções de uso.” (RDC 751/2022, art. 4º, XLIX; [AnvisaLegis][rdc751],
acesso em 29/10/2026).

**A finalidade declarada pelo fabricante pesa.** “XXI - finalidade pretendida (finalidade de uso): a utilização a que
um dispositivo se destina, de acordo com a informação declarada pelo fabricante na avaliação clínica;” (RDC 751/2022,
art. 4º, XXI). “Art. 8º A aplicação das regras de classificação rege-se pela finalidade pretendida dos dispositivos
médicos, com exceção dos dispositivos para diagnóstico in vitro, que são regidos por regras de classificação
específicas.” (RDC 751/2022, art. 8º; [AnvisaLegis][rdc751], acesso em 29/10/2026).

Mas a alegação do fabricante só decide sozinha quando o software não tem função tipicamente médica. Sobre jogos que
podem ser usados em tratamento, a Anvisa disse: “O enquadramento deste tipo de software (softwares para diversão que
podem ser usados em tratamentos) como um SaMD dependerá das alegações feitas pelo fabricante, já que não é um produto
com funções tipicamente associadas a área médica.” (Perguntas & Respostas RDC 657, pergunta 60; [gov.br/anvisa][pr657],
acesso em 29/10/2026). **Leitura minha:** questionários clínicos e opções de tratamento são funções tipicamente
médicas. Então um aviso de *material educativo* provavelmente pesa menos do que pesaria num jogo.

## 2. O que fica fora do escopo

### 2.1 As cinco exclusões da RDC 657/2022

“§ 2º Esta Resolução não se aplica aos seguintes softwares: I - para bem-estar; II - relacionado em lista
disponibilizada pela Agência Nacional de Vigilância Sanitária (Anvisa) de produtos não regulados;” (RDC 657/2022,
art. 1º, § 2º, I e II; [AnvisaLegis][rdc657], acesso em 29/10/2026). Continua: “III - utilizado exclusivamente para
gerenciamento administrativo e financeiro em serviço de saúde; IV - que processa dados médicos demográficos e
epidemiológicos, sem qualquer finalidade clínica diagnóstica ou terapêutica; e V - embarcado em dispositivo médico
sob regime de vigilância sanitária.” (idem, art. 1º, § 2º, III a V).

**Bem-estar** é definido assim: “Softwares destinados a encorajar e manter o bem-estar, incluindo atividades
saudáveis como exercícios físicos, ou a encorajar e manter o controle da saúde e um estilo de vida saudável que não
são destinados a prevenção, diagnóstico, tratamento, reabilitação ou anticoncepção;” (RDC 657/2022, art. 2º, IX;
[AnvisaLegis][rdc657], acesso em 29/10/2026). **Leitura minha:** o Stabilis trata de depressão, ansiedade, risco de
suicídio e tratamento com remédios. Isso fica longe de “estilo de vida saudável”, e a definição exclui expressamente
o que é destinado a diagnóstico ou tratamento.

**Não existe exclusão para software *educativo*, *informativo* ou *sem fins comerciais*.** Não encontrei esses
termos entre as exclusões da RDC 657/2022 nem nas isenções do art. 2º da RDC 751/2022. Isso é constatação de
leitura, não citação.

### 2.2 A lista de produtos não regulados

A página oficial com a lista informa: “Atualizado em 24/07/2024” ([Produtos não regularizados como dispositivos
médicos][naoreg], acesso em 29/10/2026). A categoria mais próxima de *ensino* é “CATEGORIA 4: PRODUTOS PARA DIDÁTICA
OU TREINAMENTO MÉDICO” (idem), mas ela traz só objetos físicos (manequim, modelo de órgão, simulador). Não encontrei
na lista nenhum item de software educativo ou informativo. Assim, a exclusão do art. 1º, § 2º, II, não parece ajudar
o Stabilis hoje.

### 2.3 Isenções que não se aplicam ao Stabilis (mas é bom conhecer)

- **Software feito por serviço de saúde para uso próprio.** “Art. 5º O SaMD desenvolvido internamente (in house) pelo
  serviço de saúde e de uso exclusivo do serviço de saúde, matriz ou filiais, que se enquadrem nas classes de risco I
  e II, não serão passíveis de regularização na Anvisa, desde que estes não interfiram no funcionamento de
  dispositivos médicos passíveis de regularização.” (RDC 657/2022, art. 5º; [AnvisaLegis][rdc657], acesso em
  29/10/2026). Logo em seguida: “§1º É proibida a comercialização ou doação do SaMD desenvolvido internamente, sem a
  devida regularização na Anvisa.” (idem, art. 5º, § 1º). O Stabilis não é um serviço de saúde: não presta
  assistência por profissional de saúde. A Anvisa usa esta definição: “Serviço de saúde: atividade em que há prestação
  de assistência ao indivíduo ou à população humana que possa alterar o seu estado de saúde, objetivando a prevenção e
  o diagnóstico de doenças, o tratamento, a recuperação, a estética ou a reabilitação, realizada obrigatoriamente por
  profissional de saúde ou sob a sua supervisão.” (Perguntas & Respostas RDC 657, pergunta 12; [gov.br/anvisa][pr657],
  acesso em 29/10/2026).
- **Investigação clínica.** “§ 8º Estão isentos de notificação ou registro os dispositivos médicos destinados a
  investigações clínicas, cumpridas as disposições legais da autoridade sanitária competente para realização desta
  atividade, estando proibidos a comercialização e o uso para outros fins.” (RDC 751/2022, art. 2º, § 8º;
  [AnvisaLegis][rdc751], acesso em 29/10/2026). Não pesquisei as regras de investigação clínica com dispositivos
  médicos. **Leitura minha:** pela parte final do parágrafo (“estando proibidos a comercialização e o uso para
  outros fins”), a isenção serve a um estudo, não a um site aberto ao público em geral.

### 2.4 Exemplos da própria Anvisa (perguntas e respostas de 2022, não vinculantes)

**Tendem a não ser SaMD:**

- Guardar ou transportar dados: “Softwares que somente transportam ou armazenam dados médicos não se enquadram nas
  regras descritas na RDC 185/2001 e RDC 657/2022” (pergunta 74; [gov.br/anvisa][pr657], acesso em 29/10/2026).
- Só registrar, para o profissional avaliar depois: “Já um software que somente faz registro de dores e incômodos
  físicos para constituir um prontuário para avaliação futura por um profissional de saúde, não é considerado SaMD.”
  (pergunta 11).
- Consultar uma base de dados: “Softwares com indicação de uso para construção e consulta a base de dados e
  organização de informações não se enquadram nas regras descritas na RDC 185/2001” (pergunta 65, sobre base de
  interação medicamentosa).
- Consultar a literatura: “Softwares de consulta e cruzamento de literatura não são considerados SaMD” (pergunta 46,
  sobre alerta de interações maléficas).
- Calculadora que não envolve funções fisiológicas: “O produto software indicado somente para edição de texto e
  calculadora médica usando dados digitados pelo médico que não envolvam funções fisiológicas não se enquadra nas
  regras descritas na RDC 185/2001” (pergunta 34).
- Protocolo apresentado como livro de consulta, com a árvore de decisão inteira visível ao profissional:
  “tornando o software um sistema de consulta a literatura o que não enquadraria nas regras descritas na RDC
  185/2001 e dispensaria da necessidade de regularização.” (pergunta 58).
- O Manual atual repete a ideia ao explicar a Regra 11: “Softwares utilizados em conjunto com dispositivos médicos
  que apenas registram, armazenam ou exibem informações geralmente não são considerados dispositivos.” (Manual para
  Regularização de Equipamento Médico e SaMD, v1.3, Anexo C, Regra 11; [gov.br/anvisa][manual], acesso em
  29/10/2026).

**Tendem a ser SaMD:**

- Avaliar sintomas periodicamente: “Sistema que realiza avaliações periódicas de dores e incômodos físicos de seus
  usuários são considerados SaMD por realizarem a avaliação, que é considerado um diagnóstico básico” (pergunta 11;
  [gov.br/anvisa][pr657], acesso em 29/10/2026).
- Sugerir exames e remédios com base em diretrizes publicadas: “Software com as indicações de realizar
  classificações de risco, sugestão de exames e medicações com base em diretrizes e protocolos médicas publicados por
  instituições especializadas é considerado um SaMD conforme RDC 657/2022” (pergunta 45).
- Recomendar linhas de ação ao médico: “Caso o software faça recomendações ao médico de linhas de ação e exames,
  mesmo sendo atrelado a um prontuário eletrônico, este necessitará de regularização.” (pergunta 57).
- Automatizar protocolos sem mostrar a árvore inteira: “Caso o software automatize os protocolos de forma que os
  profissionais de saúde não possam visualizar a arvore de decisão por inteiro, o software toma para si o risco da
  aplicação deste protocolo e passa a configurar um dispositivo médico” (pergunta 58).
- Chatbot que verifica sintomas e indica especialista: “O software indicado para verificação de receitas médicas, de
  sintomas, com indicação automática de especialista, através de chatbot disponível via aplicativo de comunicação
  (produto 1 e 2 na consulta) se enquadra na classe de risco I pela regra 12 da RDC 185/2001” (pergunta 59; regra
  antiga).
- Triagem: “Softwares com indicação de uso para triagem, classificando risco do paciente, mesmo que isso seja feito
  por um algoritmo configurado no software pelo cliente, podem ser Softwares como Dispositivo Médico, SaMD, a
  depender do uso que será feito desta informação.” (pergunta 64).
- Cálculo de dose: “Softwares com indicação de uso para cálculos de dose constituem Softwares como Dispositivo Médico,
  SaMD, e devem ser regularizados junto à Gerência de Tecnologia em Equipamentos (GQUIP/GGTPS/ANVISA) antes de
  disponibilizados ao público.” (pergunta 66). Isso vale mesmo quando o cálculo só reproduz a bula: “O aplicativo
  indicado para auxiliar a realização de cálculo de dose reproduzindo as orientações que constam na bula do remédio,
  se enquadra na classe de risco I pela regra 12 da RDC 185/2001” (pergunta 25; regra antiga).

## 3. Como a classe de risco é atribuída (RDC 751/2022)

**Quatro classes.** “Art. 5º Os dispositivos médicos, objeto desta Resolução, estão enquadrados segundo o risco
intrínseco que representam à saúde do usuário, paciente, operador ou terceiros envolvidos, nas Classes I, II, III ou
IV:” e “I - Classe I: baixo risco; II - Classe II: médio risco; III - Classe III: alto risco; e IV - Classe IV:
máximo risco.” (RDC 751/2022, art. 5º; [AnvisaLegis][rdc751], acesso em 29/10/2026).

**Na dúvida, quem decide é a Anvisa.** “§ 2º Em caso de dúvida quanto à classificação resultante da aplicação das
regras estabelecidas nesta Resolução, será atribuição da Anvisa o enquadramento do dispositivo médico.” (RDC
751/2022, art. 5º, § 2º).

**Software independente é classificado por si.** “§ 4º Se o software (SaMD) for independente de qualquer outro
dispositivo, deve ser classificado independentemente.” (RDC 751/2022, art. 8º, § 4º). Quando há mais de uma função,
vale a mais rigorosa: “§ 6º Caso a um mesmo dispositivo sejam aplicáveis várias regras ou, dentro da mesma regra,
várias sub-regras, baseadas na sua finalidade pretendida, aplicam-se a regra e a sub-regra mais rigorosas que
conduzem à classificação superior.” (idem, art. 8º, § 6º). E sobre diagnóstico: “§ 8º Considera-se que um dispositivo
permite um diagnóstico direto quando proporciona, por si próprio, o diagnóstico da doença ou da condição em questão,
ou quando fornece informações decisivas para o diagnóstico.” (idem, art. 8º, § 8º).

**Regra 11 (Anexo I), a regra dos softwares:**

- “O software destinado a prestar informações utilizadas para a tomada de decisões com fins terapêuticos ou de
  diagnóstico é classificado na classe II, exceto se tais decisões tiverem um impacto que possa causar:”
- “a) a morte ou uma deterioração irreversível do estado de saúde de uma pessoa, caso em que é classificado na classe
  IV; ou”
- “b) uma deterioração grave do estado de saúde de uma pessoa ou uma intervenção cirúrgica, caso em que é
  classificado na classe III.”
- “O software destinado a monitorar os processos fisiológicos é classificado na classe II, exceto quando se destinar
  ao monitoramento de parâmetros fisiológicos vitais, quando a natureza das variações desses parâmetros possa resultar
  em perigo imediato para o paciente, caso em que é classificado na classe III.”
- “Qualquer outro Software como Dispositivo Médico (SaMD) é classificado na classe I.”

(RDC 751/2022, Anexo I, Regra 11; [AnvisaLegis][rdc751], acesso em 29/10/2026.)

**O que o Manual atual acrescenta.** “No caso de softwares a regra será sempre a regra 11.” (Manual v1.3, cap. II,
item 4.1; [gov.br/anvisa][manual], acesso em 29/10/2026). Ao explicar a regra, o Manual diz o que considerar: “Obs.1:
Para a classificação do software, é necessário considerar a finalidade pretendida, a população pretendida (incluindo,
por exemplo, doenças a serem tratadas e/ou diagnosticadas, velocidade de evolução da enfermidade, gravidade das
consequências para saúde), o contexto de uso” (Manual v1.3, Anexo C, Regra 11, Obs.1).

Na tabela de exemplos da Regra 11 do Manual aparece este: “O SaMD destina-se ao diagnóstico de depressão com base em
uma pontuação resultante de dados inseridos sobre os sintomas do paciente (por exemplo, ansiedade, padrões de sono,
estresse etc.)” (Manual v1.3, Anexo C, Regra 11, tabela de exemplos). **Leitura minha, conferida na imagem da página
184 do PDF:** o exemplo está na mesma linha da alínea “b) uma deterioração grave do estado de saúde de uma pessoa ou
uma intervenção cirúrgica, caso em que é classificado na classe III.”, ao lado de “Um aplicativo móvel destinado a
analisar os batimentos cardíacos do usuário, detectar anormalidades e informar um médico adequadamente.” (idem). O
Manual é orientação, e a classe de um produto concreto depende da finalidade dele. Mesmo assim, é o exemplo oficial
mais próximo do que o modo paciente faz com o PHQ-9.

## 4. O que cada classe exige

**Notificação ou registro.** “Art. 6º Os dispositivos médicos enquadrados nas classes de risco I e II são sujeitos a
notificação.” e “Art. 7º Os dispositivos médicos enquadrados nas classes de risco III e IV são sujeitos a registro.”
(RDC 751/2022, arts. 6º e 7º; [AnvisaLegis][rdc751], acesso em 29/10/2026).

**Classes I e II (notificação).**

- Taxa e formulário: “Art. 13. O solicitante para peticionar a notificação de dispositivo médico deve proceder com o
  pagamento da taxa correspondente e apresentar à Anvisa, os seguintes documentos:” (RDC 751/2022, art. 13). Para
  software há formulário próprio: “Art. 10. No caso dos SaMD classe de risco I e II deve ser apresentado formulário de
  petição para notificação de software, devidamente preenchido, disponível no portal eletrônico da Anvisa.” (RDC
  657/2022, art. 10; [AnvisaLegis][rdc657], acesso em 29/10/2026).
- Não há análise técnica prévia: “§ 5º Não haverá análise técnica das petições de notificação e de alteração de
  notificação para que os produtos sejam considerados regularizados” (RDC 751/2022, art. 10, § 5º). Há prazo de rotina:
  “§ 6º O processamento da notificação de dispositivo médico ocorrerá rotineiramente em até 30 (trinta) dias após o
  protocolo pelo solicitante.” (idem, art. 10, § 6º).
- O dossiê técnico fica com a empresa: “Art. 11. O dossiê técnico, do regime de notificação de SaMD, classe de risco I
  e II, que permanece de posse da empresa detentora da notificação, deverá conter:” (RDC 657/2022, art. 11). O
  conteúdo do dossiê está numa tabela que não consegui extrair do AnvisaLegis. Confira lá ou na tradução em inglês.
- A notificação não vence, mas tem condições: “A notificação de um SaMD tem validade indeterminada, ou seja, não
  precisa ser renovada, porém algumas condições devem ser cumpridas para que a notificação seja mantida vigente.”
  (Manual v1.3, cap. II; [gov.br/anvisa][manual], acesso em 29/10/2026).

**Classes III e IV (registro).**

- Exige certificado de boas práticas: “§ 8º O deferimento do registro fica condicionado à publicação do Certificado de
  Boas Práticas de Fabricação emitido pela Anvisa.” (RDC 751/2022, art. 10, § 8º).
- Validade de dez anos: “Art. 11. O registro de dispositivos médicos terá validade por 10 (dez) anos, contados a partir
  do dia da sua publicação no Diário Oficial da União, podendo ser revalidado sucessivamente por igual período” (RDC
  751/2022, art. 11).
- O relatório técnico tem itens a mais, entre eles: “IX - avaliação clínica e associação clínica válida, incluindo a
  descrição dos algoritmos e/ou rotinas utilizadas para gerar o processamento das sugestões de prevenção, diagnóstico,
  tratamento, monitorização fisiológica, reabilitação ou anticoncepção e suas fundamentações clínicas ou científicas;”
  (RDC 657/2022, art. 12, IX).

**Em todas as classes.**

- Boas práticas e requisitos essenciais: “§ 7º A manutenção da notificação e do registro fica vinculada ao cumprimento
  dos requisitos das Boas Práticas de Fabricação, dos requisitos essenciais de segurança e desempenho e dos
  regulamentos específicos, quando existirem.” (RDC 751/2022, art. 10, § 7º).
- Normas técnicas na declaração de conformidade: “I - IEC 62304:2006 - Medical device software -- Software life cycle
  processes; II - IEC 62366-1:2015 Medical devices -- Part 1: Application of usability engineering to medical devices;
  e III - ISO 14971:2007 Medical devices -- Application of risk management to medical devices.” (RDC 657/2022, art.
  13). O parágrafo único do mesmo artigo admite versões mais atuais ou equivalentes.
- Instruções de uso, que podem estar no próprio software. Entre o que deve constar: “III - princípio de funcionamento,
  incluindo descrições genéricas dos algoritmos, rotinas e fórmulas utilizadas para gerar o processamento clínico
  (prevenção, diagnóstico, tratamento, reabilitação ou anticoncepção) e suas associações clínicas válidas;” e “IV -
  alertas e advertências;” (RDC 657/2022, art. 7º, III e IV). E também: “Art. 8º As informações do rótulo e das
  instruções de uso podem estar disponibilizadas no próprio software, em local facilmente acessível.” (RDC 657/2022,
  art. 8º).
- Mudanças depois de regularizar exigem petição quando: “I - criem novas funcionalidades ou indicações de uso
  clínicas; II - afetem significativamente as funcionalidades clínicas, segurança e eficácia clínicos ou desempenho
  associadas às finalidades previstas anteriormente;” (RDC 657/2022, art. 16, I e II). **Leitura minha:** num projeto
  que muda toda semana, isso pesa.
- Uso de inteligência artificial: “Caso seja usada tecnologia de inteligência artificial (IA) para atingir seu
  propósito médico ou para auxiliar o software a atingir esse propósito a empresa terá que apresentar relatório
  contendo racional justificando técnica de IA aplicada, tamanho das bases utilizadas e relatando histórico de
  treinamento” (Perguntas & Respostas RDC 657, pergunta 55; [gov.br/anvisa][pr657], acesso em 29/10/2026).

**Quem pode pedir: só pessoa jurídica.** As definições da RDC 751/2022 são estas:

- “VIII - detentor (de notificação ou de registro): pessoa jurídica, pública ou privada, fabricante ou importador,
  responsável pelo dispositivo médico em território nacional, que detém a concessão de comercialização de dispositivo
  médico, emitida pela Anvisa;” (art. 4º, VIII; [AnvisaLegis][rdc751], acesso em 29/10/2026).
- “XIX - fabricante legal: pessoa jurídica, pública ou privada, com responsabilidade pelo projeto, manufatura,
  embalagem e rotulagem de um produto, com a intenção de disponibilizá-lo para uso sob seu nome” (art. 4º, XIX).
- “XLIV - solicitante: pessoa jurídica, pública ou privada, que encaminha petições para notificação ou registro de
  dispositivos médicos junto à autoridade sanitária;” (art. 4º, XLIV).

O Manual explica o primeiro passo: “O ponto de partida para solicitação de registro ou notificação de equipamentos
médicos e SaMD na Anvisa é a regularização da empresa junto à Vigilância Sanitária, o que compreende a obtenção da
Autorização de Funcionamento da Empresa (AFE) junto à Anvisa e a Licença de Funcionamento (LF)” e “Sem estas
autorizações, o protocolo da petição de registro ou notificação não é possível.” (Manual v1.3, cap. I, item 2.2;
[gov.br/anvisa][manual], acesso em 29/10/2026). As perguntas e respostas dizem o mesmo: “Toda empresa da área da saúde
que pretende produzir e comercializar produtos para saúde (incluindo software médicos) deve estar devidamente
licenciada pela VISA local e pela ANVISA, com Responsável Técnico e Responsável Legal constituídos” (pergunta 88;
[gov.br/anvisa][pr657], acesso em 29/10/2026).

**Antes de regularizar, não pode ser oferecido, nem de graça.**

- “§ 1º Os produtos sujeitos a notificação e registro somente poderão ser industrializados, importados, expostos à
  venda ou entregues ao consumo após a publicação do referido número de notificação ou registro.” (RDC 751/2022, art.
  60, § 1º; [AnvisaLegis][rdc751], acesso em 29/10/2026).
- “Informamos ainda que a distribuição de softwares como dispositivos médicos sem a devida regularização, ainda que
  gratuita, incorre em infração sanitária punível conforme dispositivos descritos em lei.” (Perguntas & Respostas RDC
  657, pergunta 55; [gov.br/anvisa][pr657], acesso em 29/10/2026).
- Notificação não é regime mais leve para infrações: “Art. 59. Ao regime de notificação se aplicam as mesmas
  tipificações das infrações sanitárias e as cominações a elas associadas vigentes para o regime de registro de
  dispositivos médicos.” (RDC 751/2022, art. 59).
- Não há prazo de adaptação. A Anvisa diz que a obrigação é anterior à RDC 657: “não havendo prazo para
  regularização, pois não foi a RDC 657/2022 que determinou a regularização de SaMD, ela já era obrigatória.”
  (Perguntas & Respostas RDC 657, pergunta 131).

## 5. Aplicação ao Stabilis

Esta seção é interpretação, com cautela. Ela não conclui se o Stabilis é ou não SaMD, porque os textos não resolvem
isso e quem decide é a Anvisa.

### 5.1 O que o Stabilis faz (fatos)

- **Modo paciente (educativo).** A pessoa responde PHQ-9, GAD-7, ASQ (triagem de risco de suicídio), AUDIT-C e
  perguntas sobre mania no passado. Tudo é calculado no navegador. Ela recebe opções de tratamento por diretriz
  (sem recomendar um remédio específico), alertas de segurança e disponibilidade no SUS. Recebe também um relatório
  para a consulta, acompanhamento com PHQ-9/GAD-7 periódicos e diário, um plano de segurança e respostas sobre
  remédios tiradas da base de conhecimento. Há ainda uma sugestão por modelo de linguagem, desligada e com
  consentimento a cada envio.
- **No código do relatório** (`webapp/app/lib/patient/report.ts`) aparecem faixas de pontuação (`moderados`, `graves`,
  `risco alto`), a origem da condição como `sugerido pelos questionários (não é diagnóstico)`, os níveis `1ª linha`,
  `2ª linha` e `Evitar neste perfil` e a avaliação de tentativas anteriores (`dose abaixo da mínima eficaz`).
- **Modo profissional (apoio à decisão).** O profissional informa perfil e diagnóstico. Recebe opções por linha da
  diretriz, alertas de bula, interações, esquemas de titulação e monitoramento e revisão de receita. A opção
  `Extrair do texto` manda a anamnese a um modelo de linguagem no servidor e só preenche o formulário depois que o
  profissional confirma. O aviso da tela diz `Não inclua nome, documentos nem outros dados que identifiquem a
  pessoa.` (`webapp/app/components/professional/ExtractionPanel.tsx`).
- **Rótulos.** O título do site é `Stabilis — apoio à decisão em saúde mental (experimental)`
  (`webapp/app/layout.tsx`). As telas do profissional dizem `Modo profissional · experimental e não comercial`. A tela
  inicial do paciente diz `Não é diagnóstico nem receita.`.

### 5.2 Modo paciente: o que parece se aplicar

| Função | Texto oficial mais próximo | Leitura possível (minha) |
|---|---|---|
| Guardar respostas, diário e histórico no aparelho | Manual, Regra 11 (“apenas registram, armazenam ou exibem”); pergunta 11 (só registro) | tende a não ser SaMD |
| Responder perguntas sobre remédios a partir da base (bula) | pergunta 65 (consulta a base de dados) | tende a não ser SaMD |
| Relatório que organiza o que a pessoa disse | pergunta 11 (registro para avaliação futura por profissional) | tende a não ser SaMD **se** só organizar; o relatório atual também leva faixas de pontuação e opções por perfil |
| Pontuar PHQ-9, GAD-7 e AUDIT-C, com faixas e condição `sugerido pelos questionários` | pergunta 11 (“avaliação, que é considerado um diagnóstico básico”); Manual, exemplo de depressão por pontuação na linha da classe III | se aproxima de SaMD |
| Triagem de risco de suicídio (ASQ), que dispara alertas e contatos de emergência | pergunta 64 (triagem: “podem ser Softwares como Dispositivo Médico, SaMD, a depender do uso que será feito desta informação”) | se aproxima de SaMD; classe incerta |
| Opções por diretriz filtradas pelo perfil, `Evitar neste perfil` e avaliação de tentativas anteriores | Regra 11 (“informações utilizadas para a tomada de decisões com fins terapêuticos”); perguntas 45 e 57 | se aproxima de SaMD |
| PHQ-9 e GAD-7 repetidos no acompanhamento | pergunta 11 (“avaliações periódicas”) | se aproxima de SaMD |
| Plano de segurança (texto do próprio projeto, preenchido pela pessoa) | não encontrei texto da Anvisa | incerto |
| Sugestões por modelo de linguagem (desligadas) | pergunta 55 (IA usada para o propósito médico) | se forem ligadas, somam IA à finalidade médica |

**O aviso *educativo* resolve?** Não encontrei base nos textos para dizer que sim (seção 2.1). A finalidade declarada
pesa (RDC 751/2022, art. 4º, XXI, e art. 8º). Mas a pergunta 60 só dá peso decisivo à alegação do fabricante quando
o software não tem função tipicamente médica, e a pergunta 58 diz que automatizar a aplicação de um protocolo
transfere o risco ao software. **Leitura minha:** o rótulo ajuda a mostrar a finalidade, mas dificilmente basta
sozinho se as funções forem as de um dispositivo médico.

**Se a Anvisa entender que o modo paciente é SaMD, que classe?** Pela primeira frase da Regra 11, classe II, se as
saídas forem informações usadas em decisões terapêuticas ou diagnósticas. Classe III é possível, se a Anvisa
considerar que uma decisão errada pode causar “deterioração grave”. O exemplo do Manual sobre depressão por pontuação
está nessa linha. Sobre a classe IV (“a morte”), não encontrei nenhum texto da Anvisa sobre triagem de risco de
suicídio. É uma das perguntas a levar. Se o software não fornecer informação para decisão terapêutica ou diagnóstica,
sobra a classe I (“Qualquer outro Software como Dispositivo Médico (SaMD)”).

**Perguntas em aberto do modo paciente:**

1. Pontuar questionários validados e mostrar faixas, sem dizer *você tem depressão*, já é “avaliação” ou “diagnóstico
   básico” (pergunta 11)?
2. A triagem de risco de suicídio, usada só para mostrar ajuda imediata (CVV 188, SAMU 192) e não para decidir
   tratamento, muda o enquadramento ou a classe?
3. Mostrar as opções da diretriz inteira, com as fontes, em vez de filtrar pelo perfil, aproximaria o modo paciente
   da “consulta a literatura” (pergunta 58)? A pergunta 58 trata de profissionais de saúde, não de leigos.
4. O relatório para a consulta, se só organizar o que a pessoa respondeu, conta como “registro” (pergunta 11)?

### 5.3 Modo profissional: o que parece se aplicar

| Função | Texto oficial mais próximo | Leitura possível (minha) |
|---|---|---|
| Opções por linha de tratamento a partir do diagnóstico e do perfil informados | perguntas 45 e 57; Regra 11 | é o caso mais próximo dos exemplos de SaMD |
| Alertas de bula e de interação, sozinhos | perguntas 46 e 65 (consulta de literatura ou base de dados) | sozinhos, tendem a não ser SaMD; junto da seleção por perfil, fazem parte de um sistema que pode ser |
| Esquemas de titulação e monitoramento | perguntas 66 e 25 (cálculo de dose, mesmo copiado da bula) | se aproxima de SaMD |
| Revisão de receita | perguntas 45 e 57 (recomendações ao médico) | se aproxima de SaMD |
| `Extrair do texto` (modelo de linguagem, com confirmação do profissional) | pergunta 55 (IA) | é função auxiliar de preenchimento; não sei se a Anvisa a vê como parte da finalidade médica |
| Rótulo `Apoio à decisão — experimental` | Regra 11 (“informações utilizadas para a tomada de decisões”) | o rótulo descreve uma finalidade parecida com a da Regra 11; *experimental* não isenta, exceto investigação clínica (seção 2.3) |

**Se for SaMD, que classe?** A pergunta 45 falava em “classe de risco II ou III” pelas regras antigas, conforme as
doenças da indicação de uso. Pela Regra 11 atual, o ponto de partida é a classe II. A III depende de a Anvisa
entender que decisões sobre remédios psiquiátricos podem levar a “deterioração grave do estado de saúde”. Não
encontrei texto que trate de psiquiatria especificamente.

**Um caminho que a própria Anvisa descreve** (pergunta 58) é apresentar o protocolo de modo que o profissional veja
a árvore de decisão inteira, como um livro de consulta. Assim o software não “toma para si o risco da aplicação deste
protocolo”. **Leitura minha:** isso mudaria bastante o produto, e a resposta foi dada para um caso concreto, sob
regras já revogadas. Convém confirmar antes de redesenhar.

**Fora do escopo deste documento, mas relevante para o profissional que usar o Stabilis.** O portal do Conselho
Federal de Medicina noticia a Resolução CFM nº 2.454/2026, sobre inteligência artificial na medicina: “A norma também
assegura ao médico o direito de recusar o uso de sistemas de IA que não apresentem validação científica adequada,
certificação regulatória pertinente ou que contrariem princípios éticos, técnicos ou legais.” e “Outra mudança prática
é a exigência de que o médico registre no prontuário do paciente o uso de sistemas de IA como apoio à decisão médica.”
([notícia do CFM][cfm], acesso em 29/10/2026). Não li a resolução. A fonte é uma notícia do CFM, fora do conjunto de
fontes pedido para este documento, e vale conferir o texto da norma.

**Perguntas em aberto do modo profissional:**

1. Filtrar opções de diretrizes por diagnóstico e perfil informados pelo médico, sempre com a fonte de cada opção, é
   SaMD? Em que classe?
2. Esquemas de titulação copiados da bula contam como “cálculo de dose” (perguntas 25 e 66)?
3. Usar um modelo de linguagem só para preencher campos, com confirmação do profissional, entra na finalidade médica
   para efeito do relatório de IA (pergunta 55)?

### 5.4 O que muda se o Stabilis virar comercial ou fizer alegação diagnóstica

- **Comercial.** Pelos textos, ser gratuito não é o que afasta a regra. O art. 60, § 1º, da RDC 751/2022 fala em
  “entregues ao consumo”, e a pergunta 55 diz “ainda que gratuita”. A RDC 657/2022, art. 5º, § 1º, proíbe até a
  “doação” de SaMD in house sem regularização. Ou seja, se o Stabilis for SaMD, já precisaria de regularização hoje.
  Virar comercial somaria obrigações sem mudar essa resposta. Uma delas: “Art. 32. Toda comunicação ou publicidade de
  dispositivo médico veiculada no mercado deve guardar estrita concordância com as informações apresentadas pelo
  detentor de notificação ou registro à Anvisa.” (RDC 751/2022, art. 32; [AnvisaLegis][rdc751], acesso em
  29/10/2026). Também tornaria mais natural a figura de uma empresa (pessoa jurídica com AFE), que é quem pode
  regularizar.
- **Alegação diagnóstica.** Se o Stabilis disser que diagnostica (*rastreia depressão*, *detecta risco*), entra
  diretamente no primeiro propósito da definição (“diagnóstico […] de uma doença”, art. 4º, X, a) e na Regra 11.
  O exemplo do Manual sobre depressão por pontuação está na linha da classe III, que exige registro e Certificado de
  Boas Práticas de Fabricação (RDC 751/2022, art. 10, § 8º). Pelo art. 8º, § 8º, fornecer “informações decisivas para
  o diagnóstico” já é diagnóstico direto.
- **Inteligência artificial ligada à finalidade médica** (por exemplo, sugestões do modelo no modo paciente). Exigiria,
  na regularização, o relatório sobre a técnica, as bases e o treinamento (pergunta 55).

### 5.5 O que pode mudar nas regras

A revisão da RDC 657/2022 está na Agenda Regulatória 2026-2027 da Anvisa. Na lista preliminar, o tema “Revisão da
regularização de software como dispositivo médico (Software as a Medical Device - SaMD) (Revisão da RDC nº 657/2022)”
aparece como “Em andamento”. A descrição diz: “O marco regulatório atual (RDC 657/2022) referente a Softwares como
Dispositivos Médicos (SaMD) apesar de publicado recentemente deve ser atualizado, de forma a acompanhar a evolução de
um mercado que cresce e se expande de forma muito rápida.” e “Itens referentes à inteligência artificial e à
aprendizagem de máquinas devem ser incorporados à RDC, além da harmonização com as regulamentações e práticas
internacionais.” ([lista preliminar de temas, produtos para a saúde, tema 5][ar2627pre], acesso em 29/10/2026). O
relatório da consulta traz o tema 5.11 no anexo “LISTA DE TEMAS DA AGENDA REGULATÓRIA DA ANVISA 2026-2027”
([relatório da consulta à sociedade][ar2627rel], acesso em 29/10/2026). Não encontrei consulta pública nem minuta
publicadas sobre o tema. Vale verificar de novo antes de qualquer decisão.

## 6. Perguntas para levar à Anvisa e por qual canal

### 6.1 Perguntas

1. **Enquadramento do modo paciente.** O modo paciente é SaMD, tal como funciona: questionários validados pontuados
   no navegador, faixas de gravidade, condição `sugerido pelos questionários (não é diagnóstico)`, opções de
   diretriz filtradas por perfil, alertas, relatório para a consulta e acompanhamento periódico? Se for, em que
   classe pela Regra 11?
2. **Triagem de risco de suicídio.** A triagem (ASQ), usada só para mostrar ajuda imediata e contatos de emergência,
   muda o enquadramento ou a classe (alíneas a e b da Regra 11)?
3. **Desenho que fique fora.** Que mudanças levariam cada modo para fora da definição de SaMD? Por exemplo: mostrar a
   diretriz inteira, com as fontes, sem filtrar pelo perfil (pergunta 58), ou não pontuar os questionários.
4. **Enquadramento do modo profissional.** Opções por linha a partir de diagnóstico e perfil informados pelo médico,
   alertas de bula e interações, esquemas de titulação e revisão de receita: é SaMD? Em que classe? Os esquemas
   copiados da bula contam como “cálculo de dose”?
5. **Modelo de linguagem.** Usá-lo só para extrair campos de um texto, com confirmação humana, muda o enquadramento ou
   exige o relatório de IA?
6. **Pessoa física.** A Anvisa aceita um pedido de enquadramento feito por pessoa física, sem CNPJ? A ficha de
   enquadramento pede “1.1 Razão Social:” e “1.3 CNPJ:” ([ficha de enquadramento v.2][ficha], acesso em
   29/10/2026).
7. **Projeto sem empresa.** Se for SaMD, há algum caminho para um projeto gratuito, sem fins comerciais, mantido por
   pessoa física, além de constituir uma pessoa jurídica com AFE? Por exemplo: investigação clínica (RDC 751/2022,
   art. 2º, § 8º) ou parceria com um fabricante legal.
8. **Revisão em curso.** A revisão da RDC 657/2022 prevê algo sobre software educativo, de código aberto ou sem fins
   lucrativos?

### 6.2 Canal

- **A norma prevê o pedido de enquadramento.** “Art. 19. Em caso de dúvida na classificação resultante da aplicação
  das regras de enquadramento sanitário constantes nas resoluções aplicáveis, a empresa pode solicitar o enquadramento
  do SaMD pelos canais de comunicação disponíveis perante preenchimento do formulário de enquadramento de software,
  disponível no portal eletrônico da Anvisa.” (RDC 657/2022, art. 19; [AnvisaLegis][rdc657], acesso em 29/10/2026).
- **Canal escrito: Fale Conosco (formulário eletrônico).** Serve para “Pedidos de informações técnicas por qualquer
  usuário.” e tem “Prazo de resposta: Até 20 dias corridos, prorrogáveis por 10 dias corridos.” ([Canais de
  atendimento da Anvisa][canais], acesso em 29/10/2026). A página do formulário é
  <https://www.gov.br/anvisa/pt-br/canais_atendimento/formulario-eletronico> e aponta para o [Formulário Eletrônico
  do Fale Conosco](https://servicos-externos.anvisa.gov.br/canais-de-atendimento-fale-conosco) ([página do Fale
  Conosco][faleconosco], acesso em 29/10/2026). Anexe a ficha preenchida, telas e a descrição de dados de entrada,
  processamento e saída, que é o que a ficha pede nos itens 3.1 a 3.17.
- **Formulário.** “Formulário de Enquadramento de Softwares e Equipamentos Médicos”, com a página marcada “Criado em
  28/04/2022 11:38Modificado em 24/02/2023 13:33” ([ficha][ficha], acesso em 29/10/2026). Atenção: a ficha ainda
  remete à norma revogada: “A classificação de risco (enquadramento sanitário) de produtos para a saúde é dada pelo
  anexo II da RDC ANVISA No. 185/01.” (ficha, orientações gerais).
- **Audiências (reuniões): só pessoa jurídica.** Em 2022, as perguntas e respostas diziam que os canais “estão abertos
  a todos, sejam os fabricantes, as empresas desenvolvedoras, o cidadão comum ou estrangeiros interessados.” (pergunta
  83; [gov.br/anvisa][pr657], acesso em 29/10/2026). A página atual de audiências limita: “Quem pode utilizar esse
  serviço? Pessoa jurídica (representantes ou não do setor regulado), agentes públicos representantes das unidades
  organizacionais da Anvisa, ou de outros órgãos e entidades públicas.” ([Audiências][audiencias], acesso em
  29/10/2026). Para uma pessoa física, o canal viável parece ser o Fale Conosco.
- **Telefone, para informação geral:** “0800 642 9782” ([Canais de atendimento][canais], acesso em 29/10/2026).

Guarde no repositório a pergunta enviada, a data, o número do protocolo e a resposta, sem dados pessoais de usuários.

## 7. Precauções práticas

### 7.1 O que o projeto já faz (pelo código e pela descrição)

- Avisos de que não é diagnóstico nem receita, no paciente e no relatório. Rótulo `experimental e não comercial` no
  modo profissional.
- Fonte pública citada em cada opção. Versão e hash da base de conhecimento nos relatórios.
- Nenhuma recomendação de remédio específico no modo paciente.
- Dados no navegador por padrão. Modelo de linguagem desligado no paciente, com consentimento a cada envio quando
  ligado. Aviso para não incluir identificação no modo profissional.
- Ajuda imediata (CVV 188, SAMU 192) quando há sinal de risco.

### 7.2 O que vale considerar

Cada item é sugestão minha, ligada ao texto citado. Não é exigência comprovada.

1. **Perguntar à Anvisa antes de divulgar mais**, principalmente entre profissionais de saúde, e registrar a resposta
   (RDC 657/2022, art. 19). Se for SaMD, oferecer ao público antes de regularizar é o que a pergunta 55 chama de
   infração, “ainda que gratuita”.
2. **Descrever a finalidade de forma igual em todo lugar** (README, /about, metadados, telas) e igual ao que o software
   faz de fato. A finalidade declarada pelo fabricante conta (art. 4º, XXI, e art. 8º da RDC 751/2022). Mas trocar
   palavras não muda o enquadramento se as funções forem de dispositivo médico (perguntas 58 e 60). Vale também
   avaliar se `apoio à decisão`, no título do site, descreve o que se quer declarar.
3. **Não fazer alegação diagnóstica.** Evitar termos como *rastreio*, *detecção* ou *diagnóstico* para o que o
   software faz. Rever a frase `sugerido pelos questionários` à luz do art. 8º, § 8º (“informações decisivas para o
   diagnóstico”).
4. **Não tirar recursos de segurança só por causa da regra.** A triagem de risco e a ajuda imediata protegem quem usa.
   Se pesarem no enquadramento, a pergunta certa à Anvisa é como mantê-las.
5. **Manter o modelo de linguagem desligado no modo paciente** até ter a resposta. A IA ligada à finalidade médica
   traz exigências próprias (pergunta 55).
6. **Manter o uso não comercial**, sabendo que isso não isenta da regra (seção 5.4).
7. **Documentar desde já** a finalidade, os dados de entrada, o processamento e a saída de cada função, o que o
   software não faz (item 3.4 da ficha: “Requisito Inverso ou Escopo Negativo”), os riscos e as versões. Serve para
   a consulta e para qualquer caminho futuro. As normas IEC 62304, IEC 62366-1 e ISO 14971 (RDC 657/2022, art. 13)
   são a referência do que a Anvisa espera.
8. **Acompanhar a revisão da RDC 657/2022** (Agenda Regulatória 2026-2027) e, para o modo profissional, a Resolução
   CFM nº 2.454/2026.
9. **Se a resposta for *é SaMD* e o projeto quiser continuar como está**, as opções que os textos sugerem precisam
   ser confirmadas: (a) uma pessoa jurídica com AFE assumir como fabricante legal e regularizar; (b) investigação
   clínica, nos termos da regra própria; ou (c) redesenho das funções.

> **Lembrete:** este documento não é aconselhamento jurídico nem regulatório. Ele organiza textos oficiais e aponta
> dúvidas. A resposta sobre o enquadramento do Stabilis só a Anvisa pode dar (RDC 751/2022, art. 5º, § 2º).

## 8. Fontes (todas acessadas em 29/10/2026)

- **RDC 657/2022**, texto em português no AnvisaLegis (situação: “Vigente”):
  <https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000657&sgl_tipo=RDC&sgl_orgao=RDC/DC/ANVISA/MS&vlr_ano=2022&seq_ato=000&cod_modulo=310&cod_menu=9434>
- **RDC 751/2022**, texto consolidado em português no AnvisaLegis (situação: “Vigente com Alterações”):
  <https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000751&sgl_tipo=RDC&sgl_orgao=RDC/DC/ANVISA/MS&vlr_ano=2022&seq_ato=000&cod_modulo=134&cod_menu=1696>
- **Página de legislação da Anvisa no gov.br**, que redireciona ao AnvisaLegis:
  <https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/legislacao>
- **RDC 657/2022, tradução oficial em inglês:**
  <https://www.gov.br/anvisa/en/rules-and-regulations/arquivos/rdc_657_2022-e.pdf/@@display-file/file>
- **RDC 751/2022, tradução oficial em inglês:**
  <https://www.gov.br/anvisa/en/rules-and-regulations/arquivos/rdc-751_2022.pdf/@@display-file/file>
- **Perguntas & Respostas RDC 657/2022**, versão 1, de 01/09/2022 (página e PDF):
  <https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/produtos-para-a-saude/manuais/software-como-dispositivo-medico-perguntas-e-respostas>
- **Perguntas & Respostas RDC 751/2022**, 2ª edição, de 02/03/2023:
  <https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/produtos-para-a-saude/manuais/perguntas-respostas-rdc-751-de-2022/@@download/file>
- **Manual para Regularização de Equipamento Médico e Software como Dispositivo Médico na Anvisa**, versão 1.3
  (página e PDF): <https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/produtos-para-a-saude/manuais/manual-regularizacao-gquip>
- **Formulário de Enquadramento de Softwares e Equipamentos Médicos** (ficha v.2):
  <https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/produtos-para-a-saude/formularios-1/ficha-de-enquadramento-v-2.docx/view>
- **Produtos não regularizados como dispositivos médicos:**
  <https://www.gov.br/anvisa/pt-br/setorregulado/regularizacao/produtos-para-saude/produtos-nao-regulados>
- **Canais de atendimento:** <https://www.gov.br/anvisa/pt-br/canais_atendimento>
- **Fale Conosco:** <https://www.gov.br/anvisa/pt-br/canais_atendimento/formulario-eletronico>
- **Audiências:** <https://www.gov.br/anvisa/pt-br/canais_atendimento/audiencias-presenciais>
- **Agenda Regulatória 2026-2027, lista preliminar de temas de produtos para a saúde:**
  <https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/agenda-regulatoria/agenda-2026-2027/arquivos/lista_preliminar/produtos_para_saude_lista_preliminar_detalhada.pdf>
- **Agenda Regulatória 2026-2027, relatório da consulta à sociedade**, com a lista de temas no anexo:
  <https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/agenda-regulatoria/agenda-2026-2027/arquivos/relatorio_consulta_agendaregulatoria_2026-2027.pdf/@@display-file/file>
- **CFM, notícia sobre a Resolução CFM nº 2.454/2026** (fora do conjunto de fontes pedido):
  <https://portal.cfm.org.br/noticias/regras-sobre-uso-da-ia-na-medicina-entram-em-vigor-no-dia-26-de-agosto/>
- **Diário Oficial da União (in.gov.br): não acessado**, porque a conexão foi recusada. As datas de publicação no
  DOU citadas aqui vêm do AnvisaLegis: RDC 657/2022, “PUB D.O.U., 30/03/2022 - Seção 1”; RDC 751/2022, “PUB
  D.O.U., 21/09/2022 - Seção 1”.

[rdc657]: https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000657&sgl_tipo=RDC&sgl_orgao=RDC/DC/ANVISA/MS&vlr_ano=2022&seq_ato=000&cod_modulo=310&cod_menu=9434
[rdc751]: https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000751&sgl_tipo=RDC&sgl_orgao=RDC/DC/ANVISA/MS&vlr_ano=2022&seq_ato=000&cod_modulo=134&cod_menu=1696
[rdc657en]: https://www.gov.br/anvisa/en/rules-and-regulations/arquivos/rdc_657_2022-e.pdf/@@display-file/file
[rdc751en]: https://www.gov.br/anvisa/en/rules-and-regulations/arquivos/rdc-751_2022.pdf/@@display-file/file
[pr657]: https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/produtos-para-a-saude/manuais/software-como-dispositivo-medico-perguntas-e-respostas
[manual]: https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/produtos-para-a-saude/manuais/manual-regularizacao-gquip
[ficha]: https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/produtos-para-a-saude/formularios-1/ficha-de-enquadramento-v-2.docx/view
[naoreg]: https://www.gov.br/anvisa/pt-br/setorregulado/regularizacao/produtos-para-saude/produtos-nao-regulados
[canais]: https://www.gov.br/anvisa/pt-br/canais_atendimento
[faleconosco]: https://www.gov.br/anvisa/pt-br/canais_atendimento/formulario-eletronico
[audiencias]: https://www.gov.br/anvisa/pt-br/canais_atendimento/audiencias-presenciais
[ar2627pre]: https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/agenda-regulatoria/agenda-2026-2027/arquivos/lista_preliminar/produtos_para_saude_lista_preliminar_detalhada.pdf
[ar2627rel]: https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/agenda-regulatoria/agenda-2026-2027/arquivos/relatorio_consulta_agendaregulatoria_2026-2027.pdf/@@display-file/file
[cfm]: https://portal.cfm.org.br/noticias/regras-sobre-uso-da-ia-na-medicina-entram-em-vigor-no-dia-26-de-agosto/
