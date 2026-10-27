# Stabilis — webapp

Interface Next.js do Stabilis (hospedada na Vercel). Ferramenta experimental e educacional: não substitui avaliação profissional e não é prescrição.

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

- `POST /jobs` — envia uma análise
- `GET /jobs/<id>` e `DELETE /jobs/<id>` — acompanha ou cancela
- `GET /ready` — estado do servidor

As análises rodam como *jobs* (envia → consulta até terminar), o que sobrevive ao cold start do Space e ao limite de duração das funções da Vercel. O cliente fica em `app/lib/api/client.ts`.

## Detecção de crise

`app/lib/safety/crisis.ts` detecta, sem IA, menções a suicídio e autolesão. O léxico canônico fica em `knowledge/lexicons/crisis.pt-BR.json` (raiz do repositório) e é copiado para `app/lib/kb/crisis.generated.json` por:

```bash
python scripts/build_kb.py          # depois de editar knowledge/
python scripts/build_kb.py --check  # confere se a cópia está atualizada
```

Os mesmos vetores de teste (`knowledge/tests/crisis.vectors.json`) rodam no Python e aqui.

## Comandos

```bash
npm run dev     # http://localhost:3000
npm run lint
npm test        # testes com o test runner do Node (Node 22.18+ ou 23.6+)
npm run build
```
