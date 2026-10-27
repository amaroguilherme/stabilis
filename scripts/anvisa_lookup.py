"""Looks up active ingredients and brand names in ANVISA's open data on registered medicines.

Needs the dataset in the cache (python -I scripts/fetch_sources.py anvisa-medicamentos).

    python -I scripts/anvisa_lookup.py "\\bfluoxetina\\b"
    python -I scripts/anvisa_lookup.py "valpro" --brands 15

Prints each matching PRINCIPIO_ATIVO value with its count of active ("Ativo") and inactive
registrations, and the most common product names among active registrations.
"""

from __future__ import annotations

import argparse
import collections
import csv
import re
import sys
from pathlib import Path

DATASET = Path(__file__).resolve().parents[1] / ".sources-cache" / "anvisa-medicamentos" / "text.txt"


def rows():
    with DATASET.open(encoding="utf-8") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        yield from reader


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pattern", help="expressão regular aplicada ao PRINCIPIO_ATIVO (minúsculas)")
    parser.add_argument("--brands", type=int, default=10, help="quantos nomes de produto mostrar")
    args = parser.parse_args()
    if not DATASET.exists():
        print("dataset ausente: rode python -I scripts/fetch_sources.py anvisa-medicamentos", file=sys.stderr)
        return 2

    pattern = re.compile(args.pattern, re.IGNORECASE)
    principles: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    brands: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for row in rows():
        principle = (row.get("PRINCIPIO_ATIVO") or "").strip()
        if not principle or not pattern.search(principle):
            continue
        status = (row.get("SITUACAO_REGISTRO") or "").strip()
        principles[principle][status] += 1
        if status == "Ativo":
            brands[principle][(row.get("NOME_PRODUTO") or "").strip()] += 1

    for principle in sorted(principles, key=lambda p: -principles[p]["Ativo"]):
        counts = principles[principle]
        top = ", ".join(name for name, _ in brands[principle].most_common(args.brands))
        print(f"{counts['Ativo']:4d} ativos / {counts['Inativo']:4d} inativos | {principle}")
        if top:
            print(f"      marcas: {top}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
