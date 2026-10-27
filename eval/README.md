# Avaliação da extração (trilha LLM, etapa L1)

Antes de qualquer fine-tuning, medimos o modelo atual e os candidatos no mesmo conjunto de textos.
É isso que mostra se um modelo treinado ganhou de verdade.

## O gold set

`eval/gold/v0.jsonl` é escrito **por pessoas**, nunca gerado por modelo, e depois de congelado
**nunca entra em treino**. Metas da versão 0:

- **≥ 200 textos de paciente**, escritos como as pessoas escrevem de verdade: estilo WhatsApp, áudio
  transcrito sem pontuação, erros de digitação, nomes comerciais ("rivotril", "sertralina da farmácia
  popular"), expressões regionais ("nervos", "gastura", "aperreio", "agonia").
- **~100 anamneses**, a partir de vinhetas clínicas públicas, com abreviações (HAS, DM2, IS, TAG, etilismo).
- **≥ 100 textos com risco** (pensamentos de morte, plano, tentativa, autolesão), metade deles com
  **negativos difíceis** que não são risco: "morrendo de rir", "me mata de vergonha", "nega IS",
  "minha tia tentou se matar", "tenho medo de pensar besteira".

Não use dados reais de pacientes. Textos inspirados em situações reais devem ser reescritos de forma
que ninguém possa ser identificado.

### Formato (uma linha JSON por texto)

Veja `eval/gold/FORMAT.jsonl` (exemplos de formato, fora do gold set).

| campo | conteúdo |
|---|---|
| `id` | identificador único e estável |
| `task` | `patient` ou `professional` |
| `text` | o texto, exatamente como seria digitado |
| `expected.conditions` | códigos de `knowledge/vocab/comorbidities.json` que o texto afirma sobre a própria pessoa |
| `expected.habits` | códigos de hábitos (`alcohol`, `smoking`, `cannabis`) afirmados |
| `expected.medications` | ids de `knowledge/drugs/` mencionados como em uso ou já usados |
| `expected.pregnancy` | `pregnant`, `not_pregnant`, `planning`, `breastfeeding` ou `null` |
| `expected.risk` | `true` se há risco de suicídio/autolesão da própria pessoa (atual ou passado), não negado |
| `expected.critical_risk` | `true` para plano, intenção ou comportamento recente (subconjunto crítico) |
| `expected.must_not_suggest` | `tipo:código` de itens mencionados mas negados, de outra pessoa ou hipotéticos |

### Regras de anotação

1. Anote o que o texto **diz**, não o que você deduz. "Tomo remédio de pressão" não é `hypertension`
   a menos que a pressão alta esteja escrita; o remédio, se nomeado, entra em `medications`.
2. Negado ("nega etilismo", "não bebo") e de outra pessoa ("minha mãe é diabética") vão em
   `must_not_suggest`, nunca nos campos esperados.
3. Risco passado conta ("tentei me matar ano passado"). Risco hipotético dito como medo ("tenho medo de
   um dia pensar nisso") não conta, mas deve ser revisado por uma segunda pessoa.
4. Duas pessoas anotam cada texto de risco; divergências são discutidas antes de congelar.
5. Ao congelar uma versão, registre a data e o hash do arquivo no topo deste README.

## Rodando

```bash
# harness com modelo simulado (testa o próprio harness, sem modelo de verdade)
python eval/run_eval.py --gold eval/gold/FORMAT.jsonl --fake

# modelo real (variáveis MODEL_REPO_ID, MODEL_FILENAME, MODEL_REVISION, HF_TOKEN)
python eval/run_eval.py --gold eval/gold/v0.jsonl --out eval/reports/gemma2-9b.json --gates

# latência nas mesmas condições do Space (2 vCPUs)
docker run --rm --cpus=2 --memory=16g -e HF_TOKEN -e MODEL_REPO_ID -e MODEL_FILENAME stabilis-api \
  python eval/bench_latency.py --gold eval/gold/v0.jsonl --runs 20
```

## Portões de promoção

Medidos no GGUF que vai para produção (veja o plano):

| portão | meta |
|---|---|
| saída válida no schema | 100% |
| recall de risco | ≥ 0,98 no gold set e 100% no subconjunto crítico |
| itens sem evidência antes da filtragem | ≤ 1% |
| F1 por grupo (condições, hábitos, medicamentos) | ≥ baseline |
| sugestões indevidas (negação/experienciador) | ≤ baseline |
| p95 aquecido | ≤ 40 s (paciente) / 60 s (profissional) |
| cold start | ≤ 3 min |
