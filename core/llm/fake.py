"""Scripted model for tests: never imports llama.cpp or torch."""

from __future__ import annotations

import json
from collections.abc import Callable

from core.llm.base import LlmError

Response = str | dict | Callable[[str], "str | dict"]


class FakeLlm:
    """Answers with the scripted responses in order (the last one repeats); records every prompt.

    A dict response is serialized as JSON; a callable receives the prompt; `error` makes every call fail.
    """

    def __init__(self, *responses: Response, status: str = "ready", error: Exception | None = None):
        self._responses = list(responses)
        self._status = status
        self._error = error
        self.prompts: list[str] = []

    @property
    def status(self) -> str:
        return self._status

    def complete_json(self, prompt: str, schema: dict, *, max_tokens: int) -> str:
        self.prompts.append(prompt)
        if self._error is not None or self._status != "ready":
            raise LlmError(type(self._error).__name__ if self._error else "not ready")
        if not self._responses:
            raise LlmError("no scripted response")
        response = self._responses.pop(0) if len(self._responses) > 1 else self._responses[0]
        if callable(response):
            response = response(prompt)
        return response if isinstance(response, str) else json.dumps(response, ensure_ascii=False)
