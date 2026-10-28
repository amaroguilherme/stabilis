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
        return {"text": ". ".join(sentences) + ".", "evidence": [{"index": int(i), "evidence": f"Item {i}: {desc}"} for i, desc in items]}


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
