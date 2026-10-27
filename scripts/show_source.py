"""Prints parts of a cached source to help write citations with verbatim quotes.

    python -I scripts/show_source.py label-fluoxetina --sections            # list section markers
    python -I scripts/show_source.py label-fluoxetina "5.2 Serotonin"       # text of matching sections
    python -I scripts/show_source.py rename-2024 --page 131                 # text of a PDF page
    python -I scripts/show_source.py nice-ng222 --grep "first-line" -C 300  # matches with context

Copy quotes from this output: scripts/verify_quotes.py compares them with the same text.
"""

from __future__ import annotations

import argparse
import re
import sys
import textwrap
from pathlib import Path

CACHE = Path(__file__).resolve().parents[1] / ".sources-cache"
MARKER = re.compile(r"^\[\[(section|sec|table|pdf p\.) ?(.*?)\]\]", re.MULTILINE)
MARKER_FLAT = re.compile(r"\[\[(section|sec|table|pdf p\.) ?(.*?)\]\]")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source")
    parser.add_argument("section", nargs="?", help="trecho do título da seção (sem diferenciar maiúsculas)")
    parser.add_argument("--sections", action="store_true", help="lista os marcadores de seção/página")
    parser.add_argument("--page", type=int, help="página do PDF")
    parser.add_argument("--grep", help="expressão regular; mostra cada ocorrência com contexto")
    parser.add_argument("-C", "--context", type=int, default=250, help="caracteres de contexto para --grep")
    parser.add_argument("--width", type=int, default=140)
    args = parser.parse_args()

    path = CACHE / args.source / "text.txt"
    if not path.exists():
        print(f"fonte não está no cache: {args.source}", file=sys.stderr)
        return 2
    text = path.read_text(encoding="utf-8")
    markers = list(MARKER.finditer(text))

    if args.sections:
        for marker in markers:
            print(marker.group(0))
        return 0

    if args.grep:
        flat = re.sub(r"\s+", " ", text)
        for match in re.finditer(args.grep, flat, re.IGNORECASE):
            start, end = max(0, match.start() - args.context), min(len(flat), match.end() + args.context)
            before = list(MARKER_FLAT.finditer(flat[:match.start()]))
            where = before[-1].group(0) if before else "(início)"
            print(f"--- {where}")
            print(textwrap.fill(flat[start:end], args.width))
        return 0

    chunks = []
    for i, marker in enumerate(markers):
        end = markers[i + 1].start() if i + 1 < len(markers) else len(text)
        label = marker.group(2)
        if args.page is not None and marker.group(1) == "pdf p." and label == str(args.page):
            chunks.append((marker.group(0), text[marker.end():end]))
        elif args.section and marker.group(1) != "pdf p." and args.section.lower() in label.lower():
            chunks.append((marker.group(0), text[marker.end():end]))
    if not chunks:
        print("nada encontrado", file=sys.stderr)
        return 1
    for title, body in chunks:
        print(title)
        print(textwrap.fill(re.sub(r"\s+", " ", body).strip(), args.width))
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
