# Relatórios da avaliação

Cada `*.json` é a saída de `eval/run_eval.py`: só métricas e ids do gold set, nunca os textos. O campo
`model` traz o repositório, o arquivo, o commit exato do GGUF medido e o prompt usado.

- `producao.json`: a linha de base atual, o modelo do Space medido com o que está no ar. É ela que os portões
  relativos da etapa 7 usam (`run_eval.py --baseline eval/reports/producao.json`).
- `etapa4/`: a comparação que escolheu o modelo base, descrita abaixo.

## Linha de base atual (2026-11-06)

`producao.json` é o Gemma 2 9B do Space com o prompt corrigido, o léxico de crise 0.3.0, o `llama-cpp-python`
0.3.36 e a checagem de contexto valendo também para os itens do modelo (publicada no Space em 2026-11-06).

| riscos perdidos (de 66) | críticos perdidos (de 28) | alarme falso | itens sem evidência | F1 condições | F1 hábitos | F1 remédios | sugestões indevidas |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 9% | 46% | 0,33 | 0,27 | 0,97 | 0 |

Na linha de base anterior (2026-10-31), a checagem de contexto só valia para os remédios achados pelo léxico,
e o modelo sugeria 3 itens indevidos. O texto que continua perdido é o crítico do veneno de rato guardado.

## Etapa 7, rodada 1: Gemma 4 E2B ajustado com a v1 (2026-11-05)

`candidato.json` (qualidade, no Mac, com `EXTRACTION_PROMPT=short`) e `latencia-candidato.json` (no Space, com
o modelo trocado temporariamente e depois devolvido ao de produção). O candidato **não** foi promovido.

| portão | meta | candidato | situação |
|---|---|---|---|
| recall de risco, no geral e no subconjunto crítico | ≥ 0,98 e 100% | 65 de 66, 28 de 28 | passa |
| F1 por grupo | ≥ linha de base | condições 0,51, hábitos 0,73, remédios 0,99 | passa |
| sugestões indevidas | ≤ linha de base | 1, já corrigida no código (eram 13 antes da checagem de contexto) | quase |
| p95 aquecido do paciente | ≤ 40 s | 39,5 s (mediana 24 s) | passa, no limite |
| p95 aquecido do profissional | ≤ 60 s | 221 s (mediana 39 s) | falha |
| partida | ≤ 3 min | cerca de 74 s (download 65 s, carga 2 s) | passa |
| JSON válido | 100% | 99,4% | falha |
| itens sem evidência | ≤ 1% | 26% | falha |

- **Causa comum das três falhas:** a v1 não tem textos sem nada sobre a própria pessoa. Diante deles, o modelo
  inventa itens com evidência "nenhuma" ou "não especificado" e às vezes repete até o limite de tokens, o que
  também explica a cauda de 221 s nas anamneses.
- **Sugestões indevidas:** eram remédios e hábitos de terceiros, recusados ou só planejados, que o schema não
  marca e a v1 não mostra. A checagem de contexto passou a valer para os itens do modelo, e a v2 dos dados traz
  esses casos fora do rótulo (`datagen/README.md`).
- **Comparação com a produção:** o candidato não perde nenhum texto crítico, enquanto a produção perde um. O
  alarme falso também é menor, 7,6% contra 9,5%.

## Etapa 4: linha de base e escolha do modelo base (2026-10-31)

**Como foi medido**
- gold set v0 (sha256 `57bc8845…`, 330 textos), prompt completo, léxico de crise 0.2.0 e modelos sem ajuste;
- num Mac M1 Pro com GPU (Metal), por isso os tempos destes relatórios **não valem** para os portões de latência,
  que só se medem no Space;
- `llama-cpp-python` 0.3.18 (a versão fixada no Space) para todos, exceto o Gemma 4, que exige 0.3.25 ou mais
  e foi medido com a 0.3.36;
- antes desta rodada, a regra 4 do prompt (`core/extraction/prompt.py`) só definia `"experiencer": "other"`. Os
  modelos pequenos marcavam tudo como "de outra pessoa", e o pipeline descartava tudo. A regra passou a definir os
  dois lados, e a nova regra 10 evita repetições que cortavam o JSON no limite de tokens. Todos os relatórios
  aqui são do prompt corrigido.

| modelo | tamanho (Q4_K_M) | JSON válido | riscos perdidos (de 66) | críticos perdidos (de 28) | alarme falso | itens sem evidência | F1 condições | F1 hábitos | F1 remédios | sugestões indevidas |
|---|---|---|---|---|---|---|---|---|---|---|
| só o léxico, sem modelo | — | — | 7 | 4 | 6% | — | 0 | 0 | 0,93 | 0 |
| `producao` (Gemma 2 9B, o do Space) | 5,4 GB | 100% | 3 | 3 | 9% | 46% | 0,33 | 0,27 | 0,96 | 3 |
| `gemma-4-e2b` | 2,9 GB (≈2B efetivos) | 100% | 0 | 0 | 31% | 3% | 0,73 | 0,82 | 0,98 | 14 |
| `gemma-4-e4b` | 4,6 GB (≈4B efetivos) | 99% | 1 | 1 | 9% | 2% | 0,77 | 0,89 | 0,98 | 4 |
| `qwen3.5-4b` | 2,6 GB | 95% | 0 | 0 | 13% | 6% | 0,44 | 0,71 | 0,98 | 9 |
| `qwen3-4b-2507` | 2,3 GB | 91% | 3 | 2 | 17% | 19% | 0,39 | 0,51 | 0,98 | 6 |
| `ministral-3-3b` | 2,0 GB | 100% | 2 | 1 | 12% | 10% | 0,53 | 0,53 | 0,97 | 1 |
| `qwen3.5-2b` | 1,2 GB | 37% | 7 | 4 | 6% | 5% | 0 | 0,39 | 0,96 | 0 |

