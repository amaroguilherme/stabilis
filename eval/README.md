# Avaliação da extração (trilha LLM, etapa L1)

Antes de qualquer fine-tuning, medimos o modelo atual e os candidatos no mesmo conjunto de textos.
É isso que mostra se um modelo treinado ganhou de verdade. O passo a passo completo, do Space ao modelo
promovido, está em [docs/roteiro-modelo-de-linguagem.md](../docs/roteiro-modelo-de-linguagem.md).

## O gold set

**Versão 0 congelada em 2026-10-28:** `eval/gold/v0.jsonl`, 330 textos (228 de paciente, 102 anamneses;
66 com risco, 28 críticos, 79 negativos difíceis), sha256
`57bc8845604ec22f15b597683a7bb470d0ddadaf82f1432864d624610c327c81`.

A v0 é **sintética**: por decisão do responsável pelo projeto, foi escrita e anotada por um modelo de
linguagem (Claude), seguindo as metas e as regras abaixo, e cada linha traz `"origin": "synthetic"`. Isso
tem limites que pesam na promoção:

- os dados de treino também são sintéticos, então as métricas na v0 tendem a ser otimistas: o modelo pode
  ir bem em texto "de modelo" e pior em texto de gente;
- a regra 4 (duas pessoas anotam cada texto de risco) não foi cumprida: antes de confiar nos portões,
  uma pessoa deve revisar pelo menos os 145 textos ligados a risco;
- a próxima versão deve juntar textos **escritos por pessoas** (`"origin": "human"`), e os relatórios
  passam a ser lidos separando as duas origens;
- depois de ver os erros da v0, o léxico de crise (versão 0.2.0) e a checagem de contexto dos remédios
  achados sem o modelo foram ampliados: os números do léxico e dessa checagem na v0 deixaram de ser
  independentes. Meça-os em textos novos.

Depois de congelado, o gold set **nunca entra em treino** (`datagen/run.py` descarta textos parecidos com
qualquer arquivo de `eval/gold/`). Metas da versão 0:

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
| `origin` | `human` ou `synthetic` (quem escreveu e anotou o texto) |
| `task` | `patient` ou `professional` |
| `text` | o texto, exatamente como seria digitado |
| `expected.conditions` | códigos de `knowledge/vocab/comorbidities.json` que o texto afirma sobre a própria pessoa |
| `expected.habits` | códigos de hábitos (`alcohol`, `smoking`, `cannabis`) afirmados |
| `expected.medications` | ids de `knowledge/drugs/` mencionados como em uso ou já usados |
| `expected.pregnancy` | `pregnant`, `not_pregnant`, `planning`, `breastfeeding` ou `null` |
| `expected.risk` | `true` se há risco de suicídio/autolesão da própria pessoa (atual ou passado), não negado |
| `expected.critical_risk` | `true` para plano, intenção ou comportamento recente (subconjunto crítico) |
| `expected.must_not_suggest` | `tipo:código` de itens mencionados mas negados, de outra pessoa ou hipotéticos |
| `tags` (opcional) | `hard_negative` (linguagem parecida com risco que não é risco), `regional`, `brand_name`, `no_punctuation`, `abbreviations` |

### Regras de anotação

1. Anote o que o texto **diz**, não o que você deduz. "Tomo remédio de pressão" não é `hypertension`
   a menos que a pressão alta esteja escrita; o remédio, se nomeado, entra em `medications`.
2. Negado ("nega etilismo", "não bebo") e de outra pessoa ("minha mãe é diabética") vão em
   `must_not_suggest`, nunca nos campos esperados.
3. Risco passado conta ("tentei me matar ano passado"). Risco hipotético dito como medo ("tenho medo de
   um dia pensar nisso") não conta, mas deve ser revisado por uma segunda pessoa.
4. Duas pessoas anotam cada texto de risco; divergências são discutidas antes de congelar.
5. Ao congelar uma versão, registre a data e o hash do arquivo no topo deste README.

Antes de usar ou congelar o arquivo, confira códigos, ids repetidos e as metas da versão 0:

```bash
python eval/check_gold.py eval/gold/v0.jsonl
```

## Rodando

```bash
# harness com modelo simulado (testa o próprio harness, sem modelo de verdade)
python eval/run_eval.py --gold eval/gold/FORMAT.jsonl --fake

# modelo real (variáveis MODEL_REPO_ID, MODEL_FILENAME, MODEL_REVISION, HF_TOKEN)
python eval/run_eval.py --gold eval/gold/v0.jsonl --out eval/reports/gemma2-9b.json --gates

# latência no próprio Space (2 vCPUs): reinicie o Space logo antes para medir o cold start
STABILIS_API_URL=https://amaroguilherme-stabilis-api.hf.space HF_SPACE_TOKEN=hf_... \
  python eval/bench_space.py --gold eval/gold/v0.jsonl --runs 20 --gates --out eval/reports/latencia.json
```

A latência vale medida no Space, que é onde o modelo roda. `bench_latency.py` mede no próprio computador e
só se aproxima do Space numa máquina x86 com `docker run --cpus=2 --memory=16g` e a pasta `eval/` montada
(`-v "$PWD/eval:/home/user/app/eval:ro"`), porque a imagem não inclui `eval/`. Num Mac com chip Apple, a
imagem não compila com as instruções de CPU do Space (AVX2), e a emulação não mede o mesmo hardware.

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

`run_eval.py --gates --baseline <relatório do modelo em produção>` cobre os portões de qualidade, inclusive
os relativos (F1 por grupo e sugestões indevidas não podem piorar; os dois relatórios precisam ser do mesmo
gold set, conferido pelo hash). `bench_latency.py --gates` cobre p95 e cold start.

## Promoção, passo a passo

1. Gold set congelado: `check_gold.py` sem erros, data e hash registrados no topo deste arquivo.
2. Baseline: com as variáveis do modelo atual do Space, `run_eval.py --gold eval/gold/v0.jsonl --out eval/reports/producao.json`.
3. Candidato: com `MODEL_REPO_ID`, `MODEL_FILENAME` e `MODEL_REVISION` do GGUF novo e `EXTRACTION_PROMPT=short`,
   `run_eval.py --gold eval/gold/v0.jsonl --out eval/reports/candidato.json --gates --baseline eval/reports/producao.json`.
4. Latência: com o candidato publicado no Space, `bench_space.py --gates` (reinicie o Space antes, para medir
   o cold start). Se não passar, volte as variáveis do modelo anterior.
5. Tudo verde: troque as mesmas variáveis nas configurações do Space, reinicie e confira `/ready` e uma extração
   de teste na tela do profissional.
6. Só então, se quiser, ligue as sugestões no modo paciente (`NEXT_PUBLIC_PATIENT_SUGGESTIONS=on` na Vercel; veja
   `knowledge/POLICY.md` §15) e publique de novo o frontend.
7. Guarde os dois relatórios (sem textos) junto com o hash do modelo promovido.

