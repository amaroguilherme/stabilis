CURATED_DRUGS = [
    'agomelatine', 'alaproclate', 'amisulpride', 'amitriptyline', 'amoxapine', 
    'aripiprazole', 'asenapine', 'atomoxetine', 'baclofen', 'benperidol', 
    'benztropine-mesylate', 'biperiden', 'blonanserin', 'brexpiprazole', 
    'bromocriptine', 'bromperidol', 'bupropion', 'buspirone', 'carbamazepine', 
    'cariprazine', 'chlorpromazine', 'chlorprothixene', 'citalopram', 
    'clomipramine', 'clonazepam', 'clonidine', 'clozapine', 'desipramine', 
    'desvenlafaxine', 'diazepam', 'donepezil', 'doxepin', 'droperidol', 
    'duloxetine', 'escitalopram', 'eslicarbazepine-acetate', 'ethosuximide', 
    'felbamate', 'fluoxetine', 'flupentixol', 'fluphenazine', 'fluspirilene', 
    'fluvoxamine', 'fosphenytoin', 'gabapentin', 'galantamine', 'haloperidol', 
    'hydroxyzine', 'iloperidone', 'imipramine', 'isocarboxazid', 'lamotrigine', 
    'levetiracetam', 'levodopa', 'levomepromazine', 'levosulpiride', 'lithium-carbonate', 
    'lorazepam', 'loxapine', 'lumateperone', 'lurasidone', 'maprotiline', 
    'memantine', 'mianserin', 'milnacipran', 'mirtazapine', 'moclobemide', 
    'molindone', 'nefazodone', 'nortriptyline', 'olanzapine', 'oxcarbazepine', 
    'paliperidone', 'paroxetine', 'perospirone', 'perphenazine', 'phenelzine', 
    'phenytoin', 'pimavanserin', 'pimozide', 'pramipexole', 'primidone', 
    'prochlorperazine', 'promazine', 'promethazine', 'quetiapine', 'rasagiline', 
    'reboxetine', 'risperidone', 'rivastigmine', 'ropinirole', 'rotigotine', 
    'selegiline', 'sertraline', 'sulpiride', 'tetrabenazine', 'thioridazine', 
    'thiothixene', 'tiagabine', 'tianeptine', 'tiapride', 'topiramate', 
    'tranylcypromine', 'trazodone', 'trifluoperazine', 'trihexyphenidyl', 
    'trimipramine', 'valproic-acid', 'venlafaxine', 'vigabatrin', 'vilazodone', 
    'vortioxetine', 'ziprasidone', 'zolpidem', 'zonisamide', 'zuclopenthixol'
]

