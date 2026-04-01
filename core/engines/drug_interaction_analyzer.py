class DrugInteractionAnalyzer:
    def __init__(self):
        # Interaction Dictionary: (Drug_A, Drug_B) -> (Penalty, Description)
        # Alphabetical order to facilitate searching (e.g., always A, B)
        self.interactions = {
            # Risk of Stevens-Johnson Syndrome
            ("lamotrigine", "valproic-acid"): (800.0, "Severe Risk: Valproate doubles the half-life of Lamotrigine. Risk of Stevens-Johnson syndrome."),
            
            # Serotonin Syndrome
            ("citalopram", "phenelzine"): (1000.0, "Fatal Risk: Severe Serotonin Syndrome."),
            ("fluoxetine", "phenelzine"): (1000.0, "Fatal Risk: Severe Serotonin Syndrome."),
            
            # Hepatic Competition (Both rely heavily on CYP2D6)
            ("bupropion", "fluoxetine"): (300.0, "Moderate Risk: Mutual inhibition of CYP2D6, increasing the toxicity of both."),
            
            # Positive Synergy (Bonus! Negative Energy)
            ("lithium", "valproic-acid"): (-50.0, "Synergy: A classic and effective combination for refractory mania.")
        }

    def get_interaction(self, drug1, drug2):
        # Ensures that the order does not matter during the search
        pair = tuple(sorted([drug1.lower(), drug2.lower()]))
        return self.interactions.get(pair, (0.0, None))