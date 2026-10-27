import json
from pathlib import Path

import pytest

from core.safety.crisis import detect_crisis, normalize, summarize

VECTORS_PATH = Path(__file__).resolve().parents[1] / "knowledge" / "tests" / "crisis.vectors.json"
CASES = json.loads(VECTORS_PATH.read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=[f"{c['mode']}:{c['text'][:40] or '<vazio>'}" for c in CASES])
def test_shared_vectors(case):
    hits = detect_crisis(case["text"], mode=case["mode"])
    assert bool(hits) == case["expect_hit"]
    if case["expect_hit"]:
        assert summarize(hits)["negated_only"] == case["expect_negated_only"]


def test_normalize_strips_accents_case_and_punctuation():
    assert normalize("  Ideação SUICIDA!!  ") == "ideacao suicida"
    assert normalize("") == ""


def test_patient_mode_never_applies_negation():
    hits = detect_crisis("nega ideação suicida", mode="patient")
    assert hits and not any(h.negated for h in hits)


def test_overlapping_phrases_produce_a_single_hit():
    hits = detect_crisis("Paciente refere ideação suicida", mode="professional")
    assert [h.term_id for h in hits] == ["ideacao_suicida"]


def test_summary_flags():
    assert summarize([]) == {"crisis": False, "negated_only": False}
    assert summarize(detect_crisis("nega ideação suicida", mode="professional")) == {"crisis": False, "negated_only": True}
    assert summarize(detect_crisis("quero morrer", mode="professional")) == {"crisis": True, "negated_only": False}
