"""Job handlers: run the legacy ranking engine and shape its output for the API."""

from core.safety.crisis import detect_crisis, summarize
from data.constants import DRUG_NAME_PT


def _serialize(item: dict) -> dict:
    risk = item.get("risk_profile", [])
    out = {
        "name": item["name"],
        "final_score": round(item["final_score"], 2),
        "ai_score": round(item["ai_score"], 2),
        "bonus": round(item["bonus"], 2),
        "penalty": round(item["penalty"], 2),
        "risk_profile": list(risk) if not isinstance(risk, list) else risk,
        "drug_class": item.get("drug_class", "OTHER"),
        "name_pt": DRUG_NAME_PT.get(item["name"]),
        "reasons": item.get("reasons", []),
    }
    if "in_use" in item:
        out["in_use"] = item["in_use"]
        out["in_use_duration_months"] = item.get("in_use_duration_months")
    return out


def _safety(*texts: str) -> dict:
    hits = [hit for text in texts for hit in detect_crisis(text, mode="professional")]
    return summarize(hits)


def legacy_analyze(engine, payload: dict) -> dict:
    result = engine.run_symptom_inference(
        checklist=payload["checklist"],
        doctor_summary=payload["doctor_summary"],
    )
    return {
        "results": [_serialize(item) for item in result.ranking],
        "degraded": result.degraded,
        "safety": _safety(payload["doctor_summary"]),
    }


def legacy_reanalyze(engine, payload: dict) -> dict:
    result = engine.run_treatment_reanalysis(
        checklist=payload["checklist"],
        doctor_summary=payload["doctor_summary"],
        current_medications=payload["current_medications"],
        treatment_anamnesis=payload["treatment_anamnesis"],
    )
    return {
        "results": [_serialize(item) for item in result.ranking],
        "degraded": result.degraded,
        "safety": _safety(payload["doctor_summary"], payload["treatment_anamnesis"]),
    }


HANDLERS = {
    "legacy_analyze": legacy_analyze,
    "legacy_reanalyze": legacy_reanalyze,
}
