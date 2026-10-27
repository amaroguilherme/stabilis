import type { KnowledgeBase, KnowledgeBaseData } from "../engine/types.ts";
import bundle from "./kb.generated.json";

// Generated from knowledge/ by scripts/build_kb.py (validated there against knowledge/schema/).
export const knowledgeBase: KnowledgeBase = {
  data: bundle.data as unknown as KnowledgeBaseData,
  version: bundle.kb_version,
  hash: bundle.content_hash,
};
