import type { KnowledgeBase, KnowledgeBaseData } from "../engine/types.ts";
import bundle from "./kb.client.generated.json";

// Generated from knowledge/ by scripts/build_kb.py (validated there against knowledge/schema/).
// The browser bundle has no citation quotes: they are in /kb-quotes.json, loaded on demand
// (see quotes.ts). The full bundle, kb.generated.json, is what the tests use.
export const knowledgeBase: KnowledgeBase = {
  data: bundle.data as unknown as KnowledgeBaseData,
  version: bundle.kb_version,
  hash: bundle.content_hash,
};
