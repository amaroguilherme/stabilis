import pandas as pd
import os
import re

from constants import CURATED_DRUGS

def build_enriched_dataframe(artifacts_path="artifacts"):
    base_drugs_df = pd.read_pickle("artifacts/drugs_df_v2.pkl")
    names_path = os.path.join(artifacts_path, "drug_names.tsv")
    se_path = os.path.join(artifacts_path, "meddra_all_se.tsv.gz")
    
    names_df = pd.read_csv(names_path, sep='\t', header=None, names=['stitch_id', 'drug_name'])
    se_df = pd.read_csv(se_path, sep='\t', header=None, compression='gzip', 
                        names=['id1', 'id2', 'type', 'concept_id', 'concept_type', 'side_effect_name'])

    DRUG_CLASSES = {
        'agomelatine': 'ANTIDEPRESSANT', 'amitriptyline': 'ANTIDEPRESSANT', 'bupropion': 'ANTIDEPRESSANT',
        'citalopram': 'ANTIDEPRESSANT', 'clomipramine': 'ANTIDEPRESSANT', 'desvenlafaxine': 'ANTIDEPRESSANT',
        'duloxetine': 'ANTIDEPRESSANT', 'escitalopram': 'ANTIDEPRESSANT', 'fluoxetine': 'ANTIDEPRESSANT',
        'imipramine': 'ANTIDEPRESSANT', 'mirtazapine': 'ANTIDEPRESSANT', 'nortriptyline': 'ANTIDEPRESSANT',
        'paroxetine': 'ANTIDEPRESSANT', 'sertraline': 'ANTIDEPRESSANT', 'trazodone': 'ANTIDEPRESSANT',
        'venlafaxine': 'ANTIDEPRESSANT', 'vortioxetine': 'ANTIDEPRESSANT', 'mianserin': 'ANTIDEPRESSANT',
        'lithium-carbonate': 'MOOD_STABILIZER', 'valproic-acid': 'MOOD_STABILIZER', 'divalproex': 'MOOD_STABILIZER',
        'carbamazepine': 'MOOD_STABILIZER', 'lamotrigine': 'MOOD_STABILIZER', 'oxcarbazepine': 'MOOD_STABILIZER',
        'aripiprazole': 'ANTIPSYCHOTIC', 'quetiapine': 'ANTIPSYCHOTIC', 'olanzapine': 'ANTIPSYCHOTIC',
        'risperidone': 'ANTIPSYCHOTIC', 'clozapine': 'ANTIPSYCHOTIC', 'lurasidone': 'ANTIPSYCHOTIC',
        'ziprasidone': 'ANTIPSYCHOTIC', 'cariprazine': 'ANTIPSYCHOTIC', 'paliperidone': 'ANTIPSYCHOTIC'
    }

    def normalize_id(stitch_id):
        s_id = str(stitch_id)
        return "CID0" + s_id[4:] if s_id.startswith("CID1") else s_id

    names_df['stitch_id'] = names_df['stitch_id'].apply(normalize_id)
    se_df['id1'] = se_df['id1'].apply(normalize_id)
    full_se = se_df.merge(names_df, left_on='id1', right_on='stitch_id')

    ontology_map = {
        'METABOLIC': ['weight increased', 'hyperglycaemia', 'diabetes', 'dyslipidaemia'],
        'HEPATIC': ['hepatotoxicity', 'jaundice', 'hepatic failure', 'hepatitis', 'liver function test abnormal'],
        'RENAL': ['renal failure', 'nephrotoxicity', 'renal impairment'],
        'CARDIAC': ['arrhythmia', 'qt prolonged', 'tachycardia', 'palpitations'],
        'PROLACTIN': ['hyperprolactinaemia', 'gynaecomastia', 'galactorrhoea'],
        'MOTOR': ['extrapyramidal disorder', 'akathisia', 'tremor', 'tardive dyskinesia', 'dystonia'],
        'SEDATION': ['somnolence', 'sedation', 'drowsiness', 'lethargy', 'hypersomnia'],
    }

    def radical_clean(name):
        name = str(name).lower()
        name = re.sub(r'\(.*?\)|\[.*?\]', '', name)
        return re.sub(r'[^a-z0-9]', '', name).strip()

    print("Mapping SIDER risks...")
    risk_lookup = {}
    for tag, keywords in ontology_map.items():
        pattern = '|'.join(keywords)
        matches = full_se[full_se['side_effect_name'].str.lower().str.contains(pattern, na=False)]
        for drug in matches['drug_name'].unique():
            clean_d = radical_clean(drug)
            if clean_d:
                if clean_d not in risk_lookup: risk_lookup[clean_d] = set()
                risk_lookup[clean_d].add(tag)

    if 'lithium-carbonate' not in base_drugs_df['pert_iname'].values:
        lithium_row = pd.DataFrame([{
            'pert_iname': 'lithium-carbonate',
            'target': 'GSK3B',
            'risk_profile': ['RENAL', 'CARDIAC', 'MOTOR'],
            'is_relevant': True
        }])
        base_drugs_df = pd.concat([base_drugs_df, lithium_row], ignore_index=True)

    clin_target_map = {
        'HTR1A': '5HT1A', 'HTR2A': '5HT2A', 'HTR2C': '5HT2C',
        'HTR3A': '5HT3A', 'SLC6A4': 'SERT', 'SLC6A2': 'NET',
        'SLC6A3': 'DAT', 'DRD2': 'DRD2', 'DRD3': 'DRD3', 'HRH1': 'H1',
        'CHRM1': 'M1', 'ADRA2A': 'ADRA2',
    }

    def normalize_targets(target_str):
        if not isinstance(target_str, str): return target_str
        targets = target_str.split('|')
        return '|'.join([clin_target_map.get(t, t) for t in targets])

    print("Applying molecular enrichment and translation...")
    
    def match_risks(pert_name):
        if pert_name == 'lithium-carbonate':
            return ['RENAL', 'CARDIAC', 'MOTOR']
            
        p_clean = radical_clean(pert_name)
        if not p_clean: return []
        if p_clean in risk_lookup: return list(risk_lookup[p_clean])

        for s_name, tags in risk_lookup.items():
            if s_name.startswith(p_clean[:6]) or p_clean.startswith(s_name[:6]):
                return list(tags)
        return []

    base_drugs_df['risk_profile'] = base_drugs_df['pert_iname'].apply(match_risks)
    base_drugs_df['target'] = base_drugs_df['target'].apply(normalize_targets)
    
    base_drugs_df['drug_class'] = base_drugs_df['pert_iname'].map(DRUG_CLASSES).fillna('OTHER')
    base_drugs_df['is_relevant'] = base_drugs_df['pert_iname'].isin(CURATED_DRUGS)

    output_pkl = os.path.join(artifacts_path, "drugs_enriched.pkl")
    output_csv = os.path.join(artifacts_path, "drugs_enriched_debug.csv")
    
    base_drugs_df.to_pickle(output_pkl)
    base_drugs_df.to_csv(output_csv, sep=';', index=False)
    
    print(f"Pipeline Complete! {base_drugs_df['is_relevant'].sum()} drugs in the clinical core.")
    return base_drugs_df

def print_medication_list(pickle_path="artifacts/drugs_enriched.pkl"):
    try:
        df = pd.read_pickle(pickle_path)
        
        meds = sorted(df['pert_iname'].unique().tolist())
        
        print(f"\n--- LIST OF MEDICATIONS ({len(meds)} items) ---\n")
        print(meds)
        print(f"\n--- {len(meds)} items ---\n")
        print("\n--- END OF LIST ---")
        
    except Exception as e:
        print(f"Error loading file: {e}")

if __name__ == '__main__':
    build_enriched_dataframe()