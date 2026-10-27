"""End-to-end checks of the legacy engine with a fake LLM extractor.

Needs the model stack (torch, torch-geometric, rdkit, qyra) and the committed artifacts;
skipped automatically where they are unavailable (e.g. CI).
"""

import copy
import os
from pathlib import Path

import pytest

pytest.importorskip("torch")
pytest.importorskip("qyra")

from data.constants import DRUG_CLASS_RUNTIME  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

BASE_PROFILE = {
    "symptoms": ["humor deprimido"],
    "relative_contraindications": [],
    "estimated_metabolic_profile": "standard",
    "priority_molecular_targets": [],
}

BIPOLAR_RENAL = {
    "weight": 70.0,
    "gender": "Feminino",
    "base_diagnosis": "Transtorno Bipolar I",
    "comorbidities": ["Insuficiência Renal Crônica"],
    "habits": [],
    "patient_id": "STB-000",
}


class FixedExtractor:
    status = "ready"

    def __init__(self, profile: dict, degraded: bool = False):
        self.profile = profile
        self.degraded = degraded

    def get_profile(self, checklist, doctor_summary):
        return copy.deepcopy(self.profile), self.degraded


@pytest.fixture(scope="module")
def engine():
    from engine import StabilisEngine

    previous = os.getcwd()
    os.chdir(ROOT)  # the engine loads artifacts/ relative to the working directory
    try:
        yield StabilisEngine(symptom_extractor=FixedExtractor(BASE_PROFILE))
    finally:
        os.chdir(previous)


def _by_name(ranking):
    return {item["name"]: item for item in ranking}


def test_lithium_is_capped_with_renal_disease(engine):
    engine.symptom_extractor = FixedExtractor(BASE_PROFILE)
    result = engine.run_symptom_inference(BIPOLAR_RENAL, "Paciente bipolar com insuficiência renal.")
    assert "RENAL" in result.active_risk_tags
    assert _by_name(result.ranking)["lithium-carbonate"]["final_score"] <= 15.0


def test_continuity_does_not_lift_the_renal_cap_and_reports_each_dose(engine):
    engine.symptom_extractor = FixedExtractor(BASE_PROFILE)
    meds = [
        {"name": "lithium-carbonate", "dose": 600, "duration_months": 8},
        {"name": "quetiapine", "dose": 100, "duration_months": 2},
    ]
    result = engine.run_treatment_reanalysis(BIPOLAR_RENAL, "Paciente bipolar.", meds, "Em uso de lítio e quetiapina.")
    ranking = _by_name(result.ranking)

    lithium, quetiapine = ranking["lithium-carbonate"], ranking["quetiapine"]
    assert lithium["final_score"] <= 15.0
    assert lithium["in_use"] is True and quetiapine["in_use"] is True
    assert "(600 mg)" in lithium["reasons"][0]["text"]
    assert "(100 mg)" in quetiapine["reasons"][0]["text"]


def test_reported_class_matches_the_class_used_for_scoring(engine):
    engine.symptom_extractor = FixedExtractor(BASE_PROFILE)
    result = engine.run_symptom_inference(BIPOLAR_RENAL, "")
    overridden = [item for item in result.ranking if item["name"].lower() in DRUG_CLASS_RUNTIME]
    assert overridden, "expected at least one drug with a runtime class override"
    for item in overridden:
        assert item["drug_class"] == DRUG_CLASS_RUNTIME[item["name"].lower()]


def test_degraded_flag_propagates(engine):
    engine.symptom_extractor = FixedExtractor(BASE_PROFILE, degraded=True)
    assert engine.run_symptom_inference(BIPOLAR_RENAL, "").degraded is True
