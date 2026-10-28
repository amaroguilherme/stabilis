"""Validates the knowledge base and builds the bundles consumed by the web app.

The canonical files live in knowledge/. The web app cannot import files outside webapp/
(Turbopack resolves only inside the project root), so the bundles below are generated into
webapp/app/lib/kb/ — and committed — with a content hash:

    kb.generated.json         the whole knowledge base (validated by core/kb.py); used by tests
    kb.client.generated.json  the same without citation quotes, review metadata or brand names
    brands.client.generated.json  brand names, loaded only by the medication search
    crisis.generated.json     the crisis lexicon

and webapp/public/kb-quotes.json, the quotes themselves, fetched only when someone opens a citation.

    python scripts/build_kb.py           # validate and regenerate after editing knowledge/
    python scripts/build_kb.py --check   # fail if invalid or if a generated file is stale (CI)

Citation quotes are checked separately against the downloaded sources:
    python -I scripts/fetch_sources.py && python -I scripts/verify_quotes.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core import kb as kb_module  # noqa: E402
from core.safety.crisis import compile_lexicon, normalize  # noqa: E402

GENERATED_BY = "scripts/build_kb.py — não edite este arquivo; edite knowledge/ e rode o script"
CRISIS_SOURCE = Path("knowledge/lexicons/crisis.pt-BR.json")
CRISIS_TARGET = Path("webapp/app/lib/kb/crisis.generated.json")
KB_TARGET = Path("webapp/app/lib/kb/kb.generated.json")
KB_CLIENT_TARGET = Path("webapp/app/lib/kb/kb.client.generated.json")
BRANDS_CLIENT_TARGET = Path("webapp/app/lib/kb/brands.client.generated.json")
QUOTES_TARGET = Path("webapp/public/kb-quotes.json")
QUOTE_FIELDS = ("quote", "absent_term", "note", "accessed")


def validate_crisis_lexicon(data: dict) -> list[str]:
    errors = []
    for key in ("terms", "negation_cues", "scope_terminators", "matching"):
        if key not in data:
            errors.append(f"campo obrigatório ausente: {key}")
    if errors:
        return errors

    seen_ids: set[str] = set()
    seen_phrases: dict[str, str] = {}
    for term in data["terms"]:
        if not set(term.get("modes", ["patient", "professional"])) <= {"patient", "professional"} or term.get("modes") == []:
            errors.append(f"modos inválidos em {term['id']}: {term.get('modes')}")
        if term["id"] in seen_ids:
            errors.append(f"id de termo repetido: {term['id']}")
        seen_ids.add(term["id"])
        for phrase in term["phrases"]:
            key = normalize(phrase)
            if not key:
                errors.append(f"expressão vazia após normalização em {term['id']}: {phrase!r}")
            elif key in seen_phrases:
                errors.append(f"expressão repetida ({key!r}) em {seen_phrases[key]} e {term['id']}")
            else:
                seen_phrases[key] = term["id"]
    try:
        compile_lexicon(data)
    except (KeyError, TypeError, ValueError) as exc:
        errors.append(f"léxico não compila: {type(exc).__name__}: {exc}")
    return errors


def render(source: str, data, extra: dict | None = None, content_hash: str | None = None) -> str:
    bundle = {
        "_generated_by": GENERATED_BY,
        "_source": source,
        **(extra or {}),
        "content_hash": content_hash or kb_module.content_hash(data),
        "data": data,
    }
    return json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def split_quotes(node, quotes: dict):
    """Copy of `node` where every citation keeps source/locator/accessed plus a `qid`; the quote,
    absent term and note go to `quotes[qid]`."""
    if isinstance(node, list):
        return [split_quotes(item, quotes) for item in node]
    if not isinstance(node, dict):
        return node
    if "source" in node and "locator" in node and any(k in node for k in QUOTE_FIELDS):
        moved = {k: node[k] for k in QUOTE_FIELDS if k in node}
        qid = hashlib.sha256(json.dumps([node["source"], node["locator"], moved], ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
        quotes[qid] = moved
        return {**{k: v for k, v in node.items() if k not in QUOTE_FIELDS}, "qid": qid}
    return {key: split_quotes(value, quotes) for key, value in node.items()}


def slim_for_client(data: dict, quotes: dict) -> dict:
    """What the browser needs: no quotes (fetched on demand), no review metadata, no notes on drug
    facts (shown nowhere in the app)."""
    slim = split_quotes(data, quotes)

    def drop_reviews(node):
        if isinstance(node, list):
            return [drop_reviews(item) for item in node]
        if isinstance(node, dict):
            return {k: drop_reviews(v) for k, v in node.items() if k != "review"}
        return node

    slim = drop_reviews(slim)
    # The engine needs only the tags; fact citations are not displayed (the full bundle keeps them).
    for drug in slim["drugs"]:
        drug["facts"] = [{k: v for k, v in fact.items() if k in ("tag", "severity")} for fact in drug["facts"]]
    # Brand names are only needed by the medication search, which loads them separately.
    slim["brands"] = {}
    return slim


def build() -> tuple[dict[Path, str], list[str]]:
    outputs: dict[Path, str] = {}
    errors: list[str] = []

    crisis = json.loads((ROOT / CRISIS_SOURCE).read_text(encoding="utf-8"))
    crisis_errors = validate_crisis_lexicon(crisis)
    errors += [f"{CRISIS_SOURCE}: {e}" for e in crisis_errors]
    if not crisis_errors:
        outputs[CRISIS_TARGET] = render(CRISIS_SOURCE.as_posix(), crisis)

    try:
        kb = kb_module.load_and_validate(ROOT / "knowledge")
    except kb_module.KnowledgeBaseError as exc:
        errors += exc.errors
    else:
        data = kb_module.bundle_data(kb)
        version = {"kb_version": kb.manifest["kb_version"]}
        full_hash = kb_module.content_hash(data)
        outputs[KB_TARGET] = render("knowledge/", data, version)
        quotes: dict = {}
        outputs[KB_CLIENT_TARGET] = render("knowledge/", slim_for_client(data, quotes), version, content_hash=full_hash)
        outputs[BRANDS_CLIENT_TARGET] = json.dumps({"content_hash": full_hash, "brands": data["brands"]}, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
        outputs[QUOTES_TARGET] = json.dumps({"content_hash": full_hash, "quotes": dict(sorted(quotes.items()))}, ensure_ascii=False, separators=(",", ":")) + "\n"
    return outputs, errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="não escreve; falha se houver erro ou arquivo gerado desatualizado")
    parser.add_argument("--validate-only", action="store_true", help="só valida (não escreve nem compara arquivos gerados)")
    parser.add_argument("--filter", action="append", default=[], help="com --validate-only: mostra só erros que contêm este texto (ex.: drugs/sertralina.json)")
    args = parser.parse_args()

    outputs, errors = build()
    if args.validate_only:
        shown = [e for e in errors if not args.filter or any(f in e for f in args.filter)]
        for error in shown:
            print(f"ERRO {error}", file=sys.stderr)
        print(f"{len(shown)} erro(s)" + (f" filtrados por {args.filter}" if args.filter else ""))
        return 1 if shown else 0
    for error in errors:
        print(f"ERRO {error}", file=sys.stderr)

    stale = False
    for target, rendered in outputs.items():
        path = ROOT / target
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if args.check:
            if current != rendered:
                stale = True
                print(f"DESATUALIZADO {target} — rode: python scripts/build_kb.py", file=sys.stderr)
        elif current != rendered:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(rendered, encoding="utf-8")
            print(f"gerado {target}")
        else:
            print(f"ok {target}")
    return 1 if errors or stale else 0


if __name__ == "__main__":
    sys.exit(main())
