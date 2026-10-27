"""Latency of the extraction with the real model, in the Space's conditions (run under --cpus=2).

    python eval/bench_latency.py --gold eval/gold/v0.jsonl --runs 20

Reports the model load time (cold start) and warm latency per task (p50/p95). Texts come from the
gold set; only timings are printed.
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


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return round(ordered[min(len(ordered) - 1, int(q * len(ordered)))], 2)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--gold", type=Path, required=True)
    parser.add_argument("--runs", type=int, default=20, help="textos medidos por tarefa (após 1 de aquecimento)")
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
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
