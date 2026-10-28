# Stabilis — webapp

Interface Next.js do Stabilis (hospedada na Vercel). Ferramenta experimental e educacional: não substitui avaliação profissional e não é prescrição.

## Como funciona

- **Motor de decisão no navegador** (`app/lib/engine/`): funções puras em TypeScript que combinam a base de conhecimento com o perfil informado e devolvem opções por linha de diretriz, alertas, interações e a revisão dos medicamentos em uso. Antes de devolver, o motor confere invariantes de segurança; se alguma falha, oculta o conteúdo sobre medicamentos.
- **Base de conhecimento** (`app/lib/kb/kb.generated.json`): cópia gerada de `knowledge/` (raiz do repositório), com hash de conteúdo. Não edite à mão:

  ```bash
  python scripts/build_kb.py          # depois de editar knowledge/
  python scripts/build_kb.py --check  # confere se a cópia está atualizada (CI)
  ```

- **Serviço de linguagem** (Space no Hugging Face): só para “Extrair do texto” no modo profissional.

Rotas:

- `/`: as duas entradas.
- Paciente (`/paciente/...`): consentimento e escolha de armazenamento, `seguranca` (triagem de risco primeiro), `crise`, `perfil`, `relato`, `questionarios/[instrumento]` (uma pergunta por tela), `historico`, `prioridades`, `resultado` e `relatorio` (para levar ao médico: imprimir, compartilhar com aviso, baixar o arquivo de respostas). As respostas ficam só no navegador (`app/lib/patient/store.ts`).
- Profissional: `/profissional` (formulário), `/profissional/resultado`, `/profissional/receita` (revisão de receita).
- `/fontes`, `/privacidade`, `/ajuda-agora`, `/about`.

O pacote da base que vai ao navegador (`kb.client.generated.json`) não tem os trechos citados nem os nomes comerciais: os trechos vêm de `/kb-quotes.json` quando alguém abre uma citação, e as marcas de `brands.client.generated.json`, só na busca de medicamentos.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha. As duas variáveis são **só de servidor** — o navegador nunca as recebe:

| Variável | Para quê |
|---|---|
| `STABILIS_API_URL` | URL do Space da API (ex.: `https://amaroguilherme-stabilis-api.hf.space`) |
| `HF_SPACE_TOKEN` | Token *fine-grained* do Hugging Face com leitura apenas do Space privado |

Nunca use o prefixo `NEXT_PUBLIC_` para segredos: o Next.js copia essas variáveis para o JavaScript enviado ao navegador.

Na Vercel, configure as mesmas variáveis em *Settings → Environment Variables*.

## Como o navegador fala com a API

O navegador chama apenas `/api/backend/*` (mesma origem). A rota `app/api/backend/[...path]/route.ts` repassa ao Space, com o token, somente:

- `POST /jobs` — envia um texto para extração (`{"kind": "extract", ...}`)
- `GET /jobs/<id>` e `DELETE /jobs/<id>` — acompanha ou cancela
- `GET /ready` — estado do servidor

As extrações rodam como *jobs* (envia → consulta até terminar), o que sobrevive ao cold start do Space e ao limite de duração das funções da Vercel. O cliente fica em `app/lib/api/client.ts`.

## Detecção de crise

`app/lib/safety/crisis.ts` detecta, sem IA, menções a suicídio e autolesão. O léxico canônico fica em `knowledge/lexicons/crisis.pt-BR.json` e é copiado para `app/lib/kb/crisis.generated.json` pelo mesmo `build_kb.py`. Os mesmos vetores de teste (`knowledge/tests/crisis.vectors.json`) rodam no Python e aqui.

## Testes

`npm test` roda, com o test runner do Node:

- os vetores de crise;
- os testes do motor: unitários, os vetores de conformidade de `knowledge/tests/engine/*.json` (cenários do plano e os antigos T1–T11) e 5.000 perfis aleatórios com semente, conferindo invariantes e determinismo.

Testes no navegador (jornadas do paciente e do profissional, com axe-core): veja `e2e/README.md`.

## Comandos

```bash
npm run dev     # http://localhost:3000
npm run lint
npm test        # Node 22.18+ ou 23.6+ (remove os tipos do TypeScript sem compilar)
npm run build
```
