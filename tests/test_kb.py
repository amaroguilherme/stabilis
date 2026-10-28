"""Knowledge base validation (core/kb.py) on the real files and on deliberately broken copies."""

import json
import shutil
from pathlib import Path

import pytest

from core import kb as kb_module

KNOWLEDGE = Path(__file__).resolve().parent.parent / "knowledge"


@pytest.fixture
def knowledge_copy(tmp_path: Path) -> Path:
    target = tmp_path / "knowledge"
    shutil.copytree(KNOWLEDGE, target)
    return target


def _edit(path: Path, change) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    change(data)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def _errors(knowledge: Path) -> list[str]:
    with pytest.raises(kb_module.KnowledgeBaseError) as exc:
        kb_module.load_and_validate(knowledge)
    return exc.value.errors


def test_real_knowledge_base_is_valid():
    kb = kb_module.load_and_validate(KNOWLEDGE)
    assert kb.trials and kb.next_steps, "revisão de tratamento carregada"
    assert kb.safety_plan["steps"] and kb.tracking["instruments"]


def test_safety_plan_phone_must_be_in_a_cited_quote(knowledge_copy: Path):
    def change(plan):
        plan["contacts"][0]["phone"] = "4321"

    _edit(knowledge_copy / "safety_plan.json", change)
    assert any("telefone 4321" in e for e in _errors(knowledge_copy))


def test_trial_needs_a_minimum_or_a_maximum_duration(knowledge_copy: Path):
    def change(doc):
        trial = next(t for t in doc["trials"] if t["id"] == "TR-BENZODIAZEPINE-SHORT-TERM")
        del trial["max_weeks"]

    _edit(knowledge_copy / "rules" / "treatment_review.json", change)
    assert any("TR-BENZODIAZEPINE-SHORT-TERM" in e or "treatment_review" in e for e in _errors(knowledge_copy))


def test_next_step_message_must_exist(knowledge_copy: Path):
    def change(doc):
        doc["next_steps"][0]["message_key"] = "ts.nao.existe"

    _edit(knowledge_copy / "rules" / "treatment_review.json", change)
    assert any("ts.nao.existe" in e for e in _errors(knowledge_copy))


def test_tracking_instruments_must_exist(knowledge_copy: Path):
    _edit(knowledge_copy / "tracking.json", lambda doc: doc["instruments"].append("bdi"))
    assert any("instrumento desconhecido 'bdi'" in e for e in _errors(knowledge_copy))
