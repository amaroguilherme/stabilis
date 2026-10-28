// Minimal Chrome DevTools Protocol driver for the end-to-end checks (no test framework needed).
// Chrome must be running with --remote-debugging-port (see e2e/README.md).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function openPage({ base = "http://localhost:3100", port = 9223 } = {}) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  let seq = 0;
  const pending = new Map();
  const problems = [];
  const requests = []; // every URL the page requested, to prove what never reaches the server
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id) {
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") problems.push(`exception: ${(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).slice(0, 300)}`);
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") problems.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300)}`);
    if (msg.method === "Network.requestWillBeSent") requests.push(msg.params.request.url);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  const js = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expression.slice(0, 80)} → ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");

  const helpers = `
    window.__setValue = (el, value) => {
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    };
    window.__button = (text) => [...document.querySelectorAll("button, a")].find((b) => b.textContent.trim().startsWith(text));
    window.__label = (text) => [...document.querySelectorAll("label")].find((l) => l.textContent.trim().startsWith(text));
    true`;

  const page = {
    problems,
    requests,
    js,
    sleep,
    send,
    async goto(path) {
      await send("Page.navigate", { url: base + path });
      for (let i = 0; i < 80; i++) {
        await sleep(100);
        if ((await js("document.readyState")) === "complete") break;
      }
      await sleep(600);
      await js(helpers);
    },
    async waitForPath(suffix, timeout = 6000) {
      for (let waited = 0; waited < timeout; waited += 100) {
        if ((await js("location.pathname")).endsWith(suffix)) {
          await sleep(500);
          await js(helpers);
          return true;
        }
        await sleep(100);
      }
      return false;
    },
    text: () => js("document.body.innerText"),
    click: (text) => js(`(() => { const el = __button(${JSON.stringify(text)}); if (!el) throw new Error("botão não encontrado: " + ${JSON.stringify(text)}); el.click(); return true; })()`),
    clickLabel: (text) => js(`(() => { const el = __label(${JSON.stringify(text)}); if (!el) throw new Error("opção não encontrada: " + ${JSON.stringify(text)}); el.click(); return true; })()`),
    async axe() {
      const source = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
      await js(source + "; true");
      return js(`axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, target: v.nodes[0]?.target?.join(" ") })))`);
    },
    close: async () => {
      await send("Target.closeTarget", { targetId: target.id }).catch(() => {});
      ws.close();
    },
  };
  return page;
}

export function checker() {
  let failures = 0;
  return {
    check(label, ok, detail = "") {
      console.log(`${ok ? "OK  " : "FAIL"} ${label}${!ok && detail ? ` — ${detail}` : ""}`);
      if (!ok) failures++;
    },
    get failures() {
      return failures;
    },
  };
}