TARGETS_MAP = {
    # --- MONOAMINE TRANSPORTERS ---
    'SLC6A4': 'SERT', 'SEROTONIN TRANSPORTER': 'SERT', 'SEROTONIN': 'SERT',
    'SLC6A2': 'NET',  'NOREPINEPHRINE TRANSPORTER': 'NET', 'NOREPINEPHRINE': 'NET',
    'SLC6A3': 'DAT',  'DOPAMINE TRANSPORTER': 'DAT', 'DOPAMINE': 'DAT',

    # --- SEROTONIN RECEPTORS ---
    'HTR1A': '5HT1A', '5-HT1A': '5HT1A', '5HT-1A': '5HT1A',
    'HTR1B': '5HT1B', '5-HT1B': '5HT1B',
    'HTR1D': '5HT1D', '5-HT1D': '5HT1D',
    'HTR1E': '5HT1E', '5-HT1E': '5HT1E',
    'HTR1F': '5HT1F', '5-HT1F': '5HT1F',
    'HTR2A': '5HT2A', '5-HT2A': '5HT2A', '5HT-2A': '5HT2A',
    'HTR2B': '5HT2B', '5-HT2B': '5HT2B',
    'HTR2C': '5HT2C', '5-HT2C': '5HT2C', '5HT-2C': '5HT2C',
    'HTR3A': '5HT3A', '5-HT3A': '5HT3A', 'HTR3': '5HT3A', '5HT3': '5HT3A', '5-HT3': '5HT3A',
    'HTR3B': '5HT3B', '5-HT3B': '5HT3B',
    'HTR4':  '5HT4',  '5-HT4': '5HT4',
    'HTR5A': '5HT5A', '5-HT5A': '5HT5A',
    'HTR6':  '5HT6',  '5-HT6': '5HT6',
    'HTR7':  '5HT7',  '5-HT7': '5HT7',

    # --- DOPAMINE RECEPTORS ---
    'DRD1': 'DRD1', 'D1': 'DRD1', 'DOPAMINE D1': 'DRD1', 'D1 RECEPTOR': 'DRD1',
    'DRD2': 'DRD2', 'D2': 'DRD2', 'DOPAMINE D2': 'DRD2', 'D2 RECEPTOR': 'DRD2',
    'DRD3': 'DRD3', 'D3': 'DRD3', 'DOPAMINE D3': 'DRD3', 'D3 RECEPTOR': 'DRD3',
    'DRD4': 'DRD4', 'D4': 'DRD4', 'DOPAMINE D4': 'DRD4', 'D4 RECEPTOR': 'DRD4',

    # --- HISTAMINE RECEPTORS ---
    'HRH1': 'H1', 'H1R': 'H1', 'HISTAMINE H1': 'H1', 'HISTAMINE H1 RECEPTOR': 'H1',
    'HRH2': 'H2', 'H2R': 'H2', 'HISTAMINE H2': 'H2',
    'HRH3': 'H3', 'H3R': 'H3', 'HISTAMINE H3': 'H3',
    'HRH4': 'H4', 'H4R': 'H4', 'HISTAMINE H4': 'H4',

    # --- MUSCARINIC ACETYLCHOLINE RECEPTORS ---
    'CHRM1': 'M1', 'M1R': 'M1', 'MUSCARINIC M1': 'M1', 'MUSCARINIC 1': 'M1',
    'CHRM2': 'M2', 'M2R': 'M2', 'MUSCARINIC M2': 'M2', 'MUSCARINIC 2': 'M2',
    'CHRM3': 'M3', 'M3R': 'M3', 'MUSCARINIC M3': 'M3', 'MUSCARINIC 3': 'M3',
    'CHRM4': 'M4', 'M4R': 'M4', 'MUSCARINIC M4': 'M4',
    'CHRM5': 'M5', 'M5R': 'M5', 'MUSCARINIC M5': 'M5',
    'ACETYLCHOLINE RECEPTOR': 'M1',  # generic muscarinic alias

    # --- GABA RECEPTORS ---
    'GABRA1': 'GABRA', 'GABRA2': 'GABRA', 'GABRA3': 'GABRA', 'GABRA5': 'GABRA',
    'GABRB1': 'GABRA', 'GABRB2': 'GABRA', 'GABRB3': 'GABRA',
    'GABRG2': 'GABRA', 'GABRD': 'GABRA',
    'GABA-A': 'GABRA', 'GABAA': 'GABRA', 'GABA_A': 'GABRA',
    'GABA-A RECEPTOR': 'GABRA', 'GABRA': 'GABRA',
    'GABA': 'GABRA',  # generic alias

    # --- GLUTAMATE / NMDA RECEPTORS ---
    'GRIN1': 'NMDA', 'GRIN2A': 'NMDA', 'GRIN2B': 'NMDA', 'GRIN2C': 'NMDA',
    'NMDAR': 'NMDA', 'NMDA RECEPTOR': 'NMDA', 'N-METHYL-D-ASPARTATE': 'NMDA',
    'GRM1': 'MGLUR1', 'MGLUR1': 'MGLUR1',
    'GRM5': 'MGLUR5', 'MGLUR5': 'MGLUR5',

    # --- ADRENERGIC RECEPTORS ---
    'ADRA1A': 'ADRA1', 'ADRA1B': 'ADRA1', 'ADRA1D': 'ADRA1',
    'ALPHA1': 'ADRA1', 'ALPHA-1': 'ADRA1', 'ALPHA-1 ADRENERGIC': 'ADRA1',
    'ADRA2A': 'ADRA2', 'ADRA2B': 'ADRA2', 'ADRA2C': 'ADRA2',
    'ALPHA2': 'ADRA2', 'ALPHA-2': 'ADRA2', 'ALPHA-2 ADRENERGIC': 'ADRA2',
    'ADRB1': 'ADRB1', 'BETA1': 'ADRB1', 'BETA-1': 'ADRB1',
    'ADRB2': 'ADRB2', 'BETA2': 'ADRB2', 'BETA-2': 'ADRB2',

    # --- MAO ENZYMES ---
    'MAOA': 'MAOA', 'MAO-A': 'MAOA', 'MAO A': 'MAOA', 'MONOAMINE OXIDASE A': 'MAOA',
    'MAOB': 'MAOB', 'MAO-B': 'MAOB', 'MAO B': 'MAOB', 'MONOAMINE OXIDASE B': 'MAOB',

    # --- SIGMA RECEPTORS ---
    'SIGMAR1': 'SIGMAR1', 'SIGMA-1': 'SIGMAR1', 'SIGMA1': 'SIGMAR1', 'SIGMA-1 RECEPTOR': 'SIGMAR1',
    'SIGMAR2': 'SIGMAR2', 'SIGMA-2': 'SIGMAR2', 'SIGMA2': 'SIGMAR2',

    # --- ACETYLCHOLINESTERASE ---
    'ACHE': 'ACHE', 'ACETYLCHOLINESTERASE': 'ACHE',
    'BCHE': 'BCHE', 'BUTYRYLCHOLINESTERASE': 'BCHE',

    # --- OPIOID RECEPTORS ---
    'OPRM1': 'OPRM1', 'MOR': 'OPRM1', 'MU OPIOID': 'OPRM1', 'MU-OPIOID RECEPTOR': 'OPRM1',
    'OPRD1': 'OPRD1', 'DOR': 'OPRD1', 'DELTA OPIOID': 'OPRD1',
    'OPRK1': 'OPRK1', 'KOR': 'OPRK1', 'KAPPA OPIOID': 'OPRK1',

    # --- VOLTAGE-GATED ION CHANNELS (mood stabilizers) ---
    'SCN1A': 'SCN', 'SCN2A': 'SCN', 'NAV': 'SCN', 'SODIUM CHANNEL': 'SCN',
    'CACNA1C': 'CACNA', 'CACNA1A': 'CACNA', 'CALCIUM CHANNEL': 'CACNA',
    'KCNQ2': 'KCNQ', 'KCNQ3': 'KCNQ', 'POTASSIUM CHANNEL': 'KCNQ',

    # --- MELATONIN RECEPTORS ---
    'MTNR1A': 'MT1', 'MT1': 'MT1', 'MELATONIN MT1': 'MT1',
    'MTNR1B': 'MT2', 'MT2': 'MT2', 'MELATONIN MT2': 'MT2',

    # --- LITHIUM MECHANISM (GSK3B / inositol pathway) ---
    'GSK3B': 'GSK3B', 'GSK-3B': 'GSK3B', 'GSK3': 'GSK3B',
    'GLYCOGEN SYNTHASE KINASE 3': 'GSK3B', 'GLYCOGEN SYNTHASE KINASE': 'GSK3B',
    'INOSITOL': 'GSK3B', 'INOSITOL MONOPHOSPHATASE': 'GSK3B', 'IMPA': 'GSK3B',
}

