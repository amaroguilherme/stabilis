# Testes de ponta a ponta (navegador real)

Rodam as jornadas no app compilado, num Chrome sem interface, e passam o axe-core (WCAG 2.x A/AA) em cada página.

```bash
cd webapp
npm run build && npx next start -p 3100 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9223 \
  --user-data-dir=/tmp/chrome-e2e about:blank &      # no Linux: google-chrome --headless=new ...
node e2e/patient.mjs
node e2e/professional.mjs
node e2e/tools.mjs     # receita, acompanhamento, plano de segurança e a ponte paciente → profissional
```

Saem com código 1 se alguma checagem falhar, se o axe apontar violação ou se houver erro no console.
O `patient.mjs` também confere que a jornada do paciente não faz nenhuma chamada ao servidor.

As sugestões do modelo no modo paciente (desligadas por padrão) têm um teste à parte, com a chave ligada e um backend
local que usa o app Flask de verdade com um modelo simulado:

```bash
NEXT_PUBLIC_PATIENT_SUGGESTIONS=on npm run build
../venv/bin/python e2e/fake_backend.py &          # http://127.0.0.1:7861
STABILIS_API_URL=http://127.0.0.1:7861 HF_SPACE_TOKEN=teste npx next start -p 3100 &
node e2e/suggestions.mjs
```

Depois, compile de novo sem a chave antes de rodar os outros testes.

O uso sem internet (service worker) tem um teste em dois passos, com o servidor desligado no meio e o mesmo
perfil do Chrome:

```bash
node e2e/offline.mjs prepare       # servidor ligado: instala o service worker e abre páginas
# desligue o servidor (Ctrl+C no next start)
node e2e/offline.mjs check         # servidor desligado: as páginas vêm do cache
```
A acessibilidade automática não substitui o teste com leitor de tela (TalkBack) nem as sessões com pessoas.
