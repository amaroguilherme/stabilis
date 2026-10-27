from types import SimpleNamespace

import pytest

from api import create_app
from api.settings import Settings
from data.constants import DRUG_NAME_PT

VALID_INPUT = {
    "checklist": {"weight": 70, "gender": "Feminino", "base_diagnosis": "Transtorno Bipolar I"},
    "doctor_summary": "Paciente com humor deprimido há dois meses.",
}


def _ranking_item(name: str, score: float) -> dict:
    return {
        "name": name, "final_score": score, "ai_score": 51.1234, "bonus": 60.0, "penalty": 0.0,
        "risk_profile": ["RENAL"], "drug_class": "MOOD_STABILIZER",
        "reasons": [{"type": "bonus", "text": "Estabilizador de humor"}],
    }


class FakeEngine:
    def __init__(self, llm_status: str = "ready", error: Exception | None = None):
        self.symptom_extractor = SimpleNamespace(status=llm_status)
        self.error = error
        self.calls: list[dict] = []

    def run_symptom_inference(self, checklist, doctor_summary):
        self.calls.append({"checklist": checklist, "doctor_summary": doctor_summary})
        if self.error:
            raise self.error
        return SimpleNamespace(ranking=[_ranking_item("lithium-carbonate", 80.12345)], degraded=False, active_risk_tags=set())

    def run_treatment_reanalysis(self, checklist, doctor_summary, current_medications, treatment_anamnesis):
        item = {**_ranking_item("lithium-carbonate", 70.0), "in_use": True, "in_use_duration_months": 8.0}
        return SimpleNamespace(ranking=[item], degraded=True, active_risk_tags=set())


def _make_app(engine: FakeEngine | None = None, **settings):
    engine = engine or FakeEngine()
    app = create_app(Settings(**settings), engine_factory=lambda: engine, start_background=False)
    return app, engine


@pytest.fixture
def app():
    return _make_app()[0]


@pytest.fixture
def client(app):
    return app.test_client()


def _services(app):
    return app.extensions["stabilis"]


def _submit(client, payload=VALID_INPUT, kind="legacy_analyze"):
    return client.post("/jobs", json={"kind": kind, "input": payload})


def test_health(client):
    response = client.get("/health")
    assert (response.status_code, response.text) == (200, "ok")
    assert response.headers["X-Request-ID"]


def test_ready_is_503_until_the_engine_is_loaded(app, client):
    assert client.get("/ready").status_code == 503
    _services(app).runtime.warm()
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json == {"ready": True, "engine": "ready", "llm": "ready", "queue": 0}


def test_ready_is_503_when_the_llm_failed_to_load():
    app, _ = _make_app(FakeEngine(llm_status="error"))
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
    result = done["result"]
    assert result["degraded"] is False
    assert result["safety"] == {"crisis": False, "negated_only": False}
    drug = result["results"][0]
    assert drug["final_score"] == 80.12
    assert drug["name_pt"] == DRUG_NAME_PT["lithium-carbonate"]
    assert "in_use" not in drug

    assert client.delete(f"/jobs/{job_id}").status_code == 204
    assert client.get(f"/jobs/{job_id}").status_code == 404


def test_defaults_are_filled_before_reaching_the_engine():
    app, engine = _make_app()
    client = app.test_client()
    _submit(client)
    _services(app).worker.run_once()
    checklist = engine.calls[0]["checklist"]
    assert (checklist["patient_id"], checklist["comorbidities"], checklist["habits"]) == ("STB-000", [], [])


def test_reanalysis_result_carries_in_use_and_degraded(app, client):
    payload = {**VALID_INPUT, "current_medications": [{"name": "lithium-carbonate", "dose": 600, "duration_months": 8}],
               "treatment_anamnesis": "Estável há 8 meses."}
    job_id = _submit(client, payload, kind="legacy_reanalyze").json["job_id"]
    _services(app).worker.run_once()
    result = client.get(f"/jobs/{job_id}").json["result"]
    assert result["degraded"] is True
    assert result["results"][0]["in_use"] is True


@pytest.mark.parametrize("summary,expected", [
    ("Relata vontade de morrer nas últimas semanas.", {"crisis": True, "negated_only": False}),
    ("Pcte nega ideação suicida.", {"crisis": False, "negated_only": True}),
])
def test_crisis_language_is_reported(app, client, summary, expected):
    job_id = _submit(client, {**VALID_INPUT, "doctor_summary": summary}).json["job_id"]
    _services(app).worker.run_once()
    assert client.get(f"/jobs/{job_id}").json["result"]["safety"] == expected


@pytest.mark.parametrize("body,code", [
    ({"kind": "legacy_analyze", "input": {**VALID_INPUT, "checklist": {**VALID_INPUT["checklist"], "weight": 5}}}, "invalid_input"),
    ({"kind": "legacy_analyze", "input": {**VALID_INPUT, "checklist": {**VALID_INPUT["checklist"], "base_diagnosis": "Esquizofrenia"}}}, "invalid_input"),
    ({"kind": "legacy_analyze", "input": {**VALID_INPUT, "unexpected": True}}, "invalid_input"),
    ({"kind": "legacy_analyze", "input": {**VALID_INPUT, "doctor_summary": "a" * 4001}}, "text_too_long"),
    ({"kind": "unknown", "input": VALID_INPUT}, "unknown_kind"),
    ({"input": VALID_INPUT}, "invalid_input"),
])
def test_invalid_job_requests(client, body, code):
    response = client.post("/jobs", json=body)
    assert response.status_code == 400
    assert response.json["error"] == code
    assert response.json["request_id"]


def test_combined_free_text_is_limited(client):
    payload = {**VALID_INPUT, "doctor_summary": "a" * 3000, "treatment_anamnesis": "b" * 1001}
    response = _submit(client, payload, kind="legacy_reanalyze")
    assert response.json["error"] == "text_too_long"


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


def test_engine_errors_do_not_leak_details():
    app, _ = _make_app(FakeEngine(error=ValueError("Maria, 34 anos, tentou suicídio")))
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


def test_engine_that_fails_to_load_reports_model_unavailable():
    def broken_factory():
        raise OSError("model download failed")

    app = create_app(Settings(), engine_factory=broken_factory, start_background=False)
    client = app.test_client()
    job_id = _submit(client).json["job_id"]
    _services(app).worker.run_once()
    assert client.get(f"/jobs/{job_id}").json["error"] == "model_unavailable"


def test_audit_is_disabled(client):
    response = client.post("/audit", json={})
    assert response.status_code == 410
    assert response.json["error"] == "feature_disabled"


def test_deprecated_sync_endpoint_still_returns_the_list():
    engine = FakeEngine()
    app = create_app(Settings(), engine_factory=lambda: engine, start_background=True)
    response = app.test_client().post("/analyze", json=VALID_INPUT)
    assert response.status_code == 200
    assert response.json[0]["name"] == "lithium-carbonate"
    assert _services(app).store.queued_count() == 0
