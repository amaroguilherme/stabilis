"""Minimal OpenAI-compatible chat client (Groq, local llama.cpp server, vLLM...). Standard library only.

    DATAGEN_<ROLE>_BASE_URL   e.g. https://api.groq.com/openai/v1
    DATAGEN_<ROLE>_MODEL      e.g. openai/gpt-oss-120b (teacher) — prefer Apache 2.0 models
    DATAGEN_<ROLE>_API_KEY    the provider key (never committed)

ROLE is TEACHER or JUDGE; the judge must be a different model family from the teacher.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request


class ModelUnavailable(RuntimeError):
    pass


class ChatClient:
    def __init__(self, role: str):
        prefix = f"DATAGEN_{role.upper()}_"
        self.base_url = os.environ.get(prefix + "BASE_URL", "").rstrip("/")
        self.model = os.environ.get(prefix + "MODEL", "")
        self.api_key = os.environ.get(prefix + "API_KEY", "")
        if not self.base_url or not self.model:
            raise ModelUnavailable(f"{prefix}BASE_URL e {prefix}MODEL são obrigatórios")

    def _request(self, path: str, body: dict | None = None) -> dict:
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            method="POST" if body is not None else "GET",
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read())

    def check(self) -> None:
        """Fails loudly at start if the model does not exist (models get retired without notice)."""
        try:
            listed = self._request("/models")
        except (urllib.error.URLError, json.JSONDecodeError) as exc:
            raise ModelUnavailable(f"não foi possível listar os modelos: {exc}") from exc
        ids = {m.get("id") for m in listed.get("data", [])}
        if ids and self.model not in ids:
            raise ModelUnavailable(f"modelo {self.model} não existe no provedor")

    def complete_json(self, prompt: str, *, temperature: float, retries: int = 3) -> dict:
        body = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "response_format": {"type": "json_object"},
        }
        for attempt in range(retries):
            try:
                content = self._request("/chat/completions", body)["choices"][0]["message"]["content"]
                return json.loads(content[content.find("{") : content.rfind("}") + 1])
            except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, KeyError, ValueError):
                if attempt == retries - 1:
                    raise
                time.sleep(2 ** (attempt + 1))
        raise RuntimeError("unreachable")