SAFETY_SCORE = {
    # Structure: { "name": (Half-life h, Threshold mg/L, Vd L/kg, Bioavailability F) }
    
    # --- MOOD STABILIZERS AND ANTICONVULSANTS ---
    "lithium-carbonate": (24.0, 44.3, 0.5, 1.0),
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
    "mianserin": (30.0, 0.07, 15.0, 0.2),

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
    "loxapine": (4.0, 0.1, 15.0, 0.3),

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
    "furosemide": (2.0, 10.0, 0.15, 0.6),
    "ropinirole": (6.0, 0.01, 7.5, 0.5)
}

# Structure: { "name": (dose_mg, interval_hours) }
# Source: FDA-approved prescribing information (package inserts), maintenance doses.
# dose_mg  — typical single-administration maintenance dose in mg
# interval — dosing interval in hours (e.g. 8 = TID, 12 = BID, 24 = QD)
# Fallback for unlisted drugs: (100.0, 24)
TYPICAL_DOSING = {
    # --- MOOD STABILIZERS AND ANTICONVULSANTS ---
    "lithium-carbonate":         (300.0,  8),   # 900 mg/day divided TID
    "pregabalin":                (150.0, 12),   # 300 mg/day divided BID
    "carbamazepine":             (200.0, 12),   # 400–800 mg/day divided BID
    "eslicarbazepine-acetate":   (800.0, 24),   # 800–1600 mg once daily
    "ethosuximide":              (250.0, 12),   # 500 mg/day divided BID
    "gabapentin":                (300.0,  8),   # 900 mg/day divided TID
    "lamotrigine":               (100.0, 12),   # 100–200 mg/day divided BID
    "oxcarbazepine":             (300.0, 12),   # 600 mg/day divided BID
    "phenytoin":                 (100.0,  8),   # 300 mg/day divided TID
    "topiramate":                 (25.0, 12),   # 50 mg/day divided BID (titration)
    "valproic-acid":             (500.0,  8),   # 1500 mg/day divided TID

    # --- ANTIDEPRESSANTS ---
    "agomelatine":                (25.0, 24),   # 25 mg once daily at bedtime
    "alaproclate":                (50.0, 12),   # 100 mg/day divided BID
    "amitriptyline":              (25.0, 24),   # 75–150 mg once daily (or divided)
    "amoxapine":                  (50.0,  8),   # 150 mg/day divided TID
    "bupropion":                 (150.0, 12),   # 300 mg/day (SR: 150 mg BID)
    "citalopram":                 (20.0, 24),   # 20–40 mg once daily
    "clomipramine":               (25.0,  8),   # 75 mg/day divided TID
    "desipramine":                (50.0, 24),   # 100–200 mg once daily
    "desvenlafaxine":             (50.0, 24),   # 50 mg once daily
    "duloxetine":                 (30.0, 12),   # 60 mg/day divided BID
    "escitalopram":               (10.0, 24),   # 10–20 mg once daily
    "fluoxetine":                 (20.0, 24),   # 20 mg once daily
    "fluvoxamine":                (50.0, 12),   # 100 mg/day divided BID
    "imipramine":                 (25.0,  8),   # 75 mg/day divided TID
    "mirtazapine":                (15.0, 24),   # 15–45 mg once daily at bedtime
    "nortriptyline":              (25.0,  8),   # 75 mg/day divided TID
    "paroxetine":                 (20.0, 24),   # 20 mg once daily
    "sertraline":                 (50.0, 24),   # 50 mg once daily
    "tianeptine":                 (12.5,  8),   # 37.5 mg/day divided TID
    "trazodone":                  (50.0,  8),   # 150 mg/day divided TID (IR)
    "venlafaxine":                (37.5, 12),   # 75 mg/day divided BID (IR)
    "vilazodone":                 (10.0, 24),   # 10–40 mg once daily
    "vortioxetine":               (10.0, 24),   # 10–20 mg once daily
    "mianserin":                  (10.0, 24),   # 30–90 mg once daily at bedtime

    # --- ANTIPSYCHOTICS ---
    "amisulpride":               (200.0, 12),   # 400 mg/day divided BID
    "aripiprazole":               (10.0, 24),   # 10–30 mg once daily
    "asenapine":                   (5.0, 12),   # 10 mg/day divided BID (sublingual)
    "benperidol":                  (0.25,12),   # 0.25–1.5 mg/day divided BID
    "blonanserin":                 (4.0, 12),   # 8 mg/day divided BID
    "brexpiprazole":               (1.0, 24),   # 1–4 mg once daily
    "cariprazine":                 (1.5, 24),   # 1.5–6 mg once daily
    "chlorpromazine":             (25.0,  8),   # 75–150 mg/day divided TID
    "clozapine":                  (25.0, 12),   # 25 mg BID (titration start; maintenance higher)
    "flupentixol":                 (1.0, 12),   # 2–3 mg/day divided BID
    "fluphenazine":                (1.0,  8),   # 2.5–10 mg/day divided TID
    "fluspirilene":                (2.0,168),   # 2 mg IM once weekly (depot)
    "haloperidol":                 (2.0,  8),   # 5–10 mg/day divided TID
    "lurasidone":                 (40.0, 24),   # 40–160 mg once daily with food
    "olanzapine":                  (5.0, 24),   # 5–20 mg once daily
    "paliperidone":                (3.0, 24),   # 3–12 mg once daily
    "quetiapine":                 (50.0, 12),   # 100–800 mg/day divided BID (IR)
    "risperidone":                 (1.0, 12),   # 2–8 mg/day divided BID
    "ziprasidone":                (40.0, 12),   # 80 mg/day divided BID with food
    "loxapine":                   (10.0, 12),   # 20–100 mg/day divided BID

    # --- ANXIOLYTICS ---
    "diazepam":                    (5.0,  8),   # 15–30 mg/day divided TID
    "clonazepam":                  (0.5, 12),   # 1–4 mg/day divided BID
    "alprazolam":                  (0.25, 8),   # 0.75–4 mg/day divided TID
    "lorazepam":                   (1.0, 12),   # 2–6 mg/day divided BID
    "buspirone":                   (5.0,  8),   # 15 mg/day divided TID
    "(r)-baclofen":               (10.0,  8),   # 30 mg/day divided TID

    # --- OTHERS ---
    "acarbose":                   (50.0,  8),   # 150 mg/day divided TID with meals
    "acebutolol":                (200.0, 12),   # 400 mg/day divided BID
    "acetazolamide":             (250.0, 12),   # 500 mg/day divided BID
    "acyclovir":                 (200.0,  4),   # 1000 mg/day divided 5× daily (HSV)
    "albendazole":               (400.0, 12),   # 800 mg/day divided BID with food
    "albuterol":                   (2.0,  8),   # 6–8 mg/day divided TID (oral tablet)
    "alectinib":                 (150.0, 12),   # 300 mg/day divided BID with food
    "alfuzosin":                   (2.5,  8),   # 7.5 mg/day divided TID (IR)
    "allopurinol":               (100.0, 24),   # 100–300 mg once daily
    "amiodarone":                (200.0, 24),   # 200 mg once daily (maintenance)
    "amlodipine":                  (5.0, 24),   # 5–10 mg once daily
    "apixaban":                    (2.5, 12),   # 5 mg/day divided BID
    "aspirin":                   (325.0, 24),   # 325 mg once daily (standard)
    "atenolol":                   (25.0, 24),   # 25–100 mg once daily
    "atorvastatin":               (10.0, 24),   # 10–80 mg once daily
    "bortezomib":                  (1.3,168),   # 1.3 mg/m² SC/IV twice weekly (cycle-based)
    "celecoxib":                 (100.0, 12),   # 200 mg/day divided BID
    "donepezil":                   (5.0, 24),   # 5–10 mg once daily at bedtime
    "furosemide":                 (20.0, 24),   # 20–40 mg once daily
    "ropinirole":                  (0.25, 8),   # 0.75 mg/day divided TID (titration start)
}

