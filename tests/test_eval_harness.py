"""The evaluation harness runs end to end with the echo model (no real model)."""

import importlib.util
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
