"""Context of a medication name found by the lexicon, without the model.

The model's medication items carry no negation or experiencer, so a name it left out on purpose
("minha mãe toma fluoxetina") would come back from the lexicon. Before a lexicon match becomes a
suggestion, the words around it in the same clause are checked for another person, a negation or a
plan ("iniciar", "vai me passar"). Conservative: a first-person word between the cue and the name
("minha mãe toma fluoxetina e eu tomo sertralina") cancels the cue.
"""

from __future__ import annotations

import re

from core.extraction.text import normalize

_CLAUSE_BREAK = re.compile(r"[.,;:!?\n()]")
BACK_WINDOW = 8
FORWARD_WINDOW = 6

# Single words that point to someone other than the person writing (family, friends, neighbours).
OTHER_PERSON = {
    "mae", "pai", "irmao", "irma", "filho", "filha", "avo", "marido", "esposa", "esposo",
    "namorado", "namorada", "amigo", "amiga", "tio", "tia", "primo", "prima", "vizinho", "vizinha",
    "sobrinho", "sobrinha", "cunhado", "cunhada", "sogro", "sogra", "colega", "neto", "neta",
}
# Words that put the person back as the subject ("uso" is left out: "em uso de" is a noun in notes).
FIRST_PERSON = {"eu", "tomo", "tomei", "usei", "estou", "to", "faco", "pcte", "paciente"}
NEGATION_BEFORE = [("nao", "tomo"), ("nao", "uso"), ("nao", "tomei"), ("nao", "usei"), ("nunca", "tomei"), ("nunca", "usei"), ("nega", "uso"), ("sem", "uso")]
NEGATION_AFTER = [("nao", "quis"), ("nao", "tomei"), ("nao", "aceitei"), ("nao", "comecei"), ("recusei",), ("recusou",)]
PLAN_BEFORE = [
    ("vai", "me", "passar"), ("quer", "me", "passar"), ("pode", "me", "passar"), ("vou", "comecar"), ("falou", "em"),
    ("pensando", "em"), ("se", "nao", "melhorar"), ("avaliar",), ("iniciar",), ("considerar",), ("introduzir",),
    ("prescrever",), ("sugiro",), ("programar",), ("trocar", "para"), ("trocar", "por"), ("associar",),
]


def _has(tokens: list[str], phrase: tuple[str, ...]) -> bool:
    size = len(phrase)
    return any(tuple(tokens[i : i + size]) == phrase for i in range(len(tokens) - size + 1))


def lexicon_context(text: str, start: int, end: int) -> str | None:
    """'other_person', 'negated' or 'hypothetical' for the name at text[start:end], or None."""
    clause_start = max((m.end() for m in _CLAUSE_BREAK.finditer(text, 0, start)), default=0)
    following = _CLAUSE_BREAK.search(text, end)
    before = normalize(text[clause_start:start]).split()[-BACK_WINDOW:]
    after = normalize(text[end : following.start() if following else len(text)]).split()[:FORWARD_WINDOW]

    # Only the words after the last first-person word count as cues before the name.
    last_self = max((i for i, word in enumerate(before) if word in FIRST_PERSON), default=-1)
    cues = before[last_self + 1 :]
    if any(word in OTHER_PERSON for word in cues):
        return "other_person"
    if any(_has(before, phrase) for phrase in NEGATION_BEFORE) or any(_has(after, phrase) for phrase in NEGATION_AFTER):
        return "negated"
    if any(_has(cues, phrase) for phrase in PLAN_BEFORE):
        return "hypothetical"
    return None
