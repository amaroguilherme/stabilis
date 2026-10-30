# Roteiro: do código ao modelo de linguagem em produção

O código da trilha de modelo de linguagem está pronto: geração de dados, preparo, treino, avaliação com
portões e promoção por variáveis. O que falta é **rodar**, e quase tudo depende das suas contas. Este roteiro
leva do estado atual até um modelo ajustado servindo no Space e as funções ligadas no site.

Tudo é gratuito: Hugging Face (Space CPU Basic e repositório privado do modelo), Kaggle (GPU, cerca de 30 horas
por semana) e Groq (plano gratuito, com limites por minuto e por dia).

| # | Etapa | Onde roda | Quem faz | Tempo aproximado |
|---|---|---|---|---|
| 1 | Contas e tokens | navegador | você | 30 min |
| 2 | Publicar o backend novo no Space (com o modelo atual) | seu computador + Hugging Face | você | 1 h, contando o build |
| 3 | Revisar os textos de risco do gold set | seu computador | você (de preferência com mais alguém) | algumas horas |
| 4 | Medir o modelo atual e escolher o modelo base | seu computador | você ou eu | 2 a 4 h, quase tudo esperando |
| 5 | Gerar os dados sintéticos | seu computador | você ou eu | algumas horas, pode parar e continuar |
| 6 | Treinar no Kaggle | Kaggle | você | 1 a 3 h de GPU |
| 7 | Avaliar o candidato | seu computador + Space | você ou eu | 1 a 2 h |
| 8 | Promover e ligar as funções | Hugging Face + Vercel | você | 30 min |

Nas etapas 4, 5 e 7 eu posso rodar os comandos no seu computador, se as chaves estiverem nas variáveis de ambiente
do seu terminal (eu não leio arquivos `.env`). As etapas 2, 6 e 8 mexem nas suas contas e ficam com você.

---

## 1. Contas e tokens

1. **Hugging Face.** Crie tokens *fine-grained*, cada um só com o que precisa:
   - **token do deploy**: escrita no Space `amaroguilherme/stabilis-api` (usado como senha no `git push` da etapa 2);
   - **token de leitura do modelo**: leitura no repositório privado do modelo (secret `HF_TOKEN` do Space);
   - **token de escrita do modelo**: escrita no repositório privado do modelo (secret `HF_TOKEN` no Kaggle);
   - **token de acesso ao Space**: leitura no Space privado (variável `HF_SPACE_TOKEN` na Vercel, secret
     `HF_SPACE_TOKEN` no GitHub para o keep-alive e para medir latência na etapa 7).
2. **Kaggle.** Conta com telefone verificado. Sem isso, não aparecem GPU nem internet no notebook.
3. **Groq.** Conta e uma chave de API. Confira no console os nomes dos modelos disponíveis e os limites do plano
   gratuito.
4. **No seu computador:** Python 3.12 ou mais novo e git. Docker não é necessário.
5. **Guarde as credenciais** em `~/.config/stabilis/llm.env`, fora do repositório e só com acesso seu
   (`chmod 600`). O arquivo modelo já explica onde criar cada uma e com que permissão. Depois, confira:

```bash
source ~/.config/stabilis/llm.env && python scripts/check_credentials.py
```

O verificador diz se cada credencial funciona, sem mostrar nenhum valor. Ele também avisa se faltar espaço em
disco: o ideal são 20 GB livres para os modelos.

## 2. Publicar o backend novo no Space

O Space ainda não recebeu o backend novo: fila de jobs, serviço de linguagem, léxico de crise 0.2.0 e checagem
de contexto dos remédios. Publique primeiro **com o modelo que já está configurado**, para separar problema de
código de problema de modelo.

```bash
python scripts/build_space.py --out /tmp/stabilis-space
cd /tmp/stabilis-space && git init -b main && git add -A && git commit -m "Deploy the language service"
git push --force https://huggingface.co/spaces/amaroguilherme/stabilis-api main
# usuário: seu usuário do Hugging Face; senha: o token do deploy
```

O `--force` substitui o histórico do Space, que tem arquivos com licença que proíbe uso clínico (Broad, SIDER).
Isso é intencional (`deploy/space/README.md`).

Nas configurações do Space, confira:
- o secret `HF_TOKEN`, com leitura do repositório do modelo atual;
- as variáveis `MODEL_REPO_ID`, `MODEL_FILENAME` e `LLM_THREADS=2`.

