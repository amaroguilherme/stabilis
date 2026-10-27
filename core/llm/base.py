"""The interface every language model client implements.

The model only does language: it turns free text into JSON that follows a schema. It never decides
treatment options (that is the knowledge base's job, in the web app's engine).
"""

from __future__ import annotations

from typing import Protocol


class LlmError(Exception):
    """The model could not produce an answer (not loaded, crashed, timed out)."""


class LlmClient(Protocol):
    @property
    def status(self) -> str:
        """"ready" when the model can answer, "error" otherwise."""
        ...

    def complete_json(self, prompt: str, schema: dict, *, max_tokens: int) -> str:
        """Returns the raw model output for `prompt`, constrained to JSON matching `schema`.

        Raises LlmError when the model cannot answer. The caller validates the output.
        """
        ...
