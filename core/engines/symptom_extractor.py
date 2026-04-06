from dotenv import load_dotenv
from llama_cpp import Llama

import json
import os

load_dotenv()

# TODO: CREATE A MODEL FOR THE LLM INPUT?
"""
{
    checklist={
        "patient_id": "STB-333",
        "weight": 89.0,
        "gender": "Masculino", #Multiple choice
        "base_diagnosis": "Transtorno Bipolar I", #Multiple choice
        "comorbidities": ["Hipertensão", "Diabetes"],
        "habits": ["Tabagismo", "Consumo de Álcool"],
    },
    doctor_summary=""
}
"""

class SymptomExtractor:
    REPO_ID = os.getenv("MODEL_REPO_ID")
    FILENAME = os.getenv("MODEL_FILENAME")

    def __init__(self):
        print(f"Downloading model from Hugging Face Hub: {self.REPO_ID}/{self.FILENAME}")

        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise EnvironmentError("HF_TOKEN environment variable is not set. Required to access private Hugging Face repositories.")

        self.llm = Llama.from_pretrained(
            repo_id=self.REPO_ID,
            filename=self.FILENAME,
            n_ctx=2048,
            n_gpu_layers=-1,
            verbose=True,
            token=hf_token,
        )
        
        self.ontology = """
            Map reported health issues to the following TAGS (ignore mentions of organs only if the text explicitly states they are healthy/normal; when in doubt, tag it):
            - HEPATIC: Use for any active or recent hepatic compromise: cirrhosis, hepatitis, hepatotoxicity, elevated liver enzymes (ALT/AST/TGO/TGP alteradas), jaundice, hepatic steatosis (esteatose hepática), NAFLD/NASH, alcoholic liver disease, or doctor explicitly asking to avoid hepatotoxic drugs. IMPORTANT: fatty liver / esteatose hepática = HEPATIC, NOT METABOLIC.
            - METABOLIC: Use ONLY for: (1) existing metabolic condition — overweight, obesity, or diabetes (do NOT use this reason alone if the patient is thin or if the concern is purely liver-related); (2) weight-gain adherence risk — patient has a documented history of stopping a medication due to weight gain, or the doctor explicitly states the patient will not comply with treatment if the medication causes weight gain. Do NOT use METABOLIC for fatty liver / liver enzyme abnormalities — those are HEPATIC.
            - RENAL: Use for any of: (1) active renal conditions — insufficiency, elevated creatinine, dialysis; (2) renal vulnerability — history of renal sensitivity, family history of renal disease, doctor explicitly advising to avoid renal overload or nephrotoxic drugs; (3) concurrent use of ACE inhibitors (e.g., Enalapril, Lisinopril, Ramipril) combined with ANY mention of renal concern; (4) any phrase like "sensibilidade renal", "sobrecarga renal", "evitar nefrotóxicos".
            - MOTOR: Use for ANY history of movement-related drug side effects or conditions: tremors (tremores), akathisia (acatisia), rigidity (rigidez), extrapyramidal effects (efeitos extrapiramidais, reação extrapiramidal), dystonia (distonia, travamento muscular), tardive dyskinesia (discinesia tardia), Parkinsonism, or doctor asking to avoid drugs that cause these effects. IMPORTANT: if the patient mentions having had "distonia", "travamento muscular", "tremor" or similar from a prior drug — this is MOTOR.
            - CARDIAC: Only for arrhythmias, prolonged QT interval (QT longo), cardiac pathologies, and similar conditions.
            - PROLACTIN: Only for hyperprolactinemia, galactorrhea, or related hormonal dysfunctions.
            - SEDATION: Use when the doctor explicitly states to avoid sedating drugs, cognitive dulling, daytime sedation, or mental fog — or when the patient's occupation/needs require cognitive clarity during the day.
        """
        
        self.targets = """
                  5HT1A, 5HT1B, 5HT1D, 5HT1E, 5HT1F, 5HT2A, 5HT2B, 5HT2C, 5HT3A, 5HT3B, 5HT4, 5HT5A, 5HT6, 5HT7,
                  DRD1, DRD2, DRD3, DRD4,
                  NET, SERT, DAT,
                  H1, H2, H3,
                  M1, M2, M3,
                  GABRA,
                  NMDA,
                  ADRA1, ADRA2,
                  MAOA, MAOB,
                  SIGMAR1,
                  ACHE,
                  MT1, MT2,
                  SCN, CACNA,
                  GSK3B"""
                  
    def clean_json(self, raw_json):
        try:
            start = raw_json.find('{')
            end = raw_json.rfind('}')
            
            if start != -1 and end != -1:
                clean_json = raw_json[start:end+1]
                clean_json = clean_json.replace('\xa0', ' ').replace('\n', ' ').strip()
                
                return json.loads(clean_json)
            else:
                print("Error: No { or } key found in the text.")
                return None
                
        except json.JSONDecodeError as e:
            print(f"Decoding error: {e}")
            print(f"Here: {repr(clean_json)}") 
            return None

    def get_profile(self, checklist, doctor_summary):
        user_input = f"- checklist: {checklist}\n- doctor_summary: '{doctor_summary}'"
        
        # TODO: THIS SHOULD ONLY REPLY IF THE INCOMING TEXT IS AN ANAMNESIS
        # TODO: THE DOCTOR SUMMARY MUST HAVE A CHARACTER LIMIT
        target_guidance = """
        Target selection guidance (choose targets that would be THERAPEUTICALLY BENEFICIAL to modulate for this patient's main complaints; include ALL that apply):
        - Depressive episode, anhedonia, lack of motivation, low energy → SERT, NET, DAT
        - Cognitive symptoms (brain fog, poor concentration, mental fatigue) → DAT, NET, SIGMAR1
        - Anxiety, rumination, social withdrawal → 5HT1A, SERT
        - Insomnia, circadian disruption → MT1, MT2, H1, GABRA
        - Psychotic symptoms, hallucinations, delusions → DRD2, 5HT2A
        - Mania, mixed state, psychomotor agitation, irritability, pressured speech → DRD2, 5HT2A, GSK3B, SCN, GABRA
        - Bipolar depression (with mood stabilization need) → GSK3B, SERT
        - Suicidal ideation, impulsivity → SERT, 5HT2A
        - Neuropathic pain, seizure threshold → GABRA, SCN, CACNA
        - Attention, executive function, fatigue → DAT, NET
        """

        prompt = f"""<start_of_turn>user
        Extract clinical data from medical records into a JSON object with exactly these fields:
        - "symptoms": list of main clinical complaints in plain text
        - "relative_contraindications": list of risk TAGS from the ontology below that apply to this patient
        - "estimated_metabolic_profile": one of "slow", "standard", or "fast"
        - "priority_molecular_targets": list of molecular targets from the allowed list that would be beneficial to modulate

        Allowed Tags: {self.ontology}
        Allowed Targets: {self.targets}
        {target_guidance}

        Medical record:
        {user_input}

        Respond with only the JSON object, no explanation.<end_of_turn>
        <start_of_turn>model
        """

        response = self.llm(
            prompt,
            max_tokens=2048,
            temperature=0.1, # Keeps the output deterministic
            stop=["<end_of_turn>", "</start_of_turn>", "</start_of_turn'", "<eos>"]
        )

        raw_text = response['choices'][0]['text'].strip()
        result = self.clean_json(raw_text)
        
        try:
            return result
        except json.JSONDecodeError:
            print("Failed to decode JSON. Here's the raw text:", raw_text)

            return {
                "symptoms": [],
                "relative_contraindications": [],
                "estimated_metabolic_profile": "standard",
                "priority_molecular_targets": []
            }
