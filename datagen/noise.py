"""Deterministic noise that makes synthetic text look typed on a phone, without breaking the labels.

Every word is transformed by a function of (word, seed) only, so the same word changes the same way
in the text and in its evidence spans: evidence stays a substring of the noisy text.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata

from core.extraction.text import evidence_supported, normalize

ABBREVIATIONS = {
    "você": "vc", "voce": "vc", "também": "tb", "tambem": "tb", "porque": "pq", "que": "q", "não": "n",
    "muito": "mto", "muita": "mta", "estou": "to", "está": "ta", "para": "pra", "quando": "qdo", "hoje": "hj",
    "beleza": "blz", "obrigado": "obg", "obrigada": "obg", "mesmo": "msm", "nada": "nd", "tudo": "td",
}
_NEIGHBORS = {"a": "s", "s": "a", "e": "r", "r": "e", "o": "i", "i": "o", "n": "m", "m": "n", "t": "r", "l": "k", "c": "x", "d": "s"}
_WORD = re.compile(r"\w+", re.UNICODE)


def _unit(word: str, seed: int, salt: str) -> float:
    digest = hashlib.sha256(f"{seed}|{salt}|{word.lower()}".encode()).digest()
    return int.from_bytes(digest[:4], "big") / 2**32


def _strip_accents(word: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", word) if not unicodedata.combining(c))


def noisy_word(word: str, seed: int, level: float) -> str:
    lowered = word.lower()
    if lowered in ABBREVIATIONS and _unit(word, seed, "abbr") < level:
        return ABBREVIATIONS[lowered]
    out = word
    if _unit(word, seed, "accent") < level:
        out = _strip_accents(out)
    if len(out) > 4 and _unit(word, seed, "typo") < level / 3:
        i = 1 + int(_unit(word, seed, "pos") * (len(out) - 2))
        out = out[:i] + _NEIGHBORS.get(out[i].lower(), out[i]) + out[i + 1 :]
    if _unit(word, seed, "case") < level:
        out = out.lower()
    return out


def add_noise(text: str, seed: int, level: float) -> str:
    """Word-level noise; with `level` 0 the text is unchanged."""
    if level <= 0:
        return text
    noisy = _WORD.sub(lambda m: noisy_word(m.group(0), seed, level), text)
    if level >= 0.5:  # WhatsApp style: little punctuation
        noisy = re.sub(r"[;:]", ",", noisy)
    return noisy


def noisy_example(text: str, evidences: list[str], seed: int, level: float) -> tuple[str, list[str]]:
    """Applies the same noise to the text and to each evidence span. If the noise would break any
    evidence (an abbreviation can make a one-word span too short to check), the example stays clean."""
    noisy_text = add_noise(text, seed, level)
    noisy_evidences = [add_noise(e, seed, level) for e in evidences]
    normalized = normalize(noisy_text)
    if all(evidence_supported(e, normalized) for e in noisy_evidences):
        return noisy_text, noisy_evidences
    return text, evidences
