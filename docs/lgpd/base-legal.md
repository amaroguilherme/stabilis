# LGPD: os dispositivos que importam para o Stabilis

> **Isto não é aconselhamento jurídico.** É uma leitura de textos oficiais, feita por pesquisa documental, para o
> mantenedor do projeto (um desenvolvedor, não um advogado). Antes de usar em qualquer documento formal, confirme com
> orientação jurídica. Todas as fontes foram acessadas em 29/10/2026. Trechos entre aspas curvas (“ ”) são cópias
> literais; o resto é leitura minha e está marcado como tal quando é interpretação. Os fluxos de dados estão em
> [mapa-de-dados.md](mapa-de-dados.md) e o rascunho do relatório de impacto em [ripd.md](ripd.md). Os dois remetem a
> este arquivo para os artigos citados.

## Resumo

- **A LGPD vale para o Stabilis mesmo com servidores fora do Brasil.** Ela se aplica quando o serviço é oferecido a
  pessoas no Brasil ou quando os dados são coletados aqui (art. 3º).
- **A exceção para uso particular (art. 4º, I) protege quem usa o Stabilis para si**, não o projeto que oferece o
  serviço ao público (leitura minha).
- **Respostas de saúde são dados pessoais sensíveis (art. 5º, II).** Para o mantenedor, a base legal viável é o
  **consentimento específico e destacado** (art. 11, I). A “tutela da saúde” (art. 11, II, f) é restrita a
  profissionais de saúde, serviços de saúde ou autoridade sanitária. Pode servir ao profissional que usa o modo
  profissional, mas não ao mantenedor (leitura minha).
- **Quando os dados ficam só no navegador, não está claro se o mantenedor *trata* esses dados.** A lei não trata
  desse cenário. Os rascunhos do projeto adotam a postura conservadora de agir como controlador, e ela me parece
  sensata.
- **Enviar texto ao servidor no Hugging Face, fora do Brasil, é provavelmente transferência internacional (art.
  33).** A ANPD só reconheceu um destino como adequado: a União Europeia (Resolução CD/ANPD nº 32/2026). No modo
  paciente, o consentimento específico e em destaque para a transferência (art. 33, VIII) é viável. **No modo
  profissional, o titular é o paciente, que não usa o site.** Falta definir o mecanismo, e esse é o ponto mais
  frágil.
- **Uma pessoa física que trata dados pode ser “agente de tratamento de pequeno porte”** (Resolução CD/ANPD nº
  2/2022). Nesse caso pode deixar de indicar encarregado, desde que ofereça um canal de contato, e pode fazer registro
  simplificado. **Mas o regime simplificado não vale para tratamento de alto risco.** Uso de dados sensíveis é um
  dos critérios específicos de alto risco. Num exemplo parecido (dados de saúde de pessoas vulneráveis), a ANPD
  concluiu que o agente “deverá indicar um encarregado”. Se o Stabilis é alto risco quando recebe texto de saúde é a
  principal dúvida aberta.
- **O relatório de impacto (RIPD) ainda não tem regulamento.** A ANPD recomenda fazê-lo quando o tratamento pode ser
  de alto risco, e já existe um rascunho no repositório.

## 0. Fontes e limitações

- **Planalto (planalto.gov.br): não consegui acessar.** O `curl` não recebeu resposta. A ferramenta de leitura de
  páginas recebeu uma página de *Acesso Negado* da Diretoria de Tecnologia da Presidência. Não tentei contornar o
  bloqueio. O endereço oficial da LGPD é <https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm>
  (não acessado).
- **Texto da LGPD usado: o *Texto Atualizado* da Câmara dos Deputados**, uma fonte oficial do Poder Legislativo, mas
  não a indicada para este trabalho:
  <https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html>. Ele traz
  as alterações até a Lei nº 15.352/2026. Por exemplo, o art. 5º, VIII, já fala em “Agência Nacional de Proteção de
  Dados”, com a nota “(Inciso com redação dada pela Medida Provisória nº 1.317, de 17/9/2025, convertida na Lei nº
  15.352, de 25/2/2026)” ([Câmara][lgpd], acesso em 29/10/2026). **Confira cada citação no Planalto antes de usá-la
  fora deste repositório.**
- **Mudanças recentes na lei.** Segundo o Planalto, “A Lei Nº 15.352 transforma a Autoridade Nacional de Proteção de
  Dados em Agência Nacional de Proteção de Dados, uma autarquia especial com autonomia funcional, técnica, decisória,
  administrativa e financeira” ([notícia do Planalto][lei15352], acesso em 29/10/2026). No texto da Câmara, o art.
  55-A agora diz: “Art. 55-A. Fica criada a Agência Nacional de Proteção de Dados (ANPD), autarquia de natureza
  especial vinculada ao Ministério da Justiça e Segurança Pública” ([Câmara][lgpd]). **Leitura minha:** pelo que vi,
  as mudanças de 2025 e 2026 são institucionais e não alteram os artigos analisados abaixo. Não pude confirmar isso
  no Planalto.
- **Normas da ANPD: copiadas do gov.br/anpd.** As páginas avisam que não substituem o Diário Oficial, por exemplo:
  “Observação: Este texto não substitui a publicação no DOU de 28/01/2022, alterado pela Resolução CD/ANPD nº 15, de
  25 de abril de 2024.” ([Resolução CD/ANPD nº 2/2022][res2], acesso em 29/10/2026). O Diário Oficial (in.gov.br)
  recusou a conexão, então não o li.
- **Resolução CD/ANPD nº 18/2024 (encarregado).** A página de regulamentações da ANPD remete ao DOU, que não abriu.
  Usei o documento assinado que está no processo publicado pela ANPD
  ([PDF do processo no gov.br/anpd][res18], páginas 1199 a 1208). A extração de texto do PDF perdeu a ligadura *ti*
  em algumas palavras (por exemplo, *titular*). Restaurei essas letras comparando com a imagem das páginas.
- **Não analisei** o Estatuto Digital da Criança e do Adolescente (Lei nº 15.211/2025), o Marco Civil da Internet nem
  normas do CFM.

## 1. Os fluxos de dados, em uma frase cada

Detalhes e quem trata cada dado estão em [mapa-de-dados.md](mapa-de-dados.md).

1. **Respostas do guia, diário e plano de segurança** ficam no navegador da pessoa e não vão a nenhum servidor.
2. **O caso digitado no modo profissional** (dados de um paciente) fica no navegador do profissional.
3. **`Extrair do texto`, no modo profissional, e a ajuda para organizar o relato, no modo paciente** (ainda
   desligada) mandam texto a uma função na Vercel e daí ao servidor no Hugging Face, **fora do Brasil**. O texto é
   descartado depois.
