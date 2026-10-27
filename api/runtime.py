"""Loads the engine once, in the background, and reports its state for /ready."""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable
from typing import Any

logger = logging.getLogger("stabilis.runtime")


class EngineRuntime:
    def __init__(self, factory: Callable[[], Any]):
        self._factory = factory
        self._lock = threading.Lock()
        self._done = threading.Event()
        self.status = "idle"  # idle | loading | ready | error
        self.engine: Any = None

    def warm(self) -> bool:
        """Builds the engine if it isn't ready yet. Safe to call from several threads."""
        with self._lock:
            if self.status == "ready":
                return True
            self.status = "loading"
            self._done.clear()
            try:
                engine = self._factory()
            except Exception as exc:
                logger.error("engine_load_failed error=%s", type(exc).__name__)
                self.status = "error"
                self._done.set()
                return False
            self.engine = engine
            self.status = "ready"
            self._done.set()
            return True

    def ensure_ready(self) -> bool:
        """Waits for an in-flight warm-up; retries once if the engine isn't available."""
        if self.status == "loading":
            self._done.wait()
        if self.status == "ready":
            return True
        return self.warm()

    @property
    def llm_status(self) -> str:
        extractor = getattr(self.engine, "symptom_extractor", None)
        return getattr(extractor, "status", "unknown")
