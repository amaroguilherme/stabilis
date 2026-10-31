"""Measures the extraction against the frozen gold set (see eval/README.md).

    python eval/run_eval.py --gold eval/gold/v0.jsonl [--out report.json] [--gates] [--baseline prod.json] [--fake]

With --fake a scripted model echoes the gold annotations (useful to test the harness itself);
otherwise the model comes from the environment (MODEL_REPO_ID, MODEL_FILENAME, MODEL_REVISION), and so
does the prompt (EXTRACTION_PROMPT, read exactly as the Space reads it). Progress goes to stderr.
With --baseline (the report of the model in production, on the same gold set) the gates also require
F1 per group and improper suggestions to be no worse. The report holds only metrics and gold ids,
never the texts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.extraction.extract import Extractor  # noqa: E402
from core.kb import load_and_validate  # noqa: E402
from core.service import prompt_style_from_env  # noqa: E402

GATES = {
    "schema_valid_rate": (">=", 1.0),
    "risk_recall": (">=", 0.98),
    "critical_risk_recall": (">=", 1.0),
    "unsupported_rate": ("<=", 0.01),
}


def load_gold(path: Path) -> list[dict]:
    records = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    ids = [r["id"] for r in records]
    if len(ids) != len(set(ids)):
        raise SystemExit("ids repetidos no gold set")
    return records


def echo_model(records: list[dict]):
    """Fake model that answers with the gold annotation of the text found in the prompt."""
    from core.llm.fake import FakeLlm

    by_text = {r["text"]: r for r in records}

    def respond(prompt: str) -> dict:
        text = prompt.rsplit("<<<TEXTO\n", 1)[1].rsplit("\nTEXTO>>>", 1)[0]
        record = by_text.get(text, {"expected": {}})
        expected = record["expected"]

        def attrs(**extra):
            return {"negated": False, "experiencer": "patient", "temporality": "current", **extra}

        return {
            "symptoms": [],
            "risk": [attrs(kind="suicidal_ideation", evidence=text)] if expected.get("risk") else [],
            "medications": [{"name": m, "evidence": m, "status": "current"} for m in expected.get("medications", []) if m in text.lower()],
            "conditions": [],
            "substances": [],
            "pregnancy": {"status": expected.get("pregnancy") or "unknown"},
        }

    return FakeLlm(respond)


def f1(expected: set, got: set) -> tuple[int, int, int]:
    return len(expected & got), len(got - expected), len(expected - got)


def summarize_f1(tp: int, fp: int, fn: int) -> dict:
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn) if tp + fn else 1.0
    score = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(score, 4), "tp": tp, "fp": fp, "fn": fn}


def evaluate(records: list[dict], extractor: Extractor, progress=None) -> dict:
    groups = {"conditions": [0, 0, 0], "habits": [0, 0, 0], "medications": [0, 0, 0]}
    valid = proposed = unsupported = 0
    risk_pos = risk_hit = crit_pos = crit_hit = neg_total = neg_false_alarm = 0
    improper: list[str] = []
    pregnancy_ok = pregnancy_total = 0
    latencies: list[float] = []
    missed_risk: list[str] = []

    for done, record in enumerate(records, 1):
        expected = record["expected"]
        started = time.perf_counter()
        out = extractor.extract(record["text"], record["task"])
        latencies.append(time.perf_counter() - started)
        valid += not out["degraded"]
        proposed += out["items_proposed"]
        unsupported += out["discarded_unsupported"]
        s = out["suggestions"]
        got = {
            "conditions": {c["id"] for c in s["conditions"]},
            "habits": {h["id"] for h in s["habits"]},
            "medications": {m["drug_id"] for m in s["medications"] if m["drug_id"]},
        }
        for group, counts in groups.items():
            for i, value in enumerate(f1(set(expected.get(group, [])), got[group])):
                counts[i] += value
        flagged = out["crisis"]["language"]
        if expected.get("risk"):
            risk_pos += 1
            risk_hit += flagged
            if not flagged:
                missed_risk.append(record["id"])
            if expected.get("critical_risk"):
                crit_pos += 1
                crit_hit += flagged
        else:
            neg_total += 1
            neg_false_alarm += flagged
        suggested = {f"condition:{c}" for c in got["conditions"]} | {f"habit:{h}" for h in got["habits"]} | {f"medication:{m}" for m in got["medications"]}
        improper += [f"{record['id']}:{item}" for item in expected.get("must_not_suggest", []) if item in suggested]
        if "pregnancy" in expected:
            pregnancy_total += 1
            pregnancy_ok += (s["pregnancy"] or {}).get("status") == expected["pregnancy"]
        if progress:
            progress(done, len(records), sum(latencies))

    n = len(records)
    ordered = sorted(latencies)
    return {
        "records": n,
        "improper_count": len(improper),
        "schema_valid_rate": round(valid / n, 4) if n else 0.0,
        "unsupported_rate": round(unsupported / proposed, 4) if proposed else 0.0,
        "risk_recall": round(risk_hit / risk_pos, 4) if risk_pos else None,
        "critical_risk_recall": round(crit_hit / crit_pos, 4) if crit_pos else None,
        "risk_false_alarm_rate": round(neg_false_alarm / neg_total, 4) if neg_total else None,
        "missed_risk_ids": missed_risk,
        "groups": {group: summarize_f1(*counts) for group, counts in groups.items()},
        "improper_suggestions": improper,
        "pregnancy_accuracy": round(pregnancy_ok / pregnancy_total, 4) if pregnancy_total else None,
        "latency_s": {
            "p50": round(statistics.median(ordered), 3) if ordered else None,
            "p95": round(ordered[min(len(ordered) - 1, int(0.95 * len(ordered)))], 3) if ordered else None,
        },
    }


def check_gates(report: dict, baseline: dict | None = None) -> list[str]:
    failures = []
    for metric, (op, target) in GATES.items():
        value = report.get(metric)
        if value is None:
            continue
        ok = value >= target if op == ">=" else value <= target
        if not ok:
            failures.append(f"{metric} = {value} (meta {op} {target})")
    if baseline is not None:
        if baseline.get("gold_sha256") != report.get("gold_sha256"):
            failures.append("baseline medido em outro gold set: compare no mesmo arquivo")
            return failures
        for group, metrics in report["groups"].items():
            before = baseline["groups"][group]["f1"]
            if metrics["f1"] < before:
                failures.append(f"F1 de {group} = {metrics['f1']} (baseline {before})")
        if report["improper_count"] > baseline["improper_count"]:
            failures.append(f"sugestões indevidas = {report['improper_count']} (baseline {baseline['improper_count']})")
    return failures


def print_progress(done: int, total: int, elapsed_s: float) -> None:
    """Every 10 texts, on stderr (stdout carries the report), with a rough estimate of the time left."""
    if done % 10 and done != total:
        return
    left_s = elapsed_s / done * (total - done)
    print(f"{done}/{total} textos, {elapsed_s / 60:.0f} min até aqui, faltam ~{left_s / 60:.0f} min", file=sys.stderr, flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--gold", type=Path, required=True)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--fake", action="store_true", help="modelo simulado que repete o gold (testa o harness)")
    parser.add_argument("--gates", action="store_true", help="falha se algum portão de promoção não for atingido")
    parser.add_argument("--baseline", type=Path, help="relatório do modelo em produção, no mesmo gold set (portões relativos)")
    args = parser.parse_args()

    records = load_gold(args.gold)
    kb = load_and_validate()
    style = "full"
    if args.fake:
        llm = echo_model(records)
    else:
        from core.llm.llamacpp import LlamaCppClient

        llm = LlamaCppClient()
        if llm.status != "ready":
            print(f"modelo indisponível: {llm.load_error}", file=sys.stderr)
            return 2
        style = prompt_style_from_env()
    report = evaluate(records, Extractor(llm, kb, prompt_style=style), progress=print_progress)
    report["gold_sha256"] = hashlib.sha256(args.gold.read_bytes()).hexdigest()
    if args.fake:
        report["model"] = "fake"
    else:
        report["model"] = {k: os.getenv(v) for k, v in (("repo", "MODEL_REPO_ID"), ("file", "MODEL_FILENAME"), ("revision", "MODEL_REVISION"))}
        report["model"]["prompt"] = style
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    if args.gates:
        baseline = json.loads(args.baseline.read_text(encoding="utf-8")) if args.baseline else None
        failures = check_gates(report, baseline)
        for failure in failures:
            print(f"PORTÃO NÃO ATINGIDO: {failure}", file=sys.stderr)
        return 1 if failures else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
