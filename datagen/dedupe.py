"""Near-duplicate removal with MinHash over word shingles (no external dependencies)."""

from __future__ import annotations

import hashlib
import re

from core.extraction.text import normalize

NUM_HASHES = 64


def shingles(text: str, size: int = 3) -> set[str]:
    words = normalize(text).split()
    if len(words) < size:
        return {" ".join(words)} if words else set()
    return {" ".join(words[i : i + size]) for i in range(len(words) - size + 1)}


def signature(text: str) -> tuple[int, ...]:
    items = shingles(text)
    if not items:
        return tuple([0] * NUM_HASHES)
    return tuple(
        min(int.from_bytes(hashlib.blake2b(f"{seed}|{s}".encode(), digest_size=8).digest(), "big") for s in items)
        for seed in range(NUM_HASHES)
    )


def similarity(a: tuple[int, ...], b: tuple[int, ...]) -> float:
    return sum(x == y for x, y in zip(a, b)) / NUM_HASHES


def dedupe(texts: list[str], threshold: float = 0.8, reference: list[str] | None = None) -> list[int]:
    """Indices of texts to keep: drops near-duplicates of earlier texts and of any reference text
    (the human gold set must never leak into training data)."""
    kept: list[int] = []
    seen: list[tuple[int, ...]] = [signature(t) for t in (reference or [])]
    for i, text in enumerate(texts):
        sig = signature(text)
        if any(similarity(sig, other) >= threshold for other in seen):
            continue
        kept.append(i)
        seen.append(sig)
    return kept


_SPACE = re.compile(r"\s+")
