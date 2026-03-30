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
    #TODO: FIGURE IT OUT WHAT TO DO WITH THIS LOCAL MODEL
    def __init__(self, model_path="models/gemma-2-9b-it.Q4_K_M_v0.gguf"):
        print(f"Loading local LLM: {model_path}")
        
        self.llm = Llama(
            model_path=model_path,
            n_ctx=2048,      
            n_gpu_layers=-1, 
            verbose=True
        )
        
        # TODO: NEED TO MOVE TO ENGLISH
        self.ontology = """
            Mapeie os problemas de saúde relatados para as seguintes TAGS (Ignore menções a órgãos se o texto afirmar que estão saudáveis ou normais. 
            Atenção ao contexto geral e aos falsos positivos):
            - HEPATIC: Apenas para patologias ativas (ex: cirrose, hepatite, hepatotoxicidade, etc).
            - METABOLIC: Apenas para sobrepeso, obesidade, diabetes ou pavor explícito de engordar. Não use se o paciente for magro.
            - RENAL: Apenas para insuficiência renal, creatinina alta, histórico de diálise e semelhantes.
            - MOTOR: Apenas para histórico de tremores, acatisia, rigidez, efeitos extrapiramidais e semelhantes.
            - CARDIAC: Apenas para arritmias, QT longo, cardiopatias e semelhantes.
            - PROLACTIN: Apenas para hiperprolactinemia, galactorreia ou disfunções hormonais relacionadas.
            """
        
        self.targets = """5HT1A, 5HT1B, 5HT1D, 5HT1E, 5HT1F, 5HT2A, 5HT2B, 5HT2C, 5HT3A,
                  5HT3B, 5HT4, 5HT5A, 5HT6, 5HT7, AADACL2, DRD1, DRD2, DRD3, DRD4, SLC6A2, SLC6A4"""
                  
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
        # TODO: NEED TO MOVE TO ENGLISH
        user_input = f"- Checklist: {checklist}\n- Texto: '{doctor_summary}'"
        
        # TODO: NEED TO MOVE TO ENGLISH
        # TODO: THIS SHOULD ONLY REPLY IF THE INCOMING TEXT IS AN ANAMNESIS
        # TODO: THE DOCTOR SUMMARY MUST HAVE A CHARACTER LIMIT
        prompt = f"""<start_of_turn>user
        Extraia os dados clínicos do prontuário para JSON. Alvos permitidos: {self.targets}. Tags permitidas: {self.ontology}.

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
            # TODO: NEED TO MOVE TO ENGLISH
            return {
                "sintomas": [],
                "contraindicacoes_relativas": [],
                "perfil_metabolico_estimado": "padrão",
                "alvos_moleculares_prioritários": []
            }
