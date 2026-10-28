"""What the job worker calls: the language service (free text -> structured suggestions).
Built once by the runtime, in the background."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from core.extraction.extract import Extractor
from core.kb import KNOWLEDGE_DIR, KnowledgeBaseError, load_and_validate
from core.llm.base import LlmClient

logger = logging.getLogger("stabilis.service")


class LanguageService:
    def __init__(self, kb, llm: LlmClient | None, *, max_text_chars: int = 4000, prompt_style: str = "full"):
        self.kb = kb
        self.llm = llm
        self.extractor = Extractor(llm, kb, max_text_chars=max_text_chars, prompt_style=prompt_style)

    @property
    def llm_status(self) -> str:
        return self.llm.status if self.llm is not None else "error"

    def extract(self, text: str, task: str) -> dict:
        return self.extractor.extract(text, task)


def load_knowledge_base(root: Path = KNOWLEDGE_DIR):
    """Refuses to serve with an invalid knowledge base: raises, so /ready never turns green."""
    try:
        return load_and_validate(root)
    except KnowledgeBaseError as exc:
        logger.error("kb_invalid errors=%d", len(exc.errors))
        raise


def build_default_service() -> LanguageService:
    from core.llm.llamacpp import LlamaCppClient

    # EXTRACTION_PROMPT=short only with a model fine-tuned on the short prompt (see finetune/README.md).
    style = "short" if os.getenv("EXTRACTION_PROMPT", "").strip() == "short" else "full"
    return LanguageService(load_knowledge_base(), LlamaCppClient(), prompt_style=style)
