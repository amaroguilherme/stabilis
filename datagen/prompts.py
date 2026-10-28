"""Prompts for the teacher (writes the text) and the judge (checks it), in Portuguese."""

from __future__ import annotations

import json

from core.extraction.schema import RISK_KINDS, SYMPTOM_DOMAINS
from datagen.profiles import FactSheet

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
    lines = []
    for i, m in enumerate(sheet.mentions):
        if m.kind == "symptom":
            what = f"sintoma: {SYMPTOM_DOMAINS[m.code]}"
        elif m.kind == "risk":
            what = f"risco: {RISK_KINDS[m.code]}"
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


def teacher_prompt(sheet: FactSheet, conditions: dict[str, str], habits: dict[str, str]) -> str:
    author = "a própria pessoa" if sheet.task == "patient" else "um profissional de saúde"
    return f"""Escreva um texto em português do Brasil, como se fosse escrito por {author}.
Estilo: {STYLE_HINTS[sheet.style]}. Região: {REGION_HINTS[sheet.region]}.
Pessoa: {sheet.age} anos, sexo {'feminino' if sheet.sex == 'female' else 'masculino'}.

O texto deve expressar TODOS estes itens, cada um do jeito indicado, e nenhuma outra informação clínica (nenhum outro sintoma, doença, remédio ou risco):
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
