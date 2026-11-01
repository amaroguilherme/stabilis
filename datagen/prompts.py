"""Prompts for the teacher (writes the text) and the judge (checks it), in Portuguese."""

from __future__ import annotations

import json
import re

from core.extraction.schema import RISK_KINDS, SYMPTOM_DOMAINS
from datagen.profiles import FactSheet

# Bump on any change to the prompts below: a resumed generation never mixes versions.
PROMPT_VERSION = 2

# Anamneses speak in clinical terms. Given the PHQ-9/GAD-7 glosses instead, the teacher wrote notes like a
# form ("nega falta de apetite ou comer em excesso"), as seen in the first pilot.
CLINICAL_SYMPTOMS = {
    "depressed_mood": "humor deprimido (hipotimia)",
    "anhedonia": "anedonia",
    "sleep": "alteração do sono (insônia ou hipersonia)",
    "fatigue": "fadiga, astenia",
    "appetite": "alteração do apetite (hiporexia ou hiperfagia)",
    "worthlessness_guilt": "sentimentos de menos-valia ou culpa",
    "concentration": "déficit de concentração",
    "psychomotor": "alteração psicomotora (lentificação ou agitação)",
    "anxiety_nervousness": "ansiedade, tensão",
    "uncontrollable_worry": "preocupação excessiva e difícil de controlar",
    "trouble_relaxing": "inquietação, dificuldade de relaxar",
    "irritability": "irritabilidade",
    "dread": "apreensão, sensação de que algo ruim vai acontecer",
    "panic": "ataques de pânico",
    "elevated_mood": "humor elevado ou irritável por dias (sintomas hipomaníacos ou maníacos)",
    "decreased_need_for_sleep": "redução da necessidade de sono",
    "racing_thoughts": "aceleração do pensamento, taquilalia",
    "impulsivity": "impulsividade (gastos excessivos, comportamento de risco)",
    "psychotic_features": "sintomas psicóticos (alucinações, delírios, ideação paranoide)",
    "other": "outro sintoma relevante",
}
CLINICAL_RISKS = {
    "death_thoughts": "ideação de morte passiva",
    "suicidal_ideation": "ideação suicida",
    "suicide_plan": "ideação suicida com plano",
    "suicide_attempt": "tentativa de suicídio",
    "self_harm": "autolesão",
}


def _meaning(gloss: str) -> str:
    """A schema description without its instrument reference ("(PHQ-9 item 2)")."""
    return re.sub(r"\s*\((?:PHQ|GAD|rastreio)[^)]*\)", "", gloss).strip()

STYLE_HINTS = {
    "whatsapp": "mensagem de WhatsApp, frases curtas, pouca pontuação, pode ter gírias",
    "audio_transcript": "transcrição de áudio, sem pontuação, frases emendadas, repetições",
    "careful": "texto cuidadoso de quem escreveu com calma, primeira pessoa",
    "short": "duas ou três frases diretas",
    "sbar_note": "evolução clínica estruturada (situação, histórico, avaliação, plano), com abreviações médicas comuns no Brasil",
    "telegraphic": "anotação telegráfica de consulta: 'Pcte 45a, HAS, refere...'",
    "referral_letter": "carta de encaminhamento de um profissional para outro",
}
REGION_HINTS = {
    "nordeste": "pode usar expressões como 'aperreio', 'agonia', 'gastura'",
    "sudeste": "português coloquial do Sudeste",
    "sul": "português coloquial do Sul ('bah', 'tri' são possíveis)",
    "norte": "português coloquial do Norte",
    "centro-oeste": "português coloquial do Centro-Oeste",
}
ATTRIBUTE_TEXT = {
    "negated": "dito como algo que NÃO acontece (negado)",
    "other": "sobre outra pessoa (familiar), não sobre quem escreve",
    "past": "algo que aconteceu no passado e já passou",
    "hypothetical": "dito como medo, dúvida ou possibilidade, não como fato",
}


