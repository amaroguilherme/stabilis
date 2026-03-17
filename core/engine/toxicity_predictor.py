import math
import pandas as pd

class ToxicityPredictor:
    def __init__(self, drugs_df_path="drugs_df.pkl"):
        print("Initializing Pharmacokinetics Engine (Bioavailability Adjustment)...")
        
        try:
            self.drugs_df = pd.read_pickle(drugs_df_path)
            self.gnn_known_drugs = set(self.drugs_df['pert_iname'].str.lower().tolist())
        except:
            self.gnn_known_drugs = set()

        self.safety_score = {
            # Structure: { "name": (Half-life h, Threshold mg/L, Vd L/kg, Bioavailability F) }
            
            # --- MOOD STABILIZERS AND ANTICONVULSANTS ---
            "valproic acid": (15.0, 100.0, 0.2, 0.9),   # High absorption
            "lamotrigine": (30.0, 15.0, 1.1, 0.98),     # Nearly total absorption
            "lithium": (24.0, 44.3, 0.5, 1.0),          # Lithium Carbonate (100% bioavailability)
            "carbamazepine": (15.0, 12.0, 1.4, 0.8),    
            "oxcarbazepine": (9.0, 35.0, 0.8, 0.95),
            "topiramate": (21.0, 20.0, 0.8, 0.8),
            "gabapentin": (6.0, 20.0, 0.8, 0.6),        # Saturable absorption (decreases at high doses)
            "pregabalin": (6.3, 10.0, 0.5, 0.9),

            # --- ANTIDEPRESSANTS ---
            "fluoxetine": (96.0, 2.0, 35.0, 0.7),       
            "sertraline": (26.0, 0.3, 20.0, 0.44),      # Significant first-pass effect
            "escitalopram": (30.0, 0.2, 12.0, 0.8),     
            "venlafaxine": (11.0, 0.8, 7.0, 0.45),       
            "bupropion": (21.0, 0.4, 20.0, 0.14),       # Low systemic bioavailability
            "citalopram": (35.0, 0.4, 14.0, 0.8),
            "paroxetine": (21.0, 0.12, 17.0, 0.5),
            "duloxetine": (12.0, 0.1, 23.0, 0.5),
            "mirtazapine": (30.0, 0.1, 15.0, 0.5),
            "amitriptyline": (25.0, 0.3, 14.0, 0.45),
            
            # --- ANTIPSYCHOTICS ---
            "lurasidone": (18.0, 0.1, 88.0, 0.15),
            "quetiapine": (6.0, 1.5, 10.0, 0.1),        # Critical Adjustment: Only 10% Reaches the Bloodstream
            "aripiprazole": (75.0, 1.0, 4.9, 0.87),      
            "haloperidol": (18.0, 0.05, 18.0, 0.6),     
            "risperidone": (20.0, 0.1, 1.5, 0.7),
            "olanzapine": (33.0, 0.1, 15.0, 0.6),
            "clozapine": (14.0, 1.0, 6.0, 0.3),
            "ziprasidone": (7.0, 0.2, 1.5, 0.6),        # It depends heavily on intake with food
            
            # --- ANXIOLYTICS (Benzodiazepines) ---
            "diazepam": (48.0, 3.0, 1.1, 0.93),          
            "clonazepam": (35.0, 0.08, 3.0, 0.9),       
            "alprazolam": (11.0, 0.1, 0.7, 0.9),
            "lorazepam": (14.0, 0.2, 1.3, 0.9),
            "buspirone": (2.5, 0.01, 5.3, 0.04)         # Critical Adjustment: Only 4% Bioavailability
        }
        
        self.drug_interaction_rules = {}

    def fetch_drug_interactions(self, selected_drugs):
        print("Checking for Drug Interactions...")
        critical_drug_interactions = {
            ("lamotrigine", "valproic acid"): (2.0, "Valproate doubles the half-life of lamotrigine."),
            ("fluoxetine", "valproic acid"): (1.5, "Fluoxetine inhibits the metabolism of valproate.")
        }
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
                if drug.lower() in ["valproic acid", "escitalopram"]:
                    half_life_multipliers[drug.lower()] *= 1.5
        
        if user_snps.get("rs12248560") == "CC":
            print("-> Fast Metabolism Detected.")
            for drug in selected_drugs:
                if drug.lower() in ["quetiapine", "escitalopram", "sertraline"]:
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
