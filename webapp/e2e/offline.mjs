// Offline support (public/sw.js), in two steps around stopping the server:
//   node e2e/offline.mjs prepare     # server running: installs the service worker, opens pages
//   (stop the server)
//   node e2e/offline.mjs check       # server stopped: pages come from the offline cache
// The Chrome profile must be the same in both steps (same --user-data-dir).
import { checker, openPage } from "./cdp.mjs";

const step = process.argv[2];
const checks = checker();
const { check } = checks;
const page = await openPage();

if (step === "prepare") {
  await page.goto("/");
  const manifest = await page.js(`fetch('/manifest.webmanifest').then(r => r.json())`);
  check("manifesto com nome, ícones e atalho para a ajuda", manifest.short_name === "Stabilis" && manifest.icons.length >= 2 && manifest.shortcuts.some((s) => s.url === "/ajuda-agora"));
  const headers = await page.js(`fetch('/', { cache: 'no-store' }).then(r => ({ frame: r.headers.get('x-frame-options'), referrer: r.headers.get('referrer-policy'), permissions: r.headers.get('permissions-policy') }))`);
  check("cabeçalhos de segurança", headers.frame === "DENY" && headers.referrer === "no-referrer" && headers.permissions?.includes("microphone=(self)"), JSON.stringify(headers));
  const active = await page.js(`navigator.serviceWorker.ready.then(r => !!r.active)`);
  check("service worker ativo", active === true);
  await page.goto("/");
  check("página controlada pelo service worker", (await page.js(`!!navigator.serviceWorker.controller`)) === true);
  const precached = await page.js(`caches.keys().then(async keys => { for (const k of keys) { if (await (await caches.open(k)).match('/ajuda-agora')) return true; } return false; })`);
  check("página de crise guardada desde a instalação", precached === true);
  await page.goto("/paciente/plano-de-seguranca");
  await page.sleep(1500);
  check("plano de segurança aberto com conexão", (await page.text()).includes("Meu plano de segurança"));
} else if (step === "check") {
  await page.goto("/ajuda-agora");
  check("sem servidor, a página de crise abre", (await page.text()).includes("Precisa de ajuda agora?"));
  await page.goto("/paciente/plano-de-seguranca");
  await page.sleep(1500);
  const text = await page.text();
  check("sem servidor, o plano de segurança já visitado funciona", text.includes("Meu plano de segurança") && (await page.js(`!!document.getElementById('answer-warning_signs')`)) === true);
  await page.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.goto("/ajuda-agora");
  check("com o aparelho sem conexão, avisa e mantém a ajuda", (await page.text()).includes("Sem conexão") && (await page.text()).includes("Precisa de ajuda agora?"));
  await page.goto(`/pagina-nunca-aberta-${Date.now()}`);
  check("rota nunca visitada cai na página de crise", (await page.text()).includes("Precisa de ajuda agora?"));
} else {
  console.error("uso: node e2e/offline.mjs prepare|check");
  process.exit(2);
}

console.log(page.problems.length ? `CONSOLE:\n${page.problems.join("\n")}` : "console sem erros");
await page.close();
process.exit(checks.failures || page.problems.length ? 1 : 0);
