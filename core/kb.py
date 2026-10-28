"""Loads, validates and bundles the knowledge base in knowledge/.

Validation has two layers:
1. JSON Schema (knowledge/schema/kb.schema.json, one $def per document type);
2. referential integrity and provenance (every citation points to a registered source, every
   id used by drugs, rules, interactions and options exists, derived facts never refer forward).

The bundle written for the web app contains everything the decision engine needs.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match

KNOWLEDGE_DIR = Path(__file__).resolve().parents[1] / "knowledge"

SINGLE_FILES = {
    "manifest.json": "manifest",
    "sources.json": "sources_file",
    "vocab/facts.json": "vocab_facts",
    "vocab/classes.json": "vocab_classes",
    "vocab/comorbidities.json": "vocab_comorbidities",
    "vocab/monitoring.json": "vocab_monitoring",
    "vocab/effects.json": "vocab_effects",
    "vocab/conditions.json": "vocab_conditions",
    "rules/safety.json": "rules_file",
    "rules/derived.json": "derived_file",
    "i18n/pt-BR.json": "messages",
}
GLOBS = {
    "drugs/*.json": "drug",
    "interactions/*.json": "interactions_file",
    "conditions/*.json": "condition_doc",
    "instruments/*.json": "instrument",
}
OPTIONAL_FILES = {"lexicons/brands.pt-BR.json": "brands_lexicon"}

TIER_ORDER = ["first_line", "second_line", "alternative", "not_recommended", "avoid_for_profile"]


@dataclass
class KnowledgeBase:
    root: Path
    manifest: dict = field(default_factory=dict)
    sources: list[dict] = field(default_factory=list)
    vocab: dict[str, dict] = field(default_factory=dict)
    drugs: list[dict] = field(default_factory=list)
    interactions: list[dict] = field(default_factory=list)
    rules: list[dict] = field(default_factory=list)
    derived: list[dict] = field(default_factory=list)
    conditions: list[dict] = field(default_factory=list)
    instruments: list[dict] = field(default_factory=list)
    messages: dict[str, dict] = field(default_factory=dict)
    brands: dict[str, list[str]] = field(default_factory=dict)
    # where each document came from, for error messages
    origin: dict[int, str] = field(default_factory=dict)

    def where(self, doc: dict) -> str:
        return self.origin.get(id(doc), "?")


class KnowledgeBaseError(Exception):
    def __init__(self, errors: list[str]):
        super().__init__(f"{len(errors)} erro(s) na base de conhecimento")
        self.errors = errors


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _schema_errors(validator: Draft202012Validator, data, label: str) -> list[str]:
    errors = []
    for error in validator.iter_errors(data):
        specific = best_match(error.context) if error.context else error
        where = "/".join(str(p) for p in specific.absolute_path) or "(raiz)"
        errors.append(f"{label}: {where}: {specific.message}")
    return errors


def load(root: Path = KNOWLEDGE_DIR) -> tuple[KnowledgeBase, list[str]]:
    """Reads and schema-validates every file. Returns the knowledge base and the errors found."""
    schema = _read(root / "schema" / "kb.schema.json")
    validators: dict[str, Draft202012Validator] = {}

    def validator_for(definition: str) -> Draft202012Validator:
        if definition not in validators:
            validators[definition] = Draft202012Validator({"$ref": f"#/$defs/{definition}", "$defs": schema["$defs"]})
        return validators[definition]

    kb = KnowledgeBase(root=root)
    errors: list[str] = []

    def read_valid(rel: str, definition: str):
        path = root / rel
        try:
            data = _read(path)
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{rel}: não foi possível ler ({type(exc).__name__}: {exc})")
            return None
        found = _schema_errors(validator_for(definition), data, rel)
        errors.extend(found)
        return None if found else data

    singles = {rel: read_valid(rel, definition) for rel, definition in SINGLE_FILES.items()}
    if singles["manifest.json"]:
        kb.manifest = singles["manifest.json"]
    if singles["sources.json"]:
        kb.sources = singles["sources.json"]["sources"]
    for name in ("facts", "classes", "comorbidities", "monitoring", "conditions", "effects"):
        if singles[f"vocab/{name}.json"]:
            kb.vocab[name] = singles[f"vocab/{name}.json"]
    if singles["rules/safety.json"]:
        kb.rules = singles["rules/safety.json"]["rules"]
        for rule in kb.rules:
            kb.origin[id(rule)] = f"rules/safety.json#{rule['id']}"
    if singles["rules/derived.json"]:
        kb.derived = singles["rules/derived.json"]["derived"]
        for fact in kb.derived:
            kb.origin[id(fact)] = f"rules/derived.json#{fact['id']}"
    if singles["i18n/pt-BR.json"]:
        kb.messages = singles["i18n/pt-BR.json"]["messages"]

    for pattern, definition in GLOBS.items():
        for path in sorted(root.glob(pattern)):
            rel = path.relative_to(root).as_posix()
            data = read_valid(rel, definition)
            if data is None:
                continue
            if definition == "drug":
                kb.drugs.append(data)
                kb.origin[id(data)] = rel
                if path.stem != data["id"]:
                    errors.append(f"{rel}: o nome do arquivo deve ser o id ({data['id']}.json)")
            elif definition == "interactions_file":
                for item in data["interactions"]:
                    kb.interactions.append(item)
                    kb.origin[id(item)] = f"{rel}#{item['id']}"
            elif definition == "condition_doc":
                kb.conditions.append(data)
                kb.origin[id(data)] = rel
            elif definition == "instrument":
                kb.instruments.append(data)
                kb.origin[id(data)] = rel

    for rel, definition in OPTIONAL_FILES.items():
        if (root / rel).exists():
            data = read_valid(rel, definition)
            if data is not None:
                kb.brands = data["brands"]
    return kb, errors


# ── Referential integrity ────────────────────────────────────────────────────

def _walk_cites(node, path: str = "") -> Iterator[tuple[str, dict]]:
    if isinstance(node, dict):
        if "source" in node and "locator" in node and ("quote" in node or "absent_term" in node):
            yield path, node
        for key, value in node.items():
            yield from _walk_cites(value, f"{path}/{key}")
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from _walk_cites(value, f"{path}/{index}")


def _duplicates(ids: list[str]) -> set[str]:
    seen, dupes = set(), set()
    for item in ids:
        (dupes if item in seen else seen).add(item)
    return dupes


class _Refs:
    """Id sets used by the integrity checks."""

    def __init__(self, kb: KnowledgeBase):
        self.sources = {s["id"] for s in kb.sources}
        self.facts = {f["id"] for f in kb.vocab.get("facts", {}).get("facts", [])}
        self.classes = {c["id"]: {s["id"] for s in c["subclasses"]} for c in kb.vocab.get("classes", {}).get("classes", [])}
        comorbidities = kb.vocab.get("comorbidities", {})
        self.comorbidities = {c["id"] for c in comorbidities.get("comorbidities", [])}
        self.habits = {h["id"] for h in comorbidities.get("habits", [])}
        self.monitoring = {m["id"] for m in kb.vocab.get("monitoring", {}).get("monitoring", [])}
        self.effects = {e["id"] for e in kb.vocab.get("effects", {}).get("effects", [])}
        self.conditions = {c["id"]: {p["id"] for p in c["phases"]} for c in kb.vocab.get("conditions", {}).get("conditions", [])}
        self.drugs = {d["id"] for d in kb.drugs}
        self.interactions = {i["id"] for i in kb.interactions}
        self.instruments = {
            i["id"]: {
                "bands": {b["id"] for b in i["scoring"].get("bands", [])}
                | {b["id"] for bands in i["scoring"].get("bands_by_sex", {}).values() for b in bands}
                | ({"positive", "negative"} if i["scoring"]["type"] == "mdq" else set())
                | ({"none", "low", "high"} if i["scoring"]["type"] == "risk_screener" else set()),
                "flags": {f["id"] for f in i["scoring"].get("flags", [])},
            }
            for i in kb.instruments
        }
        self.messages = set(kb.messages)


def _check_class(refs: _Refs, cls: str, sub: str | None, where: str, errors: list[str]) -> None:
    if cls not in refs.classes:
        errors.append(f"{where}: classe desconhecida '{cls}'")
    elif sub is not None and sub not in refs.classes[cls]:
        errors.append(f"{where}: subclasse '{sub}' não pertence à classe '{cls}'")


def _check_selector(refs: _Refs, selector: dict, where: str, errors: list[str]) -> None:
    if "drug" in selector and selector["drug"] not in refs.drugs:
        errors.append(f"{where}: medicamento desconhecido '{selector['drug']}'")
    if "class" in selector:
        _check_class(refs, selector["class"], selector.get("subclass"), where, errors)
    if "fact" in selector and selector["fact"] not in refs.facts:
        errors.append(f"{where}: fato desconhecido '{selector['fact']}'")


def _check_predicate(refs: _Refs, node: dict, where: str, errors: list[str], known_derived: set[str]) -> None:
    if "all" in node or "any" in node:
        for child in node.get("all", node.get("any", [])):
            _check_predicate(refs, child, where, errors, known_derived)
    elif "not" in node:
        _check_predicate(refs, node["not"], where, errors, known_derived)
    elif "profile" in node:
        if node["profile"] in ("conditions", "habits"):
            vocab = refs.comorbidities if node["profile"] == "conditions" else refs.habits
            values = node.get("value") if isinstance(node.get("value"), list) else [node.get("value")]
            for value in values:
                if value not in vocab:
                    errors.append(f"{where}: '{value}' não existe em vocab/comorbidities.json ({node['profile']})")
    elif "derived" in node:
        if node["derived"] not in known_derived:
            errors.append(f"{where}: fato derivado '{node['derived']}' desconhecido ou usado antes de ser definido")
    elif "instrument" in node:
        instrument = refs.instruments.get(node["instrument"])
        if instrument is None:
            errors.append(f"{where}: instrumento desconhecido '{node['instrument']}'")
        else:
            for band in node.get("band_in", []):
                if band not in instrument["bands"]:
                    errors.append(f"{where}: faixa '{band}' não existe em {node['instrument']}")
            if "flag" in node and node["flag"] not in instrument["flags"]:
                errors.append(f"{where}: sinalizador '{node['flag']}' não existe em {node['instrument']}")
    elif "drug_fact" in node or "current_med_fact" in node:
        fact = node.get("drug_fact", node.get("current_med_fact"))
        if fact not in refs.facts:
            errors.append(f"{where}: fato desconhecido '{fact}'")
    elif "drug_class" in node or "current_med_class" in node:
        _check_class(refs, node.get("drug_class", node.get("current_med_class")), node.get("subclass"), where, errors)
    elif "drug" in node or "current_med" in node:
        drug = node.get("drug", node.get("current_med"))
        if drug not in refs.drugs:
            errors.append(f"{where}: medicamento desconhecido '{drug}'")
    elif "condition" in node:
        phases = refs.conditions.get(node["condition"])
        if phases is None:
            errors.append(f"{where}: condição desconhecida '{node['condition']}'")
        elif "phase" in node and node["phase"] not in phases:
            errors.append(f"{where}: fase '{node['phase']}' não existe em {node['condition']}")


def _check_message(refs: _Refs, key: str, where: str, errors: list[str]) -> None:
    if key not in refs.messages:
        errors.append(f"{where}: mensagem '{key}' não existe em i18n/pt-BR.json")


def integrity_errors(kb: KnowledgeBase) -> list[str]:
    refs = _Refs(kb)
    errors: list[str] = []

    collections = {
        "sources": [s["id"] for s in kb.sources],
        "drugs": [d["id"] for d in kb.drugs],
        "interactions": [i["id"] for i in kb.interactions],
        "rules": [r["id"] for r in kb.rules],
        "derived": [d["id"] for d in kb.derived],
        "conditions": [c["id"] for c in kb.conditions],
        "options": [o["id"] for c in kb.conditions for o in c["options"]],
        "instruments": [i["id"] for i in kb.instruments],
    }
    for name, ids in collections.items():
        for dupe in sorted(_duplicates(ids)):
            errors.append(f"{name}: id repetido '{dupe}'")

    documents: list[tuple[str, object]] = [("sources.json", {"sources": kb.sources})]
    documents += [(kb.where(d), d) for d in kb.drugs + kb.interactions + kb.rules + kb.derived + kb.conditions + kb.instruments]
    for label, document in documents:
        for path, cite in _walk_cites(document):
            if cite["source"] not in refs.sources:
                errors.append(f"{label}{path}: fonte '{cite['source']}' não registrada em sources.json")

    for drug in kb.drugs:
        where = kb.where(drug)
        _check_class(refs, drug["class"], drug["subclass"], where, errors)
        for fact in drug["facts"]:
            if fact["tag"] not in refs.facts:
                errors.append(f"{where}: fato '{fact['tag']}' não existe em vocab/facts.json")
        for item in drug.get("monitoring", []):
            if item["id"] not in refs.monitoring:
                errors.append(f"{where}: monitoramento '{item['id']}' não existe em vocab/monitoring.json")
        for effect in drug.get("common_effects", {}).get("effects", []):
            if effect not in refs.effects:
                errors.append(f"{where}: efeito '{effect}' não existe em vocab/effects.json")
        if "label_source" in drug and drug["label_source"] not in refs.sources:
            errors.append(f"{where}: label_source '{drug['label_source']}' não registrada")
        dose = drug.get("dose_adult", {})
        bounds = [dose.get(k) for k in ("usual_min", "usual_max", "max") if dose.get(k) is not None]
        if bounds != sorted(bounds):
            errors.append(f"{where}: dose_adult fora de ordem (usual_min ≤ usual_max ≤ max)")

    for interaction in kb.interactions:
        where = kb.where(interaction)
        for selector in [interaction.get("perpetrator"), interaction.get("victim"), *interaction.get("participants", [])]:
            if selector:
                _check_selector(refs, selector, where, errors)
        _check_message(refs, interaction["message_key"], where, errors)
        for other in interaction.get("supersedes", []):
            if other not in refs.interactions:
                errors.append(f"{where}: supersedes '{other}' não existe")
            elif other == interaction["id"]:
                errors.append(f"{where}: interação não pode substituir a si mesma")

    known_derived: set[str] = set()
    for fact in kb.derived:
        _check_predicate(refs, fact["when"], kb.where(fact), errors, known_derived)
        known_derived.add(fact["id"])

    for rule in kb.rules:
        where = kb.where(rule)
        _check_predicate(refs, rule["when"], where, errors, known_derived)
        for action in rule["then"]:
            if "message_key" in action:
                _check_message(refs, action["message_key"], where, errors)
            if action["action"] == "exclude_medications" and isinstance(action["scope"], dict):
                _check_class(refs, action["scope"]["class"], action["scope"].get("subclass"), where, errors)
            if action["action"] in ("set_tier", "exclude") and rule["applies_to"] != "drug":
                errors.append(f"{where}: ação '{action['action']}' só vale para applies_to=drug")

    for condition in kb.conditions:
        where = kb.where(condition)
        phases = refs.conditions.get(condition["id"])
        if phases is None:
            errors.append(f"{where}: condição '{condition['id']}' não existe em vocab/conditions.json")
            continue
        for option in condition["options"]:
            option_where = f"{where}#{option['id']}"
            if phases and "phase" in option and option["phase"] not in phases:
                errors.append(f"{option_where}: fase inválida (use {', '.join(sorted(phases))}, ou omita para todas)")
            if not phases and "phase" in option:
                errors.append(f"{option_where}: esta condição não tem fases")
            for selector in option.get("targets", []):
                _check_selector(refs, selector, option_where, errors)
            if "applies_when" in option:
                _check_predicate(refs, option["applies_when"], option_where, errors, known_derived)
            _check_message(refs, option["text_key"], option_where, errors)

    for instrument in kb.instruments:
        where = kb.where(instrument)
        items = {i["id"] for i in instrument["items"]}
        scoring = instrument["scoring"]
        referenced = [f["item"] for f in scoring.get("flags", []) if f["item"] != "total"]
        referenced += scoring.get("mdq", {}).get("symptom_items", [])
        referenced += [scoring[k][field] for k, field in (("mdq", "same_period_item"), ("mdq", "problem_item")) if k in scoring]
        referenced += scoring.get("risk", {}).get("low_items", []) + scoring.get("risk", {}).get("high_items", [])
        order = [i["id"] for i in instrument["items"]]
        for entry in instrument["items"]:
            ask_if = entry.get("ask_if")
            if ask_if:
                referenced += ask_if["items"]
                if any(order.index(dep) >= order.index(entry["id"]) for dep in ask_if["items"] if dep in items):
                    errors.append(f"{where}: '{entry['id']}' depende de item que vem depois dele")
            if entry["text_status"] == "verified" and not (entry.get("text") and entry.get("cite")):
                errors.append(f"{where}: item '{entry['id']}' verificado precisa de texto e citação")
            if entry["text_status"] == "pending" and entry.get("text"):
                errors.append(f"{where}: item '{entry['id']}' pendente não deve ter texto")
        for item in referenced:
            if item not in items:
                errors.append(f"{where}: item '{item}' não existe no instrumento")
        if scoring["type"] == "mdq" and "mdq" not in scoring:
            errors.append(f"{where}: pontuação mdq sem regra 'mdq'")
        if scoring["type"] == "risk_screener" and "risk" not in scoring:
            errors.append(f"{where}: pontuação risk_screener sem regra 'risk'")

    for brand, drugs in kb.brands.items():
        for drug in drugs:
            if drug not in refs.drugs:
                errors.append(f"lexicons/brands.pt-BR.json: marca '{brand}' aponta para medicamento desconhecido '{drug}'")
    return errors


def load_and_validate(root: Path = KNOWLEDGE_DIR) -> KnowledgeBase:
    kb, errors = load(root)
    errors = errors + integrity_errors(kb)
    if errors:
        raise KnowledgeBaseError(errors)
    return kb


# ── Bundle ───────────────────────────────────────────────────────────────────

def bundle_data(kb: KnowledgeBase) -> dict:
    vocab = {name: {k: v for k, v in doc.items() if k != "description"} for name, doc in kb.vocab.items()}
    source_fields = ("id", "title", "publisher", "year", "kind", "language", "url", "license_note")
    return {
        "manifest": kb.manifest,
        "sources": [{k: s[k] for k in source_fields} for s in kb.sources],
        "vocab": vocab,
        "drugs": sorted(kb.drugs, key=lambda d: d["id"]),
        "interactions": kb.interactions,
        "rules": kb.rules,
        "derived": kb.derived,
        "conditions": sorted(kb.conditions, key=lambda c: c["id"]),
        "instruments": sorted(kb.instruments, key=lambda i: i["id"]),
        "messages": kb.messages,
        "brands": dict(sorted(kb.brands.items())),
    }


def content_hash(data) -> str:
    canonical = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()
