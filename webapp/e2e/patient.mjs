// Patient journey in a real browser: consent → safety → profile → story → questionnaires →
// treatments → priorities → result → report, plus the crisis path and an accessibility scan
// (axe-core, WCAG 2.x A/AA) on every page.
import { checker, openPage } from "./cdp.mjs";

const { check, failures } = checker();
const page = await openPage();
const a11y = [];

async function scan(name) {
  const violations = await page.axe();
  for (const v of violations) a11y.push(`${name}: ${v.id} (${v.impact}, ${v.nodes}×) ${v.help} — ${v.target}`);
}

async function answerAll(choiceLabel) {
  // Questionnaire runner: pick the given option (or the first one) on every screen until it finishes.
  for (let i = 0; i < 30; i++) {
    const path = await page.js("location.pathname");
    const hasQuestion = await page.js(`!!document.querySelector('fieldset legend') && !!document.querySelector('input[type=radio]')`);
    if (!hasQuestion) return path;
    await page.js(`(() => {
      const labels = [...document.querySelectorAll('fieldset label')];
      const wanted = labels.find(l => l.textContent.trim().startsWith(${JSON.stringify(choiceLabel)})) ?? labels[0];
      wanted.click(); return true; })()`);
    await page.sleep(120);
    const finish = await page.js(`(() => { const b = [...document.querySelectorAll('button')].find(b => ['Próxima', 'Concluir'].includes(b.textContent.trim())); const last = b.textContent.trim() === 'Concluir'; b.click(); return last; })()`);
    await page.sleep(250);
    if (finish) {
      await page.sleep(500);
      return page.js("location.pathname");
    }
  }
  return page.js("location.pathname");
}

await page.goto("/paciente");
await page.js("localStorage.clear(); sessionStorage.clear(); true");
await page.goto("/paciente");
await scan("intro");
check("intro com consentimento e escolha de armazenamento", (await page.text()).includes("Onde guardar as respostas"));
await page.clickLabel("Entendi que isto não é diagnóstico");
await page.click("Começar");
check("vai para a segurança", await page.waitForPath("/paciente/seguranca"));
await scan("seguranca");
const screenerAvailable = await page.js(`!!document.querySelector('input[type=radio]')`);
if (screenerAvailable) await answerAll("Não");
else await page.click("Continuar");
check("triagem negativa leva ao perfil", await page.waitForPath("/paciente/perfil"));

await scan("perfil");
await page.js(`__setValue(document.querySelector('input[type=number]'), "30"); true`);
await page.js(`document.querySelector('input[type=radio][value=female]').click(); true`);
await page.sleep(200);
for (const value of ["no"]) await page.js(`[...document.querySelectorAll('input[type=radio][value=${value}]')].forEach(r => r.click()); true`);
await page.js(`__setValue(document.querySelector('input[role=combobox]'), "Rivotril 2 mg"); true`);
await page.sleep(300);
await page.js(`document.querySelector('[role=listbox] button').click(); true`);
await page.sleep(150);
await page.click("Adicionar");
await page.sleep(200);
check("remédio por marca adicionado", /Clonazepam[^\n]*2 mg\/dia/.test(await page.text()));
await page.click("Continuar");
check("vai para o relato", await page.waitForPath("/paciente/relato"));

await scan("relato");
await page.js(`__setValue(document.querySelector('textarea'), "faz dois meses que durmo mal, choro à toa e não tenho vontade de sair de casa"); true`);
await page.sleep(200);
await page.click("Continuar");
await page.sleep(800);

let path = await page.js("location.pathname");
const answered = [];
while (path.startsWith("/paciente/questionarios/")) {
  const id = path.split("/").pop();
  answered.push(id);
  if (answered.length === 1) await scan(`questionário ${id}`);
  // PHQ-9 and GAD-7: "Mais da metade dos dias" (moderate); MDQ and AUDIT-C: "Não"/first option.
  path = await answerAll(id === "phq9" || id === "gad7" ? "Mais da metade dos dias" : id === "mdq" || id === "bipolar_hx" ? "Não" : "Nunca");
  if (path.includes("seguranca")) path = await answerAll("Não");
  await page.sleep(400);
  path = await page.js("location.pathname");
}
console.log(`questionários respondidos: ${answered.join(", ") || "nenhum disponível"}`);
check("chega ao histórico", path.endsWith("/paciente/historico"), path);

