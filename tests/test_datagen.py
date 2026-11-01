"""Synthetic data pipeline (L2): deterministic parts and a full run with scripted models."""

import random
import re
from types import SimpleNamespace

import pytest
from jsonschema import Draft202012Validator

from core.extraction.schema import build_schema
from core.extraction.text import evidence_supported, normalize
from core.kb import load_and_validate
from datagen.dedupe import dedupe
from datagen.noise import add_noise, noisy_example
from datagen.profiles import ProfileSampler
from datagen.run import generate, label, validate_teacher
from datagen.split import fact_signature, persona, split


@pytest.fixture(scope="module")
def kb():
    return load_and_validate()


def test_sampler_is_deterministic(kb):
    a = [ProfileSampler(kb, 7).sample(i, "patient").to_dict() for i in range(1)]
    first = ProfileSampler(kb, 7)
    second = ProfileSampler(kb, 7)
    assert [first.sample(i, "patient").to_dict() for i in range(20)] == [second.sample(i, "patient").to_dict() for i in range(20)]
    assert a != [ProfileSampler(kb, 8).sample(0, "patient").to_dict()]


def test_labels_follow_the_extraction_schema(kb):
    comorbidities = kb.vocab["comorbidities"]
    validator = Draft202012Validator(build_schema([c["id"] for c in comorbidities["comorbidities"]], [h["id"] for h in comorbidities["habits"]]))
    sampler = ProfileSampler(kb, 3)
    for i in range(200):
        sheet = sampler.sample(i, "patient" if i % 2 else "professional")
        evidences = [f"trecho {j}" for j in range(len(sheet.mentions))]
        errors = list(validator.iter_errors(label(sheet, evidences)))
        assert not errors, errors[0].message


def test_noise_keeps_evidence_inside_the_text():
    rng = random.Random(1)
    words = "Você está muito cansada porque não dorme também hoje nada tudo remédio sertralina ansiedade".split()
    for seed in range(200):
        text = " ".join(rng.choice(words) for _ in range(25)) + "; fim."
        tokens = text.split()
        start = rng.randrange(0, 20)
        evidence = " ".join(tokens[start : start + rng.randint(1, 5)])
        noisy_text, (noisy_evidence,) = noisy_example(text, [evidence], seed=seed, level=0.8)
        assert evidence_supported(noisy_evidence, normalize(noisy_text)), (noisy_text, noisy_evidence)
    assert add_noise("Você não está bem", seed=1, level=0) == "Você não está bem"


def test_dedupe_drops_near_duplicates_and_gold_texts():
    base = "faz dois meses que não durmo direito e choro todos os dias sem motivo nenhum no trabalho"
    texts = [base, base + " mesmo", "tenho crises de pânico no ônibus e no metrô quase toda semana desde janeiro"]
    assert dedupe(texts) == [0, 2]
    assert dedupe(texts, reference=[texts[2]]) == [0]


def test_split_has_no_leakage(kb):
    sampler = ProfileSampler(kb, 11)
    examples = [{"sheet": sampler.sample(i, "patient").to_dict(), "teacher": f"t{i % 3}"} for i in range(400)]
    parts = split(examples)
    train_personas = {persona(e) for e in parts["train"]}
    assert not train_personas & {persona(e) for e in parts["test"]}
    assert not {fact_signature(e) for e in parts["train"]} & {fact_signature(e) for e in parts["test"]}
    assert parts["train"] and parts["test"]


def test_teacher_output_is_rejected_without_real_evidence(kb):
    sheet = ProfileSampler(kb, 5).sample(0, "patient")
    text = "um texto qualquer que fala de várias coisas mas não do que deveria falar de jeito nenhum"
    assert isinstance(validate_teacher({"text": text, "evidence": []}, sheet), str)
    fabricated = [{"index": i, "evidence": "isso não está no texto"} for i in range(len(sheet.mentions))]
    assert isinstance(validate_teacher({"text": text, "evidence": fabricated}, sheet), str)


class ScriptedTeacher:
    """Writes one sentence per item of the prompt and quotes it as evidence."""

    model = "teacher-family/teacher-a"

    def complete_json(self, prompt, temperature):
        items = re.findall(r"^(\d+)\. (.+)$", prompt, flags=re.MULTILINE)
        sentences = [f"Item {i}: {desc}" for i, desc in items]
        # The opening sentence keeps one-item texts above the minimum length, as a real teacher's would be.
        text = "Relato escrito pelo professor simulado. " + ". ".join(sentences) + "."
        return {"text": text, "evidence": [{"index": int(i), "evidence": f"Item {i}: {desc}"} for i, desc in items]}


