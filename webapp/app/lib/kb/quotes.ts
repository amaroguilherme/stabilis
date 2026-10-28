// Citation quotes are kept out of the JavaScript bundle and fetched once, when someone opens a citation.

export interface QuoteEntry {
  quote?: string;
  absent_term?: string;
  note?: string;
  accessed?: string;
}

let pending: Promise<Record<string, QuoteEntry>> | null = null;

export function loadQuotes(): Promise<Record<string, QuoteEntry>> {
  pending ??= fetch("/kb-quotes.json")
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<{ quotes: Record<string, QuoteEntry> }>;
    })
    .then((body) => body.quotes)
    .catch((error) => {
      pending = null; // allow a retry
      throw error;
    });
  return pending;
}