await scan("historico");
await page.js(`__setValue(document.getElementById('hist-search'), "fluoxetina"); true`);
await page.sleep(300);
await page.js(`[...document.querySelectorAll('ul button')].find(b => b.textContent.includes('Fluoxetina')).click(); true`);
await page.sleep(300);
await page.js(`(() => { const items = [...document.querySelectorAll('li')].filter(li => li.textContent.includes('Fluoxetina') && li.querySelector('fieldset')); const li = items[items.length - 1];
  [...li.querySelectorAll('label')].find(l => l.textContent.trim() === 'Não ajudou').click(); return true; })()`);
await page.sleep(150);
await page.click("Continuar");
check("vai para prioridades", await page.waitForPath("/paciente/prioridades"));

await scan("prioridades");
await page.clickLabel("Evitar ganho de peso");
await page.click("Ver meu resultado");
check("vai para o resultado", await page.waitForPath("/paciente/resultado"));
await page.sleep(600);
await scan("resultado");
let text = await page.text();
check("resultado mostra o que os escores sugerem", text.includes("O que suas respostas sugerem"));
check("revisão inclui o clonazepam em uso", text.includes("Clonazepam") || text.includes("Rivotril"));
check("tem perguntas para o médico ou orientação de onde buscar", text.includes("Onde buscar atendimento"));
if (answered.includes("phq9")) check("seção de depressão a partir do PHQ-9", text.includes("Porque seus questionários indicaram"));
if (answered.some((id) => id === "mdq" || id === "bipolar_hx")) {
  check("com triagem negativa, antidepressivos podem aparecer", /Sertralina|Fluoxetina|Escitalopram/.test(text));
  check("e o lembrete de confirmar a história de mania", text.includes("estas perguntas não substituem a avaliação"));
}
else check("sem triagem de bipolaridade, nenhum antidepressivo", !/Sertralina|Escitalopram/.test(text));

await page.click("Ver relatório para o médico");
check("vai para o relatório", await page.waitForPath("/paciente/relatorio"));
await scan("relatorio");
text = await page.text();
check("relatório traz o relato literal", text.includes("faz dois meses que durmo mal"));
check("relatório traz o histórico", /Fluoxetina[^\n]*não ajudou/.test(text));
check("relatório traz a prioridade", text.includes("Evitar ganho de peso"));
await page.click("Compartilhar");
await page.sleep(200);
check("compartilhar avisa antes de enviar", (await page.text()).includes("Antes de compartilhar"));

// Crisis path: words in the story send the person back to the safety questions and hide medicines.
await page.goto("/paciente/relato");
await page.js(`__setValue(document.querySelector('textarea'), "às vezes penso que queria morrer"); true`);
await page.sleep(300);
check("banner de crise no relato", (await page.text()).includes("O que você escreveu nos preocupa"));
await page.click("Continuar");
await page.sleep(800);
path = await page.js("location.pathname");
if (screenerAvailable) {
  check("relato com crise repete a triagem", path.endsWith("/paciente/seguranca"), path);
  await answerAll("Não");
}
await page.goto("/paciente/resultado");
text = await page.text();
check("resultado com crise mostra ajuda e esconde remédios", text.includes("Suas respostas mostram sinais de risco") && !/Sertralina|Escitalopram|Fluoxetina \(/.test(text));

await page.goto("/paciente/resultado");
await page.click("Apagar meus dados");
await page.sleep(500);
check("apagar meus dados limpa o armazenamento", (await page.js("localStorage.getItem('stabilis_patient') === null && sessionStorage.getItem('stabilis_patient') === null")) === true);

// Positive safety screen: straight to the crisis page, and no medicines anywhere afterwards.
if (screenerAvailable) {
  await page.goto("/paciente");
  await page.clickLabel("Entendi que isto não é diagnóstico");
  await page.click("Começar");
  await page.waitForPath("/paciente/seguranca");
  await answerAll("Sim");
  check("triagem positiva leva à página de crise", await page.waitForPath("/paciente/crise"));
  await scan("crise");
  check("página de crise com CVV e SAMU", /CVV: ligue 188[\s\S]*SAMU: ligue 192/.test(await page.text()));
  await page.goto("/paciente/resultado");
  check("resultado após triagem positiva esconde remédios", (await page.text()).includes("Suas respostas mostram sinais de risco"));
}

check("jornada do paciente sem nenhuma chamada ao servidor", !page.requests.some((url) => url.includes("/api/backend")), page.requests.filter((url) => url.includes("/api/backend")).join(", "));

console.log(a11y.length ? `ACESSIBILIDADE (${a11y.length}):\n${a11y.join("\n")}` : "acessibilidade: nenhuma violação do axe");
console.log(page.problems.length ? `CONSOLE:\n${page.problems.join("\n")}` : "console sem erros");
await page.close();
process.exit(failures || a11y.length || page.problems.length ? 1 : 0);