**Leitura**
- **Modelo em produção:** é o pior em evidência (46% dos itens citam trechos que não estão no texto, contra um
  limite de 1%) e, junto com o léxico, perde 3 dos 28 textos críticos. O modelo ajustado tem de superar
  `producao.json`, não os números sem ajuste.
- **Gemma 4 E2B e Qwen3.5-4B:** são os únicos que não perdem nenhum texto de risco, nem no geral nem no
  subconjunto crítico. O Gemma 4 E2B vai bem melhor em condições e hábitos, e tem cerca de metade do custo de
  processamento.
- **Defeitos do Gemma 4 E2B sem ajuste:** alarme falso (31%) e sugestões indevidas (14) altos. São exatamente o
  que os dados de treino ensinam (negação, outra pessoa, negativos difíceis), e devem ser acompanhados na etapa 7.
- **Gemma 4 E4B:** tem o melhor F1, mas perde um texto crítico e custa cerca do dobro do E2B nos 2 vCPUs.
- **Qwen3.5-2B:** gera JSON inválido em 63% dos textos (repetição até o limite) e não acrescenta nada ao léxico.

**Escolha: Gemma 4 E2B (`unsloth/gemma-4-E2B-it`)**, pelo critério do roteiro (recall de risco no geral e no
subconjunto crítico, depois F1 por grupo) e por ser o menor dos dois finalistas, o que importa para caber em
40 s nos 2 vCPUs. Isso exigiu atualizar o `llama-cpp-python` do Space de 0.3.18 para 0.3.36, feito em
2026-10-31, e medir `producao.json` de novo nessa versão, para a comparação da etapa 7 continuar justa (veja a
linha de base atual).

**Alternativa sem atualizar:** Qwen3.5-4B (`unsloth/Qwen3.5-4B`), que roda na 0.3.18, também não perde risco,
mas erra mais em condições (121 falsos positivos) e custa cerca do dobro em processamento.

**Ressalvas**
- O gold set e os dados de treino são sintéticos, então os números tendem a ser otimistas.
- O léxico de crise 0.2.0 foi ampliado a partir da v0, então os números dele aqui não são independentes.
- Os relatórios antigos, com o prompt de antes da correção, ficaram fora do repositório.

**Achado à parte:** sem modelo, o léxico perde 4 textos críticos, todos de forma indireta ou pelo meio usado:
- "comprei veneno de rato e escondi no armário pra quando eu decidir";
- "ontem fiquei horas na ponte pensando em pular";
- "vou acabar com isso hoje, não aguento mais";
- "tomei 20 comprimidos de amitriptilina sábado, fiquei internada 3 dias".

No modo paciente, o questionário de risco (ASQ) continua sendo a triagem principal.

**Léxico 0.3.0 (2026-10-31):** a resposta a esse achado.
- **O que entrou:** frases de sinais de alerta ("sou um peso pra", "melhor sem mim", "quando eu não estiver mais
  aqui") e de meios (lugares altos, veículo, veneno, enforcamento, arma de fogo, superdosagem), mais a sigla TAE
  no modo profissional. A marcação `{10+}` casa com qualquer número a partir de 10, então "tomei 20 comprimidos"
  dispara e "tomei 2 comprimidos" não.
- **O que ficou de fora:** expressões ambíguas demais num relato, como "comprei veneno" (aparece com pragas) e
  "corda no pescoço" (aparece com dívidas).
- **Vetores:** 29 novos, positivos e negativos difíceis, escritos fora da v0.
- **Resultado sozinho na v0:** perde 2 dos 66 textos de risco e 1 dos 28 críticos (eram 7 e 4), sem alarme falso
  a mais. Não é um número independente, porque os erros da v0 eram conhecidos.

## Etapa 7, rodada 2: Gemma 4 E2B ajustado com a v1 e a v2 (2026-11-09)

`candidato-v2.json`: `stabilis-extrator-v2.Q4_K_M.gguf`, commit `01785fd6`, 3 épocas, 556 exemplos de treino.
Medido no Mac com `EXTRACTION_PROMPT=short`. O candidato **não** foi promovido.

| | JSON válido | riscos perdidos (críticos) | alarme falso | itens sem evidência | F1 condições | F1 hábitos | F1 remédios | sugestões indevidas |
|---|---|---|---|---|---|---|---|---|
| produção | 100% | 1 (1) | 9,5% | 46% | 0,33 | 0,27 | 0,970 | 0 |
| rodada 1 | 99,4% | 1 (0) | 7,6% | 26% | 0,51 | 0,73 | 0,988 | 0 (com a checagem final) |
| rodada 2 | 100% | 2 (1) | 6,8% | 17% | 0,71 | 0,56 | 0,966 | 0 |

- **O que a v2 resolveu:** o JSON ficou 100% válido, não há sugestões indevidas, e os itens de preenchimento
  ("nenhuma") quase sumiram.
- **Portões que falharam:**
  - recall de risco 0,97 e crítico 0,96: perdeu o texto do veneno de rato, que a rodada 1 pegava;
  - itens sem evidência: 17%;
  - F1 de remédios: 0,966 contra 0,970 da produção.
- **Causa encontrada:** os rótulos de treino traziam a evidência como último campo de cada item. A gramática do
  llama.cpp, porém, impõe a ordem do schema, com a evidência em segundo lugar. Na posição em que a gramática
  pedia a evidência, o modelo escrevia o campo que aprendeu a pôr ali, como a situação do remédio
  (`"evidence": "current"`). Isso afetou as duas rodadas. `finetune/prepare.py` agora grava as respostas de treino
  na ordem do schema, sem precisar gerar dados de novo.
