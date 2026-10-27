from core.scoring import apply_continuity, apply_hard_caps, continuity_bonus

RULES = {
    ("lithium-carbonate", "RENAL"): 15.0,
    ("valproic-acid", "HEPATIC"): 15.0,
    ("valproic-acid", "MOTOR"): 10.0,
}


def _item(name: str, score: float) -> dict:
    return {"name": name, "final_score": score, "bonus": 0.0, "penalty": 0.0, "reasons": []}


def test_cap_applies_only_when_the_tag_is_active():
    assert apply_hard_caps("lithium-carbonate", 90.0, {"HEPATIC"}, RULES) == 90.0
    assert apply_hard_caps("lithium-carbonate", 90.0, {"RENAL"}, RULES) == 15.0


def test_strictest_of_several_matching_caps_wins():
    assert apply_hard_caps("valproic-acid", 80.0, {"HEPATIC", "MOTOR"}, RULES) == 10.0


def test_cap_never_raises_a_score():
    assert apply_hard_caps("lithium-carbonate", 5.0, {"RENAL"}, RULES) == 5.0


def test_default_rules_cap_lithium_in_renal_disease():
    assert apply_hard_caps("lithium-carbonate", 95.0, {"RENAL"}) == 15.0


def test_continuity_bonus_tiers():
    assert [continuity_bonus(m) for m in (0.5, 1, 3, 6, 24)] == [5.0, 10.0, 15.0, 20.0, 20.0]


def test_continuity_bonus_does_not_override_a_hard_cap():
    ranking = [_item("lithium-carbonate", 15.0), _item("quetiapine", 60.0)]
    meds = [{"name": "lithium-carbonate", "dose": 600, "duration_months": 8}]

    apply_continuity(ranking, meds, {"RENAL"}, RULES)

    lithium = next(i for i in ranking if i["name"] == "lithium-carbonate")
    assert lithium["final_score"] == 15.0
    assert lithium["in_use"] is True
    assert any("Teto de segurança" in r["text"] for r in lithium["reasons"])


def test_each_drug_in_use_reports_its_own_dose():
    ranking = [_item("lithium-carbonate", 50.0), _item("quetiapine", 40.0)]
    meds = [
        {"name": "lithium-carbonate", "dose": 600, "duration_months": 8},
        {"name": "quetiapine", "dose": 100.0, "duration_months": 2},
    ]

    apply_continuity(ranking, meds, set(), RULES)

    first_reason = {i["name"]: i["reasons"][0]["text"] for i in ranking}
    assert "(600 mg)" in first_reason["lithium-carbonate"]
    assert "8 meses" in first_reason["lithium-carbonate"]
    assert "(100 mg)" in first_reason["quetiapine"]


def test_continuity_marks_other_drugs_and_resorts():
    ranking = [_item("quetiapine", 60.0), _item("lithium-carbonate", 50.0)]
    apply_continuity(ranking, [{"name": "Lithium-Carbonate ", "dose": 300, "duration_months": 0.5}], set(), RULES)

    assert [i["name"] for i in ranking] == ["quetiapine", "lithium-carbonate"]
    assert ranking[0]["in_use"] is False
    assert ranking[1]["final_score"] == 55.0
    assert "menos de 1 mês" in ranking[1]["reasons"][0]["text"]
