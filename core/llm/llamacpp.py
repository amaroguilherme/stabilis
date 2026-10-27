"""Local GGUF model through llama.cpp, configured from the environment.

    HF_TOKEN         token that can read the private model repository
    MODEL_REPO_ID    Hugging Face repository with the GGUF file
    MODEL_FILENAME   GGUF file inside the repository
    MODEL_REVISION   optional commit hash: pins the exact model that passed the promotion gates
    LLM_THREADS      CPU threads (default 2, the Space's vCPUs)
"""

from __future__ import annotations

import logging
import os
import threading

from core.llm.base import LlmError

logger = logging.getLogger("stabilis.llm")

N_CTX = 4096


class LlamaCppClient:
    def __init__(self, llama=None, *, load: bool = True):
        self._lock = threading.Lock()  # llama.cpp contexts are not thread-safe
        self.load_error: str | None = None
        self.raw = llama  # the llama_cpp.Llama instance
        if self.raw is None and load:
            self.raw = self._load()

    @property
    def status(self) -> str:
        return "ready" if self.raw is not None else "error"

    def _load(self):
        try:
            from llama_cpp import Llama

            if not os.getenv("HF_TOKEN"):
                raise EnvironmentError("HF_TOKEN is not set")
            threads = int(os.getenv("LLM_THREADS", "2"))
            options = dict(n_ctx=N_CTX, n_gpu_layers=-1, n_threads=threads, n_threads_batch=threads, verbose=False)
            repo_id, filename = os.getenv("MODEL_REPO_ID"), os.getenv("MODEL_FILENAME")
            revision = os.getenv("MODEL_REVISION", "").strip()
            if revision:
                from huggingface_hub import hf_hub_download

                return Llama(model_path=hf_hub_download(repo_id=repo_id, filename=filename, revision=revision), **options)
            return Llama.from_pretrained(repo_id=repo_id, filename=filename, **options)
        except Exception as exc:
            self.load_error = type(exc).__name__
            logger.error("llm_load_failed error=%s", self.load_error)
            return None

    def complete_json(self, prompt: str, schema: dict, *, max_tokens: int) -> str:
        if self.raw is None:
            raise LlmError("model not loaded")
        try:
            with self._lock:
                response = self.raw.create_chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object", "schema": schema},
                    temperature=0.0,
                    max_tokens=max_tokens,
                )
            return response["choices"][0]["message"]["content"]
        except Exception as exc:
            raise LlmError(type(exc).__name__) from exc
