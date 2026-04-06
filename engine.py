import ast
import os
import torch
import pandas as pd
import math

from qyra.interface.models.gnn import GATClassifier
from qyra.interface.modeling_logic.translators import PharmacologyTranslator

from core.engines.dna_parser import DNAParser
from core.engines.pharmacogenomics_analyzer import PharmacogenomicsAnalyzer
from core.engines.drug_interaction_analyzer import DrugInteractionAnalyzer
from core.engines.symptom_extractor import SymptomExtractor
from core.engines.toxicity_predictor import ToxicityPredictor

from data.constants import (
    TARGETS_MAP, TYPICAL_DOSING, TARGET_CLINICAL_MEANING,
    MOTOR_RISK_SUPPLEMENT, MOTOR_RISK_EXEMPT,
    HEPATIC_RISK_EXEMPT, HEPATIC_RISK_SUPPLEMENT,
    PROLACTIN_RISK_EXEMPT, PROLACTIN_RISK_SUPPLEMENT,
    CARDIAC_RISK_EXEMPT, CARDIAC_RISK_SUPPLEMENT,
    RENAL_RISK_SUPPLEMENT, RENAL_RISK_EXEMPT,
    HARD_CAP_RULES,
    GAD_FIRST_LINE, GAD_TCA_SECOND_LINE,
    GAD_FIRST_LINE_BONUS, GAD_TCA_PENALTY, GAD_ANTIPSYCHOTIC_PENALTY,
    DRUG_CLASS_RUNTIME,
    GNN_INFERENCE_EXCLUDED,
)

# ── Keyword fallback sets ──────────────────────────────────────────────────────
# LLMs can misclassify structured comorbidity data. These keyword sets are applied
# deterministically to the checklist/summary AFTER LLM extraction to catch misses.
_HEPATIC_KW = {'hepático', 'hepática', 'hepatite', 'esteatose', 'cirrose', 'fígado',
               'tgo', 'tgp', 'alt', 'ast', 'hepatotóxico', 'transaminase'}
_RENAL_KW   = {'renal', 'rim', 'creatinina', 'diálise', 'néfro', 'nefropatia',
               'nefrotóxico', 'sobrecarga renal', 'sensibilidade renal'}
_MOTOR_KW   = {'tremor', 'distonia', 'acatisia', 'extrapiramidal', 'discinesia',
               'parkinsonismo', 'rigidez', 'travamento muscular'}
_CARDIAC_KW = {'arritmia', 'qt', 'palpitação', 'fibrilação', 'flutter', 'cardíaco',
               'cardiopatia', 'qrs'}
_SEDATION_KW  = {'sedação diurna', 'embotamento cognitivo', 'névoa mental', 'clareza mental',
                 'sonolência', 'clareza cognitiva', 'cálculos', 'concentração'}