class ScriptedJudge:
    model = "judge-family/judge-b"

    def complete_json(self, prompt, temperature):
        count = len(re.findall(r"^\d+\. ", prompt.split("Itens", 1)[1], flags=re.MULTILINE))
        return {"items": [{"index": i, "supported": True} for i in range(count)], "extra": []}


def test_full_run_with_scripted_models(kb):
    args = SimpleNamespace(n=30, seed=2, patient_share=0.6)
    accepted, rejected = generate(args, kb, ScriptedTeacher(), ScriptedJudge())
    assert accepted and not rejected
    for example in accepted:
        normalized = normalize(example["text"])
        items = [i for group in ("symptoms", "risk", "medications", "conditions", "substances") for i in example["label"][group]]
        assert all(evidence_supported(i["evidence"], normalized) for i in items)
        assert example["teacher"] != example["judge"]


def test_fine_tuning_examples_use_the_inference_prompt(kb):
    import importlib.util
    import json
    from pathlib import Path

    from core.extraction.prompt import build_short_prompt

    spec = importlib.util.spec_from_file_location("prepare", Path(__file__).resolve().parents[1] / "finetune" / "prepare.py")
    prepare = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prepare)
    accepted, _ = generate(SimpleNamespace(n=3, seed=4, patient_share=1.0), kb, ScriptedTeacher(), ScriptedJudge())
    chat = prepare.to_chat(accepted[0])
    assert chat["messages"][0]["content"] == build_short_prompt("patient", accepted[0]["text"])
    assert json.loads(chat["messages"][1]["content"]) == accepted[0]["label"]


class FlakyTeacher(ScriptedTeacher):
    """Fails like a provider out of quota after `ok` successful calls."""

    def __init__(self, ok):
        self.ok = ok

    def complete_json(self, prompt, temperature):
        from datagen.llm_client import ProviderError

        if self.ok == 0:
            raise ProviderError("cota esgotada")
        self.ok -= 1
        return super().complete_json(prompt, temperature)


def test_resume_after_provider_failure_gives_the_same_dataset(kb, tmp_path):
    from datagen.llm_client import ProviderError

    args = SimpleNamespace(n=24, seed=7, patient_share=0.6)
    expected = generate(args, kb, ScriptedTeacher(), ScriptedJudge())
    progress = tmp_path / "progress.jsonl"
    with pytest.raises(ProviderError):
        generate(args, kb, FlakyTeacher(ok=9), ScriptedJudge(), progress)
    assert len(progress.read_text(encoding="utf-8").splitlines()) == 1 + 9, "cabeçalho e os exemplos feitos"
    assert generate(args, kb, ScriptedTeacher(), ScriptedJudge(), progress) == expected
    longer = SimpleNamespace(n=30, seed=7, patient_share=0.6)
    assert generate(longer, kb, ScriptedTeacher(), ScriptedJudge(), progress) == generate(longer, kb, ScriptedTeacher(), ScriptedJudge())


def test_progress_from_another_configuration_is_refused(kb, tmp_path):
    progress = tmp_path / "progress.jsonl"
    generate(SimpleNamespace(n=3, seed=1, patient_share=0.6), kb, ScriptedTeacher(), ScriptedJudge(), progress)
    with pytest.raises(SystemExit):
        generate(SimpleNamespace(n=3, seed=2, patient_share=0.6), kb, ScriptedTeacher(), ScriptedJudge(), progress)


def test_bad_output_rejects_only_that_example(kb):
    from datagen.llm_client import BadOutput

    class SometimesBroken(ScriptedTeacher):
        calls = 0

        def complete_json(self, prompt, temperature):
            self.calls += 1
            if self.calls == 2:
                raise BadOutput("sem JSON")
            return super().complete_json(prompt, temperature)

    accepted, rejected = generate(SimpleNamespace(n=5, seed=3, patient_share=0.6), kb, SometimesBroken(), ScriptedJudge())
    assert len(accepted) == 4 and [r["reason"] for r in rejected] == ["resposta inválida do professor"]


