"""Free text -> structured suggestions for the intake forms.

The model proposes; deterministic code disposes:
- every item must quote a span that really is in the text, or it is dropped;
- negated items, items about other people and hypotheticals never become suggestions;
- medication names are mapped to the knowledge base (names, ingredients, ANVISA brands);
- the crisis lexicon always runs on the raw text, and the model can only add risk, never remove it;
- if the model is unavailable or answers out of schema, the result is degraded but still useful
  (crisis lexicon and medication names found without the model).

Nothing here is logged except counts and error types: the text is health data.
"""

from __future__ import annotations

import json
import logging

from jsonschema import Draft202012Validator

from core.extraction.context import lexicon_context
from core.extraction.meds import MedicationIndex
from core.extraction.prompt import TASKS, build_prompt, build_short_prompt
from core.extraction.schema import SCHEMA_VERSION, build_schema
from core.extraction.text import evidence_supported, normalize, sanitize_user_text
from core.llm.base import LlmClient, LlmError
from core.safety.crisis import detect_crisis, summarize

logger = logging.getLogger("stabilis.extraction")

MAX_OUTPUT_TOKENS = 1024


class Extractor:
    def __init__(self, llm: LlmClient | None, kb, *, max_text_chars: int = 4000, prompt_style: str = "full"):
        self.llm = llm
        self.max_text_chars = max_text_chars
        self.prompt_style = prompt_style  # "short" only for a model fine-tuned with build_short_prompt
        comorbidities = kb.vocab["comorbidities"]
        self._conditions = {c["id"]: c["label_clinical"] for c in comorbidities["comorbidities"]}
        self._habits = {h["id"]: h["label_clinical"] for h in comorbidities["habits"]}
        self.schema = build_schema(list(self._conditions), list(self._habits))
        self._validator = Draft202012Validator(self.schema)
        self.meds = MedicationIndex(kb.drugs, kb.brands)

    def extract(self, text: str, task: str) -> dict:
        if task not in TASKS:
            raise ValueError(f"unknown task: {task}")
        clean = sanitize_user_text(text, self.max_text_chars)
        crisis = summarize(detect_crisis(clean, mode=task))
        data, degraded = self._ask_model(clean, task)
        result = _Assembler(clean).run(data, self.meds)
        llm_risk = result.pop("_llm_risk")
        result.update(
            version=SCHEMA_VERSION,
            task=task,
            degraded=degraded,
            crisis={
                "language": crisis["crisis"] or llm_risk,
                "negated_only": crisis["negated_only"] and not llm_risk,
                "llm_risk": llm_risk,
            },
        )
        return result

    def _ask_model(self, text: str, task: str) -> tuple[dict | None, bool]:
        if self.llm is None or not text:
            return None, self.llm is None
        prompt = build_short_prompt(task, text) if self.prompt_style == "short" else build_prompt(task, text, self._conditions, self._habits)
        try:
            raw = self.llm.complete_json(prompt, self.schema, max_tokens=MAX_OUTPUT_TOKENS)
        except LlmError as exc:
            logger.warning("extraction_llm_failed error=%s", exc)
            return None, True
        data = _parse(raw)
        if data is None or not self._validator.is_valid(data):
            logger.warning("extraction_output_invalid")
            return None, True
        return data, False


def _parse(raw) -> dict | None:
    if not isinstance(raw, str):
        return None
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end < start:
        return None
    try:
        data = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


