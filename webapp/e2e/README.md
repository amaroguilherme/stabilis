# Testes de ponta a ponta (navegador real)

Rodam as jornadas no app compilado, num Chrome sem interface, e passam o axe-core (WCAG 2.x A/AA) em cada página.

```bash
cd webapp
npm run build && npx next start -p 3100 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9223 \
  --user-data-dir=/tmp/chrome-e2e about:blank &      # no Linux: google-chrome --headless=new ...
node e2e/patient.mjs
node e2e/professional.mjs
```

Saem com código 1 se alguma checagem falhar, se o axe apontar violação ou se houver erro no console.
A acessibilidade automática não substitui o teste com leitor de tela (TalkBack) nem as sessões com pessoas.
