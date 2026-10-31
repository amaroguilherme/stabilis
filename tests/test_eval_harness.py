"""The evaluation harness runs end to end with the echo model (no real model)."""

import importlib.util
import json
import sys
from pathlib import Path

from core.extraction.extract import Extractor
from core.kb import load_and_validate

ROOT = Path(__file__).resolve().parents[1]


def _harness():
    spec = importlib.util.spec_from_file_location("run_eval", ROOT / "eval" / "run_eval.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_harness_reports_metrics_and_gates():
    harness = _harness()
    records = harness.load_gold(ROOT / "eval" / "gold" / "FORMAT.jsonl")
    report = harness.evaluate(records, Extractor(harness.echo_model(records), load_and_validate()))
    assert report["records"] == len(records)
    assert report["schema_valid_rate"] == 1.0
    assert report["risk_recall"] == 1.0 and report["critical_risk_recall"] == 1.0
    assert report["groups"]["medications"]["f1"] == 1.0
    assert report["improper_suggestions"] == []
    assert harness.check_gates(report) == []
    assert "text" not in str(report.keys())  # the report never carries the texts


def test_real_runs_measure_the_prompt_the_space_serves(monkeypatch, tmp_path):
    """EXTRACTION_PROMPT reaches the harness the same way it reaches the Space (core/service.py)."""
    import core.llm.llamacpp as llamacpp
    from core.extraction.prompt import build_short_prompt
    from core.extraction.text import sanitize_user_text

    prompts = []

    class RecordingModel:
        status, load_error = "ready", None

        def complete_json(self, prompt, schema, *, max_tokens):
            prompts.append(prompt)
            return "{}"  # out of schema: the run degrades, which does not matter here

    monkeypatch.setattr(llamacpp, "LlamaCppClient", RecordingModel)
    monkeypatch.setenv("EXTRACTION_PROMPT", "short")
    gold, out = ROOT / "eval" / "gold" / "FORMAT.jsonl", tmp_path / "report.json"
    monkeypatch.setattr(sys, "argv", ["run_eval.py", "--gold", str(gold), "--out", str(out)])
    harness = _harness()
    assert harness.main() == 0
    records = harness.load_gold(gold)
    assert prompts == [build_short_prompt(r["task"], sanitize_user_text(r["text"], 4000)) for r in records]
    assert json.loads(out.read_text(encoding="utf-8"))["model"]["prompt"] == "short"


def _module(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "eval" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _report(f1: float, improper: int, gold: str = "abc") -> dict:
    groups = {g: {"f1": f1} for g in ("conditions", "habits", "medications")}
    return {"schema_valid_rate": 1.0, "risk_recall": 1.0, "critical_risk_recall": 1.0, "unsupported_rate": 0.0, "groups": groups, "improper_count": improper, "gold_sha256": gold}


def test_relative_gates_compare_with_the_model_in_production():
    harness = _harness()
    baseline = _report(0.8, 2)
    assert harness.check_gates(_report(0.85, 2), baseline) == []
    worse = harness.check_gates(_report(0.79, 3), baseline)
    assert any("F1 de medications" in f for f in worse) and any("sugestões indevidas = 3" in f for f in worse)
    assert harness.check_gates(_report(0.9, 0, gold="outro"), baseline) == ["baseline medido em outro gold set: compare no mesmo arquivo"]


def test_latency_gates():
    bench = _module("bench_latency")
    ok = {"cold_start_s": 120, "tasks": {"patient": {"p95_s": 39.0}, "professional": {"p95_s": 59.0}}}
    assert bench.check_latency(ok) == []
    slow = {"cold_start_s": 200, "tasks": {"patient": {"p95_s": 41.0}}}
    failures = bench.check_latency(slow)
    assert len(failures) == 3 and any("professional" in f for f in failures)


def test_gold_checker_flags_codes_and_annotation_errors():
    checker = _module("check_gold")
    kb = load_and_validate()
    base = {"task": "patient", "text": "texto", "expected": {"conditions": [], "habits": [], "medications": [], "pregnancy": None, "risk": False, "critical_risk": False, "must_not_suggest": []}}
    records = [
        {**base, "id": "a", "text": "tomo fluoxetina", "expected": {**base["expected"], "medications": ["fluoxetina"]}},
        {**base, "id": "a", "text": "outro texto"},
        {**base, "id": "b", "text": "Tomo  FLUOXETINA"},
        {**base, "id": "c", "text": "x", "expected": {**base["expected"], "medications": ["remedio-inexistente"], "critical_risk": True}},
        {**base, "id": "d", "text": "y", "tags": ["hard_negative"], "expected": {**base["expected"], "must_not_suggest": ["habit:alcohol", "habit:nao-existe"]}},
    ]
    errors, stats = checker.check(records, kb)
    joined = "\n".join(errors)
    assert "id repetido" in joined and "mesmo texto de a" in joined
    assert "remedio-inexistente" in joined and "critical_risk exige risk" in joined
    assert "habit:nao-existe" in joined and "habit:alcohol" not in joined
    assert stats["hard_negative"] == 1 and stats["patient"] == 5
