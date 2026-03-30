import ast
import os
import torch
import pandas as pd
import math

from qyra.interface.models.gnn import GATClassifier
from qyra.interface.modeling_logic.translators import PharmacologyTranslator

from core.engine.dna_parser import DNAParser
from core.engine.pharmacogenomics_analyzer import PharmacogenomicsAnalyzer
from core.engine.drug_interaction_analyzer import DrugInteractionAnalyzer
from core.engine.symptom_extractor import SymptomExtractor
from core.engine.toxicity_predictor import ToxicityPredictor

from data.constants import TARGETS_MAP

class StabilisEngine:
    def __init__(self):
        self.parser = DNAParser()
        self.pharmacogenomics = PharmacogenomicsAnalyzer()
        self.drug_interaction = DrugInteractionAnalyzer()
        
        self.symptom_extractor = SymptomExtractor()
        
        self.toxicity_predictor = ToxicityPredictor()
        self.safety_score = self.toxicity_predictor.safety_score
        
        print("Loading Pre-trained Artifacts...")
        
        if not os.path.exists("artifacts/drugs_enriched.pkl"):
            raise FileNotFoundError("drugs_enriched.pkl artifact not found!")
        self.drugs_df = pd.read_pickle("artifacts/drugs_enriched.pkl")
        
        # We only need the Translator to rebuild the Graph connections.
        self.translator = PharmacologyTranslator(disease_path="", drugs_path="", samples_path="")
        self.translator.drugs_df = self.drugs_df 
        self.translator._label_registry = {i: name for i, name in enumerate(self.drugs_df['pert_iname'])}
        
        self.x_tensor = torch.tensor(self.translator.get_gnn_features(), dtype=torch.float)
        self.edge_index = self.translator.build_similarity_graph(threshold=0.65)
        
        print("Waking Up the Neural Network...")
        self.gnn = GATClassifier(in_channels=2048, hidden_channels=64, out_channels=1, heads=4, dropout_rate=0.4)
        
        try:
            self.gnn.load_state_dict(torch.load("artifacts/gnn_v2_stabilis.pt", weights_only=True))
            self.gnn.eval() # Inference mode
            print("-> Weights loaded successfully!")
        except Exception as e:
            print(f"Error loading weights: {e}")
            
    def _ensure_list_type(self):
        """Ensures that the risks column is treated as a list, not as a string."""
        def parse_item(val):
            if isinstance(val, str):
                try:
                    return ast.literal_eval(val)
                except:
                    return []
            return val if isinstance(val, list) else []

        if 'risk_profile' in self.drugs_df.columns:
            self.drugs_df['risk_profile'] = self.drugs_df['risk_profile'].apply(parse_item)
            
    def _calculate_symptom_modifiers(self, profile):
        mods = {}
        risk_factors = [str(v).upper().strip() for v in profile.get("contraindicacoes_relativas", [])]
        
        if not risk_factors:
            return mods

        for idx, row in self.drugs_df.iterrows():
            score_change = 0.0
            
            drug_risks = row.get('risk_profile', [])
            if isinstance(drug_risks, str):
                drug_risks = ast.literal_eval(drug_risks) if drug_risks.startswith('[') else []
                
            drug_risks_upper = [str(dr).upper().strip() for dr in drug_risks]
            
            for rf in risk_factors:
                if rf in drug_risks_upper:
                    score_change -= 10.0
            
            if score_change != 0:
                mods[idx] = score_change
                
        return mods

    def _simulate_safety_score(self, drug_name, weight, profile):
        """Toxicity Simulator Using a Symptom-Based Virtual Genotype"""
        d_clean = drug_name.lower()
        if d_clean not in self.safety_score: return "N/A"
        
        t12, threshold, vd_kg, f = self.safety_score[d_clean]
        met = profile.get("metabolismo_estimado", "padrao")
        
        # Virtual metabolic multiplier
        mult = 1.0
        if met == "lento": mult = 1.5
        if met == "acelerado": mult = 0.6
        
        # Steady-State Calculation (Simulated for Standard dosage)
        dosage = 100.0 
        real_vd = vd_kg * weight
        k = math.log(2) / (t12 * mult)
        ssc = (dosage * f) / (real_vd * k * 24)
        
        if ssc > threshold:
            return f"HIGH RISK ({ssc:.2f} mg/L)"
        return f"SAFE ({ssc:.2f} mg/L)"
    
    def _calculate_target_affinity(self, profile):
        target_bonuses = {}
        # Correct key from your last log
        ai_raw_targets = profile.get('alvos_moleculares_prioritários', [])
        
        # Normalize AI targets
        normalized_ai_targets = [TARGETS_MAP.get(t.strip().upper(), t.strip().upper()) for t in ai_raw_targets]

        for idx, row in self.drugs_df.iterrows():
            if not row.get('is_relevant', False):
                continue
                
            targets = [t.strip().upper() for t in str(row.get('target', '')).split('|')]
            matches = set(normalized_ai_targets) & set(targets)
            
            if matches:
                target_bonuses[idx] = float(len(matches))
                # Check for high-value candidates
                if len(matches) >= 2:
                    print(f"EXCELLENT MATCH: {row['pert_iname']} hit {matches}")
                
        return target_bonuses

    def _print_results(self, top_15, profile, peso):
        print(f"\nTOP 15 - RANKING BY SYMPTOMS (Without Exome)")
        print(f"{'DRUG':<22} | {'SCORE':<8} | {'SAFETY (ESTIMATED)':<22} | STATUS")
        print("-" * 75)
        
        for item in top_15:
            name = item['name']
            final_s = item['final_score']
            # We calculate the modifier balance to determine the tag.
            total_mod = item['bonus'] + item['penalty']
            
            status_safety_score = self._simulate_safety_score(name, peso, profile)
            
            if total_mod < 0: 
                tag = "AVOID"
            elif total_mod > 0: 
                tag = "RECOMMENDED"
            else: 
                tag = "NEUTRAL"
            
            print(f"{name:<22} | {final_s:>7.1f} | {status_safety_score:<22} | {tag}")
        print("="*70 + "\n")

    def run_inference(self, dna_file_path):
        user_snps = self.parser.parse_file(dna_file_path)
        if not user_snps: return
            
        with torch.no_grad():
            logits = self.gnn(self.x_tensor, self.edge_index)
            base_probs = torch.sigmoid(logits).flatten()
            base_scores = base_probs * 100.0 
        
        genetic_adjustments = self.pharmacogenomics.calculate_personalization(user_snps)
        
        final_scores = []
        
        for idx in range(len(self.drugs_df)):
            drug_name = self.drugs_df.iloc[idx]['pert_iname']
            ai_score = base_scores[idx].item()
            
            # If the drug has a genetic rule, apply the modifier
            modifier = genetic_adjustments.get(drug_name, 0.0)
            
            if modifier < 0:
                modifier = modifier * 10 
            elif modifier > 0:
                modifier = modifier * 5  
                
            personalized_score = ai_score + modifier
            final_scores.append((drug_name, personalized_score, ai_score, modifier))

        final_scores.sort(key=lambda x: x[1], reverse=True)
        #TODO: HOW TO JUSTIFY THIS CHOICE BASED ON DATA?
        return final_scores
        
    def run_symptom_inference(self, checklist, doctor_summary):
        profile = self.symptom_extractor.get_profile(checklist=checklist, doctor_summary=doctor_summary)
        profile['contraindicacoes_relativas'] = [str(r).upper() for r in profile.get('contraindicacoes_relativas', [])]

        # Modifier Calculations
        target_bonuses = self._calculate_target_affinity(profile)
        symptom_penalties = self._calculate_symptom_modifiers(profile)
        
        with torch.no_grad():
            logits = self.gnn(self.x_tensor, self.edge_index)
            base_scores = torch.sigmoid(logits).flatten() * 100.0

        final_ranking = []
        
        BONUS_WEIGHT = 40.0    
        PENALTY_WEIGHT = 100.0  

        for idx, row in self.drugs_df.iterrows():
            if not row.get('is_relevant', True):
                continue
            ai_base_score = base_scores[idx].item()
            
            #TODO: MOOD STABILIZERS SHOULD GET A BIG BONUS IF BIPOLAR
            bonus_raw = target_bonuses.get(idx, 0.0)
            bonus_final = bonus_raw * BONUS_WEIGHT
            
            # Small "tie-breaker" bonus for clinical relevance
            tie_breaker = 0.5 if row.get('is_relevant', False) else 0.0
            
            #TODO: ANTIDEPRESSANTS SHOULD GET A BIG PENALTY IF BIPOLAR
            penalty_raw = symptom_penalties.get(idx, 0.0)
            penalty_final = abs(penalty_raw) * PENALTY_WEIGHT 
            
            final_score = ai_base_score + bonus_final + tie_breaker - penalty_final
            final_score = max(0.0, min(100.0, final_score))
            
            final_ranking.append({
                "name": row['pert_iname'],
                "final_score": final_score,
                "ai_score": ai_base_score,
                "bonus": bonus_final,
                "penalty": penalty_final,
                "risk_profile": row.get('risk_profile', [])
            })

        final_ranking.sort(key=lambda x: x["final_score"], reverse=True)
        #TODO: HOW TO JUSTIFY THIS CHOICE BASED ON DATA?
        return final_ranking
