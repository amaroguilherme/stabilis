"""Local backend for the end-to-end checks of the language features: the real Flask app, job queue
and extraction (evidence check, normalization, crisis lexicon), with a scripted model instead of the
GGUF. Never use outside tests.

    ../venv/bin/python e2e/fake_backend.py        # http://127.0.0.1:7861
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from api import create_app  # noqa: E402
from api.settings import Settings  # noqa: E402
from core.kb import load_and_validate  # noqa: E402
from core.llm.fake import FakeLlm  # noqa: E402
from core.service import LanguageService  # noqa: E402


def attrs(**extra):
    return {"negated": False, "experiencer": "patient", "temporality": "current", **extra}


def respond(prompt: str) -> dict:
    text = prompt.rsplit("<<<TEXTO\n", 1)[1]
    out = {"symptoms": [], "risk": [], "medications": [], "conditions": [], "substances": [], "pregnancy": {"status": "unknown"}}
    if "HAS" in text:
        out["conditions"].append(attrs(id="hypertension", evidence="HAS"))
    if "pressão alta" in text:
        out["conditions"].append(attrs(id="hypertension", evidence="pressão alta"))
    if "nega epilepsia" in text:
        out["conditions"].append(attrs(id="epilepsy", evidence="nega epilepsia", negated=True))
    if "Zoloft" in text:
        out["medications"].append({"name": "Zoloft", "evidence": "Zoloft 50 mg", "status": "current", "dose_mg_per_day": 50})
    if "fumo" in text:
        out["substances"].append({"id": "smoking", "evidence": "fumo", "negated": False, "temporality": "current"})
    if "queria sumir" in text:  # risk the crisis lexicon does not know: only the model sees it
        out["risk"].append(attrs(kind="death_thoughts", evidence="queria sumir"))
    return out


if __name__ == "__main__":
    kb = load_and_validate()
    app = create_app(Settings(), engine_factory=lambda: LanguageService(kb, FakeLlm(respond)))
    app.run(host="127.0.0.1", port=7861)
