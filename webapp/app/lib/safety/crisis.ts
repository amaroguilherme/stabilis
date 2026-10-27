// Deterministic detection of suicide/self-harm language in Portuguese text.
// Mirrors core/safety/crisis.py: same lexicon (knowledge/lexicons/crisis.pt-BR.json), same
// algorithm and the same vectors (knowledge/tests/crisis.vectors.json). Change both together.
//
// Negation ("nega ideação suicida") only applies in professional mode, where it is routine
// documentation. Patient mode stays maximally sensitive.

export type CrisisMode = "patient" | "professional";

export interface CrisisLexiconSource {
  terms: { id: string; category: string; phrases: string[] }[];
  negation_cues: string[];
  scope_terminators: string[];
  matching: { negation_window_tokens: number };
}

export interface CompiledLexicon {
  terms: { id: string; category: string; phrases: string[][] }[];
  negationCues: string[][];
  terminators: Set<string>;
  window: number;
}

export interface CrisisHit {
  termId: string;
  category: string;
  negated: boolean;
}

export interface CrisisSummary {
  crisis: boolean;
  negated_only: boolean;
}

const SEGMENT_SPLIT = /[.!?;:\n]+/;

export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const normalized = normalize(text);
  return normalized ? normalized.split(" ") : [];
}

export function compileLexicon(raw: CrisisLexiconSource): CompiledLexicon {
  return {
    terms: raw.terms.map((term) => ({
      id: term.id,
      category: term.category,
      phrases: term.phrases.map(tokenize).filter((p) => p.length > 0),
    })),
    negationCues: raw.negation_cues.map(tokenize).filter((c) => c.length > 0),
    terminators: new Set(raw.scope_terminators.flatMap(tokenize)),
    window: raw.matching.negation_window_tokens,
  };
}

function matchesAt(tokens: string[], start: number, phrase: string[]): boolean {
  if (start + phrase.length > tokens.length) return false;
  return phrase.every((token, i) => tokens[start + i] === token);
}

function isNegated(tokens: string[], start: number, lexicon: CompiledLexicon): boolean {
  const low = Math.max(0, start - lexicon.window);
  for (const cue of lexicon.negationCues) {
    for (let i = low; i <= start - cue.length; i++) {
      if (matchesAt(tokens, i, cue) && !tokens.slice(i + cue.length, start).some((t) => lexicon.terminators.has(t))) {
        return true;
      }
    }
  }
  return false;
}

export function detectCrisis(text: string, lexicon: CompiledLexicon, mode: CrisisMode = "patient"): CrisisHit[] {
  const hits: CrisisHit[] = [];
  for (const segment of (text ?? "").split(SEGMENT_SPLIT)) {
    const tokens = tokenize(segment);
    if (tokens.length === 0) continue;

    // [start, end, termIndex, phraseIndex]; overlapping matches keep the longest phrase.
    const matches: [number, number, number, number][] = [];
    lexicon.terms.forEach((term, termIndex) => {
      term.phrases.forEach((phrase, phraseIndex) => {
        for (let start = 0; start + phrase.length <= tokens.length; start++) {
          if (matchesAt(tokens, start, phrase)) matches.push([start, start + phrase.length, termIndex, phraseIndex]);
        }
      });
    });
    matches.sort((a, b) => b[1] - b[0] - (a[1] - a[0]) || a[0] - b[0] || a[2] - b[2] || a[3] - b[3]);

    const kept: [number, number, number, number][] = [];
    for (const match of matches) {
      if (kept.every((k) => match[1] <= k[0] || match[0] >= k[1])) kept.push(match);
    }
    kept.sort((a, b) => a[0] - b[0]);

    for (const [start, , termIndex] of kept) {
      const term = lexicon.terms[termIndex];
      hits.push({
        termId: term.id,
        category: term.category,
        negated: mode === "professional" && isNegated(tokens, start, lexicon),
      });
    }
  }
  return hits;
}

/** `crisis`: some mention is not negated. `negated_only`: every mention is negated. */
export function summarizeCrisis(hits: CrisisHit[]): CrisisSummary {
  const crisis = hits.some((h) => !h.negated);
  return { crisis, negated_only: hits.length > 0 && !crisis };
}
