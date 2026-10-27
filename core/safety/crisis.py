"""Deterministic detection of suicide/self-harm language in Portuguese text.

Mirrors webapp/app/lib/safety/crisis.ts: same lexicon (knowledge/lexicons/crisis.pt-BR.json),
same algorithm and the same test vectors (knowledge/tests/crisis.vectors.json). Any change
here must be made there too.

Negation ("nega ideação suicida") is only applied in professional mode, where it is routine
documentation. Patient mode stays maximally sensitive.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

Mode = Literal["patient", "professional"]

LEXICON_PATH = Path(__file__).resolve().parents[2] / "knowledge" / "lexicons" / "crisis.pt-BR.json"

_SEGMENT_SPLIT = re.compile(r"[.!?;:\n]+")
_NON_ALNUM = re.compile(r"[^0-9a-z]+")


@dataclass(frozen=True)
class CrisisHit:
    term_id: str
    category: str
    negated: bool


@dataclass(frozen=True)
class _Term:
    id: str
    category: str
    phrases: tuple[tuple[str, ...], ...]


@dataclass(frozen=True)
class CompiledLexicon:
    terms: tuple[_Term, ...]
    negation_cues: tuple[tuple[str, ...], ...]
    terminators: frozenset[str]
    window: int


def normalize(text: str) -> str:
    """NFKD, drop diacritical marks, lowercase, collapse everything outside [0-9a-z] to one space."""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.category(c).startswith("M"))
    return _NON_ALNUM.sub(" ", stripped.lower()).strip()


def _tokens(text: str) -> tuple[str, ...]:
    normalized = normalize(text)
    return tuple(normalized.split(" ")) if normalized else ()


def compile_lexicon(raw: dict) -> CompiledLexicon:
    terms = tuple(
        _Term(
            id=term["id"],
            category=term["category"],
            phrases=tuple(p for p in (_tokens(phrase) for phrase in term["phrases"]) if p),
        )
        for term in raw["terms"]
    )
    return CompiledLexicon(
        terms=terms,
        negation_cues=tuple(c for c in (_tokens(cue) for cue in raw["negation_cues"]) if c),
        terminators=frozenset(t for term in raw["scope_terminators"] for t in _tokens(term)),
        window=int(raw["matching"]["negation_window_tokens"]),
    )


@lru_cache(maxsize=1)
def default_lexicon() -> CompiledLexicon:
    return compile_lexicon(json.loads(LEXICON_PATH.read_text(encoding="utf-8")))


def _is_negated(tokens: tuple[str, ...], start: int, lexicon: CompiledLexicon) -> bool:
    low = max(0, start - lexicon.window)
    for cue in lexicon.negation_cues:
        size = len(cue)
        for i in range(low, start - size + 1):
            if tokens[i:i + size] == cue and not any(t in lexicon.terminators for t in tokens[i + size:start]):
                return True
    return False


def detect_crisis(text: str, mode: Mode = "patient", lexicon: CompiledLexicon | None = None) -> list[CrisisHit]:
    lexicon = lexicon or default_lexicon()
    hits: list[CrisisHit] = []
    for segment in _SEGMENT_SPLIT.split(text or ""):
        tokens = _tokens(segment)
        if not tokens:
            continue
        # (start, end, term_index, phrase_index); overlapping matches keep the longest phrase.
        matches = []
        for t_idx, term in enumerate(lexicon.terms):
            for p_idx, phrase in enumerate(term.phrases):
                size = len(phrase)
                for start in range(len(tokens) - size + 1):
                    if tokens[start:start + size] == phrase:
                        matches.append((start, start + size, t_idx, p_idx))
        matches.sort(key=lambda m: (-(m[1] - m[0]), m[0], m[2], m[3]))
        kept: list[tuple[int, int, int, int]] = []
        for match in matches:
            if all(match[1] <= k[0] or match[0] >= k[1] for k in kept):
                kept.append(match)
        kept.sort(key=lambda m: m[0])
        for start, _end, t_idx, _p_idx in kept:
            term = lexicon.terms[t_idx]
            negated = mode == "professional" and _is_negated(tokens, start, lexicon)
            hits.append(CrisisHit(term_id=term.id, category=term.category, negated=negated))
    return hits


def summarize(hits: list[CrisisHit]) -> dict:
    """`crisis`: some mention is not negated. `negated_only`: every mention is negated."""
    crisis = any(not h.negated for h in hits)
    return {"crisis": crisis, "negated_only": bool(hits) and not crisis}
