import json
import random

SYSTEM_PROMPT = """Extraia os dados clínicos do prontuário para JSON. 
Alvos: [5HT1A, 5HT1B, 5HT1D, 5HT1E, 5HT1F, 5HT2A, 5HT2B, 5HT2C, 5HT3A, 5HT3B, 5HT4, 5HT5A, 5HT6, 5HT7, AADACL2, DRD1, DRD2, DRD3, DRD4, SLC6A2, SLC6A4]. 
Tags: [HEPATIC, METABOLIC, RENAL, MOTOR, CARDIAC, PROLACTIN]."""

diagnoses = [
    "Transtorno Bipolar Tipo I (Fase Maníaca)",
    "Transtorno Bipolar Tipo II (Depressão)",
    "Esquizofrenia",
    "Transtorno Esquizoafetivo"
]


symptoms = [
    ("relata profunda tristeza e choro fácil", "Depressão"),
    ("apresenta delírios persecutórios e agitação", "Delírios"),
    ("não dorme há 3 dias e fala muito rápido", "Insônia severa"),
    ("sente extremo cansaço e passa o dia na cama", "Letargia"),
    ("tem ataques de pânico do nada", "Ataques de pânico")
]


metabolisms = [
    ("É fumante inveterado (2 maços/dia), o que historicamente faz a medicação perder o efeito rápido.", "acelerado"),
    ("Faz uso de inibidor de CYP2D6, relatando que qualquer dose baixa a deixa dopada.", "lento"),
    ("Paciente tem extrema sensibilidade a psicotrópicos, ficando letárgica com doses mínimas.", "lento"),
    ("Nunca usou medicação psiquiátrica antes, sem fatores de risco para metabolização.", "padrao"),
    ("Relata que sempre reagiu de forma absolutamente normal às doses padrões.", "padrao")
]


organ_conditions = [
    ("Apresenta cirrose hepática grau II.", ["HEPATIC"]),
    ("Tem obesidade grau III e muito medo de engordar mais.", ["METABOLIC"]),
    ("Exames de fígado e rim estão absolutamente normais, TGO e TGP perfeitos.", []), 
    ("O pai tem Parkinson, mas o paciente não tem tremores. Coração perfeito no ECG.", []), 
    ("Apresenta galactorreia e irregularidade menstrual severa.", ["PROLACTIN"]),
    ("Tem histórico de arritmia e QT longo no eletrocardiograma.", ["CARDIAC"]),
    ("Paciente muito magro. Rim em perfeito estado (creatinina normal).", []) 
]


targets = [
    ("O psiquiatra busca uma medicação com forte ativação dopaminérgica.", ["DRD2", "DRD3"]),
    ("Precisa de modulação na via da noradrenalina para dar energia.", ["SLC6A2"]),
    ("O foco é modular a serotonina para estabilizar a ansiedade.", ["5HT2A", "5HT7"]),
    ("Busca-se bloqueio duplo de dopamina e serotonina.", ["DRD2", "5HT2A"]),
    ("", []) 
]

def generate_patient(patient_id):
    diag = random.choice(diagnoses)
    symptom_text, symptom_tag = random.choice(symptoms)
    metab_text, metab_tag = random.choice(metabolisms)
    organ_text, organ_tags = random.choice(organ_conditions)
    target_text, target_tags = random.choice(targets)
    
    weight = round(random.uniform(50.0, 120.0), 1)
    checklist = {
        "paciente_id": f"STB-{patient_id}",
        "peso_kg": weight,
        "diagnostico_base": diag
    }
    
    doctor_summary = f"Paciente {diag}. {symptom_text}. {metab_text} {organ_text} {target_text}".strip()
    
    user_input = f"- Checklist: {checklist}\n- Texto: '{doctor_summary}'"
    
    ground_truth = {
        "sintomas": [symptom_tag],
        "contraindicacoes_relativas": organ_tags,
        "perfil_metabolico_estimado": metab_tag,
        "alvos_moleculares_prioritários": target_tags
    }
    
    result = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": json.dumps(ground_truth, ensure_ascii=False)}
        ]
    }
    
    return result

NUM_CASES = 500
filename = "dataset_synthetic_cases.jsonl"

with open(f"artifacts/{filename}", "w", encoding="utf-8") as f:
    for i in range(1, NUM_CASES + 1):
        patient = generate_patient(i)
        f.write(json.dumps(patient, ensure_ascii=False) + "\n")

print(f"{NUM_CASES} synthetic medical records were generated in the file '{filename}'.")
