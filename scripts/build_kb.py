"""Builds the knowledge-base bundles consumed by the web app.

The canonical files live in knowledge/. The web app cannot import files outside webapp/
(Turbopack resolves only inside the project root), so each canonical file is copied into
webapp/app/lib/kb/*.generated.json — which is committed — with a content hash.

    python scripts/build_kb.py           # regenerate after editing knowledge/
    python scripts/build_kb.py --check   # fail if a generated file is stale (CI / pre-commit)

Phase 0 ships only the crisis lexicon; Phase 1 extends this to the full knowledge base.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.safety.crisis import compile_lexicon, normalize  # noqa: E402

BUNDLES = {
    Path("knowledge/lexicons/crisis.pt-BR.json"): Path("webapp/app/lib/kb/crisis.generated.json"),
}


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


VALIDATORS = {
    Path("knowledge/lexicons/crisis.pt-BR.json"): validate_crisis_lexicon,
}


def render(source: Path, data: dict) -> str:
    canonical = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    bundle = {
        "_generated_by": "scripts/build_kb.py — não edite este arquivo; edite knowledge/ e rode o script",
        "_source": source.as_posix(),
        "content_hash": "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "data": data,
    }
    return json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="não escreve; falha se algum arquivo gerado estiver desatualizado")
    args = parser.parse_args()

    failed = False
    for source, target in BUNDLES.items():
        data = json.loads((ROOT / source).read_text(encoding="utf-8"))
        errors = VALIDATORS[source](data)
        if errors:
            failed = True
            print(f"ERRO {source}:", *errors, sep="\n  - ", file=sys.stderr)
            continue

        rendered = render(source, data)
        current = (ROOT / target).read_text(encoding="utf-8") if (ROOT / target).exists() else None
        if args.check:
            if current != rendered:
                failed = True
                print(f"DESATUALIZADO {target} — rode: python scripts/build_kb.py", file=sys.stderr)
            continue
        if current != rendered:
            (ROOT / target).parent.mkdir(parents=True, exist_ok=True)
            (ROOT / target).write_text(rendered, encoding="utf-8")
            print(f"gerado {target}")
        else:
            print(f"ok {target}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
