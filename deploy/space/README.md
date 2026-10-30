---
title: Stabilis API
emoji: 🧭
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: other
short_description: Serviço de linguagem do Stabilis (extração de texto)
---

# Stabilis API

Serviço de linguagem do [Stabilis](https://stabilis.vercel.app): transforma texto livre em sugestões
estruturadas, cada uma com o trecho do texto que a sustenta. As opções de tratamento **não** são
calculadas aqui; elas vêm da base de conhecimento, no navegador.

Este arquivo é o `README.md` do Space. O Space recebe só os arquivos abaixo, copiados do
repositório principal (o Space não guarda o resto do projeto):

```
README.md          <- deploy/space/README.md
Dockerfile
requirements.txt
app.py
gunicorn.conf.py
api/
core/
knowledge/         (sem knowledge/tests)
```

## Configuração do Space

| tipo | nome | conteúdo |
|---|---|---|
| secret | `HF_TOKEN` | token com leitura do repositório privado do modelo |
| variable | `MODEL_REPO_ID` | repositório do GGUF |
| variable | `MODEL_FILENAME` | arquivo GGUF |
| variable | `MODEL_REVISION` | hash do commit do modelo aprovado nos portões (opcional, recomendado) |
| variable | `EXTRACTION_PROMPT` | `short` só para um modelo ajustado com o prompt curto (finetune/); sem a variável, usa o prompt completo |
| variable | `LLM_THREADS` | `2` (CPU Basic) |

Não é mais preciso o secret `GITHUB_TOKEN` (a dependência privada `qyra` saiu do projeto).

## Endpoints

- `GET /health`: processo no ar.
- `GET /ready`: 200 quando a base de conhecimento é válida e o modelo carregou; 503 antes disso.
- `POST /jobs` com `{"kind": "extract", "input": {"task": "patient" | "professional", "text": "..."}}`.
- `GET /jobs/<id>` e `DELETE /jobs/<id>`.
- `POST /analyze`, `/reanalyze` e `/audit` respondem 410 (removidos).

Nada é gravado em disco nem registrado em log além de contagens e tipos de erro.

## Publicação

Feita a partir do repositório principal, só com autorização do responsável. O histórico atual do
Space contém arquivos de dados com licença que proíbe uso clínico (Broad Repurposing Hub, SIDER);
a publicação recomendada é um commit único com a árvore acima, substituindo o histórico (`push --force`):

```bash
python scripts/build_space.py --out /tmp/stabilis-space      # monta a árvore acima e valida a base
cd /tmp/stabilis-space && git init -b main && git add -A && git commit -m "Deploy the language service"
git push --force https://huggingface.co/spaces/amaroguilherme/stabilis-api main
```

O `git push` pede usuário e senha: use o seu usuário do Hugging Face e um token com escrita no Space.
