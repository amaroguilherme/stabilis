# Stabilis

A guide for people who depend on Brazil's public health system (SUS) to bring to a mental health
appointment. The person describes how they feel, answers validated questionnaires and leaves with a report for
their doctor, listing the treatment options that public guidelines indicate for their profile. There is also an
entry point for health professionals, starting from a clinical history.

> **This is not medical advice or a prescription.** It is an experimental, educational tool built on public
> sources and **not clinically reviewed**. In a crisis in Brazil, call **CVV 188** (free, 24 h) or **SAMU 192**.

## How it works

- **Two entry points.** The patient (`/paciente`) describes what they feel; the professional (`/profissional`)
  writes a clinical history. Neither shows a 0–100 score: both show options by guideline line, with sources,
  alerts and availability in the SUS.
- **The knowledge base decides.** Rules, medicines, interactions and instruments live in `knowledge/`, and every
  rule cites its source with a verbatim quote. The decision engine runs in the browser, in TypeScript
  (`webapp/app/lib/engine/`), and checks safety invariants before showing any medicine.
- **The language model only reads text.** A service on a Hugging Face Space turns free text into suggestions for
  the user to confirm (symptoms, medicines, conditions, risk). It never chooses a treatment, and a deterministic
  crisis lexicon runs on the text alongside it. Both features that use the model are switched off on the site.
- **Data stays on the device.** The patient flow makes no server calls. Answers stay in the browser and are kept
  between visits only if the person asks.

## Layout

| Folder | Contents |
|---|---|
| `webapp/` | the site (Next.js on Vercel): routes, decision engine, unit and end-to-end tests ([README](webapp/README.md)) |
| `knowledge/` | the knowledge base as JSON with JSON Schema; authoring rules in `AUTHORING.md` and `POLICY.md` |
| `api/`, `core/`, `app.py` | the language service (Flask + llama.cpp) that runs on the Space |
| `scripts/` | `build_kb.py` generates the site's copies of the base; `verify_quotes.py` checks the citations; `build_space.py` assembles the Space bundle |
| `tests/` | Python tests (with a scripted model, no llama.cpp) |
| `eval/` | gold set, extraction evaluation and latency on the Space ([README](eval/README.md), [reports](eval/reports/README.md)) |
| `datagen/` | synthetic training data generation ([README](datagen/README.md)) |
| `finetune/` | training data preparation, training script and Kaggle notebook ([README](finetune/README.md)) |
| `deploy/space/` | how to publish the service to the Space ([README](deploy/space/README.md)) |
| `docs/` | language-model roadmap, LGPD (Brazilian data protection law), ANVISA regulatory analysis and the usability session script |

Most of the documentation inside these folders is in Portuguese, the language of the product and its users.

## Running locally

Python 3.13 and Node 24, the same versions as CI.

```bash
# knowledge base and language service
python -m venv venv && . venv/bin/activate
pip install -r requirements-ci.txt
python scripts/build_kb.py --check    # the site's copy of the base is up to date
python -m pytest

# site
cd webapp
npm ci
npm run lint && npm test && npm run build
npm run dev                           # http://localhost:3000
```

After editing `knowledge/`, run `python scripts/build_kb.py` and commit the generated files under `webapp/`. The
end-to-end tests, with headless Chrome and axe-core, are described in [webapp/e2e](webapp/e2e/README.md).

## Publishing

- **Site:** Vercel deploys to production on every push to `main` (root directory `webapp/`).
- **Language service:** published by hand to the private Hugging Face Space with `scripts/build_space.py`; see
  [deploy/space/README.md](deploy/space/README.md).
- **CI** (`.github/workflows/ci.yml`): knowledge base check, Python tests, the site's lint, tests and build, and
  end-to-end tests. `keep_alive.yml` wakes the Space once a day.

## Language model

The step-by-step roadmap, from accounts to promotion, is in
[docs/roteiro-modelo-de-linguagem.md](docs/roteiro-modelo-de-linguagem.md). As of 2026-11-10 the Space runs
Gemma 2 9B with the full prompt. A fine-tuned Gemma 4 E2B is under evaluation and will be promoted only if it
passes every gate in [eval/README.md](eval/README.md).

## Privacy and regulation

- LGPD: [legal basis](docs/lgpd/base-legal.md), [data map](docs/lgpd/mapa-de-dados.md) and
  [data protection impact assessment](docs/lgpd/ripd.md).
- ANVISA: [analysis of the classification as medical software](docs/regulatorio/anvisa-samd.md).
- Content and sourcing policy: [knowledge/POLICY.md](knowledge/POLICY.md).

These analyses are not legal advice.
