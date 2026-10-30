"""Latency of the language service where it really runs: the Hugging Face Space (2 vCPUs).

    STABILIS_API_URL=https://amaroguilherme-stabilis-api.hf.space HF_SPACE_TOKEN=hf_... \\
      python eval/bench_space.py --gold eval/gold/v0.jsonl --runs 20 --gates --out eval/reports/latencia.json

Waits until /ready answers 200 and reports how long that took (the cold start: restart the Space just
before running to measure it), then sends gold-set texts one at a time through /jobs, measuring the
time until each result arrives. The limits are those of bench_latency.py (warm p95 of 40 s for
patient texts and 60 s for anamneses; cold start of 3 minutes). Prints only timings; every result is
deleted on the server as soon as it is read.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from eval.bench_latency import check_latency, percentile  # noqa: E402

READY_TIMEOUT_S = 15 * 60
JOB_TIMEOUT_S = 10 * 60


class Space:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def call(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"},
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read()
                return response.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            try:
                return exc.code, json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return exc.code, {}
        except (urllib.error.URLError, TimeoutError):
            return 0, {}

    def wait_ready(self) -> float:
        started = time.perf_counter()
        while time.perf_counter() - started < READY_TIMEOUT_S:
            status, _ = self.call("GET", "/ready")
            if status == 200:
                return time.perf_counter() - started
            time.sleep(5)
        raise SystemExit("o Space não ficou pronto em 15 minutos")

    def extract(self, task: str, text: str) -> float:
        started = time.perf_counter()
        status, body = self.call("POST", "/jobs", {"kind": "extract", "input": {"task": task, "text": text}})
        if status not in (200, 202) or "job_id" not in body:
            raise SystemExit(f"o Space recusou o job (HTTP {status}, {body.get('error', 'sem detalhe')})")
        job = body["job_id"]
        try:
            while time.perf_counter() - started < JOB_TIMEOUT_S:
                status, body = self.call("GET", f"/jobs/{job}")
                if body.get("status") == "done":
                    return time.perf_counter() - started
                if body.get("status") == "error" or status == 404:
                    raise SystemExit(f"o job falhou no Space ({body.get('error', status)})")
                time.sleep(1)
            raise SystemExit("um job passou de 10 minutos")
        finally:
            self.call("DELETE", f"/jobs/{job}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--gold", type=Path, required=True)
    parser.add_argument("--runs", type=int, default=20, help="textos medidos por tarefa (após 1 de aquecimento)")
    parser.add_argument("--out", type=Path, help="salva o relatório em JSON")
    parser.add_argument("--gates", action="store_true", help="falha acima dos limites de promoção")
    args = parser.parse_args()

    base_url, token = os.getenv("STABILIS_API_URL", ""), os.getenv("HF_SPACE_TOKEN", "")
    if not base_url or not token:
        print("defina STABILIS_API_URL e HF_SPACE_TOKEN", file=sys.stderr)
        return 2
    space = Space(base_url, token)
    records = [json.loads(line) for line in args.gold.read_text(encoding="utf-8").splitlines() if line.strip()]

    report = {"cold_start_s": round(space.wait_ready(), 1), "tasks": {}, "where": base_url}
    for task in ("patient", "professional"):
        texts = [r["text"] for r in records if r["task"] == task][: args.runs + 1]
        if len(texts) < 2:
            continue
        space.extract(task, texts[0])  # warm-up
        timings = [space.extract(task, text) for text in texts[1:]]
        report["tasks"][task] = {"n": len(timings), "p50_s": round(statistics.median(timings), 2), "p95_s": percentile(timings, 0.95)}
        print(f"{task}: {report['tasks'][task]}", file=sys.stderr)

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
