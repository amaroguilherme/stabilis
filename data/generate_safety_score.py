import pandas as pd

drugs = pd.read_pickle("artifacts/drugs_enriched.pkl")['pert_iname'].str.lower().tolist()

safety_score = {
    # Structure: { "name": (Half-life h, Threshold mg/L, Vd L/kg, Bioavailability F) }

    # --- MOOD STABILIZERS AND ANTICONVULSANTS ---
    "lithium": (24.0, 44.3, 0.5, 1.0),
    "pregabalin": (6.3, 10.0, 0.5, 0.9),
    "carbamazepine": (15.0, 12.0, 1.4, 0.8),
    "eslicarbazepine-acetate": (13.0, 35.0, 0.8, 0.94),
    "ethosuximide": (50.0, 100.0, 0.7, 0.9),
    "gabapentin": (6.0, 20.0, 0.8, 0.6),
    "lamotrigine": (30.0, 15.0, 1.1, 0.98),
    "oxcarbazepine": (9.0, 35.0, 0.8, 0.95),
    "phenytoin": (24.0, 20.0, 0.6, 0.9),
    "topiramate": (21.0, 20.0, 0.8, 0.8),
    "valproic-acid": (15.0, 100.0, 0.2, 0.9),

    # --- ANTIDEPRESSANTS ---
    "agomelatine": (2.0, 0.06, 1.1, 0.05),
    "alaproclate": (3.5, 0.1, 15.0, 0.6),
    "amitriptyline": (25.0, 0.3, 14.0, 0.45),
    "amoxapine": (10.0, 0.2, 15.0, 0.5),
    "bupropion": (21.0, 0.4, 20.0, 0.14),
    "citalopram": (35.0, 0.4, 14.0, 0.8),
    "clomipramine": (32.0, 0.5, 17.0, 0.5),
    "desipramine": (20.0, 0.3, 35.0, 0.4),
    "desvenlafaxine": (11.0, 0.8, 3.4, 0.8),
    "duloxetine": (12.0, 0.1, 23.0, 0.5),
    "escitalopram": (30.0, 0.2, 12.0, 0.8),
    "fluoxetine": (96.0, 2.0, 35.0, 0.7),
    "fluvoxamine": (15.0, 0.3, 25.0, 0.53),
    "imipramine": (15.0, 0.3, 15.0, 0.4),
    "mirtazapine": (30.0, 0.1, 15.0, 0.5),
    "nortriptyline": (31.0, 0.5, 18.0, 0.5),
    "paroxetine": (21.0, 0.12, 17.0, 0.5),
    "sertraline": (26.0, 0.3, 20.0, 0.44),
    "tianeptine": (2.5, 0.1, 0.8, 0.99),
    "trazodone": (7.0, 1.2, 1.5, 0.7),
    "venlafaxine": (11.0, 0.8, 7.0, 0.45),
    "vilazodone": (25.0, 0.2, 1.5, 0.72),
    "vortioxetine": (66.0, 0.2, 33.0, 0.75),

    # --- ANTIPSYCHOTICS ---
    "amisulpride": (12.0, 0.6, 5.8, 0.48),
    "aripiprazole": (75.0, 1.0, 4.9, 0.87),
    "asenapine": (24.0, 0.01, 20.0, 0.02),
    "benperidol": (12.0, 0.05, 1.0, 0.5),
    "blonanserin": (12.0, 0.02, 25.0, 0.55),
    "brexpiprazole": (91.0, 0.1, 1.6, 0.75),
    "cariprazine": (48.0, 0.05, 12.0, 0.52),
    "chlorpromazine": (30.0, 0.5, 20.0, 0.25),
    "clozapine": (14.0, 1.0, 6.0, 0.3),
    "flupentixol": (35.0, 0.05, 20.0, 0.4),
    "fluphenazine": (20.0, 0.05, 15.0, 0.5),
    "fluspirilene": (168.0, 0.02, 20.0, 0.3),
    "haloperidol": (18.0, 0.05, 18.0, 0.6),
    "lurasidone": (18.0, 0.1, 88.0, 0.15),
    "olanzapine": (33.0, 0.1, 15.0, 0.6),
    "paliperidone": (23.0, 0.1, 28.0, 0.28),
    "quetiapine": (6.0, 1.5, 10.0, 0.1),
    "risperidone": (20.0, 0.1, 1.5, 0.7),
    "ziprasidone": (7.0, 0.2, 1.5, 0.6),

    # --- ANXIOLYTICS (Benzodiazepines) ---
    "diazepam": (48.0, 3.0, 1.1, 0.93),          
    "clonazepam": (35.0, 0.08, 3.0, 0.9),       
    "alprazolam": (11.0, 0.1, 0.7, 0.9),
    "lorazepam": (14.0, 0.2, 1.3, 0.9),
    "buspirone": (2.5, 0.01, 5.3, 0.04),
    "(r)-baclofen": (4.0, 0.6, 0.7, 0.75),
    
    # --- OTHERS (Cardiovascular, Metabolic, Oncology, etc.) ---
    "acarbose": (2.0, 0.01, 0.4, 0.02),
    "acebutolol": (4.0, 1.0, 1.2, 0.4),
    "acetazolamide": (12.0, 15.0, 0.2, 1.0),
    "acyclovir": (3.0, 1.0, 0.7, 0.2),
    "albendazole": (12.0, 1.0, 1.0, 0.05),
    "albuterol": (4.0, 0.02, 2.5, 0.5),
    "alectinib": (33.0, 0.6, 5.0, 0.37),
    "alfuzosin": (10.0, 0.05, 2.5, 0.49),
    "allopurinol": (2.0, 2.0, 1.6, 0.8),
    "amiodarone": (1300.0, 2.5, 60.0, 0.5),
    "amlodipine": (40.0, 0.05, 21.0, 0.7),
    "apixaban": (12.0, 0.2, 0.3, 0.5),
    "aspirin": (0.3, 300.0, 0.15, 0.7),
    "atenolol": (6.0, 1.0, 0.7, 0.5),
    "atorvastatin": (14.0, 0.1, 16.0, 0.12),
    "bortezomib": (12.0, 0.1, 15.0, 1.0),
    "celecoxib": (11.0, 1.0, 7.0, 0.4),
    "donepezil": (70.0, 0.05, 12.0, 1.0),
    "furosemide": (2.0, 10.0, 0.15, 0.6)
}

safety_score_drugs = list(safety_score.keys())

absent_drugs = [drug for drug in drugs if drug not in safety_score_drugs]
print(absent_drugs)
