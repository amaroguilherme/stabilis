"""Checks a gold set file before it is used or frozen (see eval/README.md).

    python eval/check_gold.py eval/gold/v0.jsonl

Fails on malformed lines, repeated ids or texts, and codes the knowledge base does not know
(conditions, habits, medications, `must_not_suggest`). Then compares the counts with the targets of
version 0: at least 200 patient texts, about 100 anamneses, at least 100 risk-related texts, half
of them hard negatives (tag "hard_negative"). Prints only counts and ids, never the texts.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.kb import load_and_validate  # noqa: E402

PREGNANCY = {"pregnant", "not_pregnant", "planning", "breastfeeding", None}
TARGETS = {"patient": 200, "professional": 100, "risk_related": 100, "hard_negative": 50}
KNOWN_TAGS = {"hard_negative", "regional", "brand_name", "no_punctuation", "abbreviations"}


def check(records: list[dict], kb) -> tuple[list[str], dict]:
    conditions = {c["id"] for c in kb.vocab["comorbidities"]["comorbidities"]}
    habits = {h["id"] for h in kb.vocab["comorbidities"]["habits"]}
    drugs = {d["id"] for d in kb.drugs}
    codes = {"condition": conditions, "habit": habits, "medication": drugs}
    errors: list[str] = []
    seen_ids: set[str] = set()
    seen_texts: dict[str, str] = {}
    stats = {"patient": 0, "professional": 0, "risk": 0, "critical_risk": 0, "hard_negative": 0, "risk_related": 0}

    for n, record in enumerate(records, 1):
        rid = record.get("id")
        where = f"linha {n} ({rid})"
        if not rid or not isinstance(rid, str):
            errors.append(f"linha {n}: sem id")
            continue
        if rid in seen_ids:
            errors.append(f"{where}: id repetido")
        seen_ids.add(rid)
        if record.get("task") not in ("patient", "professional"):
            errors.append(f"{where}: task deve ser patient ou professional")
        text = record.get("text")
        if not isinstance(text, str) or not text.strip():
            errors.append(f"{where}: texto vazio")
            continue
        normalized = " ".join(text.lower().split())
        if normalized in seen_texts:
            errors.append(f"{where}: mesmo texto de {seen_texts[normalized]}")
        seen_texts[normalized] = rid
        expected = record.get("expected")
        if not isinstance(expected, dict):
            errors.append(f"{where}: sem expected")
            continue
        for field, known in (("conditions", conditions), ("habits", habits), ("medications", drugs)):
            for code in expected.get(field, []):
                if code not in known:
                    errors.append(f"{where}: {field} com código desconhecido '{code}'")
        if expected.get("pregnancy") not in PREGNANCY:
            errors.append(f"{where}: pregnancy inválido '{expected.get('pregnancy')}'")
        if not isinstance(expected.get("risk"), bool) or not isinstance(expected.get("critical_risk"), bool):
            errors.append(f"{where}: risk e critical_risk precisam ser true ou false")
        elif expected["critical_risk"] and not expected["risk"]:
            errors.append(f"{where}: critical_risk exige risk")
        for item in expected.get("must_not_suggest", []):
            kind, _, code = item.partition(":")
            if kind not in codes or code not in codes[kind]:
                errors.append(f"{where}: must_not_suggest inválido '{item}' (use condition:, habit: ou medication: com código da base)")
            elif code in expected.get(f"{kind}s" if kind != "medication" else "medications", []):
                errors.append(f"{where}: '{item}' está ao mesmo tempo esperado e proibido")
        tags = set(record.get("tags", []))
        for tag in tags - KNOWN_TAGS:
            errors.append(f"{where}: tag desconhecida '{tag}'")
        if "hard_negative" in tags and expected.get("risk"):
            errors.append(f"{where}: hard_negative não pode ter risk = true")

        stats[record["task"]] = stats.get(record["task"], 0) + 1
        stats["risk"] += bool(expected.get("risk"))
        stats["critical_risk"] += bool(expected.get("critical_risk"))
        stats["hard_negative"] += "hard_negative" in tags
    stats["risk_related"] = stats["risk"] + stats["hard_negative"]
    return errors, stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("gold", type=Path)
    args = parser.parse_args()
    records, errors = [], []
    for n, line in enumerate(args.gold.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as exc:
            errors.append(f"linha {n}: JSON inválido ({exc.msg})")
    more, stats = check(records, load_and_validate())
    errors += more
    for error in errors:
        print(f"ERRO {error}", file=sys.stderr)
    print(json.dumps(stats, ensure_ascii=False))
    for key, target in TARGETS.items():
        if stats.get(key, 0) < target:
            print(f"abaixo da meta da versão 0: {key} = {stats.get(key, 0)} (meta {target})")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
