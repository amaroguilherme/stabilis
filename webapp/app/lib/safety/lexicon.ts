import bundle from "@/app/lib/kb/crisis.generated.json";
import { compileLexicon, type CrisisLexiconSource } from "./crisis";

// Generated from knowledge/lexicons/crisis.pt-BR.json by scripts/build_kb.py.
export const crisisLexicon = compileLexicon(bundle.data as CrisisLexiconSource);