_PROLACTIN_KW = {'prolactina', 'galactorreia', 'galactorréia', 'hiperprolactinemia',
                 'adenoma hipofisário', 'microadenoma', 'hipofisário', 'hipofisária',
                 'prolactin-sparing'}

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
        
        # Prefer the psychiatry-specific weights when available.
        weights_path = (
            "artifacts/gnn_v3_stabilis_psychiatric.pt"
            if os.path.exists("artifacts/gnn_v3_stabilis_psychiatric.pt")
            else "artifacts/gnn_v2_stabilis.pt"
        )
        try:
            self.gnn.load_state_dict(torch.load(weights_path, weights_only=True))
            self.gnn.eval()
            print(f"-> Weights loaded: {weights_path}")
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
        contraindication_matches = {}  # idx -> list of matched risk tags
        risk_factors = [str(v).upper().strip() for v in profile.get("relative_contraindications", [])]

        if not risk_factors:
            return mods, contraindication_matches

        for idx, row in self.drugs_df.iterrows():
            if not row.get('is_relevant', True):
                continue

            score_change = 0.0
            matched = []

            drug_risks = row.get('risk_profile', [])
            if isinstance(drug_risks, str):
                drug_risks = ast.literal_eval(drug_risks) if drug_risks.startswith('[') else []

            drug_risks_upper = [str(dr).upper().strip() for dr in drug_risks]

            drug_name_lower = str(row.get('pert_iname', '')).lower()

            # ── Supplement: add risk tags SIDER misses ───────────────────────
            if drug_name_lower in MOTOR_RISK_SUPPLEMENT and 'MOTOR' not in drug_risks_upper:
                drug_risks_upper.append('MOTOR')
            if drug_name_lower in HEPATIC_RISK_SUPPLEMENT and 'HEPATIC' not in drug_risks_upper:
                drug_risks_upper.append('HEPATIC')
            if drug_name_lower in PROLACTIN_RISK_SUPPLEMENT and 'PROLACTIN' not in drug_risks_upper:
                drug_risks_upper.append('PROLACTIN')
            if drug_name_lower in CARDIAC_RISK_SUPPLEMENT and 'CARDIAC' not in drug_risks_upper:
                drug_risks_upper.append('CARDIAC')
            if drug_name_lower in RENAL_RISK_SUPPLEMENT and 'RENAL' not in drug_risks_upper:
                drug_risks_upper.append('RENAL')

            # ── Exempt: strip risk tags SIDER over-tags ───────────────────────
            if drug_name_lower in HEPATIC_RISK_EXEMPT:
                drug_risks_upper = [r for r in drug_risks_upper if r != 'HEPATIC']
            if drug_name_lower in PROLACTIN_RISK_EXEMPT:
                drug_risks_upper = [r for r in drug_risks_upper if r != 'PROLACTIN']
            if drug_name_lower in CARDIAC_RISK_EXEMPT:
                drug_risks_upper = [r for r in drug_risks_upper if r != 'CARDIAC']
            if drug_name_lower in RENAL_RISK_EXEMPT:
                drug_risks_upper = [r for r in drug_risks_upper if r != 'RENAL']
            # MOTOR_RISK_EXEMPT: drugs that SIDER tags for rare/mild tremor but that
            # are NOT associated with the EPS/akathisia/dystonia the patient experienced.
            if drug_name_lower in MOTOR_RISK_EXEMPT:
                drug_risks_upper = [r for r in drug_risks_upper if r != 'MOTOR']

            for rf in risk_factors:
                if rf in drug_risks_upper:
                    score_change -= 1.0
                    matched.append(rf)

            if score_change != 0:
                mods[idx] = score_change
                contraindication_matches[idx] = matched

        return mods, contraindication_matches

    def _simulate_safety_score(self, drug_name, weight, profile):
        """Toxicity Simulator Using a Symptom-Based Virtual Genotype"""
        d_clean = drug_name.lower()
        if d_clean not in self.safety_score: return "N/A"
        
        t12, threshold, vd_kg, f = self.safety_score[d_clean]
        met = profile.get("estimated_metabolic_profile", "standard")
        
        # Virtual metabolic multiplier
        mult = 1.0
        if met == "slow": mult = 1.5
        if met not in ["slow", "standard"]: mult = 0.6
        
        # Steady-State Calculation using per-drug typical dose and dosing interval
        dosage, interval = TYPICAL_DOSING.get(d_clean, (100.0, 24))
        real_vd = vd_kg * weight
        k = math.log(2) / (t12 * mult)
        ssc = (dosage * f) / (real_vd * k * interval)
        
        if ssc > threshold:
            return f"HIGH RISK ({ssc:.2f} mg/L)"
        return f"SAFE ({ssc:.2f} mg/L)"
    
    def _calculate_target_affinity(self, profile):
        target_bonuses = {}
        target_matches = {}  # idx -> set of matched target strings
        ai_raw_targets = profile.get('priority_molecular_targets', [])

        # Normalize AI targets
        normalized_ai_targets = [TARGETS_MAP.get(t.strip().upper(), t.strip().upper()) for t in ai_raw_targets]

        for idx, row in self.drugs_df.iterrows():
            if not row.get('is_relevant', True):
                continue

            # Normalize artifact targets through the same TARGETS_MAP used for LLM output.
            # The enricher's clin_target_map stored DRD2 as "D2", but TARGETS_MAP normalises
            # "D2" → "DRD2". Without this step quetiapine, aripiprazole, lurasidone etc.
            # get no DRD2 bonus because "DRD2" (LLM) ≠ "D2" (artifact).
            raw_targets = [t.strip().upper() for t in str(row.get('target', '')).split('|')]
            targets = [TARGETS_MAP.get(t, t) for t in raw_targets]
            matches = set(normalized_ai_targets) & set(targets)

            if matches:
                target_bonuses[idx] = float(len(matches))
                target_matches[idx] = matches
                if len(matches) >= 2:
                    print(f"EXCELLENT MATCH: {row['pert_iname']} hit {matches}")

        return target_bonuses, target_matches

    def _print_results(self, top_15, profile, peso):
        print(f"\nTOP {len(top_15)} - RANKING BY SYMPTOMS (Without Exome)")
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
        print("LLM raw profile:", profile)

        # Normalise LLM output to uppercase strings
        contraindications = {str(r).upper() for r in profile.get('relative_contraindications', [])}

        # Keyword fallback: LLMs can misclassify structured comorbidity data.
        # Apply deterministic keyword scan over comorbidities + summary to catch misses.
        all_text = ' '.join([
            ' '.join(checklist.get('comorbidities', [])),
            ' '.join(checklist.get('habits', [])),
            doctor_summary,
        ]).lower()

        if any(kw in all_text for kw in _HEPATIC_KW):   contraindications.add('HEPATIC')
        if any(kw in all_text for kw in _RENAL_KW):     contraindications.add('RENAL')
        if any(kw in all_text for kw in _MOTOR_KW):     contraindications.add('MOTOR')
        if any(kw in all_text for kw in _CARDIAC_KW):   contraindications.add('CARDIAC')
        if any(kw in all_text for kw in _SEDATION_KW):  contraindications.add('SEDATION')
        if any(kw in all_text for kw in _PROLACTIN_KW): contraindications.add('PROLACTIN')

        # LLMs frequently confuse hepatic steatosis / fatty liver with a metabolic condition.
        # Remove METABOLIC if no genuine metabolic indicator is present in the record.
        _METABOLIC_VALIDATION_KW = {
            'obesidade', 'sobrepeso', 'diabetes', 'glicemia', 'dislipidemia',
            'síndrome metabólica', 'ganhou peso', 'engordou', 'imc elevado',
            'hiperglicemia', 'resistência à insulina',
        }
        if 'METABOLIC' in contraindications and not any(kw in all_text for kw in _METABOLIC_VALIDATION_KW):
            contraindications.discard('METABOLIC')

        profile['relative_contraindications'] = list(contraindications)
        print("Effective contraindications (after fallback):", profile['relative_contraindications'])

        # Diagnosis-based target supplement: ensure primary mechanism targets are always
        # present even when the LLM misses them. The LLM is used for nuance; these are
        # the non-negotiable mechanistic anchors per diagnosis category.
        ai_targets_upper = [t.strip().upper() for t in profile.get('priority_molecular_targets', [])]
        base_diagnosis_upper = checklist.get("base_diagnosis", "").upper()

        _MANIC_TARGETS  = ['DRD2', '5HT2A', 'GSK3B', 'SCN', 'GABRA']
        _DEPRESSIVE_TARGETS = ['SERT', 'NET', 'GSK3B']
        _ANXIETY_TARGETS    = ['5HT1A', 'SERT', 'GABRA']

        if any(k in base_diagnosis_upper for k in ('MANÍACO', 'MANIACO', 'MANIA', 'MISTO', 'MIXED')):
            for t in _MANIC_TARGETS:
                if t not in ai_targets_upper:
                    ai_targets_upper.append(t)
        elif any(k in base_diagnosis_upper for k in ('DEPRESSIV', 'DEPRESS')):
            for t in _DEPRESSIVE_TARGETS:
                if t not in ai_targets_upper:
                    ai_targets_upper.append(t)
        if any(k in base_diagnosis_upper for k in ('ANSIEDADE', 'ANXIETY', 'ANSIEDAD')):
            for t in _ANXIETY_TARGETS:
                if t not in ai_targets_upper:
                    ai_targets_upper.append(t)

        profile['priority_molecular_targets'] = ai_targets_upper
        print("Effective targets (after diagnosis supplement):", profile['priority_molecular_targets'])

        # Modifier Calculations
        target_bonuses, target_matches = self._calculate_target_affinity(profile)
        symptom_penalties, contraindication_matches = self._calculate_symptom_modifiers(profile)

        is_bipolar = "TRANSTORNO BIPOLAR" in checklist.get("base_diagnosis", "").upper()

        with torch.no_grad():
            logits = self.gnn(self.x_tensor, self.edge_index)
            base_scores = torch.sigmoid(logits).flatten() * 100.0

        final_ranking = []

        # Target bonus: 1 match = +20 pts (positive reinforcement, bounded by 0-100 cap).
        # Contraindication penalty: 1 match = -40 pts. Deliberately asymmetric — a patient
        # safety signal must outweigh a therapeutic signal. Without this asymmetry, the
        # bipolar mood-stabilizer bonus (+60) drowns out a hepatotoxicity or motor-risk flag.
        BONUS_WEIGHT = 20.0
        PENALTY_WEIGHT = 40.0
        BIPOLAR_MOOD_STABILIZER_BONUS = 60.0
        BIPOLAR_ANTIDEPRESSANT_PENALTY = 80.0

        _BASE_DIAG_UPPER = checklist.get("base_diagnosis", "").upper()
        is_gad           = "TRANSTORNO DE ANSIEDADE GENERALIZADA" in _BASE_DIAG_UPPER
        # Risk tags needed for hard-cap lookup (already fully resolved in profile)
        active_risk_tags = {str(v).upper().strip() for v in profile.get("relative_contraindications", [])}

        for idx, row in self.drugs_df.iterrows():
            if not row.get('is_relevant', True):
                continue
            drug_name_lower = str(row.get('pert_iname', '')).lower()
            if drug_name_lower in GNN_INFERENCE_EXCLUDED:
                continue
            ai_base_score = base_scores[idx].item()

            # Use runtime drug_class override when the artifact classification is incomplete.
            drug_class = DRUG_CLASS_RUNTIME.get(drug_name_lower, row.get('drug_class', 'OTHER'))

            bonus_raw            = target_bonuses.get(idx, 0.0)
            bipolar_bonus        = BIPOLAR_MOOD_STABILIZER_BONUS if (is_bipolar and drug_class == 'MOOD_STABILIZER') else 0.0
            gad_first_line_bonus = GAD_FIRST_LINE_BONUS if (is_gad and drug_name_lower in GAD_FIRST_LINE) else 0.0
            bonus_final          = bonus_raw * BONUS_WEIGHT + bipolar_bonus + gad_first_line_bonus

            # Small "tie-breaker" bonus for clinical relevance
            tie_breaker = 0.5 if row.get('is_relevant', False) else 0.0

            penalty_raw     = symptom_penalties.get(idx, 0.0)
            bipolar_penalty = BIPOLAR_ANTIDEPRESSANT_PENALTY if (is_bipolar and drug_class == 'ANTIDEPRESSANT') else 0.0
            gad_ap_penalty  = GAD_ANTIPSYCHOTIC_PENALTY if (is_gad and drug_class == 'ANTIPSYCHOTIC') else 0.0
            gad_tca_penalty = GAD_TCA_PENALTY if (is_gad and drug_name_lower in GAD_TCA_SECOND_LINE) else 0.0
            penalty_final   = abs(penalty_raw) * PENALTY_WEIGHT + bipolar_penalty + gad_ap_penalty + gad_tca_penalty

            final_score = ai_base_score + bonus_final + tie_breaker - penalty_final
            final_score = max(0.0, min(100.0, final_score))

            # Hard safety caps: drug+contraindication combos that are near-absolute
            # contraindications — no diagnostic bonus can overcome them.
            for (cap_drug, cap_tag), cap_max in HARD_CAP_RULES.items():
                if drug_name_lower == cap_drug and cap_tag in active_risk_tags:
                    final_score = min(final_score, cap_max)
                    break

            # --- Build patient-specific justification reasons ---
            reasons = []

            for t in sorted(target_matches.get(idx, [])):
                meaning = TARGET_CLINICAL_MEANING.get(t)
                if meaning:
                    effect, relevance = meaning
                    reasons.append({"type": "bonus", "text": f"{effect} — {relevance}"})

            if bipolar_bonus > 0:
                reasons.append({"type": "bonus", "text": "Estabilizador de humor: primeira linha para Transtorno Bipolar"})

            if bipolar_penalty > 0:
                reasons.append({"type": "penalty", "text": "Antidepressivo sem estabilizador de humor: risco de virada maníaca no Transtorno Bipolar"})

            for tag in contraindication_matches.get(idx, []):
                CONTRAINDICATION_LABELS = {
                    "METABOLIC": "Risco metabólico (ganho de peso/diabetes) — conflita com a preocupação do paciente",
                    "HEPATIC":   "Risco hepático — contraindicado em hepatopatia ativa",
                    "RENAL":     "Risco renal — exige monitoramento rigoroso ou é contraindicado em disfunção/vulnerabilidade renal",
                    "CARDIAC":   "Risco cardíaco (prolongamento de QT/arritmia) — monitorar em cardiopatia",
                    "MOTOR":     "Risco motor (acatisia/distonia/tremor) — histórico de efeitos extrapiramidais",
                    "PROLACTIN": "Risco de hiperprolactinemia — monitorar em disfunção hormonal",
                    "SEDATION":  "Sedação diurna significativa — incompatível com a necessidade de clareza cognitiva do paciente",
                }
                label = CONTRAINDICATION_LABELS.get(tag, f"Risco '{tag}' presente no perfil do medicamento")
                reasons.append({"type": "penalty", "text": label})

            final_ranking.append({
                "name": row['pert_iname'],
                "final_score": final_score,
                "ai_score": ai_base_score,
                "bonus": bonus_final,
                "penalty": penalty_final,
                "risk_profile": row.get('risk_profile', []),
                "drug_class": row.get('drug_class', 'OTHER'),
                "reasons": reasons,
            })

        final_ranking.sort(key=lambda x: x["final_score"], reverse=True)
        
        self._print_results(final_ranking[:15], profile, checklist["weight"])
        #TODO: HOW TO USE THE LLM TO JUSTIFY THIS CHOICE?
        return final_ranking
