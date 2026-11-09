# Dados sintéticos para a extração (trilha LLM, etapa L2)

Gera exemplos de treino para o modelo que lê textos de pacientes e anamneses. A ordem é **estrutura
primeiro**:

1. `profiles.py` sorteia, com semente, uma *ficha*: o que o texto precisa dizer (sintomas, condições,
   remédios com o nome como a pessoa escreveria, risco, gravidez), inclusive itens negados, sobre
   outra pessoa, passados ou hipotéticos. O rótulo de treino sai daqui, não do texto.
2. Um modelo **professor** escreve o texto no estilo da ficha (WhatsApp, áudio transcrito, anamnese
   telegráfica…) e cita, para cada item, o trecho literal que o expressa.
3. O código confere que cada trecho está mesmo no texto.
4. Um modelo **juiz de outra família** confere item por item e aponta informação clínica a mais;
   qualquer falha descarta o exemplo.
5. `noise.py` aplica ruído determinístico (sem acento, abreviações, erros de digitação) no texto e
   nas evidências ao mesmo tempo.
6. `dedupe.py` remove quase-duplicatas e qualquer texto parecido com o gold set humano (`eval/gold/`).
7. `split.py` separa personas inteiras para validação e teste e descarta do treino as combinações de
   fatos que aparecem no teste.

## Como rodar

Localmente ou num notebook do Kaggle, **nunca** como Action agendada. O script confere no início se os
modelos existem no provedor e falha alto se não existirem.

```bash
export DATAGEN_TEACHER_BASE_URL=https://api.groq.com/openai/v1
export DATAGEN_TEACHER_MODEL=openai/gpt-oss-120b     # Apache 2.0
export DATAGEN_TEACHER_API_KEY=...                    # nunca comitar
export DATAGEN_JUDGE_BASE_URL=https://api.groq.com/openai/v1
export DATAGEN_JUDGE_MODEL=qwen/qwen3.8-27b           # outra família (confira a licença no model card)
export DATAGEN_JUDGE_API_KEY=...
export DATAGEN_TEACHER_REASONING_EFFORT=low           # opcional; gasta menos tokens (gpt-oss)
python -m datagen.run --n 500 --seed 1 --out datagen/out/v1
```

Cada exemplo é gravado em `datagen/out/<versão>/progress.jsonl` assim que fica pronto. Planos gratuitos têm
limite por minuto e por dia: o cliente espera o tempo que o provedor pede (`Retry-After`, até 30 minutos por
vez) e, se o provedor continuar falhando, a geração para (código 3) e o mesmo comando continua de onde parou,
com o mesmo resultado de uma geração sem interrupção. Um `--n` maior estende uma geração já terminada. Comece
com `--n 100` e leia `stats.json` (taxa de aprovação e motivos de rejeição) antes de gerar milhares.

**Ritmo no plano gratuito da Groq (medido em 2026-10-31):**
- **Limites do professor:** o `gpt-oss-120b` tem 200 mil tokens por dia, 8 mil por minuto e mil pedidos por dia.
- **Custo por exemplo:** cerca de 2 mil tokens do professor, então dá umas 100 tentativas por dia.
- **Raciocínio baixo:** `DATAGEN_TEACHER_REASONING_EFFORT=low` gasta menos tokens escondidos por resposta.
- **Retomada automática:** para rodar até o fim, repita o comando enquanto ele sair com código 3.

```bash
until python -m datagen.run --n 1000 --seed 1 --out datagen/out/v1; [ $? -ne 3 ]; do sleep 1800; done
```

O progresso registra a versão do prompt (`PROMPT_VERSION` em `prompts.py`). Mudou o prompt, mude a versão: a
retomada recusa misturar versões na mesma pasta.

**Opções da v2** (as duas valem 0 por padrão, o que reproduz as fichas da v1):
- `--distractors 0.5`: metade das fichas cita também um remédio de outra pessoa, recusado ou só planejado, ou um
  hábito de outra pessoa. Ele aparece no texto e fica **fora** do rótulo, porque os itens de remédio e de
  substância não têm o campo "outra pessoa" e o modelo precisa aprender a não listá-los.
- `--empty-share 0.3`: 30% das fichas não têm nada sobre a própria pessoa, só terceiros, negações e esses
  distratores, e algumas nem têm informação clínica. Sem esses casos, o modelo ajustado com a v1 inventava itens
  com evidência "nenhuma" (`eval/reports/README.md`).

Saída em `datagen/out/<versão>/` (fora do git): `train.jsonl`, `validation.jsonl`, `test.jsonl`,
`rejected.jsonl` e `stats.json`. Depois de `finetune/prepare.py`, o conjunto vai para um dataset **privado** no
Kaggle, de onde o notebook de treino o lê, com o datasheet abaixo preenchido.

## Licenças

