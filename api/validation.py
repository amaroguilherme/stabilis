"""Input validation for job payloads (JSON Schema, Draft 2020-12)."""

from jsonschema import Draft202012Validator

from api.errors import ApiError

EXTRACT_SCHEMA = {
    "type": "object",
    "required": ["task", "text"],
    "properties": {
        "task": {"enum": ["patient", "professional"]},
        "text": {"type": "string", "minLength": 1},
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
_INPUT_VALIDATORS = {"extract": Draft202012Validator(EXTRACT_SCHEMA)}
JOB_KINDS = tuple(_INPUT_VALIDATORS)


def validate_job_envelope(body) -> tuple[str, dict]:
    if not _ENVELOPE_VALIDATOR.is_valid(body):
        raise ApiError("invalid_input")
    return body["kind"], body["input"]


def validate_job_input(kind: str, payload, max_text_chars: int) -> dict:
    """Validates a job payload and returns a normalized copy."""
    validator = _INPUT_VALIDATORS.get(kind)
    if validator is None:
        raise ApiError("unknown_kind")
    if not validator.is_valid(payload):
        raise ApiError("invalid_input")
    if len(payload["text"]) > max_text_chars:
        raise ApiError("text_too_long")
    return {"task": payload["task"], "text": payload["text"]}
