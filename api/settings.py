import os
from dataclasses import dataclass


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    max_text_chars: int = 4000          # free text per request; prompt + text + answer fit n_ctx=4096
    max_content_length: int = 64 * 1024
    queue_max: int = 4                  # queued jobs beyond this get 429
    job_ttl_s: int = 600                # finished results are kept this long, in memory only

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            max_text_chars=_int_env("STABILIS_MAX_TEXT_CHARS", cls.max_text_chars),
            queue_max=_int_env("STABILIS_QUEUE_MAX", cls.queue_max),
            job_ttl_s=_int_env("STABILIS_JOB_TTL_S", cls.job_ttl_s),
        )
