// Finds drugs of the knowledge base from what a person types: the Portuguese name, the DCB, aliases,
// the ANVISA ingredient names or a brand (ANVISA open data, knowledge/lexicons/brands.pt-BR.json).

import type { KnowledgeBaseData } from "../engine/types.ts";

export interface MedMatch {
  drug_id: string;
  label: string; // Portuguese display name of the drug
  matched: string; // the name that matched, as shown to the person
  kind: "name" | "brand";
}

/** Same normalization as scripts/build_brand_lexicon.py: lowercase, no accents, single spaces. */
export function normalizeName(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/®/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Entry {
  key: string;
  drug_id: string;
  matched: string;
  kind: MedMatch["kind"];
}

const titleCase = (text: string) => text.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());

export function buildMedIndex(kb: KnowledgeBaseData): Entry[] {
  const entries: Entry[] = [];
  for (const drug of kb.drugs) {
    const names = new Set([drug.names.display_pt, drug.names.dcb, drug.names.inn_en, ...(drug.names.aliases ?? []), ...drug.names.anvisa_principles]);
    for (const name of names) entries.push({ key: normalizeName(name), drug_id: drug.id, matched: name, kind: "name" });
  }
  for (const [brand, ids] of Object.entries(kb.brands)) {
    for (const id of ids) entries.push({ key: brand, drug_id: id, matched: titleCase(brand), kind: "brand" });
  }
  return entries;
}

/** Up to `limit` drugs, best first: exact name, then prefix, then word prefix; names before brands. */
export function searchMeds(kb: KnowledgeBaseData, index: Entry[], query: string, limit = 8): MedMatch[] {
  // "sertralina 50 mg" searches for "sertralina": the dose goes in its own field.
  const q = normalizeName(query).replace(/\s*\d.*$/, "").trim();
  if (q.length < 2) return [];
  const labels = new Map(kb.drugs.map((d) => [d.id, d.names.display_pt]));
  const rank = (e: Entry) => {
    if (e.key === q) return 0;
    if (e.key.startsWith(q)) return 1;
    if (e.key.includes(` ${q}`)) return 2;
    return 3;
  };
  const best = new Map<string, { entry: Entry; score: number }>();
  for (const entry of index) {
    if (!entry.key.includes(q)) continue;
    const score = rank(entry) * 2 + (entry.kind === "brand" ? 1 : 0);
    const id = `${entry.drug_id}|${entry.kind === "brand" ? entry.key : ""}`;
    const current = best.get(id);
    if (!current || score < current.score || (score === current.score && entry.matched.length < current.entry.matched.length)) {
      best.set(id, { entry, score });
    }
  }
  return [...best.values()]
    .sort((a, b) => a.score - b.score || a.entry.matched.length - b.entry.matched.length || (a.entry.matched < b.entry.matched ? -1 : 1))
    .slice(0, limit)
    .map(({ entry }) => ({ drug_id: entry.drug_id, label: labels.get(entry.drug_id) ?? entry.drug_id, matched: entry.matched, kind: entry.kind }));
}

/** Reads a daily dose in mg from free text such as "50mg", "1,5 g" or "600 mg 2x". */
export function parseDailyDoseMg(text: string): number | null {
  const match = normalizeName(text).match(/(\d+(?:[.,]\d+)?)\s*(mg|g)\b(?:\s*(?:\/|por)?\s*(\d)\s*x)?/);
  if (!match) return null;
  const amount = parseFloat(match[1].replace(",", "."));
  const perDose = match[2] === "g" ? amount * 1000 : amount;
  const times = match[3] ? parseInt(match[3], 10) : 1;
  return Math.round(perDose * times * 100) / 100;
}
