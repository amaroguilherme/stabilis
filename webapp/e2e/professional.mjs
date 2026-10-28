// Professional journey in a real browser: form → result → prescription review, with axe-core.
import { checker, openPage } from "./cdp.mjs";

const { check, failures } = checker();
const page = await openPage();
const a11y = [];
async function scan(name) {
  for (const v of await page.axe()) a11y.push(`${name}: ${v.id} (${v.impact}, ${v.nodes}×) ${v.help} — ${v.target}`);
}
async function addMed(query, pick = true) {
  await page.js(`__setValue(document.querySelector('input[role=combobox]'), ${JSON.stringify(query)}); true`);
  await page.sleep(250);
  if (pick) await page.js(`document.querySelector('[role=listbox] button').click(); true`);
  await page.sleep(150);
  await page.click("Adicionar");
  await page.sleep(200);
}

await page.goto("/");
await scan("início");
check("início mostra as duas entradas", (await page.text()).includes("Para você, paciente"));

await page.goto("/profissional");
await page.js("sessionStorage.clear(); true");
await page.goto("/profissional");
await scan("formulário");
await page.js(`__setValue(document.querySelector('input[type=number]'), "30"); true`);
await page.js(`document.querySelector('input[type=radio][value=female]').click(); true`);
await page.sleep(200);
await page.js(`document.querySelector('input[type=radio][value=unsure]').click(); true`);
await page.js(`__setValue(document.querySelector('select'), "bipolar_1"); true`);
await page.sleep(200);
await page.js(`__setValue(document.querySelectorAll('select')[1], "mania"); true`);
await addMed("Depakote 500mg");
await addMed("ibuprofeno 600 mg 2x");
await addMed("remédio azul", false);
await page.click("Adicionar “remédio azul”");
await page.sleep(200);
await page.click("Ver opções por diretriz");
check("navega para o resultado", await page.waitForPath("/profissional/resultado"));
await scan("resultado");
const text = await page.text();
check("valproato em evitar neste perfil", /Evitar neste perfil[\s\S]*Valproato/.test(text));
check("texto digitado preservado", text.includes("Informado: “Depakote 500mg”"));
check("não reconhecido visível", text.includes("Não reconhecido") && text.includes("remédio azul"));
check("antidepressivos não recomendados agrupados", text.includes("Inclui:"));
check("cartões mostram titulação e retirada com fonte (carregadas à parte)", text.includes("Titulação · ") && text.includes("Retirada gradual · "));

await page.goto("/profissional/receita");
await scan("receita");
await addMed("carbonato de lítio 300 mg 3x");
await addMed("ibuprofeno 600 mg");
await page.sleep(300);
const review = await page.text();
check("receita: interação lítio + ibuprofeno", /Ibuprofeno pode elevar a litemia/.test(review));
check("receita: lítio 900 mg dentro da faixa", review.includes("Dentro da faixa usual da bula"));
check("receita: quando dosar a litemia", /Litemia|litemia/.test(review) && review.includes("após 3 dias"));

for (const path of ["/about", "/fontes", "/privacidade", "/ajuda-agora"]) {
  await page.goto(path);
  await scan(path);
}

console.log(a11y.length ? `ACESSIBILIDADE (${a11y.length}):\n${a11y.join("\n")}` : "acessibilidade: nenhuma violação do axe");
console.log(page.problems.length ? `CONSOLE:\n${page.problems.join("\n")}` : "console sem erros");
await page.close();
process.exit(failures || a11y.length || page.problems.length ? 1 : 0);