4. **Ditado por voz** manda o áudio à empresa do navegador (Google ou Apple), **fora do Brasil**. O Stabilis não
   recebe o áudio.
5. **Contagens anônimas** (desligadas até a pessoa ligar) mandam só o nome de um evento à Vercel e ao Upstash.
6. **Registros técnicos das plataformas** (endereço IP, navegador, página) existem sempre que alguém abre o site.
7. **Imprimir, baixar e compartilhar** são ações da própria pessoa.

## 2. Quando a LGPD se aplica

- “Art. 3º Esta Lei aplica-se a qualquer operação de tratamento realizada por pessoa natural ou por pessoa jurídica de
  direito público ou privado, independentemente do meio, do país de sua sede ou do país onde estejam localizados os
  dados, desde que:” (art. 3º, caput; [Câmara][lgpd], acesso em 29/10/2026).
- “II - a atividade de tratamento tenha por objetivo a oferta ou o fornecimento de bens ou serviços ou o tratamento de
  dados de indivíduos localizados no território nacional;” e “III - os dados pessoais objeto do tratamento tenham sido
  coletados no território nacional.” (art. 3º, II e III).
- **A exceção do uso particular:** “Art. 4º Esta Lei não se aplica ao tratamento de dados pessoais: I - realizado por
  pessoa natural para fins exclusivamente particulares e não econômicos;” (art. 4º, I). A Resolução CD/ANPD nº
  2/2022 repete o limite: “Parágrafo único. Este regulamento não se aplica ao tratamento de dados pessoais realizado
  por pessoa natural para fins exclusivamente particulares e não econômicos, bem como nas demais hipóteses previstas
  no art. 4º da LGPD.” (Res. 2/2022, Anexo I, art. 1º, parágrafo único; [gov.br/anpd][res2], acesso em 29/10/2026).

**Leitura minha:** quem usa o Stabilis para organizar a própria saúde está no art. 4º, I. O mantenedor oferece o
serviço a terceiros, e isso dificilmente cabe em “fins exclusivamente particulares e não econômicos”, mesmo sem cobrar.

## 3. Definições (art. 5º) e quem é quem

- “I - dado pessoal: informação relacionada a pessoa natural identificada ou identificável;” (art. 5º, I; [Câmara][lgpd],
  acesso em 29/10/2026).
- “II - dado pessoal sensível: dado pessoal sobre origem racial ou étnica, convicção religiosa, opinião política,
  filiação a sindicato ou a organização de caráter religioso, filosófico ou político, dado referente à saúde ou à vida
  sexual, dado genético ou biométrico, quando vinculado a uma pessoa natural;” (art. 5º, II).
- “III - dado anonimizado: dado relativo a titular que não possa ser identificado, considerando a utilização de meios
  técnicos razoáveis e disponíveis na ocasião de seu tratamento;” (art. 5º, III).
- “VI - controlador: pessoa natural ou jurídica, de direito público ou privado, a quem competem as decisões
  referentes ao tratamento de dados pessoais;” (art. 5º, VI).
- “VII - operador: pessoa natural ou jurídica, de direito público ou privado, que realiza o tratamento de dados
  pessoais em nome do controlador;” (art. 5º, VII).
- “VIII - encarregado: pessoa indicada pelo controlador e operador para atuar como canal de comunicação entre o
  controlador, os titulares dos dados e a Agência Nacional de Proteção de Dados (ANPD);” (art. 5º, VIII, redação da Lei
  nº 15.352/2026, segundo a Câmara).
- “X - tratamento: toda operação realizada com dados pessoais, como as que se referem a coleta, produção, recepção,
  classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento,
  armazenamento, eliminação, avaliação ou controle da informação, modificação, comunicação, transferência, difusão ou
  extração;” (art. 5º, X).
- “XII - consentimento: manifestação livre, informada e inequívoca pela qual o titular concorda com o tratamento de
  seus dados pessoais para uma finalidade determinada;” (art. 5º, XII).
- “XV - transferência internacional de dados: transferência de dados pessoais para país estrangeiro ou organismo
  internacional do qual o país seja membro;” (art. 5º, XV).
- “XVII - relatório de impacto à proteção de dados pessoais: documentação do controlador que contém a descrição dos
  processos de tratamento de dados pessoais que podem gerar riscos às liberdades civis e aos direitos fundamentais,
  bem como medidas, salvaguardas e mecanismos de mitigação de risco;” (art. 5º, XVII).
- **Dado anonimizado sai da lei, se a anonimização for real:** “Art. 12. Os dados anonimizados não serão considerados
  dados pessoais para os fins desta Lei, salvo quando o processo de anonimização ao qual foram submetidos for
  revertido, utilizando exclusivamente meios próprios, ou quando, com esforços razoáveis, puder ser revertido.” (art.
  12).

**Quem é quem (leitura minha, com dúvidas):**

- **Texto enviado ao servidor pelo modo paciente:** o mantenedor decide a finalidade e os meios, então é controlador.
  Vercel e Hugging Face tratam o dado em nome dele, então são operadores. É o que está no mapa de dados.
- **Respostas que ficam no navegador:** o mantenedor não tem acesso a elas. Pela definição de tratamento (art. 5º, X),
  quem coleta, guarda e processa é o software rodando no aparelho da pessoa. **Não encontrei texto que diga se o
  autor do software é controlador nesse caso.** A postura do [ripd.md](ripd.md) é agir como controlador
  (transparência, consentimento e canal de contato). Ela é a mais segura.
- **`Extrair do texto`, no modo profissional:** há duas leituras. (a) O profissional, ou o serviço de saúde dele, é o
  controlador dos dados do paciente, e o mantenedor é operador. (b) O mantenedor é controlador do seu próprio
  serviço. A ANPD lembra que os papéis variam: “um mesmo agente de tratamento poderá desempenhar papel de operador em
  relação a um tratamento e de controlador para outro.” (Guia orientativo Atuação do encarregado, 2024, p. 7;
  [gov.br/anpd][guiaenc], acesso em 29/10/2026). A escolha muda a base legal e a responsabilidade. Na leitura (a), o
  operador segue o art. 39: “Art. 39. O operador deverá realizar o tratamento segundo as instruções fornecidas pelo
  controlador, que verificará a observância das próprias instruções e das normas sobre a matéria.” ([Câmara][lgpd]).

## 4. Bases legais (arts. 7º e 11)

