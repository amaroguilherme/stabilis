"""Downloads the documents listed in knowledge/sources.json and extracts their text.

Each source goes to its own directory, .sources-cache/<id>/ (ignored by git):
    source.<ext>   the downloaded document
    text.txt       extracted text with locator markers ([[pdf p. N]], [[sec Title]], [[section Title]])
    meta.json      retrieval URL, date, size and sha256

scripts/verify_quotes.py then checks every citation quote against text.txt.

Downloaded files are untrusted data: this script is self-contained and meant to run isolated:
    python -I scripts/fetch_sources.py              # all sources not yet cached
    python -I scripts/fetch_sources.py rename-2024  # specific sources
    python -I scripts/fetch_sources.py --force      # re-download everything
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import warnings

import requests
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

ROOT = Path(__file__).resolve().parents[1]
SOURCES_FILE = ROOT / "knowledge" / "sources.json"
CACHE = ROOT / ".sources-cache"
TIMEOUT = 180
HEADERS = {"User-Agent": "stabilis-knowledge-fetcher/0.1 (+https://github.com/amaroguilherme/stabilis)"}


def _clean_lines(text: str) -> str:
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in text.splitlines()]
    out: list[str] = []
    for line in lines:
        if line or (out and out[-1]):
            out.append(line)
    return "\n".join(out).strip() + "\n"


def _download(url: str, target: Path) -> requests.Response:
    response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    response.raise_for_status()
    target.write_bytes(response.content)
    return response


def fetch_pdf(retrieval: dict, folder: Path) -> tuple[str, Path]:
    pdf = folder / "source.pdf"
    response = _download(retrieval["url"], pdf)
    if not pdf.read_bytes().startswith(b"%PDF"):
        raise RuntimeError(f"not a PDF (content-type {response.headers.get('content-type')})")
    raw = subprocess.run(["pdftotext", "-enc", "UTF-8", str(pdf), "-"], check=True, capture_output=True).stdout
    pages = raw.decode("utf-8", errors="replace").split("\f")
    parts = [f"[[pdf p. {n}]]\n{_clean_lines(page)}" for n, page in enumerate(pages, start=1) if page.strip()]
    return "\n".join(parts), pdf


def fetch_html(retrieval: dict, folder: Path) -> tuple[str, Path]:
    html = folder / "source.html"
    _download(retrieval["url"], html)
    soup = BeautifulSoup(html.read_text(encoding="utf-8", errors="replace"), "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "form"]):
        tag.decompose()
    main = soup.find("main") or soup.body or soup
    return _clean_lines(main.get_text("\n")), html


def _europepmc_text(xml_text: str) -> str:
    soup = BeautifulSoup(xml_text, "html.parser")
    for tag in soup(["ref-list", "back"]):
        tag.decompose()
    lines: list[str] = []
    title = soup.find("article-title")
    if title:
        lines.append(f"[[title]] {title.get_text(' ', strip=True)}")
    abstract = soup.find("abstract")
    if abstract:
        lines.append("[[sec Abstract]]")
        lines.append(abstract.get_text(" ", strip=True))
    body = soup.find("body")
    if body:
        for node in body.find_all(["title", "p", "table-wrap"]):
            if node.name == "title" and node.parent and node.parent.name == "sec":
                lines.append(f"[[sec {node.get_text(' ', strip=True)}]]")
            elif node.name == "p" and not node.find_parent("table-wrap"):
                lines.append(node.get_text(" ", strip=True))
            elif node.name == "table-wrap":
                label = node.find("label")
                caption = node.find("caption")
                lines.append(f"[[table {label.get_text(' ', strip=True) if label else ''}]] "
                             f"{caption.get_text(' ', strip=True) if caption else ''}")
                for row in node.find_all("tr"):
                    cells = [c.get_text(" ", strip=True) for c in row.find_all(["td", "th"])]
                    lines.append(" | ".join(cells))
    return _clean_lines("\n".join(lines))


def fetch_europepmc(retrieval: dict, folder: Path) -> tuple[str, Path]:
    search = requests.get(
        "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        params={"query": f"DOI:{retrieval['doi']}", "format": "json", "resultType": "lite"},
        headers=HEADERS, timeout=TIMEOUT,
    )
    search.raise_for_status()
    results = search.json().get("resultList", {}).get("result", [])
    pmcid = next((r.get("pmcid") for r in results if r.get("pmcid")), None)
    if not pmcid:
        raise RuntimeError("no open-access full text (PMCID) found for this DOI")
    xml = folder / "source.xml"
    _download(f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML", xml)
    return _europepmc_text(xml.read_text(encoding="utf-8", errors="replace")), xml


def _spl_section_text(section) -> str:
    text = section.find("text", recursive=False)
    return text.get_text(" ", strip=True) if text else ""


def _dailymed_text(xml_text: str) -> str:
    soup = BeautifulSoup(xml_text, "html.parser")
    lines: list[str] = []
    title = soup.find("title")
    if title:
        lines.append(f"[[title]] {title.get_text(' ', strip=True)}")
    for section in soup.find_all("section"):
        heading = section.find("title", recursive=False)
        code = section.find("code", recursive=False)
        name = heading.get_text(" ", strip=True) if heading else (code.get("displayname", "") if code else "")
        lines.append(f"[[section {name}]]")
        lines.append(_spl_section_text(section))
        # The label's Highlights live in each section's <excerpt>; keep them as their own sections.
        excerpt = section.find("excerpt", recursive=False)
        if excerpt:
            lines.append(f"[[section Highlights: {name}]]")
            lines.append(excerpt.get_text(" ", strip=True))
    return _clean_lines("\n".join(lines))


def fetch_dailymed(retrieval: dict, folder: Path) -> tuple[str, Path]:
    xml = folder / "source.xml"
    _download(f"https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/{retrieval['setid']}.xml", xml)
    return _dailymed_text(xml.read_text(encoding="utf-8", errors="replace")), xml


def fetch_file(retrieval: dict, folder: Path) -> tuple[str, Path]:
    suffix = Path(retrieval["url"].split("?")[0]).suffix or ".bin"
    target = folder / f"source{suffix}"
    _download(retrieval["url"], target)
    return target.read_bytes().decode(retrieval.get("encoding", "utf-8"), errors="replace"), target


def fetch_local(retrieval: dict, folder: Path) -> tuple[str, Path]:
    origin = ROOT / retrieval["path"]
    target = folder / f"source{origin.suffix}"
    target.write_bytes(origin.read_bytes())
    return origin.read_text(encoding="utf-8"), target


FETCHERS = {"pdf": fetch_pdf, "html": fetch_html, "europepmc": fetch_europepmc, "dailymed": fetch_dailymed,
            "file": fetch_file, "local": fetch_local}
# Rebuild text.txt from the document already in the cache (after a parser change), without downloading.
REPARSERS = {"dailymed": lambda folder: _dailymed_text((folder / "source.xml").read_text(encoding="utf-8", errors="replace"))}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ids", nargs="*", help="ids de fontes (padrão: todas)")
    parser.add_argument("--force", action="store_true", help="baixa de novo mesmo se já estiver no cache")
    parser.add_argument("--reparse", action="store_true", help="refaz o texto a partir do documento em cache, sem baixar")
    args = parser.parse_args()

    sources = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))["sources"]
    selected = [s for s in sources if not args.ids or s["id"] in args.ids]
    unknown = set(args.ids) - {s["id"] for s in sources}
    if unknown:
        print(f"ids desconhecidos: {', '.join(sorted(unknown))}", file=sys.stderr)
        return 2

    failed = False
    for source in selected:
        retrieval = source.get("retrieval")
        folder = CACHE / source["id"]
        if not retrieval:
            print(f"- {source['id']}: sem recuperação automática (conferir manualmente)")
            continue
        if args.reparse:
            reparse = REPARSERS.get(retrieval["kind"])
            if reparse and (folder / "meta.json").exists():
                text = reparse(folder)
                (folder / "text.txt").write_text(text, encoding="utf-8")
                print(f"~ {source['id']}: texto refeito ({len(text)} caracteres)")
            continue
        if (folder / "text.txt").exists() and not args.force:
            print(f"= {source['id']}: já no cache")
            continue
        folder.mkdir(parents=True, exist_ok=True)
        try:
            text, document = FETCHERS[retrieval["kind"]](retrieval, folder)
        except Exception as exc:  # report and keep going with the other sources
            failed = True
            print(f"! {source['id']}: falhou ({type(exc).__name__}: {exc})", file=sys.stderr)
            continue
        (folder / "text.txt").write_text(text, encoding="utf-8")
        meta = {
            "id": source["id"],
            "retrieved_from": retrieval.get("url") or retrieval.get("doi") or retrieval.get("setid") or retrieval.get("path"),
            "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "file": document.name,
            "bytes": document.stat().st_size,
            "sha256": hashlib.sha256(document.read_bytes()).hexdigest(),
        }
        (folder / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
        print(f"+ {source['id']}: {meta['bytes']} bytes, {len(text)} caracteres de texto")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