def describe(sheet: FactSheet, conditions: dict[str, str], habits: dict[str, str]) -> list[str]:
    """One line per item. `conditions` and `habits` carry the plain labels for patient texts and the
    clinical ones for anamneses (datagen.run picks them by task)."""
    clinical = sheet.task == "professional"
    lines = []
    for i, m in enumerate(sheet.mentions):
        if m.kind == "symptom":
            what = f"sintoma: {CLINICAL_SYMPTOMS[m.code] if clinical else _meaning(SYMPTOM_DOMAINS[m.code])}"
        elif m.kind == "risk":
            what = f"risco: {CLINICAL_RISKS[m.code] if clinical else RISK_KINDS[m.code]}"
        elif m.kind == "condition":
            what = f"condição de saúde: {conditions.get(m.code, m.code)}"
        elif m.kind == "habit":
            what = f"hábito: {habits.get(m.code, m.code)}"
        elif m.kind == "medication":
            dose = f", {m.extra['mg_per_day']} mg por dia" if m.extra.get("mg_per_day") else ""
            what = f"remédio escrito exatamente como \"{m.extra['written_as']}\"{dose}, {'já usou e parou' if m.temporality == 'past' else 'usa atualmente'}"
        else:
            what = {"pregnant": "está grávida", "planning": "planeja engravidar", "breastfeeding": "está amamentando"}[m.code]
        flags = [ATTRIBUTE_TEXT[k] for k, on in (("negated", m.negated), ("other", m.experiencer == "other"), ("past", m.temporality == "past" and m.kind != "medication"), ("hypothetical", m.temporality == "hypothetical")) if on]
        lines.append(f"{i}. {what}" + (f" — {'; '.join(flags)}" if flags else ""))
    return lines


VOICE = {
    # The item descriptions come from the schema; copied verbatim they read like a form, and a model trained
    # on them learns the form's wording instead of how people talk (seen in the first pilot).
    "patient": "Escreva como essa pessoa falaria de verdade: palavras do dia a dia, situações concretas, do jeito dela.",
    "professional": "Escreva como um prontuário real, com os termos clínicos e as abreviações comuns no Brasil.",
}


def teacher_prompt(sheet: FactSheet, conditions: dict[str, str], habits: dict[str, str]) -> str:
    author = "a própria pessoa" if sheet.task == "patient" else "um profissional de saúde"
    return f"""Escreva um texto em português do Brasil, como se fosse escrito por {author}.
Estilo: {STYLE_HINTS[sheet.style]}. Região: {REGION_HINTS[sheet.region]}.
Pessoa: {sheet.age} anos, sexo {'feminino' if sheet.sex == 'female' else 'masculino'}.
{VOICE[sheet.task]} As descrições dos itens abaixo dizem o que cada um significa: não copie essas palavras.
A região e o estilo valem só para o jeito de escrever; o texto não diz de onde a pessoa é nem como ela escreve.

O texto deve expressar TODOS estes itens, cada um com a forma indicada depois do travessão (negado, sobre outra pessoa,
passado, hipotético), e nenhuma outra informação clínica (nenhum outro sintoma, doença, remédio ou risco):
{chr(10).join(describe(sheet, conditions, habits))}

Responda só com JSON: {{"text": "<o texto>", "evidence": [{{"index": <número do item>, "evidence": "<trecho copiado literalmente do texto que expressa o item>"}}]}}
Cada item precisa de exatamente um trecho de evidência, copiado sem nenhuma alteração do texto."""


def judge_prompt(text: str, sheet: FactSheet, conditions: dict[str, str], habits: dict[str, str]) -> str:
    return f"""Você confere se um texto expressa exatamente uma lista de itens clínicos.

Texto:
<<<
{text}
>>>

Itens (com o modo como devem aparecer):
{chr(10).join(describe(sheet, conditions, habits))}

Para cada item, diga se o texto o expressa do jeito indicado (inclusive negação, pessoa e tempo). Depois liste qualquer
sintoma, doença, remédio ou risco de suicídio que esteja no texto e não esteja na lista.
Responda só com JSON: {{"items": [{{"index": <n>, "supported": true|false}}], "extra": ["<informação clínica a mais>"]}}"""


def parse_items(raw: dict, count: int) -> dict[int, bool]:
    out = {}
    for entry in raw.get("items", []):
        if isinstance(entry, dict) and isinstance(entry.get("index"), int) and 0 <= entry["index"] < count:
            out[entry["index"]] = bool(entry.get("supported"))
    return out


def dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)