def test_rate_limits_wait_and_permanent_errors_fail_fast(monkeypatch):
    import io
    import urllib.error

    from datagen.llm_client import ChatClient, ProviderError

    monkeypatch.setenv("DATAGEN_TEACHER_BASE_URL", "https://exemplo.invalid/v1")
    monkeypatch.setenv("DATAGEN_TEACHER_MODEL", "teacher-family/teacher-a")
    client = ChatClient("teacher")
    waits = []
    client.sleep = waits.append

    def http_error(code, retry_after=None):
        headers = {"retry-after": str(retry_after)} if retry_after is not None else {}
        return urllib.error.HTTPError("https://exemplo.invalid", code, "erro", headers, io.BytesIO(b""))

    answers = [http_error(429, 7), http_error(503), {"choices": [{"message": {"content": '{"ok": true}'}}]}]

    def scripted(path, body=None):
        answer = answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer

    monkeypatch.setattr(client, "_request", scripted)
    assert client.complete_json("oi", temperature=0) == {"ok": True}
    assert waits == [7.0, 4.0], "respeita o Retry-After e depois espera cada vez mais"

    answers[:] = [http_error(401)]
    with pytest.raises(urllib.error.HTTPError):
        client.complete_json("oi", temperature=0)

    monkeypatch.setattr(client, "_request", lambda path, body=None: (_ for _ in ()).throw(http_error(429)))
    with pytest.raises(ProviderError):
        client.complete_json("oi", temperature=0)


def test_requests_identify_the_client(monkeypatch):
    """Groq answers urllib's default User-Agent with HTTP 403; the client says who it is."""
    import io

    from datagen import llm_client

    seen = {}

    def fake_urlopen(request, timeout):
        seen["user_agent"] = request.get_header("User-agent")
        return io.BytesIO(b'{"data": []}')

    monkeypatch.setattr(llm_client.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setenv("DATAGEN_TEACHER_BASE_URL", "https://exemplo.invalid/v1")
    monkeypatch.setenv("DATAGEN_TEACHER_MODEL", "modelo")
    llm_client.ChatClient("teacher").check()
    assert seen["user_agent"] == "stabilis-datagen"


def test_json_refused_by_the_provider_is_a_bad_sample(monkeypatch):
    """Groq answers HTTP 400 json_validate_failed when the model's JSON is broken: retry, then reject the example."""
    import io
    import urllib.error

    from datagen.llm_client import BadOutput, ChatClient

    monkeypatch.setenv("DATAGEN_TEACHER_BASE_URL", "https://exemplo.invalid/v1")
    monkeypatch.setenv("DATAGEN_TEACHER_MODEL", "teacher-family/teacher-a")
    client = ChatClient("teacher")
    client.sleep = lambda seconds: None

    def refused():
        body = b'{"error": {"code": "json_validate_failed", "message": "Failed to generate JSON"}}'
        return urllib.error.HTTPError("https://exemplo.invalid", 400, "Bad Request", {}, io.BytesIO(body))

    answers = [refused(), {"choices": [{"message": {"content": '{"ok": true}'}}]}]

    def scripted(path, body=None):
        answer = answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer

    monkeypatch.setattr(client, "_request", scripted)
    assert client.complete_json("oi", temperature=0.9) == {"ok": True}

    monkeypatch.setattr(client, "_request", lambda path, body=None: (_ for _ in ()).throw(refused()))
    with pytest.raises(BadOutput):
        client.complete_json("oi", temperature=0.9)


def test_anamneses_get_clinical_terms_and_patients_plain_meanings(kb):
    """Copied PHQ-9 glosses made anamneses read like a form; patients get the meaning, not the instrument."""
    from datagen.prompts import CLINICAL_RISKS, CLINICAL_SYMPTOMS, describe
    from core.extraction.schema import RISK_KINDS, SYMPTOM_DOMAINS

    assert set(CLINICAL_SYMPTOMS) == set(SYMPTOM_DOMAINS) and set(CLINICAL_RISKS) == set(RISK_KINDS)
    sampler = ProfileSampler(kb, 4)
    for i in range(40):
        for task in ("patient", "professional"):
            lines = "\n".join(describe(sampler.sample(i, task), {}, {}))
            assert "PHQ-9" not in lines and "GAD-7" not in lines
            if task == "professional":
                assert not any(gloss in lines for gloss in (SYMPTOM_DOMAINS["anhedonia"], RISK_KINDS["suicide_plan"]))


def test_reasoning_effort_is_sent_only_when_configured(monkeypatch):
    from datagen.llm_client import ChatClient

    monkeypatch.setenv("DATAGEN_TEACHER_BASE_URL", "https://exemplo.invalid/v1")
    monkeypatch.setenv("DATAGEN_TEACHER_MODEL", "teacher-family/teacher-a")
    bodies = []
    for effort in ("", "low"):
        monkeypatch.setenv("DATAGEN_TEACHER_REASONING_EFFORT", effort)
        client = ChatClient("teacher")
        monkeypatch.setattr(client, "_request", lambda path, body=None: bodies.append(body) or {"choices": [{"message": {"content": "{}"}}]})
        client.complete_json("oi", temperature=0.9)
    assert "reasoning_effort" not in bodies[0] and bodies[1]["reasoning_effort"] == "low"