Use professor e juiz com licença que permita usar as saídas para treinar outro modelo (Apache 2.0, por
exemplo `gpt-oss`, Qwen, Gemma 4). Evite modelos com licença Llama como professor: ela exige "Llama" no
nome do modelo derivado. Confira a licença no model card antes de cada rodada.

## Datasheet (preencher a cada versão)

Modelo para as próximas versões:

- **Versão, data e semente:**
- **Professor e juiz** (modelo, provedor, licença):
- **Tamanho** por divisão e taxa de rejeição (de `stats.json`):
- **Composição:** proporção paciente/profissional, estilos, regiões, itens negados/de outra pessoa.
- **Usos previstos:** treinar e validar o extrator do Stabilis. Não usar para diagnóstico.
- **Limitações:** texto sintético não cobre toda a variação real; o gold set humano é a medida de verdade.
- **Dados pessoais:** nenhum (fichas sorteadas, textos gerados).

### v1

- **Versão, data e semente:** v1, gerada de 2026-10-31 a 2026-11-05, semente 1, `PROMPT_VERSION` 2, professor
  com raciocínio baixo. Comando: `--n 1000 --seed 1 --out datagen/out/v1`.
- **Professor e juiz:** `openai/gpt-oss-120b` e `qwen/qwen3.8-27b`, os dois no plano gratuito da Groq e com
  licença Apache 2.0 (conferida no model card em 2026-11-05).
- **Tamanho:** 1.000 tentativas e 529 exemplos aprovados (360 de treino, 49 de validação, 120 de teste). Os 471
  reprovados se dividem em 383 pelo juiz, 87 por evidência fora do texto e 1 por resposta inválida do juiz.
  Nenhuma duplicata.
- **Composição:**
  - 70% relatos de paciente e 30% anamneses;
  - sete estilos (WhatsApp, áudio transcrito, texto cuidadoso, curto, evolução estruturada, anotação
    telegráfica, carta de encaminhamento) e cinco regiões, cerca de 20% cada;
  - ruído de digitação: nenhum em 46% (todas as anamneses ficam sem ruído), leve em 18%, médio em 19% e
    forte em 17%;
  - 2.975 itens, dos quais 14% negados, 8% sobre outra pessoa, 14% passados e 3% hipotéticos;
  - 191 exemplos com risco, 119 deles com risco não negado da própria pessoa, e 41 com gravidez informada.
- **Usos previstos:** treinar e validar o extrator do Stabilis. Não usar para diagnóstico.
- **Limitações:**
  - texto sintético não cobre toda a variação real; o gold set é a medida de verdade, mas também é sintético
    (revisado por pessoa);
  - 6% dos sintomas e riscos ainda repetem palavras das descrições do schema;
  - algumas anamneses soam como formulário;
  - alguns remédios aparecem com o nome em inglês;
  - o nome do remédio no rótulo fica sem o ruído aplicado ao texto, então o modelo aprende a devolver o
    nome correto de uma marca digitada com erro;
  - o juiz às vezes não reconhece uma abreviação ("HAS") como o item da ficha e reprova sem motivo (cerca
    de 1,5% das tentativas).
- **Dados pessoais:** nenhum (fichas sorteadas, textos gerados). Os nomes que aparecem em cartas de
  encaminhamento são inventados.

### v2

- **Versão, data e semente:** v2, gerada de 2026-11-06 a 2026-11-07, semente 2, `PROMPT_VERSION` 3, professor
  com raciocínio baixo. Comando: `--n 500 --seed 2 --distractors 0.5 --empty-share 0.3 --out datagen/out/v2`.
- **Professor e juiz:** os mesmos da v1, `openai/gpt-oss-120b` e `qwen/qwen3.8-27b`, ambos Apache 2.0, no plano
  gratuito da Groq.
- **Tamanho:** 500 tentativas e 306 exemplos aprovados (196 de treino, 32 de validação, 74 de teste). Outros 4
  saíram do treino porque repetiam combinações de fatos do teste. Os 194 reprovados se dividem em 149 pelo juiz
  e 45 por evidência fora do texto. Nenhuma duplicata.
- **Composição:**
  - 72% relatos de paciente e 28% anamneses;
  - 198 exemplos com distrator fora do rótulo: 70 hábitos de outra pessoa, 59 remédios recusados, 44 remédios
    só planejados e 42 remédios de outra pessoa;
  - 88 exemplos sem nada a sugerir para a própria pessoa, 14 deles com o rótulo totalmente vazio.
- **Uso no treino:** junto com a v1, em `finetune/data/v1v2` (556 de treino e 81 de validação, com os ids
  prefixados por `v1-` e `v2-`).
- **Limitações:**
  - as da v1;
  - para fichas com pouco conteúdo, o professor costuma preencher o texto com cenas do dia a dia ("hoje acordei
    cedo, tomei um cafezinho...");
  - 7% dos sintomas e riscos repetem palavras das descrições do schema.
- **Dados pessoais:** nenhum.
