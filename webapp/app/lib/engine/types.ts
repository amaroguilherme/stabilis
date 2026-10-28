// Types for the knowledge base bundle (knowledge/schema/kb.schema.json) and the decision engine.
// The bundle is validated by scripts/build_kb.py; these types mirror the schema.

export type Mode = "patient" | "professional";
export type Tier = "first_line" | "second_line" | "alternative" | "not_recommended" | "avoid_for_profile";
export type GuidelineTier = Exclude<Tier, "avoid_for_profile">;
export type Severity = "info" | "warning" | "major" | "contraindicated";
export type AlertLevel = "info" | "warning" | "critical";
export type Signal = "crisis_language" | "crisis_language_negated_only" | "bipolar_screen_negative";

export interface Cite {
  source: string;
  locator: string;
  quote?: string;
  absent_term?: string;
  accessed?: string;
  note?: string;
  qid?: string; // browser bundle: quote, absent term, note and access date live in /kb-quotes.json
}

export interface Review {
  status: "draft" | "verified";
  extracted_by: "ai" | "owner";
  extracted_on: string;
  verified_by: string | null;
  verified_on: string | null;
  notes?: string;
}

export interface DrugFact {
  tag: string;
  severity?: Severity;
  note?: string;
  cite: Cite;
}

export interface Drug {
  id: string;
  names: { dcb: string; display_pt: string; inn_en: string; aliases?: string[]; anvisa_principles: string[] };
  class: string;
  subclass: string;
  scope: { anvisa_registered: boolean; interaction_only: boolean; cite?: Cite };
  label_source?: string;
  sus?: { component: "basico" | "estrategico" | "especializado" | "nao_consta"; note?: string; cite: Cite };
  dose_adult?: {
    unit: "mg/dia";
    start?: number;
    usual_min?: number;
    usual_max?: number;
    max?: number;
    indication?: string;
    note?: string;
    cite: Cite;
  };
  facts: DrugFact[];
  monitoring?: { id: string; note?: string; cite: Cite }[];
  common_effects?: { effects: string[]; cite: Cite; note?: string };
  review: Review;
}

export type Selector = { drug: string } | { class: string; subclass?: string } | { fact: string };

export type ProfilePath =
  | "age"
  | "sex_at_birth"
  | "reproductive.pregnant"
  | "reproductive.breastfeeding"
  | "reproductive.planning"
  | "conditions"
  | "habits"
  | "severity"
  | "suicide_risk_assessed";

export type Op = "eq" | "ne" | "in" | "lt" | "lte" | "gt" | "gte" | "between" | "exists" | "contains";

export type Predicate =
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { not: Predicate }
  | { profile: ProfilePath; op: Op; value?: unknown }
  | { derived: string; value?: boolean }
  | { instrument: string; band_in?: string[]; flag?: string; answered?: boolean }
  | { drug_fact: string }
  | { drug_class: string; subclass?: string }
  | { drug: string }
  | { current_med_fact: string }
  | { current_med_class: string; subclass?: string }
  | { current_med: string }
  | { mode: Mode }
  | { condition: string; phase?: string }
  | { signal: Signal };

export type Action =
  | { action: "set_tier"; tier: "avoid_for_profile" | "not_recommended" }
  | { action: "exclude" }
  | { action: "exclude_medications"; scope: "all" | { class: string; subclass?: string } }
  | { action: "alert"; level: AlertLevel; message_key: string }
  | { action: "add_question"; message_key: string }
  | { action: "referral"; urgent?: boolean; message_key: string };

export interface SafetyRule {
  id: string;
  title: string;
  applies_to: "drug" | "global";
  modes: Mode[];
  when: Predicate;
  then: Action[];
  sources: Cite[];
  review: Review;
}

export interface DerivedFact {
  id: string;
  label_pt: string;
  when: Predicate;
  sources: Cite[];
  review: Review;
}

export interface Interaction {
  id: string;
  type: "pharmacokinetic" | "pharmacodynamic";
  perpetrator?: Selector;
  victim?: Selector;
  participants?: [Selector, Selector];
  effect:
    | "increases_victim_exposure"
    | "decreases_victim_exposure"
    | "contraceptive_failure"
    | "serotonin_syndrome"
    | "qt_additive"
    | "cns_depression_additive"
    | "bleeding_additive"
    | "maoi_reaction";
  severity: Severity;
  message_key: string;
  supersedes?: string[]; // more general interactions this one replaces for the same pair
  sources: Cite[];
  review: Review;
}

export interface Option {
  id: string;
  phase?: string;
  kind: "psychotherapy" | "medication" | "referral" | "self_care";
  targets?: Selector[];
  use?: "monotherapy" | "adjunctive" | "either";
  tier: GuidelineTier;
  applies_when?: Predicate;
  modes: Mode[];
  text_key: string;
  sources: Cite[];
  review: Review;
}

export interface ConditionDoc {
  id: string;
  description?: string;
  population?: { age_min?: number };
  options: Option[];
}

export interface Band {
  id: string;
  min: number;
  max: number;
}

export interface InstrumentItem {
  id: string;
  text: string | null;
  text_status: "verified" | "pending";
  options?: { value: number; label: string }[];
  cite?: Cite;
  ask_if?: { items: string[]; min_yes: number }; // asked only when enough of these items were positive
}

