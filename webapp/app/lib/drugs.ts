// Curated drug list mirroring CURATED_DRUGS in data/constants.py.
// Used for the current-medications autocomplete in the intake form.
export const CURATED_DRUGS: string[] = [
  // Mood stabilizers
  "lithium-carbonate", "valproic-acid", "carbamazepine", "lamotrigine",
  "oxcarbazepine", "eslicarbazepine-acetate", "topiramate", "zonisamide",
  // Antidepressants — SSRIs
  "citalopram", "escitalopram", "fluoxetine", "fluvoxamine", "paroxetine", "sertraline",
  "vilazodone", "vortioxetine",
  // Antidepressants — SNRIs
  "desvenlafaxine", "duloxetine", "milnacipran", "reboxetine", "venlafaxine",
  // Antidepressants — TCAs
  "amitriptyline", "amoxapine", "clomipramine", "desipramine", "doxepin",
  "imipramine", "maprotiline", "nortriptyline", "trimipramine",
  // Antidepressants — other
  "agomelatine", "bupropion", "mianserin", "mirtazapine", "nefazodone",
  "tianeptine", "trazodone",
  // Antidepressants — MAOIs
  "isocarboxazid", "moclobemide", "phenelzine", "selegiline", "tranylcypromine",
  // Atypical antipsychotics
  "amisulpride", "aripiprazole", "asenapine", "blonanserin", "brexpiprazole",
  "cariprazine", "clozapine", "iloperidone", "lurasidone", "lumateperone",
  "olanzapine", "paliperidone", "perospirone", "quetiapine", "risperidone", "ziprasidone",
  // Typical antipsychotics
  "chlorpromazine", "chlorprothixene", "flupentixol", "fluphenazine", "fluspirilene",
  "haloperidol", "levomepromazine", "loxapine", "molindone", "perphenazine",
  "pimozide", "promazine", "sulpiride", "levosulpiride", "thioridazine",
  "thiothixene", "trifluoperazine", "zuclopenthixol", "benperidol", "bromperidol",
  // Anxiolytics / sedatives
  "alprazolam", "buspirone", "clonazepam", "diazepam", "hydroxyzine", "lorazepam",
  // Anticonvulsants
  "gabapentin", "phenytoin", "pregabalin", "primidone",
  // Other
  "atomoxetine",
];

export function formatDrugLabel(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Brazilian Portuguese names mirroring DRUG_NAME_PT in data/constants.py.
export const DRUG_NAME_PT: Record<string, string> = {
  // Mood stabilizers / anticonvulsants
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
  "primidone":                "Primidona",
  "zonisamide":               "Zonisamida",
  // SSRIs
  "fluoxetine":               "Fluoxetina",
  "sertraline":               "Sertralina",
  "escitalopram":             "Escitalopram",
  "citalopram":               "Citalopram",
  "paroxetine":               "Paroxetina",
  "fluvoxamine":              "Fluvoxamina",
  "vilazodone":               "Vilazodona",
  "vortioxetine":             "Vortioxetina",
  // SNRIs
  "venlafaxine":              "Venlafaxina",
  "desvenlafaxine":           "Desvenlafaxina",
  "duloxetine":               "Duloxetina",
  "milnacipran":              "Milnaciprana",
  "reboxetine":               "Reboxetina",
  // TCAs
  "amitriptyline":            "Amitriptilina",
  "clomipramine":             "Clomipramina",
  "imipramine":               "Imipramina",
  "nortriptyline":            "Nortriptilina",
  "desipramine":              "Desipramina",
  "doxepin":                  "Doxepina",
  "trimipramine":             "Trimipramina",
  "maprotiline":              "Maprotilina",
  "amoxapine":                "Amoxapina",
  // MAOIs
  "phenelzine":               "Fenelzina",
  "tranylcypromine":          "Tranilcipromina",
  "isocarboxazid":            "Isocarboxazida",
  "moclobemide":              "Moclobemida",
  "selegiline":               "Selegilina",
  // Atypical antidepressants
  "bupropion":                "Bupropiona",
  "mirtazapine":              "Mirtazapina",
  "trazodone":                "Trazodona",
  "nefazodone":               "Nefazodona",
  "agomelatine":              "Agomelatina",
  "tianeptine":               "Tianeptina",
  "mianserin":                "Mianserina",
  "atomoxetine":              "Atomoxetina",
  // Atypical antipsychotics
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
  "blonanserin":              "Blonanserina",
  "perospirone":              "Perospirone",
  "amisulpride":              "Amisulprida",
  // Typical antipsychotics
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
  "bromperidol":              "Bromperidol",
  "benperidol":               "Benperidol",
  "fluspirilene":             "Fluspirileno",
  "loxapine":                 "Loxapina",
  "molindone":                "Molindona",
  "sulpiride":                "Sulpirida",
  "levosulpiride":            "Levosulpirida",
  // Anxiolytics
  "diazepam":                 "Diazepam",
  "clonazepam":               "Clonazepam",
  "lorazepam":                "Lorazepam",
  "alprazolam":               "Alprazolam",
  "buspirone":                "Buspirona",
  "hydroxyzine":              "Hidroxizina",
};