- **Dados não sensíveis:** “Art. 7º O tratamento de dados pessoais somente poderá ser realizado nas seguintes
  hipóteses: I - mediante o fornecimento de consentimento pelo titular;” (art. 7º, I; [Câmara][lgpd], acesso em
  29/10/2026). Há também o legítimo interesse: “IX - quando necessário para atender aos interesses legítimos do
  controlador ou de terceiro, exceto no caso de prevalecerem direitos e liberdades fundamentais do titular que exijam a
  proteção dos dados pessoais; ou” (art. 7º, IX). **Leitura minha:** para os registros técnicos de acesso (IP,
  navegador), o legítimo interesse é a base mais usual. Não analisei a fundo.
- **Dados sensíveis:** “Art. 11. O tratamento de dados pessoais sensíveis somente poderá ocorrer nas seguintes
  hipóteses: I - quando o titular ou seu responsável legal consentir, de forma específica e destacada, para
  finalidades específicas;” (art. 11, I).
- **Tutela da saúde, só para quem é da saúde:** “f) tutela da saúde, exclusivamente, em procedimento realizado por
  profissionais de saúde, serviços de saúde ou autoridade sanitária; ou” (art. 11, II, f). **Leitura minha:** o
  mantenedor não é profissional nem serviço de saúde. Então essa base parece servir ao profissional que usa o modo
  profissional, não ao projeto. Se o mantenedor for operador do profissional (leitura a da seção 3), a base é a do
  profissional.
- **O que revela dado sensível também conta:** “§ 1º Aplica-se o disposto neste artigo a qualquer tratamento de dados
  pessoais que revele dados pessoais sensíveis e que possa causar dano ao titular, ressalvado o disposto em legislação
  específica.” (art. 11, § 1º). **Leitura minha:** um registro de acesso que ligue um IP à página de ajuda em crise
  poderia revelar dado sensível. Vale conferir o que Vercel e Hugging Face guardam e por quanto tempo.
- **Se um dia houver ganho econômico:** “§ 4º É vedada a comunicação ou o uso compartilhado entre controladores de
  dados pessoais sensíveis referentes à saúde com objetivo de obter vantagem econômica,” […] (art. 11, § 4º, com
  exceções para serviços de saúde que não se aplicam ao projeto hoje).
- **Crianças e adolescentes:** “Art. 14. O tratamento de dados pessoais de crianças e de adolescentes deverá ser
  realizado em seu melhor interesse, nos termos deste artigo e da legislação pertinente.” e “§ 1º O tratamento de
  dados pessoais de crianças deverá ser realizado com o consentimento específico e em destaque dado por pelo menos um
  dos pais ou pelo responsável legal.” (art. 14, caput e § 1º). A ANPD fixou: “O tratamento de dados pessoais de
  crianças e adolescentes poderá ser realizado com base nas hipóteses legais previstas no art. 7º ou no art. 11 da Lei
  Geral de Proteção de Dados Pessoais (LGPD), desde que observado e prevalecente o seu melhor interesse, a ser avaliado
  no caso concreto, nos termos do art. 14 da Lei.” ([Enunciado CD/ANPD nº 1/2023][enunciado], acesso em 29/10/2026).
  Adolescentes podem usar o modo paciente; as sessões de usabilidade já preveem uma personagem de 17 anos. Sobre o
  Estatuto Digital da Criança e do Adolescente, o Planalto informa que a Lei nº 15.352 alterou a Lei nº 15.211/2025
  “para que o início da sua vigência seja dia 17 de março de 2026.” ([notícia do Planalto][lei15352], acesso em
  29/10/2026). Não o analisei.

## 5. Requisitos do consentimento e revogação (art. 8º)

- “Art. 8º O consentimento previsto no inciso I do art. 7º desta Lei deverá ser fornecido por escrito ou por outro
  meio que demonstre a manifestação de vontade do titular.” (art. 8º; [Câmara][lgpd], acesso em 29/10/2026).
- “§ 1º Caso o consentimento seja fornecido por escrito, esse deverá constar de cláusula destacada das demais
  cláusulas contratuais.” (art. 8º, § 1º).
- “§ 2º Cabe ao controlador o ônus da prova de que o consentimento foi obtido em conformidade com o disposto nesta
  Lei.” (art. 8º, § 2º).
- “§ 4º O consentimento deverá referir-se a finalidades determinadas, e as autorizações genéricas para o tratamento de
  dados pessoais serão nulas.” (art. 8º, § 4º).
- “§ 5º O consentimento pode ser revogado a qualquer momento mediante manifestação expressa do titular, por
  procedimento gratuito e facilitado, ratificados os tratamentos realizados sob amparo do consentimento anteriormente
  manifestado enquanto não houver requerimento de eliminação, nos termos do inciso VI do caput do art. 18 desta Lei.”
  (art. 8º, § 5º).
- “§ 6º Em caso de alteração de informação referida nos incisos I, II, III ou V do art. 9º desta Lei, o controlador
  deverá informar ao titular, com destaque de forma específica do teor das alterações, podendo o titular, nos casos em
  que o seu consentimento é exigido, revogá-lo caso discorde da alteração.” (art. 8º, § 6º).

**Leitura minha:**

- Um consentimento a cada envio, no próprio botão, com finalidade dita, combina com o “específica e destacada” do
  art. 11, I.
- O ponto difícil é o § 2º: como provar o consentimento sem guardar registro de quem consentiu? Uma saída possível,
  a confirmar, é provar pelo desenho: código e testes que impedem o envio sem a marcação e textos de consentimento
  versionados no repositório.
- A revogação (§ 5º) é simples no modelo atual, porque o texto é descartado e cada envio pede consentimento de novo.
- Mudanças no aviso de privacidade precisam ser destacadas (§ 6º). A página /privacidade já tem histórico de
  versões.

## 6. Informações que o titular deve receber (art. 9º)

- “Art. 9º O titular tem direito ao acesso facilitado às informações sobre o tratamento de seus dados, que deverão ser
  disponibilizadas de forma clara, adequada e ostensiva acerca de, entre outras características previstas em
  regulamentação para o atendimento do princípio do livre acesso:” (art. 9º; [Câmara][lgpd], acesso em 29/10/2026).
- “I - finalidade específica do tratamento; II - forma e duração do tratamento, observados os segredos comercial e
  industrial; III - identificação do controlador; IV - informações de contato do controlador;” (art. 9º, I a IV).
- “V - informações acerca do uso compartilhado de dados pelo controlador e a finalidade; VI - responsabilidades dos
  agentes que realizarão o tratamento; e VII - direitos do titular, com menção explícita aos direitos contidos no art.
  18 desta Lei.” (art. 9º, V a VII).
