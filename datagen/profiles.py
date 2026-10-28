"""Samples structured "fact sheets": what a synthetic text must say, before any text exists.

Structure first: the expected extraction is fixed here, deterministically from a seed, and the
teacher model only writes a narrative that expresses it. That way the labels never depend on what
the teacher happened to write, and the judge can check each fact.
"""

from __future__ import annotations

import random
from dataclasses import asdict, dataclass, field

from core.extraction.schema import RISK_KINDS, SYMPTOM_DOMAINS

STYLES = {
    "patient": ["whatsapp", "audio_transcript", "careful", "short"],
    "professional": ["sbar_note", "telegraphic", "referral_letter"],
}
REGIONS = ["nordeste", "sudeste", "sul", "norte", "centro-oeste"]


@dataclass
class Mention:
    kind: str  # condition | habit | symptom | risk | medication | pregnancy
    code: str
    negated: bool = False
    experiencer: str = "patient"
    temporality: str = "current"
    extra: dict = field(default_factory=dict)


@dataclass
class FactSheet:
    id: str
    task: str
    style: str
    region: str
    age: int
    sex: str
    mentions: list[Mention]

    def to_dict(self) -> dict:
        return asdict(self)


class ProfileSampler:
    def __init__(self, kb, seed: int):
        self.rng = random.Random(seed)
        vocab = kb.vocab["comorbidities"]
        self.conditions = [c["id"] for c in vocab["comorbidities"]]
        self.habits = [h["id"] for h in vocab["habits"]]
        self.drugs = [d for d in kb.drugs]
        self.brands: dict[str, list[str]] = {}
        for brand, ids in kb.brands.items():
            if len(ids) == 1:
                self.brands.setdefault(ids[0], []).append(brand)

    def _attributes(self, allow_other: bool = True) -> dict:
        r = self.rng.random()
        if r < 0.15:
            return {"negated": True}
        if allow_other and r < 0.25:
            return {"experiencer": "other"}
        if r < 0.32:
            return {"temporality": "past"}
        if r < 0.36:
            return {"temporality": "hypothetical"}
        return {}

    def _medication(self) -> Mention:
        drug = self.rng.choice(self.drugs)
        names = [drug["names"]["display_pt"], *drug["names"].get("aliases", [])]
        brands = self.brands.get(drug["id"], [])
        written = self.rng.choice(brands).title() if brands and self.rng.random() < 0.4 else self.rng.choice(names)
        dose = drug.get("dose_adult", {})
        mg = None
        if dose.get("usual_min") is not None and self.rng.random() < 0.6:
            mg = self.rng.choice(sorted({dose.get("usual_min"), dose.get("usual_max") or dose["usual_min"]}))
        status = "past" if self.rng.random() < 0.3 else "current"
        return Mention("medication", drug["id"], temporality=status, extra={"written_as": written, "mg_per_day": mg})

    def sample(self, index: int, task: str) -> FactSheet:
        rng = self.rng
        mentions: list[Mention] = []
        for code in rng.sample(list(SYMPTOM_DOMAINS)[:-1], k=rng.randint(1, 4)):
            mentions.append(Mention("symptom", code, **self._attributes()))
        for code in rng.sample(self.conditions, k=rng.choice([0, 0, 1, 2])):
            mentions.append(Mention("condition", code, **self._attributes()))
        for code in rng.sample(self.habits, k=rng.choice([0, 1])):
            mentions.append(Mention("habit", code, **self._attributes(allow_other=False)))
        for _ in range(rng.choice([0, 1, 1, 2, 3])):
            mentions.append(self._medication())
        if rng.random() < 0.35:  # risk, often negated or about someone else (hard negatives)
            mentions.append(Mention("risk", rng.choice(list(RISK_KINDS)), **self._attributes()))
        sex = rng.choice(["female", "male"])
        if sex == "female" and rng.random() < 0.15:
            mentions.append(Mention("pregnancy", rng.choice(["pregnant", "planning", "breastfeeding"])))
        rng.shuffle(mentions)
        return FactSheet(
            id=f"{task[:3]}-{index:06d}",
            task=task,
            style=rng.choice(STYLES[task]),
            region=rng.choice(REGIONS),
            age=rng.randint(18, 75),
            sex=sex,
            mentions=mentions,
        )


def expected_extraction(sheet: FactSheet) -> dict:
    """The label for a fact sheet, in the shape of extraction schema v1 (evidence filled in later)."""
    out = {"symptoms": [], "risk": [], "medications": [], "conditions": [], "substances": [], "pregnancy": {"status": "unknown"}}
    attrs = lambda m: {"negated": m.negated, "experiencer": m.experiencer, "temporality": m.temporality}  # noqa: E731
    for m in sheet.mentions:
        if m.kind == "symptom":
            out["symptoms"].append({"domain": m.code, **attrs(m)})
        elif m.kind == "risk":
            out["risk"].append({"kind": m.code, **attrs(m)})
        elif m.kind == "condition":
            out["conditions"].append({"id": m.code, **attrs(m)})
        elif m.kind == "habit":
            out["substances"].append({"id": m.code, "negated": m.negated, "temporality": m.temporality})
        elif m.kind == "medication":
            entry = {"drug_id": m.code, "name": m.extra["written_as"], "status": "past" if m.temporality == "past" else "current"}
            if m.extra.get("mg_per_day"):
                entry["dose_mg_per_day"] = m.extra["mg_per_day"]
            out["medications"].append(entry)
        elif m.kind == "pregnancy":
            out["pregnancy"] = {"status": m.code}
    return out
