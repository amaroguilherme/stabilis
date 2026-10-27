"""Pure helpers for the legacy ranking engine.

Kept free of torch/qyra imports so they can be unit-tested without the model stack.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from data.constants import HARD_CAP_RULES


def apply_hard_caps(
    drug_name: str,
    score: float,
    active_tags: Iterable[str],
    rules: Mapping[tuple[str, str], float] = HARD_CAP_RULES,
) -> float:
    """Caps the score by every matching (drug, risk tag) rule — the strictest cap wins."""
    tags = set(active_tags)
    caps = [cap for (cap_drug, cap_tag), cap in rules.items() if cap_drug == drug_name and cap_tag in tags]
    return min([score, *caps])


def continuity_bonus(duration_months: float) -> float:
    """Continuity-of-care bonus scaled by treatment duration."""
    if duration_months < 1:
        return 5.0
    if duration_months < 3:
        return 10.0
    if duration_months < 6:
        return 15.0
    return 20.0


def _format_dose(dose) -> str:
    if isinstance(dose, (int, float)) and float(dose).is_integer():
        return str(int(dose))
    return "?" if dose is None else str(dose)


def _format_duration(months: float) -> str:
    if months < 1:
        return "menos de 1 mês"
    whole = int(months)
    return f"{whole} {'mês' if whole == 1 else 'meses'}"


def apply_continuity(
    ranking: list[dict],
    current_medications: Iterable[Mapping],
    active_tags: Iterable[str],
    rules: Mapping[tuple[str, str], float] = HARD_CAP_RULES,
) -> list[dict]:
    """Adds the continuity bonus to drugs already in use, then re-applies the hard caps.

    The caps run last so that an active contraindication is never overridden by continuity.
    """
    tags = set(active_tags)
    in_use: dict[str, dict] = {}
    for med in current_medications:
        name = str(med.get("name", "")).strip().lower()
        if name:
            in_use[name] = {"duration": float(med.get("duration_months", 0)), "dose": med.get("dose")}

    for item in ranking:
        med = in_use.get(item["name"].lower())
        if med is None:
            item["in_use"] = False
            continue
        bonus = continuity_bonus(med["duration"])
        uncapped = min(100.0, item["final_score"] + bonus)
        item["final_score"] = apply_hard_caps(item["name"].lower(), uncapped, tags, rules)
        item["bonus"] += bonus
        item["in_use"] = True
        item["in_use_duration_months"] = med["duration"]
        item["reasons"].insert(0, {
            "type": "bonus",
            "text": f"Em uso há {_format_duration(med['duration'])} ({_format_dose(med['dose'])} mg) — continuidade terapêutica",
        })
        if item["final_score"] < uncapped:
            item["reasons"].insert(1, {
                "type": "penalty",
                "text": "Teto de segurança mantido apesar do uso atual — há contraindicação ativa no perfil",
            })

    ranking.sort(key=lambda x: x["final_score"], reverse=True)
    return ranking