- “§ 1º Na hipótese em que o consentimento é requerido, esse será considerado nulo caso as informações fornecidas ao
  titular tenham conteúdo enganoso ou abusivo ou não tenham sido apresentadas previamente com transparência, de forma
  clara e inequívoca.” (art. 9º, § 1º).

**Leitura minha:** a página /privacidade já cobre finalidade, forma, duração e destinos. Faltam a
**identificação do controlador** (III) e o **contato** (IV): hoje ela diz só que o projeto é mantido por uma pessoa
física, e o e-mail depende de `NEXT_PUBLIC_CONTACT_EMAIL` estar configurado. Sem essas informações, um consentimento
pode ser questionado pelo § 1º.

## 7. Direitos do titular (art. 18)

- “Art. 18. O titular dos dados pessoais tem direito a obter do controlador, em relação aos dados do titular por ele
  tratados, a qualquer momento e mediante requisição:” (art. 18; [Câmara][lgpd], acesso em 29/10/2026).
- “I - confirmação da existência de tratamento; II - acesso aos dados; III - correção de dados incompletos, inexatos
  ou desatualizados; IV - anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em
  desconformidade com o disposto nesta Lei;” (art. 18, I a IV).
- “VI - eliminação dos dados pessoais tratados com o consentimento do titular, exceto nas hipóteses previstas no art.
  16 desta Lei; VII - informação das entidades públicas e privadas com as quais o controlador realizou uso
  compartilhado de dados;” (art. 18, VI e VII).
- “VIII - informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa; IX -
  revogação do consentimento, nos termos do § 5º do art. 8º desta Lei.” (art. 18, VIII e IX). O inciso V trata de
  portabilidade.
- “§ 5º O requerimento referido no § 3º deste artigo será atendido sem custos para o titular, nos prazos e nos termos
  previstos em regulamento.” (art. 18, § 5º).
- Quando o controlador não tem o dado: “I - comunicar que não é agente de tratamento dos dados e indicar, sempre que
  possível, o agente; ou” (art. 18, § 4º, I).
- Prazo da confirmação ou do acesso: “I - em formato simplificado, imediatamente; ou II - por meio de declaração clara
  e completa, que indique a origem dos dados, a inexistência de registro, os critérios utilizados e a finalidade do
  tratamento, observados os segredos comercial e industrial, fornecida no prazo de até 15 (quinze) dias, contado da
  data do requerimento do titular.” (art. 19, I e II).

**Leitura minha:** quase tudo fica no aparelho e pode ser apagado ali mesmo (`Apagar meus dados`). Por isso a
resposta a um pedido costuma ser *não guardamos seus dados; eles estão no seu navegador*. Isso combina com o § 4º, I.
Mesmo assim, é preciso um canal para receber o pedido (seção 10).

## 8. Transferência internacional (art. 33 e Resolução CD/ANPD nº 19/2024)

**A lei:**

- “Art. 33. A transferência internacional de dados pessoais somente é permitida nos seguintes casos: I - para países
  ou organismos internacionais que proporcionem grau de proteção de dados pessoais adequado ao previsto nesta Lei;”
  (art. 33, I; [Câmara][lgpd], acesso em 29/10/2026).
- “II - quando o controlador oferecer e comprovar garantias de cumprimento dos princípios, dos direitos do titular e
  do regime de proteção de dados previstos nesta Lei, na forma de: a) cláusulas contratuais específicas para
  determinada transferência; b) cláusulas-padrão contratuais;” (art. 33, II, a e b).
- **A hipótese do consentimento:** “VIII - quando o titular tiver fornecido o seu consentimento específico e em
  destaque para a transferência, com informação prévia sobre o caráter internacional da operação, distinguindo
  claramente esta de outras finalidades; ou” (art. 33, VIII).
- “IX - quando necessário para atender as hipóteses previstas nos incisos II, V e VI do art. 7º desta Lei.” (art. 33,
  IX). Esses incisos do art. 7º são obrigação legal, contrato de que o titular seja parte e exercício de direitos.
  **Leitura minha:** o do contrato talvez se discuta para o modo paciente, se houver termos de uso aceitos pela
  pessoa. Não serve para o modo profissional, em que o paciente não é parte de nada com o projeto.

**O regulamento da ANPD.** A página informa: “Observação: Este texto não substitui a publicação no DOU de 23/08/2024,
alterado pela RETIFICAÇÃO de 18/08/2025.” ([Res. 19/2024][res19], acesso em 29/10/2026).

- Ele não exclui o consentimento: “Parágrafo único. O disposto neste Regulamento não exclui a possibilidade da
  realização de transferência internacional de dados com base nos demais mecanismos previstos no art. 33 da Lei nº
  13.709, de 14 de agosto de 2018, que não dependam de regulamentação, desde que atendidas as especificidades do caso
  concreto e os requisitos legais aplicáveis.” (Res. 19/2024, Anexo I, art. 1º, parágrafo único; [gov.br/anpd][res19],
  acesso em 29/10/2026).
- Exige base legal e mecanismo: “Art. 9º A transferência internacional de dados somente poderá ser realizada para
  atender a propósitos legítimos, específicos, explícitos e informados ao titular, sem possibilidade de tratamento
  posterior de forma incompatível com essas finalidades, e desde que amparada em:” […] “I - uma das hipóteses legais
  previstas no art. 7º ou no art. 11 da Lei nº 13.709, de 14 de agosto de 2018; e” (art. 9º, caput e I). Entre os
  mecanismos estão os do art. 33: “c) nas hipóteses previstas nos incisos II, "d", e III a IX do art. 33 da Lei nº
  13.709, de 14 de agosto de 2018.” (art. 9º, II, c).
- Pede o mínimo: “Parágrafo único. A transferência internacional de dados deverá se limitar ao mínimo necessário para
  o alcance de suas finalidades, com abrangência dos dados pertinentes, proporcionais e não excessivos em relação às
  finalidades do tratamento de dados.” (art. 9º, parágrafo único).
- Definições: “III - transferência: operação de tratamento por meio da qual um agente de tratamento transmite,
  compartilha ou disponibiliza acesso a dados pessoais a outro agente de tratamento;” e “V - coleta internacional de
  dados: coleta de dados pessoais do titular efetuada diretamente pelo agente de tratamento localizado no exterior;”
  (art. 3º, III e V). E também: “Art. 6º A coleta internacional de dados não caracteriza transferência internacional
  de dados.” (art. 6º).
- **Destinos reconhecidos como adequados:** “Até o momento, a União Europeia foi considerada como organismo
  internacional adequado pelo Conselho Diretor da ANPD por meio da publicação da Resolução nº 32/2026.”
  ([Transferência Internacional de Dados, ANPD][tid], acesso em 29/10/2026). Sobre outros mecanismos aprovados caso a
  caso: “Até o momento, nenhum desses mecanismos foi aprovado pelo Conselho Diretor da ANPD.” (idem).

