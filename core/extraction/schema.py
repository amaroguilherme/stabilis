"""Extraction schema v1: what the model may return for a piece of free text.

Every item carries a literal evidence span from the text, plus whether it is negated, who it is
about and when. Condition and substance codes come from the knowledge base vocabulary, so the model
can only point to concepts the engine understands. The same schema is the target of the evaluation
harness (eval/) and of the fine-tuning datasets.
"""

from __future__ import annotations

SCHEMA_VERSION = 1

# Symptom domains, aligned with the PHQ-9 and GAD-7 items and the MDQ screen, plus psychosis
# features (which lead to referral). Portuguese descriptions go into the prompt.
SYMPTOM_DOMAINS: dict[str, str] = {
    "depressed_mood": "tristeza, desânimo, sem esperança (PHQ-9 item 2)",
    "anhedonia": "pouco interesse ou prazer nas coisas (PHQ-9 item 1)",
    "sleep": "insônia ou sono demais (PHQ-9 item 3)",
    "fatigue": "cansaço, pouca energia (PHQ-9 item 4)",
    "appetite": "falta de apetite ou comer demais (PHQ-9 item 5)",
    "worthlessness_guilt": "sentir-se mal consigo, fracasso, culpa (PHQ-9 item 6)",
    "concentration": "dificuldade de concentração (PHQ-9 item 7)",
    "psychomotor": "lentidão ou agitação percebida por outros (PHQ-9 item 8)",
    "anxiety_nervousness": "nervosismo, ansiedade, tensão (GAD-7 item 1)",
    "uncontrollable_worry": "não consegue parar de se preocupar (GAD-7 itens 2 e 3)",
    "trouble_relaxing": "dificuldade para relaxar, inquietação (GAD-7 itens 4 e 5)",
    "irritability": "irritação fácil (GAD-7 item 6)",
    "dread": "medo de que algo terrível aconteça (GAD-7 item 7)",
    "panic": "crises de pânico, falta de ar, coração disparado",
    "elevated_mood": "euforia, humor muito elevado ou irritável por dias (rastreio de bipolaridade)",
    "decreased_need_for_sleep": "dorme pouco sem sentir cansaço",
    "racing_thoughts": "pensamentos acelerados, fala rápida",
    "impulsivity": "gastos excessivos, comportamento arriscado ou impulsivo",
    "psychotic_features": "alucinações, delírios, desconfiança extrema",
    "other": "outro sintoma relevante",
}

RISK_KINDS: dict[str, str] = {
    "death_thoughts": "pensamentos de morte ou de que seria melhor estar morto",
    "suicidal_ideation": "pensamentos de se matar",
    "suicide_plan": "plano ou preparação para se matar",
    "suicide_attempt": "tentativa de suicídio",
    "self_harm": "se machucar de propósito (cortes, queimaduras)",
}

PREGNANCY_STATUS = ["pregnant", "not_pregnant", "planning", "breastfeeding", "unknown"]

_EVIDENCE = {"type": "string", "minLength": 1, "maxLength": 300}
_ATTRIBUTES = {
    "negated": {"type": "boolean"},
    "experiencer": {"enum": ["patient", "other"]},
    "temporality": {"enum": ["current", "past", "hypothetical"]},
}


def _coded_items(field: str, codes: list[str], max_items: int, *, experiencer: bool = True) -> dict:
    attributes = dict(_ATTRIBUTES) if experiencer else {k: v for k, v in _ATTRIBUTES.items() if k != "experiencer"}
    return {
        "type": "array",
        "maxItems": max_items,
        "items": {
            "type": "object",
            "properties": {field: {"enum": codes}, "evidence": _EVIDENCE, **attributes},
            "required": [field, "evidence", *attributes],
            "additionalProperties": False,
        },
    }


def build_schema(condition_ids: list[str], habit_ids: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {
            "symptoms": _coded_items("domain", list(SYMPTOM_DOMAINS), 20),
            "risk": _coded_items("kind", list(RISK_KINDS), 10),
            "medications": {
                "type": "array",
                "maxItems": 15,
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "minLength": 1, "maxLength": 80},
                        "evidence": _EVIDENCE,
                        "status": {"enum": ["current", "past"]},
                        "dose_mg_per_day": {"type": "number", "minimum": 0, "maximum": 10000},
                        "duration_months": {"type": "number", "minimum": 0, "maximum": 600},
                        "response": {"enum": ["good", "partial", "none", "unknown"]},
                        "adverse_effects": {"type": "array", "maxItems": 5, "items": {"type": "string", "maxLength": 80}},
                        "stop_reason": {"type": "string", "maxLength": 120},
                    },
                    "required": ["name", "evidence", "status"],
                    "additionalProperties": False,
                },
            },
            "conditions": _coded_items("id", condition_ids, 15),
            "substances": _coded_items("id", habit_ids, 5, experiencer=False),
            "pregnancy": {
                "type": "object",
                "properties": {"status": {"enum": PREGNANCY_STATUS}, "evidence": _EVIDENCE},
                "required": ["status"],
                "additionalProperties": False,
            },
        },
        "required": ["symptoms", "risk", "medications", "conditions", "substances", "pregnancy"],
        "additionalProperties": False,
    }
