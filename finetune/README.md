# Fine-tuning do extrator (trilha LLM, etapa L3)

1. **Dados:** gere com `datagen/` e converta para o formato de chat:
   `python finetune/prepare.py --data datagen/out/v1 --out finetune/data/v1`
2. **Treino (Kaggle, GPU):** importe `finetune/kaggle_train.ipynb` no Kaggle (acelerador GPU T4 ×2, internet ligada,
   segredo `HF_TOKEN` com escrita no repositório privado do modelo) e anexe os dados de `finetune/data/<versão>` como
   dataset privado. O notebook roda `finetune/train_qlora.py` com o modelo base escolhido na L1 (candidatos: Gemma 4
   E2B/E4B, Qwen3.5, Tucano2-qwen, Ministral 3 3B), guarda semente e hiperparâmetros em `run.json` e envia o GGUF para
   o repositório privado, mostrando o hash do commit. Nem o script nem o notebook rodam no CI (precisam de GPU), e
   ainda não foram testados de ponta a ponta.
3. **Avaliação:** siga "Promoção, passo a passo" em `eval/README.md` (`run_eval.py --gates --baseline` e
   `bench_latency.py --gates` com `--cpus=2`). Só promova se todos os portões passarem, inclusive o subconjunto crítico
   de risco.
4. **Publicação:** envie o GGUF para um repositório **privado** no Hugging Face e anote o hash do commit.
5. **Promoção no Space:** troque `MODEL_REPO_ID`, `MODEL_FILENAME`, `MODEL_REVISION` (o hash) e defina
   `EXTRACTION_PROMPT=short`, que usa o mesmo prompt curto do treino (`core/extraction/prompt.py`).

O texto do treino nunca inclui o gold set (`datagen/run.py` remove textos parecidos com ele).