**Leitura minha, para o Stabilis:**

- O navegador manda o texto à Vercel, que o repassa ao Hugging Face. O controlador, no Brasil, “disponibiliza acesso”
  a operadores no exterior. Isso se parece mais com transferência (art. 3º, III) do que com “coleta internacional”,
  em que quem coleta é o próprio agente no exterior. Não é certo. Confirme também em que país rodam a função da
  Vercel e o Space do Hugging Face. Se for nos EUA, não há decisão de adequação, porque a única é a da União Europeia.
- **Modo paciente:** o consentimento a cada envio pode cumprir o art. 33, VIII. Para isso, o texto do consentimento
  precisa dizer, **antes** do envio, que o servidor fica fora do Brasil, e separar essa finalidade das outras.
- **Modo profissional:** o titular é o paciente, e quem clica é o profissional. O consentimento do profissional não é
  o do titular. Saídas possíveis, todas a confirmar:
  - garantir que o texto chegue **anonimizado** ao servidor, para que não seja dado pessoal (art. 12). É difícil de
    garantir com texto livre de anamnese, mesmo com o aviso atual para não incluir nome nem documentos;
  - processar no Brasil ou no próprio navegador, sem transferência;
  - usar cláusulas-padrão da ANPD num contrato com o operador. Com os termos padrão de Vercel e Hugging Face, isso
    não parece viável para uma pessoa física (não verifiquei os termos deles).

## 9. Registro das operações e relatório de impacto (arts. 37 e 38)

- “Art. 37. O controlador e o operador devem manter registro das operações de tratamento de dados pessoais que
  realizarem, especialmente quando baseado no legítimo interesse.” (art. 37; [Câmara][lgpd], acesso em 29/10/2026).
- “Art. 38. A autoridade nacional poderá determinar ao controlador que elabore relatório de impacto à proteção de
  dados pessoais, inclusive de dados sensíveis, referente a suas operações de tratamento de dados, nos termos de
  regulamento, observados os segredos comercial e industrial.” (art. 38).
- “Parágrafo único. Observado o disposto no caput deste artigo, o relatório deverá conter, no mínimo, a descrição dos
  tipos de dados coletados, a metodologia utilizada para a coleta e para a garantia da segurança das informações e a
  análise do controlador com relação a medidas, salvaguardas e mecanismos de mitigação de risco adotados.” (art. 38,
  parágrafo único).
- **Registro simplificado para pequeno porte:** “Art. 9º Os agentes de tratamento de pequeno porte podem cumprir a
  obrigação de elaboração e manutenção de registro das operações de tratamento de dados pessoais, constante do art. 37
  da LGPD, de forma simplificada. Parágrafo único. A ANPD fornecerá modelo para o registro simplificado de que trata o
  caput.” (Res. 2/2022, Anexo I, art. 9º; [gov.br/anpd][res2], acesso em 29/10/2026). Sobre o modelo, a ANPD diz: “O
  modelo simplificado contém apenas os campos considerados essenciais para que a Coordenação-Geral de Fiscalização da
  ANPD, caso necessite, receba desses agentes as informações básicas para o exercício das atividades fiscalizatórias.”
  ([notícia da ANPD sobre o modelo][modelo], acesso em 29/10/2026). **Leitura minha:** o
  [mapa-de-dados.md](mapa-de-dados.md) já cobre boa parte dos 8 campos do modelo.
- **RIPD ainda sem regulamento.** A ANPD orienta: “Enquanto não for editado regulamento específico sobre o RIPD, os
  controladores podem, no que couber, adotar como parâmetro o conceito de tratamento de alto risco definido no art. 4º
  do Regulamento de aplicação da LGPD para agentes de tratamento de pequeno porte, aprovado pela Resolução nº 2/2022.”
  e “Recomenda-se elaborar o RIPD antes de o controlador iniciar o tratamento dos dados pessoais para a finalidade
  desejada” ([RIPD, página da ANPD][ripd], acesso em 29/10/2026).
- **Situação do regulamento.** No balanço do 1º semestre de 2026, sobre o item do RIPD: “Encontra-se em finalização de
  elaboração do RAIR.” ([Balanço da Agenda Regulatória 2025-2026, 1º sem./2026][balanco], acesso em 29/10/2026). A
  proposta da agenda seguinte diz sobre o RIPD: “A manutenção decorre da necessidade de aprofundar a análise dos
  impactos regulatórios e consolidar a proposta de regulamentação” ([Nota Técnica nº 20/2026][nt20], acesso em
  29/10/2026). **Leitura minha:** não deve haver regulamento de RIPD antes de 2027.

## 10. Encarregado (art. 41) e a dispensa para pequeno porte

**A lei:**

- “Art. 41. O controlador deverá indicar encarregado pelo tratamento de dados pessoais.” e “§ 1º A identidade e as
  informações de contato do encarregado deverão ser divulgadas publicamente, de forma clara e objetiva,
  preferencialmente no sítio eletrônico do controlador.” (art. 41, caput e § 1º; [Câmara][lgpd], acesso em 29/10/2026).
- “§ 2º As atividades do encarregado consistem em: I - aceitar reclamações e comunicações dos titulares, prestar
  esclarecimentos e adotar providências; II - receber comunicações da autoridade nacional e adotar providências;”
  (art. 41, § 2º, I e II).
- “§ 3º A autoridade nacional poderá estabelecer normas complementares sobre a definição e as atribuições do
  encarregado, inclusive hipóteses de dispensa da necessidade de sua indicação, conforme a natureza e o porte da
  entidade ou o volume de operações de tratamento de dados.” (art. 41, § 3º).

**A dispensa (Resolução CD/ANPD nº 2/2022):**

- Pessoa física entra na definição de pequeno porte: “I - agentes de tratamento de pequeno porte: microempresas,
  empresas de pequeno porte, startups, pessoas jurídicas de direito privado, inclusive sem fins lucrativos, nos termos
  da legislação vigente, bem como pessoas naturais e entes privados despersonalizados que realizam tratamento de dados
  pessoais, assumindo obrigações típicas de controlador ou de operador;” (Res. 2/2022, Anexo I, art. 2º, I;
  [gov.br/anpd][res2], acesso em 29/10/2026).
