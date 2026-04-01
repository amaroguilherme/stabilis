from llama_cpp import Llama
import json

# TODO: CREATE A MODEL FOR THE LLM INPUT
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
    #TODO: MOVE IT HUGGING FACE HUB
    def __init__(self, model_path="models/gemma-2-9b-it.Q4_K_M_v0.gguf"):
        print(f"Loading local LLM: {model_path}")
        
        self.llm = Llama(
            model_path=model_path,
            n_ctx=2048,      
            n_gpu_layers=-1, 
            verbose=True
        )
        
        self.ontology = """
            Map reported health issues to the following TAGS (Ignore mentions of organs if the text states they are healthy or normal.
            Pay attention to the general context and to false positives):
            - HEPATIC: Only for active pathologies (e.g., cirrhosis, hepatitis, hepatotoxicity, etc.).
            - METABOLIC: Only for overweight, obesity, diabetes, or an explicit fear of gaining weight. Do not use if the patient is thin.
            - RENAL: Only for renal insufficiency, elevated creatinine, history of dialysis, and similar conditions.
            - MOTOR: Only for a history of tremors, akathisia, rigidity, extrapyramidal effects, and similar conditions.
            - CARDIAC: Only for arrhythmias, prolonged QT interval, cardiac pathologies, and similar conditions.
            - PROLACTIN: Only for hyperprolactinemia, galactorrhea, or related hormonal dysfunctions.
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
                  SCN, CACNA"""
                  
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
        prompt = f"""<start_of_turn>user
        Extract clinical data from medical records into JSON. Targets: {self.targets}. Allowed Tags: {self.ontology}.

        {user_input}<end_of_turn>
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
