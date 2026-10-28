"""Generates the synthetic extraction dataset (run locally or on Kaggle, never as a scheduled Action).

    python -m datagen.run --n 500 --seed 1 --out datagen/out/v1

Needs DATAGEN_TEACHER_* and DATAGEN_JUDGE_* (see datagen/llm_client.py). Writes train/validation/test
JSONL, the rejected examples with reasons, and stats. Texts close to the human gold set
(eval/gold/*.jsonl) are dropped, so evaluation never sees training data.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.extraction.text import evidence_supported, normalize  # noqa: E402
from core.kb import load_and_validate  # noqa: E402
from datagen.dedupe import dedupe  # noqa: E402
from datagen.noise import noisy_example  # noqa: E402
from datagen.profiles import FactSheet, ProfileSampler, expected_extraction  # noqa: E402
from datagen.prompts import judge_prompt, parse_items, teacher_prompt  # noqa: E402
from datagen.split import split  # noqa: E402

MIN_CHARS, MAX_CHARS = 60, 2000


def validate_teacher(raw: dict, sheet: FactSheet) -> tuple[str, list[str]] | str:
    """(text, evidence per mention) or the reason for rejection."""
    text = raw.get("text")
    if not isinstance(text, str) or not MIN_CHARS <= len(text) <= MAX_CHARS:
        return "texto ausente ou de tamanho inválido"
    by_index = {e.get("index"): e.get("evidence") for e in raw.get("evidence", []) if isinstance(e, dict)}
    evidences = []
    normalized = normalize(text)
    for i in range(len(sheet.mentions)):
        evidence = by_index.get(i)
        if not isinstance(evidence, str) or not evidence_supported(evidence, normalized):
            return f"evidência ausente ou fora do texto (item {i})"
        evidences.append(evidence)
    return text, evidences


def label(sheet: FactSheet, evidences: list[str]) -> dict:
    """Extraction schema v1 output the model must learn to produce (drug ids are resolved later, not by the model)."""
    expected = expected_extraction(sheet)
    queues = {k: list(v) for k, v in expected.items() if isinstance(v, list)}
    out = {k: [] for k in queues}
    out["pregnancy"] = expected["pregnancy"]
    field = {"symptom": "symptoms", "risk": "risk", "condition": "conditions", "habit": "substances", "medication": "medications"}
    for mention, evidence in zip(sheet.mentions, evidences):
        if mention.kind == "pregnancy":
            out["pregnancy"] = {"status": mention.code, "evidence": evidence}
            continue
        item = dict(queues[field[mention.kind]].pop(0))
        item.pop("drug_id", None)
        item["evidence"] = evidence
        out[field[mention.kind]].append(item)
    return out


def generate(args, kb, teacher, judge) -> tuple[list[dict], list[dict]]:
    conditions = {c["id"]: c["label_plain"] for c in kb.vocab["comorbidities"]["comorbidities"]}
    habits = {h["id"]: h["label_plain"] for h in kb.vocab["comorbidities"]["habits"]}
    sampler = ProfileSampler(kb, args.seed)
    rng = random.Random(args.seed)
    accepted, rejected = [], []
    for i in range(args.n):
        task = "patient" if rng.random() < args.patient_share else "professional"
        sheet = sampler.sample(i, task)
        raw = teacher.complete_json(teacher_prompt(sheet, conditions, habits), temperature=0.9)
        checked = validate_teacher(raw, sheet)
        if isinstance(checked, str):
            rejected.append({"id": sheet.id, "reason": checked})
            continue
        text, evidences = checked
        verdict = judge.complete_json(judge_prompt(text, sheet, conditions, habits), temperature=0.0)
        items = parse_items(verdict, len(sheet.mentions))
        if len(items) != len(sheet.mentions) or not all(items.values()) or verdict.get("extra"):
            rejected.append({"id": sheet.id, "reason": "juiz reprovou", "judge": verdict})
            continue
        level = 0.0 if task == "professional" else rng.choice([0.0, 0.2, 0.5, 0.8])
        text, evidences = noisy_example(text, evidences, seed=args.seed * 100003 + i, level=level)
        accepted.append({
            "id": sheet.id,
            "task": task,
            "text": text,
            "label": label(sheet, evidences),
            "sheet": sheet.to_dict(),
            "teacher": teacher.model,
            "judge": judge.model,
            "noise_level": level,
        })
    return accepted, rejected


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--n", type=int, default=100)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--patient-share", type=float, default=0.65)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    from datagen.llm_client import ChatClient

    teacher, judge = ChatClient("teacher"), ChatClient("judge")
    teacher.check()
    judge.check()
    if teacher.model.split("/")[-1].split("-")[0] == judge.model.split("/")[-1].split("-")[0]:
        print("o juiz precisa ser de outra família de modelo", file=sys.stderr)
        return 2

    kb = load_and_validate()
    accepted, rejected = generate(args, kb, teacher, judge)
    gold = [json.loads(line)["text"] for path in (ROOT / "eval" / "gold").glob("*.jsonl") for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    keep = dedupe([a["text"] for a in accepted], reference=gold)
    accepted = [accepted[i] for i in keep]
    parts = split(accepted)

    args.out.mkdir(parents=True, exist_ok=True)
    for name, rows in {**parts, "rejected": rejected}.items():
        (args.out / f"{name}.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    stats = {
        "requested": args.n,
        "accepted_after_dedupe": len(accepted),
        "rejected": dict(Counter(r["reason"] for r in rejected)),
        "splits": {k: len(v) for k, v in parts.items()},
        "teacher": teacher.model,
        "judge": judge.model,
        "seed": args.seed,
    }
    (args.out / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
