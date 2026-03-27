import math
import pandas as pd

from data.constants import SAFETY_SCORE, CRITICAL_DRUG_INTERACTIONS

class ToxicityPredictor:
    def __init__(self, drugs_df_path="drugs_df.pkl"):
        print("Initializing Pharmacokinetics Engine (Bioavailability Adjustment)...")
        
        try:
            self.drugs_df = pd.read_pickle(drugs_df_path)
            self.gnn_known_drugs = set(self.drugs_df['pert_iname'].str.lower().tolist())
        except:
            self.gnn_known_drugs = set()

        self.safety_score = SAFETY_SCORE
        
        self.drug_interaction_rules = {}

    def fetch_drug_interactions(self, selected_drugs):
        print("Checking for Drug Interactions...")
        critical_drug_interactions = CRITICAL_DRUG_INTERACTIONS
        
        for i in range(len(selected_drugs)):
            for j in range(i + 1, len(selected_drugs)):
                d1, d2 = selected_drugs[i].lower(), selected_drugs[j].lower()
                pair = tuple(sorted([d1, d2]))
                if pair in critical_drug_interactions:
                    self.drug_interaction_rules[pair] = critical_drug_interactions[pair]

    def simulate_cocktail(self, selected_drugs, dosages_mg, interval_hours, patient_weight_kg, user_snps, days_to_simulate=30):
        print("\n" + "="*70)
        print("Initializing cocktail simulator...")
        print("="*70)
        
        self.fetch_drug_interactions(selected_drugs)
        
        half_life_multipliers = {drug.lower(): 1.0 for drug in selected_drugs}
        
        for pair, data in self.drug_interaction_rules.items():
            mult, desc = data
            if pair[0] in half_life_multipliers: half_life_multipliers[pair[0]] *= mult
            if pair[1] in half_life_multipliers: half_life_multipliers[pair[1]] *= mult
            print(f"DDI ALERT: {desc}")

        # Applies Genetic Multipliers
        print("\nAnalyzing DNA...")
        
        if user_snps.get("rs4244285") == "AA":
            print("-> Slow Metabolism Detected.")
            for drug in selected_drugs:
                if drug.lower() in [
                    "escitalopram", "citalopram", "sertraline", 
                    "amitriptyline", "clomipramine", "imipramine", 
                    "diazepam", "valproic-acid"
                ]:
                    half_life_multipliers[drug.lower()] *= 1.5
        
        if user_snps.get("rs12248560") == "CC":
            print("-> Fast Metabolism Detected.")
            for drug in selected_drugs:
                if drug.lower() in [
                    "escitalopram", "citalopram", "sertraline", 
                    "amitriptyline", "imipramine", "venlafaxine"
                ]:
                    half_life_multipliers[drug.lower()] *= 0.6

        print(f"\nWeight: {patient_weight_kg}kg | Duration: {days_to_simulate} days")
        
        blood_concentration = {drug.lower(): 0.0 for drug in selected_drugs}
        total_steps = int((24 / interval_hours) * days_to_simulate)
        
        for step in range(total_steps):
            for drug in selected_drugs:
                d_clean = drug.lower()
                if d_clean not in self.safety_score: continue
                
                t12, threshold, vd_kg, f = self.safety_score[d_clean]
                
                # Time Adjustment
                real_t12 = t12 * half_life_multipliers[d_clean]
                k = math.log(2) / real_t12
                
                # Elimination
                blood_concentration[d_clean] *= math.exp(-k * interval_hours)
                
                # Intake (Adjusted for Bioavailability and Weight)
                real_vd = vd_kg * patient_weight_kg
                dose_absorbed = dosages_mg[d_clean] * f
                blood_concentration[d_clean] += (dose_absorbed / real_vd)
                
                if blood_concentration[d_clean] > threshold:
                    print(f"TOXICITY: {d_clean.upper()} on day {step * interval_hours / 24:.1f} ({blood_concentration[d_clean]:.2f} mg/L)")
                    return

        print("\nSafe treatment for the provided parameters.")
        for d, conc in blood_concentration.items():
            print(f"   -> {d.upper()}: {conc:.2f} mg/L (Stabilized)")
