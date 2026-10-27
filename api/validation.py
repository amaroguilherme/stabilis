"""Input validation for job payloads (JSON Schema, Draft 2020-12)."""

from jsonschema import Draft202012Validator

from api.errors import ApiError

BASE_DIAGNOSES = [
    "Transtorno Bipolar I",
    "Transtorno Bipolar II",
    "Transtorno de Ansiedade Generalizada",
]
GENDERS = ["Masculino", "Feminino"]

_SHORT_TEXT_LIST = {
    "type": "array",
    "maxItems": 20,
    "items": {"type": "string", "minLength": 1, "maxLength": 80},
}

CHECKLIST_SCHEMA = {
    "type": "object",
    "required": ["weight", "gender", "base_diagnosis"],
    "properties": {
        "patient_id": {"type": "string", "maxLength": 32},
        "weight": {"type": "number", "minimum": 20, "maximum": 300},
        "gender": {"enum": GENDERS},
        "base_diagnosis": {"enum": BASE_DIAGNOSES},
        "comorbidities": _SHORT_TEXT_LIST,
        "habits": _SHORT_TEXT_LIST,
    },
    "additionalProperties": False,
}

MEDICATION_SCHEMA = {
    "type": "object",
    "required": ["name", "dose", "duration_months"],
    "properties": {
        "name": {"type": "string", "minLength": 1, "maxLength": 80},
        "dose": {"type": "number", "exclusiveMinimum": 0, "maximum": 10000},
        "duration_months": {"type": "number", "minimum": 0, "maximum": 600},
    },
    "additionalProperties": False,
}

ANALYZE_SCHEMA = {
    "type": "object",
    "required": ["checklist"],
    "properties": {
        "checklist": CHECKLIST_SCHEMA,
        "doctor_summary": {"type": "string"},
    },
    "additionalProperties": False,
}

REANALYZE_SCHEMA = {
    "type": "object",
    "required": ["checklist"],
    "properties": {
        "checklist": CHECKLIST_SCHEMA,
        "doctor_summary": {"type": "string"},
        "current_medications": {"type": "array", "maxItems": 15, "items": MEDICATION_SCHEMA},
        "treatment_anamnesis": {"type": "string"},
    },
    "additionalProperties": False,
}

JOB_ENVELOPE_SCHEMA = {
    "type": "object",
    "required": ["kind", "input"],
    "properties": {
        "kind": {"type": "string", "maxLength": 40},
        "input": {"type": "object"},
    },
    "additionalProperties": False,
}

_ENVELOPE_VALIDATOR = Draft202012Validator(JOB_ENVELOPE_SCHEMA)
_INPUT_VALIDATORS = {
    "legacy_analyze": Draft202012Validator(ANALYZE_SCHEMA),
    "legacy_reanalyze": Draft202012Validator(REANALYZE_SCHEMA),
}
JOB_KINDS = tuple(_INPUT_VALIDATORS)


def validate_job_envelope(body) -> tuple[str, dict]:
    if not _ENVELOPE_VALIDATOR.is_valid(body):
        raise ApiError("invalid_input")
    return body["kind"], body["input"]


def validate_job_input(kind: str, payload, max_text_chars: int) -> dict:
    """Validates a job payload and returns a normalized copy with defaults filled in."""
    validator = _INPUT_VALIDATORS.get(kind)
    if validator is None:
        raise ApiError("unknown_kind")
    if not validator.is_valid(payload):
        raise ApiError("invalid_input")

    free_text = len(payload.get("doctor_summary", "")) + len(payload.get("treatment_anamnesis", ""))
    if free_text > max_text_chars:
        raise ApiError("text_too_long")

    checklist = dict(payload["checklist"])
    checklist.setdefault("patient_id", "STB-000")
    checklist.setdefault("comorbidities", [])
    checklist.setdefault("habits", [])

    normalized = {"checklist": checklist, "doctor_summary": payload.get("doctor_summary", "")}
    if kind == "legacy_reanalyze":
        normalized["current_medications"] = [dict(m) for m in payload.get("current_medications", [])]
        normalized["treatment_anamnesis"] = payload.get("treatment_anamnesis", "")
    return normalized