CRITICAL_DRUG_INTERACTIONS = {
    # --- MOOD STABILIZER + ANTICONVULSANT INTERACTIONS ---
    ("lamotrigine", "valproic-acid"): (2.0, "Valproate inhibits glucuronidation, doubling lamotrigine half-life and increasing Stevens-Johnson Syndrome risk."),
    ("valproic-acid", "carbamazepine"): (1.4, "Valproate inhibits epoxide hydrolase, increasing levels of the toxic metabolite carbamazepine-10,11-epoxide."),
    ("carbamazepine", "valproic-acid"): (0.5, "Carbamazepine induces UGT enzymes, significantly reducing valproate plasma concentrations."),

    # --- ANTIDEPRESSANT + TRICYCLIC INTERACTIONS (CYP2D6 Inhibition) ---
    ("fluoxetine", "amitriptyline"): (2.5, "Fluoxetine is a potent CYP2D6 inhibitor, markedly increasing tricyclic levels and cardiotoxicity risk."),
    ("paroxetine", "nortriptyline"): (2.5, "Paroxetine potently inhibits CYP2D6, increasing nortriptyline levels to potentially toxic ranges."),
    ("fluoxetine", "imipramine"): (2.0, "Potent inhibition of CYP2D6 by fluoxetine increases imipramine concentration."),

    # --- ANTIPSYCHOTIC + INDUCER/INHIBITOR INTERACTIONS ---
    ("carbamazepine", "quetiapine"): (0.15, "Carbamazepine is a potent CYP3A4 inducer, reducing quetiapine levels by up to 80-90%."),
    ("carbamazepine", "clozapine"): (0.5, "Carbamazepine induces CYP3A4 and increases risk of bone marrow suppression (agranulocytosis)."),
    ("fluvoxamine", "clozapine"): (3.0, "Fluvoxamine strongly inhibits CYP1A2, drastically increasing clozapine levels and seizure risk."),
    ("fluoxetine", "aripiprazole"): (1.7, "CYP2D6 inhibition by fluoxetine increases aripiprazole concentration; dose reduction often required."),

    # --- LITHIUM + RENAL CLEARANCE INTERACTIONS ---
    ("lithium-carbonate", "furosemide"): (1.3, "Diuretics alter sodium balance, reducing renal lithium clearance and increasing toxicity risk."),
    ("lithium-carbonate", "aspirin"): (1.2, "NSAIDs like aspirin can reduce renal blood flow, leading to increased lithium plasma levels."),
    ("lithium-carbonate", "celecoxib"): (1.4, "COX-2 inhibitors significantly reduce lithium clearance; high risk of lithium toxicity."),

    # --- BENZODIAZEPINE + ANTIPSYCHOTIC RISKS ---
    ("clozapine", "diazepam"): (1.0, "Synergistic risk of severe respiratory depression, hypotension, and circulatory collapse."),
    ("clozapine", "lorazepam"): (1.0, "Increased risk of respiratory arrest and profound sedation when combined."),

    # --- QT PROLONGATION (Cumulative Cardiac Risk) ---
    ("amiodarone", "quetiapine"): (1.5, "Pharmacodynamic synergy increasing the risk of QTc prolongation and Torsades de Pointes."),
    ("amiodarone", "amitriptyline"): (1.5, "Combined effect on cardiac potassium channels increases risk of fatal arrhythmias."),
    ("ziprasidone", "amiodarone"): (2.0, "Critical cumulative risk of QTc prolongation; combination is generally contraindicated."),

    # --- METABOLIC / OTHER ---
    ("valproic-acid", "topiramate"): (1.0, "Increased risk of hyperammonemia and encephalopathy despite normal liver enzymes."),
    ("carbamazepine", "alprazolam"): (0.5, "Induction of CYP3A4 by carbamazepine reduces alprazolam levels by approximately 50%."),
    ("fluvoxamine", "loxapine"): (2.0, "Fluvoxamine inhibits CYP1A2, significantly increasing loxapine plasma levels."),
    ("carbamazepine", "loxapine"): (0.5, "Carbamazepine induces CYP3A4, reducing loxapine efficacy."),
    ("fluvoxamine", "ropinirole"): (2.5, "Strong CYP1A2 inhibition by fluvoxamine can lead to ropinirole toxicity."),
    ("haloperidol", "ropinirole"): (0.0, "Pharmacodynamic antagonism: Haloperidol blocks the D2 receptors that ropinirole tries to stimulate."),
}

