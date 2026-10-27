"""Maps medication names (generic, ingredient, alias or brand) to drug ids of the knowledge base."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass

from core.extraction.text import normalize_name, parse_daily_dose_mg

_WORD = re.compile(r"[\w®]+(?:[-'][\w]+)*")
_DOSE_AFTER = re.compile(r"\s*\d+(?:[.,]\d+)?\s*(?:mg|g)\b(?:\s*(?:/|por)?\s*\d\s*x)?", re.IGNORECASE)


@dataclass(frozen=True)
class NameMatch:
    drug_ids: tuple[str, ...]
    key: str
    kind: str  # "name" | "brand"


class MedicationIndex:
    def __init__(self, drugs: list[dict], brands: dict[str, list[str]]):
        names: dict[str, set[str]] = defaultdict(set)
        for drug in drugs:
            n = drug["names"]
            for name in {n["display_pt"], n["dcb"], n["inn_en"], *n.get("aliases", []), *n["anvisa_principles"]}:
                key = normalize_name(name)
                if key:
                    names[key].add(drug["id"])
        self._names = {k: tuple(sorted(v)) for k, v in names.items()}
        self._brands = {k: tuple(sorted(v)) for k, v in brands.items() if k not in self._names}
        # Longest keys first, so "carbonato de litio" wins over "litio".
        self._keys = sorted([(k, "name") for k in self._names] + [(k, "brand") for k in self._brands], key=lambda kv: -len(kv[0]))

    def lookup(self, name: str) -> NameMatch | None:
        """Exact match of a name as written (dose and form words removed), then the longest known name inside it."""
        key = re.sub(r"\s*\d.*$", "", normalize_name(name)).strip()
        if not key:
            return None
        if key in self._names:
            return NameMatch(self._names[key], key, "name")
        if key in self._brands:
            return NameMatch(self._brands[key], key, "brand")
        padded = f" {key} "
        for candidate, kind in self._keys:
            if f" {candidate} " in padded:
                ids = self._names[candidate] if kind == "name" else self._brands[candidate]
                return NameMatch(ids, candidate, kind)
        return None

    def scan(self, text: str) -> list[dict]:
        """Finds medication names in free text without the model (used alone when the model is down).

        Brands are only taken when written with a capital letter ("Frontal", not "dor frontal"), since
        many brand names are also common words.
        """
        words = [(m.group(0), m.start(), m.end()) for m in _WORD.finditer(text)]
        normalized = [normalize_name(w) for w, _, _ in words]
        found: list[dict] = []
        used: set[int] = set()
        for candidate, kind in self._keys:
            size = len(candidate.split(" "))
            for i in range(len(words) - size + 1):
                if any(j in used for j in range(i, i + size)) or " ".join(normalized[i : i + size]) != candidate:
                    continue
                if kind == "brand" and not words[i][0][:1].isupper():
                    continue
                start, end = words[i][1], words[i + size - 1][2]
                ids = self._names[candidate] if kind == "name" else self._brands[candidate]
                dose = _DOSE_AFTER.match(text, end)
                found.append({
                    "drug_ids": list(ids),
                    "raw_text": text[start:end],
                    "evidence": text[start : dose.end() if dose else end].strip(),
                    "mg_per_day": parse_daily_dose_mg(dose.group(0)) if dose else None,
                })
                used.update(range(i, i + size))
        return sorted(found, key=lambda f: text.find(f["raw_text"]))
