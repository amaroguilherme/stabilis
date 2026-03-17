class PharmacogenomicsAnalyzer:
    """
    Maps Genetic Variants -> Impact on Specific Drugs
    """
    def __init__(self):
        # Score > 0: Improves efficacy (Bonus)
        # Score < 0: Increases risk/toxicity (Penalty)
        # Score -100: Absolute contraindication (Blacklist)
        
        self.rules = {
            "rs4244285": {
                "AA": { # Poor Metabolizer (Toxic)
                        "valproic-acid": -1000.0,  # High risk of hepatotoxicity
                        "diazepam": -30.0,       # Excessive sedation
                        "citalopram": -20.0,     # Risk of QT prolongation
                        "phenytoin": -40.0       # Acute toxicity
                    },
                "GG": { # Ultra-Rapid Metabolizer (Ineffective)
                    "valproic-acid": -2.0,  # Metabolized before it can take effect
                    "diazepam": -2.0
                }
            },

            "rs4680": {
                "AA": { # WORRIER (Met/Met) - High Dopamine, Slow Degradation
                    # Profile: Anxious, obsessive, pain-sensitive. 
                    # Avoid stimulants or activating antidepressants. 
                    "amoxapine": -3.0,      # May cause panic/agitation
                    "bupropion": -2.0,      # Worsens anxiety
                    "valproic-acid": 2.0,   # GABA helps to calm
                    "lamotrigine": 1.5      # Neutral stabilizer is beneficial
                },
                "GG": { # WARRIOR (Val/Val) - Low Dopamine, Rapid Degradation
                    # Profile: Depressive, apathetic, but stress-resilient. 
                    # Requires a dopaminergic or energetic boost. 
                    "coenzyme-I": 3.0,      # Mitochondrial energy support helps significantly
                    "amoxapine": 2.0,       # Tricyclic antidepressant works well
                    "bupropion": 2.0        # Excellent response
                }
            }
        }

    def calculate_personalization(self, user_snps):
        """
        Returns a dictionary of score adjustments to be added to the Q-Matrix.
        Ex: {'valproic-acid': -5.0, ...}
        """
        adjustments = {}
        hits = []
        
        for rsid, user_genotype in user_snps.items():
            if rsid in self.rules:
                rule = self.rules[rsid]
                if user_genotype in rule:
                    impacts = rule[user_genotype]
                    hits.append(f"{rsid}({user_genotype})")
                    
                    for drug, score in impacts.items():
                        if drug in adjustments:
                            adjustments[drug] += score
                        else:
                            adjustments[drug] = score
                            
        print(f"Variants found: {', '.join(hits)}")
        return adjustments