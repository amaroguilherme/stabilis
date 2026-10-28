"""Latency of the extraction with the real model, in the Space's conditions (run under --cpus=2).

    python eval/bench_latency.py --gold eval/gold/v0.jsonl --runs 20 [--out latency.json] [--gates]

Reports the model load time (cold start) and warm latency per task (p50/p95). Texts come from the
gold set; only timings are printed. With --gates, fails above the promotion limits (warm p95 of
40 s for patient texts and 60 s for anamneses, cold start of 3 minutes).
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.extraction.extract import Extractor  # noqa: E402
from core.kb import load_and_validate  # noqa: E402


P95_LIMIT_S = {"patient": 40, "professional": 60}
COLD_START_LIMIT_S = 180


def check_latency(report: dict) -> list[str]:
    failures = []
    if report["cold_start_s"] > COLD_START_LIMIT_S:
        failures.append(f"cold start = {report['cold_start_s']} s (meta <= {COLD_START_LIMIT_S} s)")
    for task, limit in P95_LIMIT_S.items():
        measured = report["tasks"].get(task)
        if measured is None:
            failures.append(f"sem textos de {task} para medir")
        elif measured["p95_s"] > limit:
            failures.append(f"p95 {task} = {measured['p95_s']} s (meta <= {limit} s)")
    return failures


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return round(ordered[min(len(ordered) - 1, int(q * len(ordered)))], 2)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--gold", type=Path, required=True)
    parser.add_argument("--runs", type=int, default=20, help="textos medidos por tarefa (após 1 de aquecimento)")
    parser.add_argument("--out", type=Path, help="salva o relatório em JSON")
    parser.add_argument("--gates", action="store_true", help="falha acima dos limites de promoção")
    args = parser.parse_args()

    from core.llm.llamacpp import LlamaCppClient

    started = time.perf_counter()
    llm = LlamaCppClient()
    cold_start = time.perf_counter() - started
    if llm.status != "ready":
        print(f"modelo indisponível: {llm.load_error}", file=sys.stderr)
        return 2
    extractor = Extractor(llm, load_and_validate())
    records = [json.loads(line) for line in args.gold.read_text(encoding="utf-8").splitlines() if line.strip()]

    report = {"cold_start_s": round(cold_start, 1), "tasks": {}}
    for task in ("patient", "professional"):
        texts = [r["text"] for r in records if r["task"] == task][: args.runs + 1]
        if len(texts) < 2:
            continue
        extractor.extract(texts[0], task)  # warm-up
        timings = []
        for text in texts[1:]:
            t0 = time.perf_counter()
            extractor.extract(text, task)
            timings.append(time.perf_counter() - t0)
        report["tasks"][task] = {"n": len(timings), "p50_s": round(statistics.median(timings), 2), "p95_s": percentile(timings, 0.95)}
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    if args.gates:
        failures = check_latency(report)
        for failure in failures:
            print(f"PORTÃO NÃO ATINGIDO: {failure}", file=sys.stderr)
        return 1 if failures else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
