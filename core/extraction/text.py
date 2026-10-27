"""Text helpers shared by the extraction steps: sanitizing input and matching evidence."""

from __future__ import annotations

import re
import unicodedata

# Chat-template control tokens (Gemma and common equivalents) and our own data delimiters.
# The rendered prompt is tokenized with special tokens enabled, so these must never reach it.
_CONTROL_TOKENS = re.compile(
    r"<\s*/?\s*(start_of_turn|end_of_turn|bos|eos|pad|unk|mask|unused\d*|\|[a-z_]+\|)\s*>|<<<|>>>",
    re.IGNORECASE,
)
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_NON_WORD = re.compile(r"[^\w]+")


def sanitize_user_text(text, max_chars: int) -> str:
    """Removes control tokens/characters and truncates free text before it reaches the prompt."""
    cleaned = _CONTROL_CHARS.sub(" ", _CONTROL_TOKENS.sub(" ", str(text or "")))
    return cleaned[:max_chars].strip()


def normalize(text: str) -> str:
    """Lowercase, no accents, punctuation as spaces, single spaces. Used to compare text spans."""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(_NON_WORD.sub(" ", stripped.casefold()).split())


def normalize_name(text: str) -> str:
    """Same normalization as the web app's normalizeName (medication names and brands)."""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(stripped.lower().replace("®", " ").split())


def evidence_supported(evidence: str, normalized_text: str, min_chars: int = 3) -> bool:
    """True when the evidence span really occurs in the text (ignoring case, accents and punctuation)."""
    span = normalize(evidence or "")
    return len(span) >= min_chars and f" {span} " in f" {normalized_text} "


_DOSE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(mg|g)\b(?:\s*(?:/|por)?\s*(\d)\s*x)?")


def parse_daily_dose_mg(text: str) -> float | None:
    """Daily dose in mg from text such as "50mg", "1,5 g" or "600 mg 2x" (same rule as the web app)."""
    match = _DOSE.search(normalize_name(text))
    if not match:
        return None
    amount = float(match.group(1).replace(",", "."))
    per_dose = amount * 1000 if match.group(2) == "g" else amount
    times = int(match.group(3)) if match.group(3) else 1
    return round(per_dose * times, 2)
