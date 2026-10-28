# Fine-tuning do extrator (trilha LLM, etapa L3)

1. **Dados:** gere com `datagen/` e converta para o formato de chat:
   `python finetune/prepare.py --data datagen/out/v1 --out finetune/data/v1`
2. **Treino (Kaggle, GPU):** suba o repositório (ou só `core/`, `finetune/` e os dados) num notebook e rode
   `finetune/train_qlora.py` com o modelo base escolhido na L1 (candidatos: Gemma 4 E2B/E4B, Qwen3.5, Tucano2-qwen,
   Ministral 3 3B). Semente e hiperparâmetros ficam em `run.json`. Este script não roda no CI (precisa de GPU) e
   ainda não foi testado de ponta a ponta.
3. **Avaliação:** rode `eval/run_eval.py --gates` com o GGUF gerado e `eval/bench_latency.py` com `--cpus=2`. Só
   promova se todos os portões de `eval/README.md` passarem, inclusive o subconjunto crítico de risco.
4. **Publicação:** envie o GGUF para um repositório **privado** no Hugging Face e anote o hash do commit.
5. **Promoção no Space:** troque `MODEL_REPO_ID`, `MODEL_FILENAME`, `MODEL_REVISION` (o hash) e defina
   `EXTRACTION_PROMPT=short`, que usa o mesmo prompt curto do treino (`core/extraction/prompt.py`).

O texto do treino nunca inclui o gold set (`datagen/run.py` remove textos parecidos com ele).
