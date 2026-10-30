"""Checks the credentials of the language-model track (docs/roteiro-modelo-de-linguagem.md, step 1)
against each service, without ever printing them:

    source ~/.config/stabilis/llm.env && python scripts/check_credentials.py

Each line says OK, FALTA (not filled in), ERRO (the service refused it) or AVISO (works, but something
needs attention). Exits with 1 when a required credential is missing or refused. Standard library only.
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

MIN_FREE_GB = 20
failures = 0


def report(status: str, label: str, detail: str) -> None:
    global failures
    if status in ("FALTA", "ERRO"):
        failures += 1
    print(f"{status:<6}{label}: {detail}")


def get(url: str, headers: dict[str, str]) -> tuple[int, object]:
    request = urllib.request.Request(url, headers={"User-Agent": "stabilis-check-credentials", **headers})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read()
            try:
                return response.status, json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return response.status, {}
    except urllib.error.HTTPError as exc:
        return exc.code, {}
    except (urllib.error.URLError, TimeoutError):
        return 0, {}


def scoped_permissions(whoami: dict) -> dict[str, list[str]]:
    """Repository → permissions of a fine-grained token, when the API tells them."""
    token = (whoami.get("auth") or {}).get("accessToken") or {}
    scoped = (token.get("fineGrained") or {}).get("scoped") or []
    return {(entry.get("entity") or {}).get("name", ""): entry.get("permissions", []) for entry in scoped}


def check_hugging_face() -> None:
    token = os.getenv("HF_TOKEN", "")
    if not token:
        report("FALTA", "Hugging Face", "HF_TOKEN vazio")
        return
    auth = {"Authorization": f"Bearer {token}"}
    status, me = get("https://huggingface.co/api/whoami-v2", auth)
    if status != 200 or not isinstance(me, dict):
        report("ERRO", "Hugging Face", f"token recusado (HTTP {status})")
        return
    report("OK", "Hugging Face", f"token da conta {me.get('name', '?')}")
    permissions = scoped_permissions(me)
    for kind, repo in (("spaces", os.getenv("HF_SPACE_REPO", "")), ("models", os.getenv("HF_MODEL_REPO", ""))):
        if not repo:
            continue
        label = "Space" if kind == "spaces" else "repositório do modelo"
        status, _ = get(f"https://huggingface.co/api/{kind}/{repo}", auth)
        if status != 200:
            hint = "confira o nome e a permissão de leitura" if kind == "spaces" else "crie-o como privado e dê acesso ao token"
            report("ERRO", f"{label} {repo}", f"não encontrado ou sem acesso (HTTP {status}): {hint}")
        elif permissions and "repo.write" not in permissions.get(repo, []):
            report("AVISO", f"{label} {repo}", "acessível, mas o token não tem escrita nele")
        else:
            report("OK", f"{label} {repo}", "acessível" + (" com escrita" if permissions else ""))


def check_space() -> None:
    url, token = os.getenv("STABILIS_API_URL", "").rstrip("/"), os.getenv("HF_SPACE_TOKEN", "")
    if not url or not token:
        report("FALTA", "Space no ar", "STABILIS_API_URL ou HF_SPACE_TOKEN vazio")
        return
    status, _ = get(f"{url}/health", {"Authorization": f"Bearer {token}"})
    if status == 200:
        report("OK", "Space no ar", "responde em /health")
    else:
        report("AVISO", "Space no ar", f"HTTP {status} em /health: pode estar dormindo ou com o código antigo (a etapa 2 publica o novo)")


def check_groq() -> None:
    base, key = os.getenv("DATAGEN_TEACHER_BASE_URL", "").rstrip("/"), os.getenv("DATAGEN_TEACHER_API_KEY", "")
    if not key:
        report("FALTA", "Groq", "GROQ_API_KEY vazio")
        return
    status, listed = get(f"{base}/models", {"Authorization": f"Bearer {key}"})
    if status != 200 or not isinstance(listed, dict):
        report("ERRO", "Groq", f"chave recusada (HTTP {status})")
        return
    available = {m.get("id") for m in listed.get("data", [])}
    report("OK", "Groq", f"chave aceita ({len(available)} modelos disponíveis)")
    for role in ("TEACHER", "JUDGE"):
        model = os.getenv(f"DATAGEN_{role}_MODEL", "")
        name = "professor" if role == "TEACHER" else "juiz"
        if model in available:
            report("OK", f"modelo {name}", model)
        else:
            report("ERRO", f"modelo {name}", f"{model or '(vazio)'} não existe na Groq: troque pelo nome atual no console")


def check_kaggle() -> None:
    username, key, api_token = os.getenv("KAGGLE_USERNAME", ""), os.getenv("KAGGLE_KEY", ""), os.getenv("KAGGLE_API_TOKEN", "")
    stored = Path.home() / ".kaggle" / "kaggle.json"
    if not (username and key) and not api_token and stored.exists():
        try:
            data = json.loads(stored.read_text(encoding="utf-8"))
            username, key = data.get("username", ""), data.get("key", "")
        except (OSError, json.JSONDecodeError):
            pass
    if username and key:
        auth = {"Authorization": "Basic " + base64.b64encode(f"{username}:{key}".encode()).decode()}
    elif api_token:
        auth = {"Authorization": f"Bearer {api_token}"}
    else:
        report("FALTA", "Kaggle", "KAGGLE_USERNAME e KAGGLE_KEY (ou KAGGLE_API_TOKEN) vazios")
        return
    status, _ = get("https://www.kaggle.com/api/v1/datasets/list?group=my&page=1", auth)
    if status == 200:
        report("OK", "Kaggle", "token aceito (confira também que o telefone está verificado)")
    else:
        report("ERRO", "Kaggle", f"token recusado (HTTP {status})")


def check_vercel() -> None:
    token = os.getenv("VERCEL_TOKEN", "")
    if not token:
        print("-     Vercel: não configurado (opcional; você muda as variáveis pelo painel)")
        return
    # Tokens scoped to a team cannot read the user endpoint; listing projects works for both.
    status, _ = get("https://api.vercel.com/v9/projects?limit=1", {"Authorization": f"Bearer {token}"})
    report("OK" if status == 200 else "ERRO", "Vercel", "token aceito" if status == 200 else f"token recusado (HTTP {status})")


def check_disk() -> None:
    free_gb = shutil.disk_usage(Path.home()).free / 1024**3
    if free_gb < MIN_FREE_GB:
        report("AVISO", "espaço em disco", f"{free_gb:.0f} GB livres; o ideal são {MIN_FREE_GB} GB para os modelos")
    else:
        report("OK", "espaço em disco", f"{free_gb:.0f} GB livres")


def main() -> int:
    check_hugging_face()
    check_space()
    check_groq()
    check_kaggle()
    check_vercel()
    check_disk()
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