export interface Instrument {
  id: string;
  name: string;
  stem?: string;
  stem_cite?: Cite;
  instructions?: string;
  instructions_cite?: Cite;
  license_note?: string;
  validation_note?: string;
  options: { value: number; label: string }[];
  options_cite?: Cite;
  items: InstrumentItem[];
  scoring: {
    type: "sum" | "mdq" | "risk_screener";
    bands?: Band[];
    bands_by_sex?: Record<string, Band[]>;
    flags?: { id: string; item: string; op: "gt" | "gte" | "eq"; value: number }[];
    mdq?: { symptom_items: string[]; min_yes: number; same_period_item: string; problem_item: string; problem_min_value: number };
    risk?: { low_items: string[]; high_items: string[] };
  };
  sources: Cite[];
  review: Review;
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  year: number;
  kind: string;
  language: string;
  url: string;
  license_note: string;
}

export interface Concept {
  id: string;
  label_plain: string;
  label_clinical: string;
  legacy_labels: string[];
}

export interface KnowledgeBaseData {
  manifest: { kb_version: string; schema_version: number; language: string };
  sources: Source[];
  vocab: {
    facts: { facts: { id: string; category: string; label_pt: string }[] };
    classes: { classes: { id: string; label_pt: string; subclasses: { id: string; label_pt: string }[] }[] };
    comorbidities: { comorbidities: Concept[]; habits: Concept[] };
    monitoring: { monitoring: { id: string; label_pt: string; blood_test?: boolean }[] };
    effects: { effects: { id: string; label_plain: string; label_clinical: string }[] };
    conditions: {
      conditions: {
        id: string;
        label_plain: string;
        label_clinical: string;
        patient_scope: "options" | "referral";
        phases: { id: string; label_clinical: string }[];
      }[];
    };
  };
  drugs: Drug[];
  interactions: Interaction[];
  rules: SafetyRule[];
  derived: DerivedFact[];
  conditions: ConditionDoc[];
  instruments: Instrument[];
  messages: Record<string, { plain?: string; clinical: string }>;
  brands: Record<string, string[]>;
}

export interface KnowledgeBase {
  data: KnowledgeBaseData;
  version: string;
  hash: string;
}

// ── Engine input ─────────────────────────────────────────────────────────────

export interface MedEntry {
  drug_id: string | null; // null when the text could not be matched to a drug in the knowledge base
  raw_text: string;
  mg_per_day?: number | null;
  duration_months?: number | null;
}

export interface Profile {
  age: number | null;
  sex_at_birth: "female" | "male" | "intersex" | null;
  reproductive: { pregnant: "yes" | "no" | "unsure" | null; breastfeeding: boolean | null; planning: boolean | null };
  conditions: string[];
  habits: string[];
  severity?: "less_severe" | "more_severe" | null;
  suicide_risk_assessed?: boolean | null; // professional assessment; patient mode uses instruments and text
  current_meds: MedEntry[];
}

export type InstrumentAnswers = Record<string, number>;

export interface EngineInput {
  mode: Mode;
  condition: { id: string; phase?: string | null } | null;
  profile: Profile;
  instruments?: Record<string, InstrumentAnswers>;
  free_text?: string;
  // What the person wants to avoid or prefer; orders drugs within a tier, never across tiers.
  // Fact tags (e.g. "weight_gain_significant") or the preferences in PREFERENCE_CONCERNS.
  concerns?: string[];
}

// ── Engine output ────────────────────────────────────────────────────────────

export interface Message {
  key: string;
  params: Record<string, string>;
}

export interface Alert {
  level: AlertLevel;
  message: Message;
  drug_id?: string;
  origin: string; // rule, interaction or engine check that produced it
  sources: Cite[];
}

export interface InteractionFinding {
  interaction_id: string;
  effect: Interaction["effect"];
  severity: Severity;
  message: Message;
  drugs: [string, string];
  perpetrator?: string;
  victim?: string;
  sources: Cite[];
}

export interface Reason {
  kind: "guideline" | "guideline_caution";
  option_id: string;
  tier: GuidelineTier;
  use?: Option["use"];
  message: Message;
  sources: Cite[];
}

export interface DrugResult {
  drug_id: string;
  tier: Tier;
  guideline_tier: GuidelineTier;
  use?: Option["use"];
  in_use: boolean;
  reasons: Reason[];
  alerts: Alert[];
  interactions: InteractionFinding[];
  monitoring: { id: string; note?: string; cite: Cite }[];
}

export interface OptionResult {
  option_id: string;
  kind: Option["kind"];
  tier: GuidelineTier;
  use?: Option["use"];
  message: Message;
  sources: Cite[];
  drug_ids: string[];
}

export interface TierGroup {
  tier: Tier;
  options: OptionResult[];
  drugs: DrugResult[];
}

export type DoseCheck = "within_usual" | "below_usual" | "above_usual" | "above_max" | "no_label_data" | "no_dose_informed";

export interface MedReviewItem {
  raw_text: string;
  drug_id: string | null;
  status: "recognized" | "unrecognized";
  dose_check: DoseCheck;
  alerts: Alert[];
  monitoring: { id: string; note?: string; cite: Cite }[];
}

export interface InstrumentResult {
  instrument_id: string;
  answered: boolean;
  total: number | null;
  band: string | null;
  flags: string[];
}

export interface EngineOutput {
  kb_version: string;
  kb_hash: string;
  mode: Mode;
  condition: { id: string; phase: string | null } | null;
  crisis: { language: boolean; negated_only: boolean };
  derived: Record<string, boolean>;
  scores: Record<string, InstrumentResult>;
  medications_excluded: "all" | { class: string; subclass?: string }[] | null;
  tiers: TierGroup[];
  alerts: Alert[];
  referrals: { message: Message; urgent: boolean; origin: string; sources: Cite[] }[];
  questions: { message: Message; origin: string; sources: Cite[] }[];
  medication_review: MedReviewItem[];
  interactions: InteractionFinding[];
  violations: string[];
  fail_closed: boolean;
}
