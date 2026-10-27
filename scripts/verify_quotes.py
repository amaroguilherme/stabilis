"""Checks every citation in knowledge/ against the downloaded source text.

For each citation:
- `quote`: must appear in .sources-cache/<source>/text.txt (case-insensitive, whitespace and
  line-break hyphenation normalized). When the locator starts with "pdf p. N" (or "pdf p. N-M"),
  the quote must appear on those pages.
- `absent_term`: must NOT appear anywhere in the source (accent-insensitive).

Sources that are not in the cache are reported as "sem cache" and do not fail the run, so this can
run anywhere; download them first with `python -I scripts/fetch_sources.py`.

Reads untrusted downloaded text, so it is self-contained:
    python -I scripts/verify_quotes.py            # summary + failures
    python -I scripts/verify_quotes.py --verbose  # every citation
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE = ROOT / "knowledge"
CACHE = ROOT / ".sources-cache"

_PAGE_LOCATOR = re.compile(r"^pdf p\.\s*(\d+)(?:\s*[-–]\s*(\d+))?", re.IGNORECASE)
_PAGE_MARKER = re.compile(r"^\[\[pdf p\. (\d+)\]\]$", re.MULTILINE)
_TRANSLATE = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-",
                            "−": "-", "­": "", "ﬁ": "fi", "ﬂ": "fl"})
_TRANSLATE.update({0x2010: "-", 0x2011: "-", 0x2012: "-"})  # hyphen, non-breaking hyphen, figure dash


def normalize(text: str, strip_accents: bool = False) -> str:
    text = unicodedata.normalize("NFKC", text).translate(_TRANSLATE)
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)  # join words hyphenated across lines
    if strip_accents:
        text = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.category(c).startswith("M"))
    return re.sub(r"\s+", " ", text).strip().lower()


def walk_cites(node, path=""):
    if isinstance(node, dict):
        if "source" in node and "locator" in node and ("quote" in node or "absent_term" in node):
            yield path, node
        for key, value in node.items():
            yield from walk_cites(value, f"{path}/{key}")
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from walk_cites(value, f"{path}/{index}")


class SourceText:
    def __init__(self, raw: str):
        self.raw = raw
        self.full = normalize(raw)
        self.full_ascii = normalize(raw, strip_accents=True)
        self.pages: dict[int, str] = {}
        markers = list(_PAGE_MARKER.finditer(raw))
        for i, marker in enumerate(markers):
            end = markers[i + 1].start() if i + 1 < len(markers) else len(raw)
            self.pages[int(marker.group(1))] = normalize(raw[marker.end():end])

    def page_range(self, first: int, last: int) -> str:
        return " ".join(self.pages.get(p, "") for p in range(first, last + 1))


def check(cite: dict, text: SourceText) -> tuple[str, str]:
    if "absent_term" in cite:
        term = normalize(cite["absent_term"], strip_accents=True)
        return ("ok", "ausente, como afirmado") if term not in text.full_ascii else ("falha", f"o termo '{cite['absent_term']}' aparece na fonte")
    quote = normalize(cite["quote"])
    match = _PAGE_LOCATOR.match(cite["locator"])
    if match and text.pages:
        first = int(match.group(1))
        last = int(match.group(2) or first)
        if quote in text.page_range(first, last):
            return "ok", f"encontrado em pdf p. {first}" + (f"-{last}" if last != first else "")
        if quote in text.full:
            pages = [p for p, page_text in text.pages.items() if quote in page_text]
            return "falha", f"trecho existe, mas fora da página indicada (está em pdf p. {pages[:3] or '?'})"
        return "falha", "trecho não encontrado na fonte"
    return ("ok", "encontrado") if quote in text.full else ("falha", "trecho não encontrado na fonte")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("paths", nargs="*", help="arquivos de knowledge/ a conferir (padrão: todos)")
    args = parser.parse_args()

    texts: dict[str, SourceText | None] = {}
    counts: Counter[str] = Counter()
    failures: list[str] = []

    if args.paths:
        files = sorted((ROOT / p).resolve() if not Path(p).is_absolute() else Path(p) for p in args.paths)
    else:
        files = sorted(p for p in KNOWLEDGE.rglob("*.json") if "schema" not in p.parts and "tests" not in p.parts)
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        for pointer, cite in walk_cites(json.loads(path.read_text(encoding="utf-8"))):
            source = cite["source"]
            if source not in texts:
                text_file = CACHE / source / "text.txt"
                texts[source] = SourceText(text_file.read_text(encoding="utf-8")) if text_file.exists() else None
            if texts[source] is None:
                counts["sem cache"] += 1
                if args.verbose:
                    print(f"? {rel}{pointer}: fonte '{source}' não está em .sources-cache")
                continue
            status, detail = check(cite, texts[source])
            counts[status] += 1
            line = f"{rel}{pointer} [{source} · {cite['locator']}]: {detail}"
            if status == "falha":
                failures.append(line)
            elif args.verbose:
                print(f"✓ {line}")

    for line in failures:
        print(f"✗ {line}", file=sys.stderr)
    total = sum(counts.values())
    print(f"{total} citações: {counts['ok']} conferidas, {counts['falha']} com falha, {counts['sem cache']} sem cache")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
