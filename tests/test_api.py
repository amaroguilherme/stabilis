import pytest

from api import create_app
from api.settings import Settings

VALID_INPUT = {"task": "professional", "text": "Paciente com humor deprimido há dois meses."}


class FakeService:
    def __init__(self, llm_status: str = "ready", error: Exception | None = None):
        self.llm_status = llm_status
        self.error = error
        self.calls: list[tuple[str, str]] = []

    def extract(self, text: str, task: str) -> dict:
        self.calls.append((text, task))
        if self.error:
            raise self.error
        return {"version": 1, "task": task, "degraded": False, "suggestions": {"conditions": []}}


def _make_app(service: FakeService | None = None, **settings):
    service = service or FakeService()
    app = create_app(Settings(**settings), engine_factory=lambda: service, start_background=False)
    return app, service


@pytest.fixture
def app():
    return _make_app()[0]


@pytest.fixture
def client(app):
    return app.test_client()


def _services(app):
    return app.extensions["stabilis"]


def _submit(client, payload=VALID_INPUT, kind="extract"):
    return client.post("/jobs", json={"kind": kind, "input": payload})


def test_health(client):
    response = client.get("/health")
    assert (response.status_code, response.text) == (200, "ok")
    assert response.headers["X-Request-ID"]


def test_ready_is_503_until_the_service_is_loaded(app, client):
    assert client.get("/ready").status_code == 503
    _services(app).runtime.warm()
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json == {"ready": True, "engine": "ready", "llm": "ready", "queue": 0}


def test_ready_is_503_when_the_llm_failed_to_load():
    app, _ = _make_app(FakeService(llm_status="error"))
    _services(app).runtime.warm()
    response = app.test_client().get("/ready")
    assert response.status_code == 503
    assert response.json["llm"] == "error"


def test_job_lifecycle(app, client):
    submitted = _submit(client)
    assert submitted.status_code == 202
    job_id = submitted.json["job_id"]
    assert submitted.json["position"] == 1

    queued = client.get(f"/jobs/{job_id}").json
    assert queued == {"status": "queued", "backend": "idle", "position": 1}

    assert _services(app).worker.run_once() is True
    done = client.get(f"/jobs/{job_id}").json
    assert done["status"] == "done"
    assert done["result"]["task"] == "professional"

    assert client.delete(f"/jobs/{job_id}").status_code == 204
    assert client.get(f"/jobs/{job_id}").status_code == 404


def test_payload_reaches_the_service_unchanged():
    app, service = _make_app()
    _submit(app.test_client())
    _services(app).worker.run_once()
    assert service.calls == [(VALID_INPUT["text"], "professional")]


@pytest.mark.parametrize("body,code", [
    ({"kind": "extract", "input": {"task": "doctor", "text": "x"}}, "invalid_input"),
    ({"kind": "extract", "input": {"task": "patient", "text": ""}}, "invalid_input"),
    ({"kind": "extract", "input": {**VALID_INPUT, "unexpected": True}}, "invalid_input"),
    ({"kind": "extract", "input": {**VALID_INPUT, "text": "a" * 4001}}, "text_too_long"),
    ({"kind": "legacy_analyze", "input": VALID_INPUT}, "unknown_kind"),
    ({"input": VALID_INPUT}, "invalid_input"),
])
def test_invalid_job_requests(client, body, code):
    response = client.post("/jobs", json=body)
    assert response.status_code == 400
    assert response.json["error"] == code
    assert response.json["request_id"]


def test_non_json_body_is_rejected(client):
    response = client.post("/jobs", data="not json", content_type="text/plain")
    assert response.status_code == 400


def test_full_queue_returns_429():
    app, _ = _make_app(queue_max=2)
    client = app.test_client()
    _submit(client)
    _submit(client)
    response = _submit(client)
    assert response.status_code == 429
    assert response.json["error"] == "busy"
    assert response.headers["Retry-After"] == "30"


def test_oversized_body_returns_413(client):
    response = client.post("/jobs", data="x" * (70 * 1024), content_type="application/json")
    assert response.status_code == 413
    assert response.json["error"] == "too_large"


def test_service_errors_do_not_leak_details():
    app, _ = _make_app(FakeService(error=ValueError("Maria, 34 anos, tentou suicídio")))
    client = app.test_client()
    job_id = _submit(client).json["job_id"]
    _services(app).worker.run_once()
    response = client.get(f"/jobs/{job_id}")
    assert response.json == {"status": "error", "backend": "ready", "error": "internal"}
    assert "Maria" not in response.text


def test_unhandled_exceptions_return_a_generic_500(app, client, monkeypatch):
    def explode(job_id):
        raise RuntimeError("texto sensível do paciente")

    monkeypatch.setattr(_services(app).store, "get", explode)
    response = client.get("/jobs/abc")
    assert response.status_code == 500
    assert response.json["error"] == "internal"
    assert "sensível" not in response.text


def test_service_that_fails_to_load_reports_model_unavailable():
    def broken_factory():
        raise OSError("model download failed")

    app = create_app(Settings(), engine_factory=broken_factory, start_background=False)
    client = app.test_client()
    job_id = _submit(client).json["job_id"]
    _services(app).worker.run_once()
    assert client.get(f"/jobs/{job_id}").json["error"] == "model_unavailable"


@pytest.mark.parametrize("path", ["/analyze", "/reanalyze", "/audit"])
def test_removed_endpoints_answer_410(client, path):
    response = client.post(path, json={})
    assert response.status_code == 410
    assert response.json["error"] == "feature_removed"