- “Art. 11. Os agentes de tratamento de pequeno porte não são obrigados a indicar o encarregado pelo tratamento de
  dados pessoais exigido no art. 41 da LGPD.” e “§ 1º O agente de tratamento de pequeno porte que não indicar um
  encarregado deve disponibilizar um canal de comunicação com o titular de dados para atender o disposto no art. 41, §
  2º, I da LGPD.” (art. 11, caput e § 1º).
- **Mas a dispensa não vale para alto risco:** “Art. 3º Não poderão se beneficiar do tratamento jurídico diferenciado
  previsto neste Regulamento os agentes de tratamento de pequeno porte que: I - realizem tratamento de alto risco para
  os titulares, ressalvada a hipótese prevista no art. 8º;” (art. 3º, I). Os incisos II e III tratam de receita
  bruta acima dos limites legais e de grupo econômico.
- **O que é alto risco:** “Art. 4º Para fins deste regulamento, e sem prejuízo do disposto no art. 16, será
  considerado de alto risco o tratamento de dados pessoais que atender cumulativamente a pelo menos um critério geral e
  um critério específico, dentre os a seguir indicados:” (art. 4º, caput). Os critérios gerais: “a) tratamento de
  dados pessoais em larga escala; ou b) tratamento de dados pessoais que possa afetar significativamente interesses e
  direitos fundamentais dos titulares;” (art. 4º, I). Entre os critérios específicos: “a) uso de tecnologias
  emergentes ou inovadoras;” e “d) utilização de dados pessoais sensíveis ou de dados pessoais de crianças, de
  adolescentes e de idosos.” (art. 4º, II, a e d).
- O “afetar significativamente” é explicado assim: “§ 2º O tratamento de dados pessoais que possa afetar
  significativamente interesses e direitos fundamentais será caracterizado, dentre outras situações, naquelas em que a
  atividade de tratamento puder impedir o exercício de direitos ou a utilização de um serviço, assim como ocasionar
  danos materiais ou morais aos titulares, tais como discriminação,” […] (art. 4º, § 2º).
- **O exemplo da própria ANPD**, sobre uma empresa pequena que trata dados de saúde de idosos: “Considerando que esses
  dados são classificados como sensíveis e o contexto de vulnerabilidade dos titulares, o tratamento realizado poderá
  afetar significativamente os interesses e direitos fundamentais dos titulares, impedir o exercício de direitos,
  ocasionar danos morais, discriminação, dentre outras situações.” A conclusão: “Por isso, ainda que o controlador
  seja classificado como agente de tratamento de pequeno porte, deverá indicar um encarregado.” (Guia orientativo
  Atuação do encarregado, 2024, exemplo 2; [gov.br/anpd][guiaenc], acesso em 29/10/2026).

**A Resolução CD/ANPD nº 18/2024 (atuação do encarregado):**

- “§ 3º Os Agentes de Tratamento de Pequeno Porte dispensados de indicar encarregado devem disponibilizar um canal de
  comunicação com o titular de dados, nos termos do art. 11 do Regulamento de aplicação da LGPD para Agentes de
  Tratamento de Pequeno Porte, aprovado pela Resolução CD/ANPD nº 2, de 27 de janeiro de 2022.” (Res. 18/2024, Anexo,
  art. 3º, § 3º; [processo no gov.br/anpd][res18], acesso em 29/10/2026).
- “Art. 9º A identidade e as informações de contato do encarregado deverão ser divulgadas publicamente, de forma clara
  e objetiva, em local de destaque e de fácil acesso, no sítio eletrônico do agente de tratamento, ressalvada a
  hipótese do § 3º deste artigo.” (art. 9º).
- “Art. 12. O encarregado poderá ser: I - uma pessoa natural, integrante do quadro organizacional do agente de
  tratamento ou externo a esse; ou II - uma pessoa jurídica.” (art. 12).
- Sobre conflito de interesse, ele pode se configurar: “II - com o acúmulo das atividades de encarregado com outras
  que envolvam a tomada de decisões estratégicas sobre o tratamento de dados pessoais pelo controlador, ressalvadas as
  operações com dados pessoais inerentes às atribuições do encarregado.” (art. 19, § 1º, II).

**Leitura minha, para o Stabilis:**

- Quando o Stabilis recebe texto de saúde (extração no profissional; ajuda ao relato no paciente, se ligada), o
  critério específico de dados sensíveis é atendido. O modelo de linguagem pode contar também como “tecnologias
  emergentes ou inovadoras”. O critério geral “larga escala” provavelmente não é atendido hoje. Já o “afetar
  significativamente” pode ser, a julgar pelo exemplo da ANPD (dados de saúde e vulnerabilidade). **Se for alto risco, o Stabilis perde
  o regime de pequeno porte: precisa de encarregado e segue os prazos normais.**
- Se os dados ficam só no navegador e nada é enviado, talvez não haja tratamento pelo mantenedor (seção 3). Os
  rascunhos do projeto, porém, já tratam o projeto como controlador.
- **Pode o mantenedor ser o próprio encarregado?** A Res. 18/2024 admite pessoa natural interna (art. 12). Mas
  aponta conflito de interesse quando o encarregado também toma as decisões estratégicas (art. 19, § 1º, II), e numa
  pessoa física sozinha é exatamente isso. Não encontrei resposta expressa. É uma pergunta em aberto.
- Em qualquer cenário, **um canal de contato publicado é obrigatório**: o do encarregado (art. 41, § 1º) ou o canal
  do pequeno porte (Res. 2/2022, art. 11, § 1º).

**O que pode mudar.** A ANPD prepara um guia sobre alto risco: “O item 7 retrata a iniciativa de elaboração de Guia
sobre Definição de alto risco e larga escala e tem por objetivo elucidar os conceitos de alto risco e de larga escala à
sociedade no contexto do tratamento de dados pessoais” e “A versão final encontra-se no Conselho Diretor para
aprovação.” ([Balanço da Agenda Regulatória, 1º sem./2026][balanco], acesso em 29/10/2026). Não procurei se o guia
saiu depois desse balanço. A proposta da agenda seguinte sugere juntar o tema ao do relatório de impacto: “sugere-se a
incorporação desta iniciativa à ação regulatória do Relatório de Impacto à Proteção de Dados Pessoais (RIPD) na
Agenda Regulatória 2027/2028.” ([Nota Técnica nº 20/2026][nt20], acesso em 29/10/2026). Confira na ANPD antes de
decidir sobre o encarregado.

## 11. Segurança e incidentes (arts. 46 a 48)

- “Art. 46. Os agentes de tratamento devem adotar medidas de segurança, técnicas e administrativas aptas a proteger os
  dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração,
  comunicação ou qualquer forma de tratamento inadequado ou ilícito.” (art. 46; [Câmara][lgpd], acesso em 29/10/2026).