Sem `EXTRACTION_PROMPT` por enquanto: o modelo atual usa o prompt completo.

**Deu certo quando** o build termina (10 a 20 minutos, porque compila o llama.cpp) e esta chamada responde
`"ready": true`:

```bash
curl -s -H "Authorization: Bearer <token de acesso ao Space>" https://amaroguilherme-stabilis-api.hf.space/ready
```

Depois, configure na Vercel `STABILIS_API_URL=https://amaroguilherme-stabilis-api.hf.space` e `HF_SPACE_TOKEN`, e
no GitHub o secret `HF_SPACE_TOKEN` (keep-alive). **Se der errado:** os logs do build ficam na aba "Logs" do Space.

## 3. Revisar os textos de risco do gold set

A v0 (`eval/gold/v0.jsonl`, 330 textos) foi escrita por um modelo de linguagem. Os portões de risco dependem dela,
então revise pelo menos os 145 textos ligados a risco (`"risk": true` ou a tag `hard_negative`), de preferência com
mais uma pessoa. As regras de anotação estão em `eval/README.md`.

Depois de editar:

```bash
python eval/check_gold.py eval/gold/v0.jsonl        # sem erros e com as metas da v0
shasum -a 256 eval/gold/v0.jsonl                    # registre a data e o hash novos no topo do eval/README.md
```

**Congele antes da etapa 4.** Mudar o gold set depois de medir invalida a comparação: o portão relativo confere o
hash. Textos escritos por pessoas, com `"origin": "human"`, podem entrar numa v1.

## 4. Medir o modelo atual e escolher o modelo base

Instale as dependências completas num ambiente separado. O `llama-cpp-python` compila na instalação e, num Mac
com chip Apple, usa a GPU. Isso serve para medir qualidade; a latência só vale medida no Space (etapa 7).

```bash
python3 -m venv .venv-llm && source .venv-llm/bin/activate
pip install -r requirements.txt
```

**Linha de base, o modelo em produção hoje** (os mesmos valores das variáveis do Space):

```bash
HF_TOKEN=<token com leitura> MODEL_REPO_ID=<atual> MODEL_FILENAME=<atual> \
  python eval/run_eval.py --gold eval/gold/v0.jsonl --out eval/reports/producao.json
```

**Candidatos a modelo base, sem ajuste:** dois ou três modelos pequenos (até uns 4B parâmetros, para caber na
latência de 2 vCPUs) com licença permissiva (Apache 2.0). Os candidatos do plano são Gemma 4 E2B/E4B, Qwen3.5
2B/4B, Tucano2-qwen e Ministral 3 3B. Use a versão GGUF Q4_K_M de cada um no Hugging Face e o mesmo comando,
trocando `MODEL_REPO_ID` e `MODEL_FILENAME` e salvando em `eval/reports/<nome>.json`.

- Se aparecer "modelo indisponível", a versão fixada do `llama-cpp-python` (0.3.18) talvez não suporte a
  arquitetura. Tente outro candidato, ou me peça para atualizar a versão (precisa de teste).
- Confira a licença no model card antes de escolher.

**Escolha** o modelo base pelo recall de risco (no geral e no subconjunto crítico), depois pelo F1 por grupo e
pelas sugestões indevidas. O ajuste da etapa 6 tem de superar `producao.json`, não esses números sem ajuste.

## 5. Gerar os dados sintéticos

```bash
export DATAGEN_TEACHER_BASE_URL=https://api.groq.com/openai/v1
export DATAGEN_TEACHER_MODEL=openai/gpt-oss-120b      # professor, Apache 2.0
export DATAGEN_TEACHER_API_KEY=<chave da Groq>
export DATAGEN_JUDGE_BASE_URL=https://api.groq.com/openai/v1
export DATAGEN_JUDGE_MODEL=qwen/qwen3.8-27b           # juiz de outra família (os nomes mudam: confira no console)
export DATAGEN_JUDGE_API_KEY=<chave da Groq>

python -m datagen.run --n 100 --seed 1 --out datagen/out/piloto    # piloto
```

No piloto, leia `datagen/out/piloto/stats.json` (quantos foram aprovados e por que os outros foram rejeitados) e
abra uns dez exemplos de `train.jsonl` para ver se o texto parece de gente de verdade. Se o script disser que um
modelo não existe, troque pelo nome que aparece no console da Groq.

Depois, a geração de verdade:

```bash
python -m datagen.run --n 3000 --seed 1 --out datagen/out/v1
python finetune/prepare.py --data datagen/out/v1 --out finetune/data/v1
```

- Se o plano gratuito esgotar, a geração para e avisa. Rode **o mesmo comando** mais tarde: ela continua de onde
  parou, com o mesmo resultado.
- Preencha o datasheet no fim de `datagen/README.md`.
- Suba `finetune/data/v1` (`train.jsonl` e `validation.jsonl`) como **dataset privado** no Kaggle. Os dados não
  vão para o git (`datagen/out/` e `finetune/data/` estão no `.gitignore`).

## 6. Treinar no Kaggle

1. No Kaggle, importe `finetune/kaggle_train.ipynb` (File → Import Notebook).
2. Nas configurações do notebook:
   - acelerador **GPU T4 ×2** e internet ligada;
   - em Add-ons → Secrets, `HF_TOKEN` com o token de escrita do modelo;
   - em Add data, o dataset da etapa 5.
3. Na célula de configuração, ajuste:
   - `BASE_MODEL`: o modelo escolhido na etapa 4, na versão do Hugging Face/Unsloth, não o GGUF;
   - `DATA_DIR`: `/kaggle/input/<nome do dataset>`;
   - `HF_MODEL_REPO`: por exemplo `amaroguilherme/stabilis-extrator`, privado;
   - `REPO_URL`: se o repositório do GitHub for privado, suba `core/` e `finetune/` como outro dataset e troque o
     `git clone` por uma cópia.
4. Rode tudo. No fim, o notebook mostra `MODEL_REPO_ID`, `MODEL_FILENAME` e `MODEL_REVISION`: anote os três.

O notebook nunca rodou de ponta a ponta. Se alguma célula falhar, me mande a mensagem de erro.

## 7. Avaliar o candidato

**Qualidade**, no seu computador, contra a linha de base:

```bash
HF_TOKEN=<token com leitura> MODEL_REPO_ID=<novo> MODEL_FILENAME=<novo> MODEL_REVISION=<hash> EXTRACTION_PROMPT=short \
  python eval/run_eval.py --gold eval/gold/v0.jsonl --out eval/reports/candidato.json --gates --baseline eval/reports/producao.json
```

Código de saída 0 quer dizer que todos os portões de qualidade passaram. Cada falha aparece como "PORTÃO NÃO
ATINGIDO". Se o recall de risco falhar, `missed_risk_ids` no relatório lista os textos perdidos; normalmente a
correção é gerar mais exemplos daquele tipo e treinar de novo.

**Latência**, no Space, que é o hardware que conta:
1. Troque as variáveis do Space para o candidato (`MODEL_REPO_ID`, `MODEL_FILENAME`, `MODEL_REVISION`,
   `EXTRACTION_PROMPT=short`). O Space reinicia sozinho.
2. Logo em seguida, rode:

```bash
STABILIS_API_URL=https://amaroguilherme-stabilis-api.hf.space HF_SPACE_TOKEN=<token de acesso ao Space> \
  python eval/bench_space.py --gold eval/gold/v0.jsonl --runs 20 --gates --out eval/reports/latencia.json
```

Os limites são p95 de 40 s (paciente) e 60 s (profissional), e cold start de até 3 minutos. Se não passar, volte
as variáveis do modelo anterior. Como ninguém usa o app ainda, testar direto no Space não atrapalha ninguém.

## 8. Promover e ligar as funções

1. Com tudo verde, deixe as variáveis do candidato no Space, com `MODEL_REVISION` fixado.
2. Guarde os relatórios em `eval/reports/` (só métricas, sem textos) e anote no `eval/README.md` o hash do modelo
   promovido e a data.
3. Ligue as funções na Vercel e publique de novo, porque as chaves valem a partir do build:
   - **ajuda para organizar o relato (paciente):** `NEXT_PUBLIC_PATIENT_SUGGESTIONS=on`, só depois de concluir e
     assinar o RIPD (`docs/lgpd/ripd.md`);
   - **"Extrair do texto" (profissional):** `NEXT_PUBLIC_PROFESSIONAL_EXTRACTION=on`, só depois de escolher o
     mecanismo legal para a transferência internacional (RIPD, risco R3b).
4. **Para voltar atrás:** recoloque as variáveis do modelo anterior no Space, ou desligue as chaves na Vercel e
   publique de novo.

Os portões, os relatórios e o hash fixado garantem que o modelo em produção é exatamente o que foi medido.
