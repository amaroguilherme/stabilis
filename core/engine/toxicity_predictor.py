import math
import pandas as pd

from collections import Counter
from data.constants import SAFETY_SCORE, CRITICAL_DRUG_INTERACTIONS

class ToxicityPredictor:
    def __init__(self, drugs_df_path="artifacts/drugs_enriched.pkl"):        
        try:
            self.drugs_df = pd.read_pickle(drugs_df_path)
            self.gnn_known_drugs = set(self.drugs_df['pert_iname'].str.lower().tolist())
        except:
            self.gnn_known_drugs = set()

        self.safety_score = SAFETY_SCORE
        
        self.critical_drug_interactions = CRITICAL_DRUG_INTERACTIONS

    def audit_and_simulate(self, prescription, patient_profile, user_snps=None):
        """
        prescription: list of dicts [{'name': 'lithium-carbonate', 'dose': 300, 'interval': 12}, ...]
        """
        
        # CLINICAL REDUNDANCY & CLASS BALANCE
        self._check_clinical_redundancy(prescription)
        self._check_class_balance(prescription, patient_profile)

        # 2. Applying DDI and Genetics
        selected_names = [p['name'].lower() for p in prescription]
        half_life_multipliers = self._calculate_pk_multipliers(selected_names, user_snps)

        # Using 1-hour steps to handle different intervals accurately
        simulation_hours = 24 * 14 # 14 days to reach steady state for most drugs
        blood_levels = {name: 0.0 for name in selected_names}
        history = {name: [] for name in selected_names}

        print(f"\nSimulating for {patient_profile['peso_kg']}kg patient over 14 days...")

        for hour in range(simulation_hours):
            for drug in prescription:
                d_name = drug['name'].lower()
                if d_name not in self.safety_score: continue
                
                t12, threshold, vd_kg, f = self.safety_score[d_name]
                real_t12 = t12 * half_life_multipliers[d_name]
                k = math.log(2) / real_t12
                
                # Decay (1 hour step)
                blood_levels[d_name] *= math.exp(-k * 1)
                
                # Intake check (Is it time for a dose?)
                if hour % drug['interval'] == 0:
                    dose_absorbed = drug['dose'] * f
                    real_vd = vd_kg * patient_profile['peso_kg']
                    blood_levels[d_name] += (dose_absorbed / real_vd)

                # Toxicity check
                if blood_levels[d_name] > threshold:
                    print(f"CRITICAL TOXICITY: {d_name.upper()} reached {blood_levels[d_name]:.2f} mg/L on hour {hour}")
                    return {"status": "DANGEROUS", "culprit": d_name}

        print("All blood levels stabilized below toxic thresholds.")
        for d, level in blood_levels.items():
            print(f"-> {d.upper()}: {level:.2f} mg/L")
        
        return {"status": "SAFE", "blood_levels": blood_levels}

    def _check_clinical_redundancy(self, prescription):
        """Checks if multiple drugs hit the same primary target (Mechanism Overlap)"""
        targets_hit = []
        for p in prescription:
            drug_data = self.drugs_df[self.drugs_df['pert_iname'] == p['name']]
            if not drug_data.empty:
                targets_hit.extend(str(drug_data['target'].values[0]).split('|'))
        
        counts = Counter(targets_hit)
        # Dangerous overlaps: multiple drugs hitting SERT (Serotonin Syndrome) or D2 (Parkinsonism)
        for target in ['SERT', 'D2', 'NET']:
            if counts[target] > 1:
                print(f"WARNING: Redundancy detected on {target}. Risk of mechanism overdrive.")

    def _calculate_pk_multipliers(self, drug_names, user_snps=None):
        """Combines DDI and Genetics into a single list of multipliers"""
        multipliers = {name: 1.0 for name in drug_names}
        
        # Apply Drug-Drug Interactions
        for (d1, d2), (mult, desc) in self.critical_drug_interactions.items():
            if d1 in drug_names and d2 in drug_names:
                multipliers[d1] *= mult
                print(f"DDI: {desc}")
        
        #TODO: REVISIT IT LATER WHEN TESTING EXOM FLOW
        # Apply Genetics (Simplified for example)
        if user_snps and user_snps.get("rs4244285") == "AA": # CYP2C19 Slow
            for d in drug_names:
                if d in ["escitalopram", "sertraline", "diazepam"]:
                    multipliers[d] *= 1.5
                    print(f"Slow metabolism for {d} (rs4244285-AA)")
        
        return multipliers

    def _check_class_balance(self, prescription, profile):
        """Specific clinical rules (e.g., Bipolar protection)"""
        #TODO: THIS NEEDS TO CHANGE ONCE THE DATA MODEL IS IN PLACE
        is_bipolar = "BIPOLAR" in profile['diagnostico_base'].upper()
        classes = [self.drugs_df[self.drugs_df['pert_iname'] == p['name']]['drug_class'].values[0] 
                   for p in prescription if p['name'] in self.drugs_df['pert_iname'].values]
 
        if is_bipolar and "ANTIDEPRESSANT" in classes and "MOOD_STABILIZER" not in classes:
            print("RISK: Antidepressant use in Bipolar patient without Mood Stabilizer.")
