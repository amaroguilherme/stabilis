from flask import Blueprint, current_app, jsonify, request

from api.errors import ApiError
from api.jobs import QueueFull
from api.validation import validate_job_envelope, validate_job_input

analysis = Blueprint("analysis", __name__)


def _services():
    return current_app.extensions["stabilis"]


def _json_body() -> dict:
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError("invalid_input")
    return body


def _submit(kind: str, payload: dict):
    try:
        return _services().store.submit(kind, payload)
    except QueueFull:
        raise ApiError("busy", 429, {"Retry-After": "30"})


@analysis.get("/health")
def health():
    return "ok"


@analysis.get("/ready")
def ready():
    services = _services()
    engine_status = services.runtime.status
    llm_status = services.runtime.llm_status
    is_ready = engine_status == "ready" and llm_status == "ready"
    body = {"ready": is_ready, "engine": engine_status, "llm": llm_status, "queue": services.store.queued_count()}
    return jsonify(body), 200 if is_ready else 503


@analysis.post("/jobs")
def submit_job():
    services = _services()
    kind, raw_input = validate_job_envelope(_json_body())
    payload = validate_job_input(kind, raw_input, services.settings.max_text_chars)
    job = _submit(kind, payload)
    return jsonify({
        "job_id": job.id,
        "status": job.status,
        "position": services.store.position(job.id),
        "poll_after_ms": 2000,
    }), 202


@analysis.get("/jobs/<job_id>")
def get_job(job_id: str):
    services = _services()
    job = services.store.get(job_id)
    if job is None:
        raise ApiError("not_found", 404)
    body = {"status": job.status, "backend": services.runtime.status}
    if job.status == "queued":
        body["position"] = services.store.position(job_id)
    elif job.status == "done":
        body["result"] = job.result
    elif job.status == "error":
        body["error"] = job.error
    return jsonify(body)


@analysis.delete("/jobs/<job_id>")
def delete_job(job_id: str):
    if not _services().store.delete(job_id):
        raise ApiError("not_found", 404)
    return "", 204


# Removed in Phase 1.6 with the legacy ranking engine. They answer 410 for one version so an old
# client fails clearly, then they go away.
@analysis.post("/analyze")
@analysis.post("/reanalyze")
@analysis.post("/audit")
def removed():
    raise ApiError("feature_removed", 410)