class _Assembler:
    """Turns validated model output (or nothing) into suggestions, keeping only supported evidence."""

    def __init__(self, text: str):
        self.text = text
        self.normalized = normalize(text)
        self.proposed = 0
        self.discarded = 0
        self.repaired = 0
        self.excluded: list[dict] = []

    def supported(self, item: dict) -> bool:
        self.proposed += 1
        if evidence_supported(item.get("evidence", ""), self.normalized):
            return True
        self.discarded += 1
        return False

    def keep(self, kind: str, item: dict, code_field: str) -> bool:
        """Applies the negation / experiencer / temporality filters; records why an item was left out."""
        reason = None
        if item.get("negated"):
            reason = "negated"
        elif item.get("experiencer", "patient") != "patient":
            reason = "other_person"
        elif item.get("temporality") == "hypothetical":
            reason = "hypothetical"
        if reason:
            self.excluded.append({"kind": kind, "code": item[code_field], "evidence": item["evidence"], "reason": reason})
            return False
        return True

    def in_context(self, kind: str, code: str, item: dict, name: str | None = None) -> bool:
        """The words around the item, as for names found by the lexicon. Medication and substance items carry
        no experiencer, and the model mislabels some conditions ("minha mãe tem alzheimer")."""
        where = _locate(self.text, item.get("evidence", ""), name)
        reason = lexicon_context(self.text, *where) if where else None
        if reason:
            self.excluded.append({"kind": kind, "code": code, "evidence": item["evidence"], "reason": reason})
            return False
        return True

    def run(self, data: dict | None, meds: MedicationIndex) -> dict:
        data = data or {"symptoms": [], "risk": [], "medications": [], "conditions": [], "substances": [], "pregnancy": {"status": "unknown"}}

        conditions, habits, symptoms = [], [], []
        for item in data["conditions"]:
            if self.supported(item) and self.keep("condition", item, "id") and self.in_context("condition", item["id"], item):
                conditions.append({"id": item["id"], "evidence": item["evidence"]})
        for item in data["substances"]:
            if self.supported(item) and self.keep("habit", item, "id") and self.in_context("habit", item["id"], item):
                habits.append({"id": item["id"], "evidence": item["evidence"]})
        for item in data["symptoms"]:
            if self.supported(item) and self.keep("symptom", item, "domain"):
                symptoms.append({"domain": item["domain"], "evidence": item["evidence"], "temporality": item["temporality"]})

        # Risk counts when it is about the person and not negated, whatever the tense: a past attempt matters.
        llm_risk = False
        for item in data["risk"]:
            if not self.supported(item):
                continue
            if not item["negated"] and item["experiencer"] == "patient":
                llm_risk = True
            else:
                self.keep("risk", item, "kind")

        pregnancy = data["pregnancy"]
        if pregnancy.get("evidence"):
            self.proposed += 1
            if not evidence_supported(pregnancy["evidence"], self.normalized):
                self.discarded += 1
                pregnancy = {"status": "unknown"}

        return {
            "suggestions": {
                "conditions": _unique(conditions, "id"),
                "habits": _unique(habits, "id"),
                "medications": self.medications(data["medications"], meds),
                "pregnancy": pregnancy if pregnancy["status"] != "unknown" else None,
                "symptoms": symptoms,
            },
            "excluded": self.excluded,
            "items_proposed": self.proposed,
            "discarded_unsupported": self.discarded,
            "evidence_repaired": self.repaired,
            "_llm_risk": llm_risk,
        }

    def repair_medication_evidence(self, item: dict) -> dict:
        """A medication whose name is in the text but whose evidence is not (the fine-tuned model sometimes
        writes "current" or "patient_report" there) gets the name's own span as evidence. Counted apart, in
        `evidence_repaired`, so the model's error stays visible."""
        name, evidence = item.get("name", ""), item.get("evidence", "")
        if evidence_supported(evidence, self.normalized) or len(name) < 3 or not evidence_supported(name, self.normalized):
            return item
        at = self.text.lower().find(name.lower())
        self.repaired += 1
        return {**item, "evidence": self.text[at : at + len(name)] if at >= 0 else name}

    def medications(self, items: list[dict], meds: MedicationIndex) -> list[dict]:
        out: dict[str, dict] = {}
        unrecognized: list[dict] = []
        left_out: set[str] = set()  # excluded by context: the lexicon pass below must not bring them back
        for item in items:
            item = self.repair_medication_evidence(item)
            if not self.supported(item):
                continue
            match = meds.lookup(item["name"]) or meds.lookup(item["evidence"])
            code = match.drug_ids[0] if match and len(match.drug_ids) == 1 else item["name"]
            if not self.in_context("medication", code, item, name=item["name"]):
                left_out.add(code)
                continue
            entry = {
                "raw_text": item["name"],
                "evidence": item["evidence"],
                "status": item["status"],
                "mg_per_day": item.get("dose_mg_per_day"),
                "source": "llm",
            }
            if match is None:
                unrecognized.append({"drug_id": None, "candidates": [], **entry})
            elif len(match.drug_ids) > 1:
                unrecognized.append({"drug_id": None, "candidates": list(match.drug_ids), **entry})
            else:
                out.setdefault(match.drug_ids[0], {"drug_id": match.drug_ids[0], "candidates": [], **entry})
        # Names found without the model fill in what it missed (and everything when it is down), unless
        # the words around them say the medicine is someone else's, refused or only a plan.
        for found in meds.scan(self.text):
            if len(found["drug_ids"]) == 1 and found["drug_ids"][0] not in out and found["drug_ids"][0] not in left_out:
                reason = lexicon_context(self.text, found["start"], found["end"])
                if reason:
                    self.excluded.append({"kind": "medication", "code": found["drug_ids"][0], "evidence": found["evidence"], "reason": reason})
                    continue
                out[found["drug_ids"][0]] = {
                    "drug_id": found["drug_ids"][0],
                    "candidates": [],
                    "raw_text": found["raw_text"],
                    "evidence": found["evidence"],
                    "status": "unknown",  # the lexicon sees the name, not whether it is still taken
                    "mg_per_day": found["mg_per_day"],
                    "source": "lexicon",
                }
        return list(out.values()) + unrecognized


def _locate(text: str, evidence: str, name: str | None = None) -> tuple[int, int] | None:
    """Where an item sits in the text, for the context check: its name inside the evidence, else the name
    anywhere in the text (the model sometimes quotes a span without it: "Avaliar bupropiona? Contraindicada"
    with the evidence "contraindicada"), else the end of the evidence, so words like "meu marido" inside the
    span count. None when neither is found verbatim (accents or spacing differ): the item is then kept."""
    lowered = text.lower()
    at = lowered.find(evidence.lower()) if evidence else -1
    if name:
        inner = lowered.find(name.lower(), at, at + len(evidence)) if at >= 0 else -1
        if inner < 0:
            inner = lowered.find(name.lower())
        if inner >= 0:
            return inner, inner + len(name)
    if at < 0:
        return None
    end = at + len(evidence)
    return end, end


def _unique(items: list[dict], key: str) -> list[dict]:
    seen: set[str] = set()
    return [i for i in items if not (i[key] in seen or seen.add(i[key]))]
