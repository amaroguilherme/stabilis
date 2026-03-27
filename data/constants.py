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
    'SLC6A2': 'NET', 'NOREPINEPHRINE': 'NET',
    'SLC6A4': 'SERT', 'SEROTONIN': 'SERT',
    'SLC6A3': 'DAT', 'DOPAMINE': 'DAT',
    'HTR1A': '5HT1A', 'HTR2A': '5HT2A', 'HTR2C': '5HT2C'
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