- “§ 2º As medidas de que trata o caput deste artigo deverão ser observadas desde a fase de concepção do produto ou do
  serviço até a sua execução.” (art. 46, § 2º).
- “Art. 48. O controlador deverá comunicar à autoridade nacional e ao titular a ocorrência de incidente de segurança
  que possa acarretar risco ou dano relevante aos titulares.” (art. 48). O procedimento está no regulamento que
  “Aprova o Regulamento de Comunicação de Incidente de Segurança.” (Resolução CD/ANPD nº 15/2024;
  [lista de regulamentações da ANPD][regs], acesso em 29/10/2026), que não analisei. O pequeno porte tem prazo em
  dobro: “II - no caso da comunicação, à ANPD e ao titular, da ocorrência de incidente de segurança que possa acarretar
  risco ou dano relevante aos titulares, nos termos do Regulamento de Comunicação de Incidente de Segurança, aprovado
  pela Resolução CD/ANPD nº 15, de 24 de abril de 2024;” (Res. 2/2022, Anexo I, art. 14, II; [gov.br/anpd][res2]).
- Política simplificada para pequeno porte: “Art. 13. Os agentes de tratamento de pequeno porte podem estabelecer
  política simplificada de segurança da informação, que contemple requisitos essenciais e necessários para o
  tratamento de dados pessoais,” […] (Res. 2/2022, Anexo I, art. 13). A ANPD tem um guia e uma lista de verificação
  próprios: “Acesse aqui o Checklist de medidas de segurança para agentes de tratamento de pequeno porte.” ([Guia de
  segurança para pequeno porte][guiaseg], acesso em 29/10/2026).
- Responsabilidade civil, para ter em mente: “Art. 42. O controlador ou o operador que, em razão do exercício de
  atividade de tratamento de dados pessoais, causar a outrem dano patrimonial, moral, individual ou coletivo, em
  violação à legislação de proteção de dados pessoais, é obrigado a repará-lo.” (art. 42; [Câmara][lgpd]).

## 12. Resolução CD/ANPD nº 2/2022: o que muda para uma pessoa física de pequeno porte

Tudo abaixo vale **só se** o tratamento não for de alto risco (art. 3º, I) e se a ANPD não determinar o contrário. A
resolução diz: “Art. 16. A ANPD poderá determinar ao agente de tratamento de pequeno porte o cumprimento das
obrigações dispensadas ou flexibilizadas neste regulamento, considerando as circunstâncias relevantes da situação,
tais como a natureza ou o volume das operações, bem como os riscos para os titulares.” (Res. 2/2022, Anexo I, art. 16;
[gov.br/anpd][res2], acesso em 29/10/2026).

| Tema | O que a resolução permite | Citação |
|---|---|---|
| Encarregado | dispensa, com canal de contato | art. 11, citado na seção 10 |
| Registro das operações | forma simplificada, com modelo da ANPD | art. 9º, citado na seção 9 |
| Atendimento ao titular | por meio eletrônico, impresso ou outro | “Art. 7º Os agentes de tratamento de pequeno porte devem disponibilizar informações sobre o tratamento de dados pessoais e atender às requisições dos titulares em conformidade com o disposto nos arts. 9º e 18 da LGPD, por meio:” (art. 7º) |
| Prazos | em dobro para pedidos de titulares, incidentes e declaração completa; 15 dias para a declaração simplificada | “Art. 15. Os agentes de tratamento de pequeno porte podem fornecer a declaração simplificada de que trata o art. 19, I, da LGPD no prazo de até quinze dias, contados da data do requerimento do titular.” (art. 15) |
| Segurança | política simplificada | art. 13, citado na seção 11 |
| O que não muda | princípios, bases legais e direitos | “Art. 6º A dispensa ou flexibilização das obrigações dispostas neste regulamento não isenta os agentes de tratamento de pequeno porte do cumprimento dos demais dispositivos da LGPD, inclusive das bases legais e dos princípios,” […] (art. 6º) |

## 13. O que isso significa para o Stabilis

Lista de verificação. Os itens marcados **(incerto)** dependem de interpretação ou de resposta de um profissional
do direito.

**Identificação e contato**

- [ ] Preencher o nome do controlador e publicar um contato em /privacidade. Configurar `NEXT_PUBLIC_CONTACT_EMAIL`,
  já previsto no [ripd.md](ripd.md). Base: art. 9º, III e IV; art. 41, § 1º, ou Res. 2/2022, art. 11, § 1º.
- [ ] Decidir sobre o encarregado: indicar alguém e publicar o nome completo e o contato (Res. 18/2024, art. 9º), ou
  registrar o fundamento da dispensa (Res. 2/2022, art. 11). **(incerto)** A dispensa só vale se o tratamento não for
  de alto risco (Res. 2/2022, arts. 3º e 4º). Também não está claro se o próprio mantenedor pode ser o encarregado
  sem conflito de interesse (Res. 18/2024, art. 19, § 1º, II).

**Base legal e consentimento**

- [ ] Manter o consentimento específico e destacado a cada envio de texto de saúde (art. 11, I; art. 8º, § 4º).
  Garantir que ele diga, antes, que o servidor fica fora do Brasil, separado das outras finalidades (art. 33, VIII).
- [ ] Documentar como se prova o consentimento sem guardar dados pessoais (art. 8º, § 2º): código, testes e textos
  versionados. **(incerto)** Não há orientação específica.
- [ ] Manter revogação simples e destacar mudanças no aviso (art. 8º, §§ 5º e 6º).
- [ ] Decidir e escrever, nos termos de uso, qual é o papel do mantenedor no modo profissional: operador do
  profissional ou controlador do próprio serviço (art. 5º, VI e VII; art. 39). **(incerto)**

**Transferência internacional**

- [ ] Confirmar em que país rodam a função da Vercel e o Space do Hugging Face. Se for fora da União Europeia, não há
  decisão de adequação.
- [ ] Modo profissional: escolher um caminho para o texto do paciente. As opções são anonimização efetiva antes do
  envio (art. 12), processamento no Brasil ou no navegador, ou cláusulas-padrão (Res. 19/2024). **(incerto)** É o ponto
  mais frágil hoje, porque o consentimento do profissional não substitui o do paciente.
- [ ] Manter o envio limitado ao mínimo necessário (Res. 19/2024, art. 9º, parágrafo único). Isso já é feito: só o
  texto, descartado depois.

**Registro, relatório e segurança**

- [ ] Manter o [mapa-de-dados.md](mapa-de-dados.md) como registro das operações. Se o regime de pequeno porte valer,
  conferir com os 8 campos do modelo da ANPD (art. 37; Res. 2/2022, art. 9º).
