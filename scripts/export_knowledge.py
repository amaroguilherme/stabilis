"""Exports the knowledge base as a stand-alone folder for a public mirror (knowledge/POLICY.md §20).

    python scripts/export_knowledge.py --out /tmp/stabilis-knowledge

Copies knowledge/ and writes a README for readers and an issue template for reporting errors. It
publishes nothing: creating the public repository and pushing the folder is the project owner's step.
The downloaded sources (.sources-cache/) are not copied; every citation keeps its source id, locator
and verbatim quote, and the source list keeps the official links.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.kb import load_and_validate  # noqa: E402

README = """# Base de conhecimento do Stabilis

Regras, opções de tratamento, alertas, interações, questionários e textos usados pelo
[Stabilis](https://github.com/{owner_repo}), um guia gratuito e não comercial, baseado em diretrizes públicas de saúde mental,
para pessoas que dependem do SUS levarem à consulta.

**Não é conselho médico.** O conteúdo ainda não passou por revisão clínica: cada item cita uma fonte pública com localizador e
trecho literal, conferido mecanicamente contra a fonte, e a maior parte está marcada como rascunho (`review.status`).

- Versão {version} · {counts}
- Como cada item é escrito e conferido: [AUTHORING.md](knowledge/AUTHORING.md)
- Decisões de produto que não são afirmações clínicas: [POLICY.md](knowledge/POLICY.md)
- Fontes (com links oficiais): [sources.json](knowledge/sources.json)

## Encontrou um erro?

Abra uma issue com o modelo "Erro no conteúdo": diga onde está o erro (o id da regra, ou a fonte e o localizador da citação), o
que está errado e qual fonte pública mostra o certo, com o trecho. **Não inclua dados de pacientes.** Correções só entram com
fonte.

## Licenças

Os trechos citados pertencem às suas fontes e seguem as condições de cada uma (veja `license_note` e `url` em
`knowledge/sources.json`). Licença do conteúdo próprio do Stabilis (estrutura das regras, mensagens e perguntas): {license}.
"""

ISSUE = """---
name: Erro no conteúdo
about: Uma regra, alerta, dose ou citação que parece errada
title: "Erro: "
labels: conteudo
---

**Onde está o erro** (id da regra ou da opção, ou fonte e localizador da citação; a página do Stabilis, se souber):

**O que está errado:**

**Fonte pública que mostra o certo** (link, localizador e trecho literal):

Não inclua nome, idade, documentos nem qualquer dado de pacientes.
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True, help="pasta de saída (fora deste repositório)")
    parser.add_argument("--repo", default="amaroguilherme/stabilis", help="repositório do app, para o link no README")
    parser.add_argument("--license", default="a definir pelo responsável", help="licença do conteúdo próprio")
    args = parser.parse_args()

    out = args.out.resolve()
    if out == ROOT or ROOT in out.parents:
        print("escolha uma pasta fora do repositório", file=sys.stderr)
        return 2
    kb = load_and_validate(ROOT / "knowledge")  # refuses to export an invalid base
    target = out / "knowledge"
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(ROOT / "knowledge", target)

    manifest = json.loads((ROOT / "knowledge" / "manifest.json").read_text(encoding="utf-8"))
    counts = f"{len(kb.drugs)} medicamentos, {len(kb.rules)} regras, {len(kb.interactions)} interações, {len(kb.sources)} fontes"
    (out / "README.md").write_text(README.format(owner_repo=args.repo, version=manifest["kb_version"], counts=counts, license=args.license), encoding="utf-8")
    template = out / ".github" / "ISSUE_TEMPLATE" / "erro-no-conteudo.md"
    template.parent.mkdir(parents=True, exist_ok=True)
    template.write_text(ISSUE, encoding="utf-8")
    print(f"exportado em {out}: {counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
