"""Turns datagen output into chat-format JSONL for supervised fine-tuning (runs anywhere, no GPU).

    python finetune/prepare.py --data datagen/out/v1 --out finetune/data/v1

Each example: user turn = the short extraction prompt (core.extraction.prompt.build_short_prompt),
assistant turn = the extraction schema v1 JSON with evidence spans. Using the exact inference prompt
is what lets the production server switch to EXTRACTION_PROMPT=short after promotion.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.extraction.prompt import build_short_prompt  # noqa: E402
from core.extraction.schema import build_schema  # noqa: E402

# The server constrains each answer to the extraction schema, and llama.cpp's grammar writes every item's fields in
# the schema's order, with the evidence second. Training answers must follow that order: the first two fine-tuned
# models learned the evidence last and wrote the medication status where the grammar asked for it ("current").
_SCHEMA = build_schema([], [])["properties"]


def in_schema_order(label: dict) -> dict:
    """The label with groups and item fields in the order of the extraction schema (unknown fields are an error)."""
    def ordered(value: dict, spec: dict) -> dict:
        fields = list(spec["properties"])
        extra = set(value) - set(fields)
        if extra:
            raise ValueError(f"campos fora do schema: {sorted(extra)}")
        return {f: value[f] for f in fields if f in value}

    out = {}
    for group, spec in _SCHEMA.items():
        value = label[group]
        out[group] = [ordered(item, spec["items"]) for item in value] if spec.get("type") == "array" else ordered(value, spec)
    return out


def to_chat(example: dict) -> dict:
    return {
        "id": example["id"],
        "messages": [
            {"role": "user", "content": build_short_prompt(example["task"], example["text"])},
            {"role": "assistant", "content": json.dumps(in_schema_order(example["label"]), ensure_ascii=False)},
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for split in ("train", "validation", "test"):
        rows = [json.loads(line) for line in (args.data / f"{split}.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
        (args.out / f"{split}.jsonl").write_text("".join(json.dumps(to_chat(r), ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
        print(f"{split}: {len(rows)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
