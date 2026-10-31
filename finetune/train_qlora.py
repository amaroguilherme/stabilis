"""QLoRA fine-tuning of the extraction model with Unsloth (run on a Kaggle GPU notebook, 2×T4 or P100).

    pip install unsloth trl datasets      # in the notebook
    python finetune/train_qlora.py --base unsloth/gemma-4-E2B-it --chat-template gemma-4 \\
      --data finetune/data/v1 --out runs/gemma4-e2b-v1

Not run in this repository's CI (needs a GPU). Records seed, hyperparameters and the turn markers in
<out>/run.json, trains on the model's answers only, and exports a GGUF (Q4_K_M) for llama.cpp. The base
model was chosen in eval/reports/README.md; another one needs a permissive license (check its model
card) and an architecture the pinned llama-cpp-python supports. Follows Unsloth's Gemma 4 guide:
FastModel with the vision layers frozen, the BOS token left to the trainer, and the turn markers of the
model's own chat template.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

PROBE = "STABILIS_PROBE"


def bos_token(tokenizer) -> str:
    # Multimodal models (Gemma 4) come with a processor that wraps the tokenizer.
    return getattr(tokenizer, "bos_token", None) or getattr(getattr(tokenizer, "tokenizer", None), "bos_token", None) or ""


def without_bos(text: str, bos: str) -> str:
    """The trainer adds the BOS token itself; a second one from the chat template hurts training."""
    return text[len(bos):] if bos and text.startswith(bos) else text


def turn_markers(tokenizer) -> tuple[str, str]:
    """Where a user turn and the model's answer start in the base model's chat template. They differ
    between families and even between versions: Gemma 4 uses "<|turn>user\\n" and "<|turn>model\\n"."""
    probe = [{"role": "user", "content": PROBE}]
    closed = tokenizer.apply_chat_template(probe, tokenize=False)
    opened = tokenizer.apply_chat_template(probe, tokenize=False, add_generation_prompt=True)
    if not opened.startswith(closed) or opened == closed or PROBE not in closed:
        raise SystemExit("o template de chat do modelo base não separa a pergunta da resposta: informe --chat-template")
    return without_bos(closed[: closed.index(PROBE)], bos_token(tokenizer)), opened[len(closed):]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", required=True)
    parser.add_argument("--chat-template", help="template do Unsloth (get_chat_template), ex.: gemma-4; sem ele, o do modelo")
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=3407)
    parser.add_argument("--epochs", type=float, default=2.0)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--rank", type=int, default=16)
    parser.add_argument("--max-seq", type=int, default=3072)
    parser.add_argument("--batch", type=int, default=2)
    parser.add_argument("--grad-accum", type=int, default=8)
    args = parser.parse_args()

    from datasets import load_dataset
    from trl import SFTConfig, SFTTrainer
    from unsloth import FastModel
    from unsloth.chat_templates import get_chat_template, train_on_responses_only

    args.out.mkdir(parents=True, exist_ok=True)
    record = {k: str(v) for k, v in vars(args).items()}
    (args.out / "run.json").write_text(json.dumps(record, indent=2) + "\n")

    model, tokenizer = FastModel.from_pretrained(model_name=args.base, max_seq_length=args.max_seq, load_in_4bit=True, full_finetuning=False)
    if args.chat_template:
        tokenizer = get_chat_template(tokenizer, chat_template=args.chat_template)
    model = FastModel.get_peft_model(
        model,
        finetune_vision_layers=False,  # text only
        finetune_language_layers=True,
        finetune_attention_modules=True,
        finetune_mlp_modules=True,
        r=args.rank,
        lora_alpha=args.rank,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=args.seed,
    )
    instruction_part, response_part = turn_markers(tokenizer)
    record["turn_markers"] = [instruction_part, response_part]
    (args.out / "run.json").write_text(json.dumps(record, indent=2) + "\n")

    bos = bos_token(tokenizer)

    def render(batch):
        return {"text": [without_bos(tokenizer.apply_chat_template(m, tokenize=False), bos) for m in batch["messages"]]}

    files = {split: str(args.data / f"{split}.jsonl") for split in ("train", "validation")}
    data = load_dataset("json", data_files=files).map(render, batched=True)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=data["train"],
        eval_dataset=data["validation"],
        args=SFTConfig(
            dataset_text_field="text",
            max_seq_length=args.max_seq,
            per_device_train_batch_size=args.batch,
            gradient_accumulation_steps=args.grad_accum,
            num_train_epochs=args.epochs,
            learning_rate=args.lr,
            lr_scheduler_type="cosine",
            warmup_ratio=0.03,
            logging_steps=10,
            eval_strategy="epoch",
            save_strategy="epoch",
            seed=args.seed,
            output_dir=str(args.out / "checkpoints"),
            report_to="none",
        ),
    )
    # Learn only the JSON answers, not to reproduce the prompts.
    trainer = train_on_responses_only(trainer, instruction_part=instruction_part, response_part=response_part)
    trainer.train()

    model.save_pretrained(str(args.out / "lora"))
    model.save_pretrained_gguf(str(args.out / "gguf"), tokenizer, quantization_method="q4_k_m")
    print(f"GGUF em {args.out / 'gguf'}: avalie com eval/run_eval.py antes de publicar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
