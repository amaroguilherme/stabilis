"""QLoRA fine-tuning of the extraction model with Unsloth (run on a Kaggle GPU notebook, 2×T4 or P100).

    pip install unsloth trl datasets      # in the notebook
    python finetune/train_qlora.py --base unsloth/Qwen3-4B-Instruct-2507 --data finetune/data/v1 --out runs/qwen3-4b-v1

Not run in this repository's CI (needs a GPU). Records seed and hyperparameters in <out>/run.json,
trains on the assistant turns only, and exports a GGUF (Q4_K_M) for llama.cpp. Check the base model's
license on its model card first (Apache 2.0 preferred) and that the pinned llama-cpp-python supports
the architecture.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", required=True)
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
    from unsloth import FastLanguageModel
    from unsloth.chat_templates import train_on_responses_only

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "run.json").write_text(json.dumps({k: str(v) for k, v in vars(args).items()}, indent=2) + "\n")

    model, tokenizer = FastLanguageModel.from_pretrained(model_name=args.base, max_seq_length=args.max_seq, load_in_4bit=True)
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.rank,
        lora_alpha=args.rank,
        lora_dropout=0,
        bias="none",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth",
        random_state=args.seed,
    )

    def render(batch):
        return {"text": [tokenizer.apply_chat_template(m, tokenize=False) for m in batch["messages"]]}

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
    # Learn only the JSON answers, not to reproduce the prompts. The markers depend on the chat template.
    trainer = train_on_responses_only(trainer)
    trainer.train()

    model.save_pretrained(str(args.out / "lora"))
    model.save_pretrained_gguf(str(args.out / "gguf"), tokenizer, quantization_method="q4_k_m")
    print(f"GGUF em {args.out / 'gguf'}: avalie com eval/run_eval.py antes de publicar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
