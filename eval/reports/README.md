# Relatórios da avaliação

Cada `*.json` é a saída de `eval/run_eval.py`: só métricas e ids do gold set, nunca os textos. O campo
`model` traz o repositório, o arquivo, o commit exato do GGUF medido e o prompt usado.

- `producao.json`: a linha de base atual, o modelo do Space medido com o que está no ar. É ela que os portões
  relativos da etapa 7 usam (`run_eval.py --baseline eval/reports/producao.json`).
- `etapa4/`: a comparação que escolheu o modelo base, descrita abaixo.

## Linha de base atual (2026-10-31)

`producao.json` é o Gemma 2 9B do Space com o prompt corrigido, o léxico de crise 0.3.0 e o `llama-cpp-python`
0.3.36, o que está no ar desde 2026-10-31.

| riscos perdidos (de 66) | críticos perdidos (de 28) | alarme falso | itens sem evidência | F1 condições | F1 hábitos | F1 remédios | sugestões indevidas |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 9% | 46% | 0,33 | 0,27 | 0,96 | 3 |

As métricas do próprio modelo são idênticas às medidas com a 0.3.18 na etapa 4, ou seja, a atualização não
mudou o que ele responde. O ganho em risco (eram 3 perdidos) veio do léxico 0.3.0. O texto que continua perdido
é o crítico do veneno de rato guardado.

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
