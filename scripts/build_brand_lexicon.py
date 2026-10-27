"""Builds knowledge/lexicons/brands.pt-BR.json (brand name -> drug ids) from ANVISA open data.

Needs the dataset in the cache:  python -I scripts/fetch_sources.py anvisa-medicamentos
Run with:                        python -I scripts/build_brand_lexicon.py

Registrations of products whose active ingredients map to drugs in knowledge/drugs/ (through
names.anvisa_principles) are used, active or not: many people still call a medicine by a brand whose
registration has lapsed (Prozac, Tryptanol, Risperdal). Generic products are named after the active
ingredient, so they add no brand. A brand registered for different ingredient sets keeps the
union of drug ids: the autocomplete then asks which one the person means.
"""

from __future__ import annotations

import argparse
import collections
import csv
import json
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".sources-cache" / "anvisa-medicamentos"
TARGET = ROOT / "knowledge" / "lexicons" / "brands.pt-BR.json"


def normalize(text: str) -> str:
    """Lowercase without accents and with single spaces: the matching key used by the app."""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(stripped.lower().replace("®", " ").split())


def principle_index() -> dict[str, set[str]]:
    index: dict[str, set[str]] = collections.defaultdict(set)
    for path in sorted((ROOT / "knowledge" / "drugs").glob("*.json")):
        drug = json.loads(path.read_text(encoding="utf-8"))
        for principle in drug["names"]["anvisa_principles"]:
            index[principle.strip().lower()].add(drug["id"])
    return index


def drugs_for(principle_field: str, index: dict[str, set[str]]) -> set[str]:
    whole = principle_field.strip().lower()
    if whole in index:
        return set(index[whole])
    found: set[str] = set()
    for part in whole.split(", "):
        found |= index.get(part.strip(), set())
    return found


def build() -> dict:
    index = principle_index()
    known_names = {normalize(p) for p in index}
    brands: dict[str, set[str]] = collections.defaultdict(set)
    with (CACHE / "text.txt").open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter=";"):
            if (row.get("CATEGORIA_REGULATORIA") or "").strip() == "Genérico":
                continue
            drug_ids = drugs_for(row.get("PRINCIPIO_ATIVO") or "", index)
            if not drug_ids:
                continue
            name = normalize(row.get("NOME_PRODUTO") or "")
            # Products named after their ingredient ("cloridrato de sertralina") are not brands.
            if not name or name in known_names or any(name.startswith(p) for p in known_names):
                continue
            brands[name] |= drug_ids
    meta = json.loads((CACHE / "meta.json").read_text(encoding="utf-8"))
    return {
        "description": "Nomes comerciais registrados na ANVISA (com registro ativo ou não), com os medicamentos da base que contêm. Gerado; não edite à mão.",
        "source": "anvisa-medicamentos",
        "generated_by": "scripts/build_brand_lexicon.py",
        "retrieved_at": meta.get("retrieved_at", ""),
        "brands": {name: sorted(ids) for name, ids in sorted(brands.items())},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="falha se o arquivo gerado estiver desatualizado")
    args = parser.parse_args()
    if not (CACHE / "text.txt").exists():
        print("dataset ausente: rode python -I scripts/fetch_sources.py anvisa-medicamentos", file=sys.stderr)
        return 2
    rendered = json.dumps(build(), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        current = TARGET.read_text(encoding="utf-8") if TARGET.exists() else ""
        if current != rendered:
            print(f"{TARGET.relative_to(ROOT)} desatualizado: rode python -I scripts/build_brand_lexicon.py", file=sys.stderr)
            return 1
        print("ok")
        return 0
    TARGET.write_text(rendered, encoding="utf-8")
    data = json.loads(rendered)
    multi = sum(1 for ids in data["brands"].values() if len(ids) > 1)
    print(f"{len(data['brands'])} marcas ({multi} com mais de um medicamento) -> {TARGET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