# Maps internal English drug name (pert_iname) to its Brazilian Portuguese commercial/generic name.
# Fallback: formatDrugName() on the raw key.
DRUG_NAME_PT = {
    # --- MOOD STABILIZERS AND ANTICONVULSANTS ---
    "lithium-carbonate":        "Carbonato de Lítio",
    "valproic-acid":            "Ácido Valproico",
    "carbamazepine":            "Carbamazepina",
    "lamotrigine":              "Lamotrigina",
    "oxcarbazepine":            "Oxcarbazepina",
    "eslicarbazepine-acetate":  "Acetato de Eslicarbazepina",
    "topiramate":               "Topiramato",
    "gabapentin":               "Gabapentina",
    "pregabalin":               "Pregabalina",
    "phenytoin":                "Fenitoína",
    "fosphenytoin":             "Fosfenitoína",
    "ethosuximide":             "Etosuximida",
    "primidone":                "Primidona",
    "levetiracetam":            "Levetiracetam",
    "zonisamide":               "Zonisamida",
    "tiagabine":                "Tiagabina",
    "vigabatrin":               "Vigabatrina",
    "felbamate":                "Felbamato",

    # --- ANTIDEPRESSANTS (SSRIs) ---
    "fluoxetine":               "Fluoxetina",
    "sertraline":               "Sertralina",
    "escitalopram":             "Escitalopram",
    "citalopram":               "Citalopram",
    "paroxetine":               "Paroxetina",
    "fluvoxamine":              "Fluvoxamina",

    # --- ANTIDEPRESSANTS (SNRIs) ---
    "venlafaxine":              "Venlafaxina",
    "desvenlafaxine":           "Desvenlafaxina",
    "duloxetine":               "Duloxetina",
    "milnacipran":              "Milnaciprana",
    "reboxetine":               "Reboxetina",

    # --- ANTIDEPRESSANTS (Tricyclics) ---
    "amitriptyline":            "Amitriptilina",
    "clomipramine":             "Clomipramina",
    "imipramine":               "Imipramina",
    "nortriptyline":            "Nortriptilina",
    "desipramine":              "Desipramina",
    "doxepin":                  "Doxepina",
    "trimipramine":             "Trimipramina",
    "maprotiline":              "Maprotilina",
    "amoxapine":                "Amoxapina",

    # --- ANTIDEPRESSANTS (MAOIs) ---
    "phenelzine":               "Fenelzina",
    "tranylcypromine":          "Tranilcipromina",
    "isocarboxazid":            "Isocarboxazida",
    "moclobemide":              "Moclobemida",
    "selegiline":               "Selegilina",
    "rasagiline":               "Rasagilina",

    # --- ANTIDEPRESSANTS (Atypical) ---
    "bupropion":                "Bupropiona",
    "mirtazapine":              "Mirtazapina",
    "trazodone":                "Trazodona",
    "nefazodone":               "Nefazodona",
    "agomelatine":              "Agomelatina",
    "tianeptine":               "Tianeptina",
    "vilazodone":               "Vilazodona",
    "vortioxetine":             "Vortioxetina",
    "mianserin":                "Mianserina",
    "alaproclate":              "Alaproclato",

    # --- ANTIPSYCHOTICS (Atypical) ---
    "clozapine":                "Clozapina",
    "olanzapine":               "Olanzapina",
    "risperidone":              "Risperidona",
    "quetiapine":               "Quetiapina",
    "aripiprazole":             "Aripiprazol",
    "ziprasidone":              "Ziprasidona",
    "paliperidone":             "Paliperidona",
    "lurasidone":               "Lurasidona",
    "asenapine":                "Asenapina",
    "iloperidone":              "Iloperidona",
    "cariprazine":              "Cariprazina",
    "brexpiprazole":            "Brexpiprazol",
    "lumateperone":             "Lumateperona",
    "pimavanserin":             "Pimavanserina",
    "blonanserin":              "Blonanserina",
    "perospirone":              "Perospirone",

    # --- ANTIPSYCHOTICS (Typical) ---
    "haloperidol":              "Haloperidol",
    "chlorpromazine":           "Clorpromazina",
    "fluphenazine":             "Flufenazina",
    "perphenazine":             "Perfenazina",
    "trifluoperazine":          "Trifluoperazina",
    "thioridazine":             "Tioridazina",
    "levomepromazine":          "Levomepromazina",
    "promazine":                "Promazina",
    "chlorprothixene":          "Clorprotixeno",
    "flupentixol":              "Flupentixol",
    "zuclopenthixol":           "Zuclopentixol",
    "thiothixene":              "Tiotixeno",
    "pimozide":                 "Pimozida",
    "droperidol":               "Droperidol",
    "bromperidol":              "Bromperidol",
    "benperidol":               "Benperidol",
    "fluspirilene":             "Fluspirileno",
    "loxapine":                 "Loxapina",
    "molindone":                "Molindona",
    "amisulpride":              "Amisulprida",
    "sulpiride":                "Sulpirida",
    "levosulpiride":            "Levosulpirida",
    "tiapride":                 "Tiaprida",
    "tetrabenazine":            "Tetrabenazina",

    # --- ANXIOLYTICS / BENZODIAZEPINES ---
    "diazepam":                 "Diazepam",
    "clonazepam":               "Clonazepam",
    "lorazepam":                "Lorazepam",
    "alprazolam":               "Alprazolam",
    "buspirone":                "Buspirona",
    "hydroxyzine":              "Hidroxizina",
    "zolpidem":                 "Zolpidem",

    # --- ANTICHOLINERGICS / ANTIPARKINSON ---
    "biperiden":                "Biperideno",
    "trihexyphenidyl":          "Tri-hexifenidila",
    "benztropine-mesylate":     "Mesilato de Benzatropina",

    # --- ADHD / NORADRENERGIC ---
    "atomoxetine":              "Atomoxetina",
    "clonidine":                "Clonidina",

    # --- ANTIPARKINSON / DOPAMINERGIC ---
    "levodopa":                 "Levodopa",
    "pramipexole":              "Pramipexol",
    "ropinirole":               "Ropinirol",
    "rotigotine":               "Rotigotina",
    "bromocriptine":            "Bromocriptina",

    # --- DEMENTIA ---
    "donepezil":                "Donepezila",
    "rivastigmine":             "Rivastigmina",
    "galantamine":              "Galantamina",
    "memantine":                "Memantina",

    # --- MUSCLE RELAXANT ---
    "baclofen":                 "Baclofeno",
}