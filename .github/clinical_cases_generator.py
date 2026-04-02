import os
import json
import random
import re
import time

import requests
from jsonschema import validate

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_ID     = "llama-3.1-8b-instant"
API_URL      = "https://api.groq.com/openai/v1/chat/completions"

JSONL_PATH = os.path.join(os.path.dirname(__file__), "synthetic_cases_dataset_v3.jsonl")

CASES_PER_RUN = 4
MAX_RETRIES   = 3

CASE_SCHEMA = {
    "type": "object",
    "properties": {
        "messages": {
            "type": "array",
            "minItems": 3,
            "items": {"type": "object", "required": ["role", "content"]}
        }
    },
    "required": ["messages"]
}

# Diversity seeds: each run picks one profile at random for each of the 4 cases.
DIAGNOSES = [
    "Transtorno Bipolar I", "Transtorno Bipolar II", "Esquizofrenia",
    "Transtorno Depressivo Maior", "Transtorno de Ansiedade Generalizada",
    "Transtorno Obsessivo-Compulsivo", "TDAH", "Transtorno de Pânico",
    "Transtorno Esquizoafetivo", "Transtorno de Estresse Pós-Traumático"
]

COMORBIDITIES = [
    [], [], [],  # blank entries make comorbidity-free cases more common
    ["Hipertensão"], ["Diabetes Tipo 2"], ["Obesidade"], ["Hipotireoidismo"],
    ["Hipertensão", "Diabetes Tipo 2"], ["Hepatite C"], ["Insuficiência Renal Crônica"]
]

HABITS = [
    [], [],
    ["Tabagismo"], ["Consumo de Álcool"], ["Uso de Cannabis"],
    ["Tabagismo", "Consumo de Álcool"]
]

METABOLIC_PROFILES = ["standard", "slow", "fast"]

TARGETS = (
    "5HT1A, 5HT1B, 5HT1D, 5HT1E, 5HT1F, 5HT2A, 5HT2B, 5HT2C, "
    "5HT3A, 5HT3B, 5HT4, 5HT5A, 5HT6, 5HT7, "
    "DRD1, DRD2, DRD3, DRD4, "
    "NET, SERT, DAT, "
    "H1, H2, H3, "
    "M1, M2, M3, "
    "GABRA, NMDA, "
    "ADRA1, ADRA2, "
    "MAOA, MAOB, "
    "SIGMAR1, ACHE, MT1, MT2, SCN, CACNA, GSK3B"
)

TAGS = "HEPATIC, METABOLIC, RENAL, MOTOR, CARDIAC, PROLACTIN"

SYSTEM_PROMPT = (
    f"Extract clinical data from medical records into JSON. "
    f"Targets: [{TARGETS}]. Tags: [{TAGS}]."
)


def _build_prompt(seed: dict) -> list[dict]:
    checklist = {
        "patient_id": f"STB-SYN-{random.randint(1000, 9999)}",
        "weight": seed["weight"],
        "gender": seed["gender"],
        "base_diagnosis": seed["diagnosis"],
        "comorbidities": seed["comorbidities"],
        "habits": seed["habits"]
    }

    contraindication_hint = (
        "Based on the comorbidities and habits in the checklist, select ALL applicable tags: "
        "HEPATIC (hepatitis, cirrhosis, alcohol use), "
        "METABOLIC (obesity, diabetes, weight gain fear), "
        "RENAL (renal insufficiency), "
        "CARDIAC (arrhythmia, QT risk), "
        "MOTOR (tremors, akathisia history), "
        "PROLACTIN (hyperprolactinemia). "
        "If none apply, return an empty list."
    )

    user_content = (
        f"You are generating training data for a clinical NLP model.\n\n"
        f"Generate ONE complete synthetic clinical case as a JSON object with exactly this structure:\n"
        f'{{\n'
        f'    "messages": [\n'
        f'        {{"role": "system", "content": "{SYSTEM_PROMPT}"}},\n'
        f'        {{"role": "user", "content": {{"checklist": {json.dumps(checklist, ensure_ascii=False)}, "doctor_summary": "<3-5 sentence clinical note in Brazilian Portuguese for a {seed["diagnosis"]} patient. Mention relevant symptoms, treatment history, and any concerns>"}}}},\n'
        f'        {{"role": "assistant", "content": {{"symptoms": ["<1-3 tags from: {TAGS}>"], "relative_contraindications": ["<{contraindication_hint}>"], "estimated_metabolic_profile": "{seed["metabolic"]}", "priority_molecular_targets": ["<2-4 targets from: {TARGETS}>"]}}}}\n'
        f'    ]\n'
        f'}}\n\n'
        f"Return ONLY the raw JSON object. No markdown, no code blocks, no explanation."
    )

    return [{"role": "user", "content": user_content}]


def _extract_json(raw: str) -> dict:
    """Strips markdown fences, fixes common LLM JSON mistakes, and parses."""
    # Remove markdown fences
    raw = re.sub(r"```(?:json)?", "", raw).strip()

    # Isolate the outermost JSON object
    start = raw.find("{")
    end   = raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in response")
    raw = raw[start:end + 1]

    # Remove trailing commas before ] or }
    raw = re.sub(r",\s*([}\]])", r"\1", raw)

    # Replace single-quoted keys/values with double-quoted
    raw = re.sub(r"(?<![\\])'", '"', raw)

    return json.loads(raw)


def generate_case(seed: dict) -> dict | None:
    messages = _build_prompt(seed)
    headers  = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    payload  = {
        "model": MODEL_ID,
        "messages": messages,
        "max_tokens": 800,
        "temperature": 0.85,
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(API_URL, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            raw_text = response.json()["choices"][0]["message"]["content"]

            case_data = _extract_json(raw_text)
            validate(instance=case_data, schema=CASE_SCHEMA)
            return case_data

        except requests.HTTPError as e:
            print(f"  Attempt {attempt}/{MAX_RETRIES} failed: {e}")
            print(f"  Response body: {e.response.text}")
            if attempt < MAX_RETRIES:
                time.sleep(3 * attempt)
        except Exception as e:
            print(f"  Attempt {attempt}/{MAX_RETRIES} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(3 * attempt)

    return None


def _make_seed() -> dict:
    return {
        "diagnosis":    random.choice(DIAGNOSES),
        "weight":       round(random.uniform(48.0, 110.0), 1),
        "gender":       random.choice(["Masculino", "Feminino"]),
        "comorbidities": random.choice(COMORBIDITIES),
        "habits":       random.choice(HABITS),
        "metabolic":    random.choice(METABOLIC_PROFILES)
    }


def main():
    if not GROQ_API_KEY:
        raise EnvironmentError("GROQ_API_KEY is not set.")

    new_cases = []
    for i in range(CASES_PER_RUN):
        seed = _make_seed()
        print(f"Generating case {i + 1}/{CASES_PER_RUN}: {seed['diagnosis']} | {seed['gender']} | {seed['weight']}kg")
        case = generate_case(seed)
        if case:
            new_cases.append(case)
        time.sleep(10)

    if new_cases:
        with open(JSONL_PATH, "a", encoding="utf-8") as f:
            for case in new_cases:
                f.write(json.dumps(case, ensure_ascii=False) + "\n")
        print(f"{len(new_cases)}/{CASES_PER_RUN} cases written to {JSONL_PATH}")
    else:
        print("No valid cases generated.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
