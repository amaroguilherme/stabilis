"""Assembles the files the Hugging Face Space receives (deploy/space/README.md) in a folder outside this
repository, ready to be pushed as a single commit that replaces the Space's history:

    python scripts/build_space.py --out /tmp/stabilis-space
    cd /tmp/stabilis-space && git init -b main && git add -A && git commit -m "Deploy the language service"
    git push --force https://huggingface.co/spaces/amaroguilherme/stabilis-api main

Copies README.md (from deploy/space/README.md), Dockerfile, requirements.txt, app.py,
gunicorn.conf.py, api/, core/ and knowledge/ (without knowledge/tests), skipping caches. Validates the
knowledge base first, since the Space refuses to start with an invalid one. Publishing is the project
owner's step.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.kb import load_and_validate  # noqa: E402

FILES = ["Dockerfile", "requirements.txt", "app.py", "gunicorn.conf.py"]
DIRS = ["api", "core", "knowledge"]
SKIP = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", ".DS_Store")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True, help="pasta de saída (fora deste repositório)")
    args = parser.parse_args()
    out = args.out.resolve()
    if out == ROOT or ROOT in out.parents:
        print("escolha uma pasta fora do repositório", file=sys.stderr)
        return 2
    load_and_validate(ROOT / "knowledge")

    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    shutil.copy2(ROOT / "deploy" / "space" / "README.md", out / "README.md")
    for name in FILES:
        shutil.copy2(ROOT / name, out / name)
    for name in DIRS:
        shutil.copytree(ROOT / name, out / name, ignore=SKIP)
    shutil.rmtree(out / "knowledge" / "tests", ignore_errors=True)

    files = sorted(p.relative_to(out).as_posix() for p in out.rglob("*") if p.is_file())
    size = sum((out / f).stat().st_size for f in files)
    print(f"{len(files)} arquivos ({size / 1024:.0f} KB) em {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
