"""Train/validation/test split that keeps related examples apart.

Whole personas (writing style + region + teacher model) are held out for validation and test, and
any training example whose set of facts also appears in test is dropped, so the test set measures
generalization to new people and new combinations, not memorization.
"""

from __future__ import annotations

import hashlib


def persona(example: dict) -> str:
    return f"{example['sheet']['style']}|{example['sheet']['region']}|{example['teacher']}"


def fact_signature(example: dict) -> str:
    return "/".join(sorted(f"{m['kind']}:{m['code']}" for m in example["sheet"]["mentions"]))


def _unit(key: str) -> float:
    return int.from_bytes(hashlib.sha256(key.encode()).digest()[:4], "big") / 2**32


def split(examples: list[dict], test: float = 0.15, validation: float = 0.1) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {"train": [], "validation": [], "test": []}
    for example in examples:
        unit = _unit(persona(example))
        bucket = "test" if unit < test else "validation" if unit < test + validation else "train"
        out[bucket].append(example)
    held_out = {fact_signature(e) for e in out["test"]}
    out["train"] = [e for e in out["train"] if fact_signature(e) not in held_out]
    out["validation"] = [e for e in out["validation"] if fact_signature(e) not in held_out]
    return out
