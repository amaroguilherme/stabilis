"""In-memory job queue served by a single worker thread.

One worker means the model is only ever called from one thread (llama.cpp is not thread-safe)
and gives natural backpressure on the 2-vCPU Space. Nothing is written to disk: payloads are
dropped as soon as processing ends and results expire after `ttl_s`.
"""

from __future__ import annotations

import logging
import secrets
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("stabilis.jobs")

FINISHED = ("done", "error")


class QueueFull(Exception):
    pass


@dataclass
class Job:
    id: str
    kind: str
    payload: dict | None
    created_at: float
    status: str = "queued"  # queued | running | done | error
    result: Any = None
    error: str | None = None
    finished_at: float | None = None


class JobStore:
    def __init__(self, max_queued: int = 4, ttl_s: float = 600, clock: Callable[[], float] = time.monotonic):
        self._max_queued = max_queued
        self._ttl_s = ttl_s
        self._clock = clock
        self._jobs: dict[str, Job] = {}
        self._queue: deque[str] = deque()
        self._cond = threading.Condition()

    def submit(self, kind: str, payload: dict) -> Job:
        with self._cond:
            self._purge_expired()
            if len(self._queue) >= self._max_queued:
                raise QueueFull()
            job = Job(id=secrets.token_urlsafe(18), kind=kind, payload=payload, created_at=self._clock())
            self._jobs[job.id] = job
            self._queue.append(job.id)
            self._cond.notify_all()
            return job

    def get(self, job_id: str) -> Job | None:
        with self._cond:
            self._purge_expired()
            return self._jobs.get(job_id)

    def position(self, job_id: str) -> int | None:
        """1-based position among queued jobs, or None when not queued."""
        with self._cond:
            try:
                return self._queue.index(job_id) + 1
            except ValueError:
                return None

    def queued_count(self) -> int:
        with self._cond:
            return len(self._queue)

    def delete(self, job_id: str) -> bool:
        with self._cond:
            job = self._jobs.pop(job_id, None)
            if job is None:
                return False
            if job.status == "queued":
                self._queue.remove(job_id)
                job.payload = None
            # A running job keeps its payload until `finish`, which then drops the result.
            job.result = None
            return True

    def next_job(self, timeout: float | None = None) -> Job | None:
        """Blocks until a job is queued (or the timeout passes) and marks it as running."""
        with self._cond:
            while not self._queue:
                if not self._cond.wait(timeout):
                    return None
            job = self._jobs[self._queue.popleft()]
            job.status = "running"
            return job

    def finish(self, job: Job, *, result: Any = None, error: str | None = None) -> None:
        with self._cond:
            job.payload = None
            job.finished_at = self._clock()
            if error is None:
                job.status, job.result = "done", result
            else:
                job.status, job.error = "error", error
            if job.id not in self._jobs:  # deleted while running: drop the result
                job.result = None
            self._cond.notify_all()

    def wait_finished(self, job_id: str, timeout: float) -> Job | None:
        deadline = time.monotonic() + timeout
        with self._cond:
            while True:
                job = self._jobs.get(job_id)
                if job is None or job.status in FINISHED:
                    return job
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return job
                self._cond.wait(remaining)

    def _purge_expired(self) -> None:
        now = self._clock()
        expired = [
            job_id for job_id, job in self._jobs.items()
            if (job.finished_at is not None and now - job.finished_at > self._ttl_s)
            or (job.status == "queued" and now - job.created_at > self._ttl_s)
        ]
        for job_id in expired:
            if self._jobs.pop(job_id).status == "queued":
                self._queue.remove(job_id)


class JobWorker(threading.Thread):
    """The only caller of the engine. Handlers receive (engine, payload) and return a JSON-able dict."""

    def __init__(self, store: JobStore, handlers: dict[str, Callable[[Any, dict], dict]], runtime):
        super().__init__(name="stabilis-job-worker", daemon=True)
        self._store = store
        self._handlers = handlers
        self._runtime = runtime

    def run(self) -> None:
        while True:
            self.run_once(timeout=None)

    def run_once(self, timeout: float | None = 0.0) -> bool:
        job = self._store.next_job(timeout)
        if job is None:
            return False
        self._process(job)
        return True

    def _process(self, job: Job) -> None:
        try:
            if not self._runtime.ensure_ready():
                self._store.finish(job, error="model_unavailable")
                return
            result = self._handlers[job.kind](self._runtime.engine, job.payload)
        except Exception as exc:
            logger.error("job_failed kind=%s error=%s", job.kind, type(exc).__name__)
            self._store.finish(job, error="internal")
            return
        self._store.finish(job, result=result)