- [ ] Concluir e assinar o [ripd.md](ripd.md) antes de ligar a ajuda ao relato no modo paciente. A ANPD recomenda o
  relatório antes de começar um tratamento que pode ser de alto risco (página do RIPD). Ainda não há regulamento.
- [ ] Verificar o que Vercel, Hugging Face e Upstash registram (IP, página, horário) e por quanto tempo. Reduzir o que
  for possível (art. 11, § 1º; art. 46). **(incerto)** Não sei se as contas gratuitas permitem configurar isso.
- [ ] Escrever um plano curto de incidente (art. 48; Res. 15/2024, não analisada; prazo em dobro se o regime de
  pequeno porte valer). Usar a lista de verificação de segurança da ANPD para pequeno porte (art. 46; Res. 2/2022,
  art. 13).

**Públicos e cenários especiais**

- [ ] Decidir como tratar adolescentes e crianças: aviso de idade e envio de texto bloqueado para menores, por
  exemplo (art. 14; Enunciado CD/ANPD nº 1/2023). **(incerto)** O Estatuto Digital da Criança e do Adolescente, em
  vigor desde 17/03/2026, não foi analisado.
- [ ] Ditado por voz: o áudio vai à empresa do navegador. O aviso já existe. **(incerto)** Não está claro se o
  mantenedor tem responsabilidade por esse fluxo, que ele não recebe.
- [ ] Se o projeto virar comercial, rever tudo. Há a vedação a compartilhar dados de saúde para obter vantagem
  econômica (art. 11, § 4º) e os limites de receita do pequeno porte (Res. 2/2022, art. 3º, II). A exceção do uso
  particular continua não se aplicando ao serviço (art. 4º, I).

**A quem perguntar.** A ANPD avisa que “A ANPD não responde individualmente consultas jurídicas em tese ou que
demandem a emissão de pronunciamento específico sobre uma condição hipotética ou concreta.” e acrescenta: “Não
obstante, o controlador pode encaminhar suas dúvidas e questionamentos para a ANPD, por meio do endereço eletrônico
ouvidoria@anpd.gov.br.” ([RIPD, página da ANPD][ripd], acesso em 29/10/2026). Na prática, as dúvidas marcadas como
incertas acima pedem um profissional do direito.

> **Lembrete:** este documento não é aconselhamento jurídico. Ele organiza textos oficiais e aponta dúvidas. As
> decisões sobre base legal, encarregado e transferência internacional pedem orientação de um profissional do
> direito. Confira as citações da LGPD no Planalto, que não pude acessar.

## 14. Fontes (todas acessadas em 29/10/2026)

- **LGPD, texto atualizado da Câmara dos Deputados** (usado no lugar do Planalto, que bloqueou o acesso):
  <https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html>
- **LGPD no Planalto** (endereço oficial; **não acessado**): <https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm>
- **Notícia do Planalto sobre a Lei nº 15.352/2026:**
  <https://www.gov.br/planalto/pt-br/acompanhe-o-planalto/noticias/2026/02/presidente-lula-sanciona-lei-que-cria-a-agencia-nacional-de-protecao-de-dados>
- **Regulamentações da ANPD** (lista e situação de cada norma):
  <https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd>
- **Resolução CD/ANPD nº 2/2022** (agentes de tratamento de pequeno porte):
  <https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022>
- **Resolução CD/ANPD nº 18/2024** (encarregado), processo com o documento assinado:
  <https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/processo_integra_-resolucao_cd_anpd_no_18_2024.pdf/@@display-file/file>.
  A publicação no DOU, indicada pela ANPD, não foi acessada:
  <https://www.in.gov.br/en/web/dou/-/resolucao-cd/anpd-n-18-de-16-de-julho-de-2024-572632074>
- **Resolução CD/ANPD nº 19/2024** (transferência internacional):
  <https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024>
- **Transferência Internacional de Dados** (decisões de adequação; Resolução nº 32/2026):
  <https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados>
- **Guia orientativo Atuação do encarregado** (dezembro de 2024):
  <https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/copy_of_guia_da_atuacao_do_encarregado_anpd.pdf/@@display-file/file>
- **RIPD, perguntas e respostas da ANPD:**
  <https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd>
- **Balanço da Agenda Regulatória 2025-2026, 1º semestre de 2026:**
  <https://www.gov.br/anpd/pt-br/assuntos/regulacao/agenda-regulatoria-1/agenda-regulatoria-2025-2026/balanco-agenda-regulatoria-2025-2026-01-2026.pdf/@@display-file/file>
- **Nota Técnica nº 20/2026** (proposta de Agenda Regulatória 2027-2028):
  <https://www.gov.br/anpd/pt-br/acesso-a-informacao/participacao-social/outras-acoes/ts-04-2026-nota-tecnica-no-20-2026.pdf/@@display-file/file>
- **Enunciado CD/ANPD nº 1/2023** (crianças e adolescentes):
  <https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes/Enunciado1ANPD.pdf/@@display-file/file>
- **Modelo de registro simplificado para pequeno porte:**
  <https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-modelo-de-registro-simplificado-de-operacoes-com-dados-pessoais-para-agentes-de-tratamento-de-pequeno-porte-atpp>
- **Guia de segurança da informação para pequeno porte:**
  <https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte>

[lgpd]: https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html
[lei15352]: https://www.gov.br/planalto/pt-br/acompanhe-o-planalto/noticias/2026/02/presidente-lula-sanciona-lei-que-cria-a-agencia-nacional-de-protecao-de-dados
[regs]: https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd
[res2]: https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022
[res18]: https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/processo_integra_-resolucao_cd_anpd_no_18_2024.pdf/@@display-file/file
[res19]: https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024
[tid]: https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados
[guiaenc]: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/copy_of_guia_da_atuacao_do_encarregado_anpd.pdf/@@display-file/file
[ripd]: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd
[balanco]: https://www.gov.br/anpd/pt-br/assuntos/regulacao/agenda-regulatoria-1/agenda-regulatoria-2025-2026/balanco-agenda-regulatoria-2025-2026-01-2026.pdf/@@display-file/file
[nt20]: https://www.gov.br/anpd/pt-br/acesso-a-informacao/participacao-social/outras-acoes/ts-04-2026-nota-tecnica-no-20-2026.pdf/@@display-file/file
[enunciado]: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes/Enunciado1ANPD.pdf/@@display-file/file
[modelo]: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-modelo-de-registro-simplificado-de-operacoes-com-dados-pessoais-para-agentes-de-tratamento-de-pequeno-porte-atpp
[guiaseg]: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte
