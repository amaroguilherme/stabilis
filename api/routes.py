from flask import Blueprint, jsonify, request

from engine import StabilisEngine
from data.constants import DRUG_NAME_PT
from core.engines.toxicity_predictor import ToxicityPredictor

analysis = Blueprint('analysis', __name__)

_engine: StabilisEngine | None = None
_toxicity: ToxicityPredictor | None = None

def _get_engine() -> StabilisEngine:
    global _engine
    if _engine is None:
        _engine = StabilisEngine()
    return _engine

def _get_toxicity() -> ToxicityPredictor:
    global _toxicity
    if _toxicity is None:
        _toxicity = ToxicityPredictor()
    return _toxicity


@analysis.route("/health")
def health():
    return "alive"


@analysis.route("/analyze", methods=["POST"])
def analyze():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON."}), 400

    checklist      = body.get("checklist")
    doctor_summary = body.get("doctor_summary", "")

    if not checklist:
        return jsonify({"error": "Missing required field: checklist."}), 400

    required_fields = ["weight", "gender", "base_diagnosis"]
    missing = [f for f in required_fields if f not in checklist]
    if missing:
        return jsonify({"error": f"Missing checklist fields: {', '.join(missing)}"}), 400

    checklist.setdefault("patient_id",    "STB-000")
    checklist.setdefault("comorbidities", [])
    checklist.setdefault("habits",        [])

    try:
        ranking = _get_engine().run_symptom_inference(
            checklist=checklist,
            doctor_summary=doctor_summary,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    def serialize(item: dict) -> dict:
        risk = item.get("risk_profile", [])
        return {
            "name":        item["name"],
            "final_score": round(item["final_score"], 2),
            "ai_score":    round(item["ai_score"],    2),
            "bonus":       round(item["bonus"],        2),
            "penalty":     round(item["penalty"],      2),
            "risk_profile": list(risk) if not isinstance(risk, list) else risk,
            "drug_class": item.get("drug_class", "OTHER"),
            "name_pt": DRUG_NAME_PT.get(item["name"], None),
            "reasons": item.get("reasons", []),
        }

    return jsonify([serialize(item) for item in ranking])


@analysis.route("/audit", methods=["POST"])
def audit():
    """
    Body:
    {
        "prescription": [{"name": "lithium-carbonate", "dose": 300, "interval": 8}, ...],
        "patient_profile": {"peso_kg": 70.0, "diagnostico_base": "Transtorno Bipolar"}
    }
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON."}), 400

    prescription     = body.get("prescription")
    patient_profile  = body.get("patient_profile")

    if not prescription or not isinstance(prescription, list):
        return jsonify({"error": "Missing or invalid field: prescription."}), 400
    if not patient_profile or "peso_kg" not in patient_profile:
        return jsonify({"error": "Missing or invalid field: patient_profile (requires peso_kg)."}), 400

    try:
        result = _get_toxicity().audit_and_simulate(
            prescription=prescription,
            patient_profile=patient_profile,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(result)
