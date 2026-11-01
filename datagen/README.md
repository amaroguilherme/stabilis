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

Saída em `datagen/out/<versão>/` (fora do git): `train.jsonl`, `validation.jsonl`, `test.jsonl`,
`rejected.jsonl` e `stats.json`. O conjunto vai para um dataset **privado** no Hugging Face Hub, com o
datasheet abaixo preenchido.

## Licenças

Use professor e juiz com licença que permita usar as saídas para treinar outro modelo (Apache 2.0, por
exemplo `gpt-oss`, Qwen, Gemma 4). Evite modelos com licença Llama como professor: ela exige "Llama" no
nome do modelo derivado. Confira a licença no model card antes de cada rodada.

## Datasheet (preencher a cada versão)

- **Versão, data e semente:**
- **Professor e juiz** (modelo, provedor, licença):
- **Tamanho** por divisão e taxa de rejeição (de `stats.json`):
- **Composição:** proporção paciente/profissional, estilos, regiões, itens negados/de outra pessoa.
- **Usos previstos:** treinar e validar o extrator do Stabilis. Não usar para diagnóstico.
- **Limitações:** texto sintético não cobre toda a variação real; o gold set humano é a medida de verdade.
- **Dados pessoais:** nenhum (fichas sorteadas, textos gerados).
