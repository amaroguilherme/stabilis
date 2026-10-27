import os
from dataclasses import dataclass

_DEFAULT_ORIGINS = ("http://localhost:3000", "https://stabilis.vercel.app")


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    cors_origins: tuple[str, ...] = _DEFAULT_ORIGINS
    max_text_chars: int = 4000          # free text per request (summary + anamnesis), fits n_ctx=4096
    max_content_length: int = 64 * 1024
    queue_max: int = 4                  # queued jobs beyond this get 429
    job_ttl_s: int = 600                # finished results are kept this long, in memory only
    sync_wait_s: int = 600              # deprecated synchronous endpoints wait up to this long

    @classmethod
    def from_env(cls) -> "Settings":
        origins = os.environ.get("STABILIS_CORS_ORIGINS", "")
        return cls(
            cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()) or _DEFAULT_ORIGINS,
            max_text_chars=_int_env("STABILIS_MAX_TEXT_CHARS", cls.max_text_chars),
            queue_max=_int_env("STABILIS_QUEUE_MAX", cls.queue_max),
            job_ttl_s=_int_env("STABILIS_JOB_TTL_S", cls.job_ttl_s),
        )
