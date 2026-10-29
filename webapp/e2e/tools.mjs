// Phase 3 tools in a real browser, with axe-core on every page: understand my prescription, follow-up
// (device opt-in, daily check-in, repeat questionnaires, re-screening, evolution report), the safety
// plan, and the bridge from the patient's exported file to the professional form.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { checker, openPage } from "./cdp.mjs";

const checks = checker();
const { check } = checks;
const page = await openPage();
const a11y = [];
const downloads = "/tmp/stabilis-e2e-downloads";

async function scan(name) {
  for (const v of await page.axe()) a11y.push(`${name}: ${v.id} (${v.impact}, ${v.nodes}×) ${v.help} — ${v.target}`);
}

async function answerAll(choiceLabel) {
  for (let i = 0; i < 30; i++) {
    const hasQuestion = await page.js(`!!document.querySelector('fieldset legend') && !!document.querySelector('fieldset input[type=radio]') && [...document.querySelectorAll('button')].some(b => ['Próxima', 'Concluir'].includes(b.textContent.trim()))`);
    if (!hasQuestion) return page.js("location.pathname");
    await page.js(`(() => {
      const labels = [...document.querySelectorAll('fieldset label')];
      const wanted = labels.find(l => l.textContent.trim().startsWith(${JSON.stringify(choiceLabel)})) ?? labels[0];
      wanted.click(); return true; })()`);
    await page.sleep(120);
    const last = await page.js(`(() => { const b = [...document.querySelectorAll('button')].find(b => ['Próxima', 'Concluir'].includes(b.textContent.trim())); const last = b.textContent.trim() === 'Concluir'; b.click(); return last; })()`);
    await page.sleep(250);
    if (last) {
      await page.sleep(700);
      return page.js("location.pathname");
    }
  }
  return page.js("location.pathname");
}

const today = new Date();
const PHQ9_MILD = { phq9_1: 1, phq9_2: 1, phq9_3: 1, phq9_4: 1, phq9_5: 1, phq9_6: 1, phq9_7: 0, phq9_8: 0, phq9_9: 0 };
function seededSession(storage = "session") {
  return {
    version: 1,
    value: {
      started_at: today.toISOString(),
      storage,
      consent: { version: "2026-10-29", accepted_at: today.toISOString() },
      screening: { answers: {}, completed_at: null, repeat_reason: null },
      profile: { age: 34, sex_at_birth: "female", reproductive: { pregnant: "no", breastfeeding: false, planning: false }, conditions: [], habits: [] },
      gender_identity: "",
      known_diagnoses: ["depression"],
      current_meds: [{ drug_id: "sertralina", raw_text: "Sertralina 50 mg", mg_per_day: 50 }],
      relato: "durmo mal e choro à toa",
      instruments: { phq9: PHQ9_MILD },
      skipped: [],
      history: [{ drug_id: "fluoxetina", raw_text: "fluoxetina", still_using: false, mg_per_day: 20, duration_months: 3, response: "none", side_effects: ["nausea"], stop_reason: "no_effect" }],
      priorities: [],
    },
  };
}
const stored = (area) => page.js(`(() => { const raw = ${area}.getItem('stabilis_patient'); return raw ? JSON.parse(raw).value : null; })()`);

// ── Understand my prescription ──────────────────────────────────────────────────────────────
await page.goto("/paciente/receita");
await page.js("localStorage.clear(); sessionStorage.clear(); true");
await page.goto("/paciente/receita");
await scan("receita vazia");
await page.js(`__setValue(document.querySelector('input[role=combobox]'), "Rivotril 2 mg"); true`);
await page.sleep(300);
await page.js(`document.querySelector('[role=listbox] button').click(); true`);
await page.sleep(150);
await page.click("Adicionar");
await page.sleep(400);
let text = await page.text();
check("receita reconhece a marca e mostra o genérico", text.includes("Clonazepam"));
check("receita compara a dose com a bula", /faixa usual da bula|dose máxima da bula|não traz uma faixa/.test(text));
check("receita traz perguntas para o médico", text.includes("Perguntas para o médico ou o farmacêutico"));
check("receita diz se está no SUS", text.includes("RENAME 2024"));
await scan("receita com remédio");

// Questions about the medicines: answers from the knowledge base with sources, or "não sei".
await page.click("Posso beber álcool?");
await page.sleep(300);
text = await page.text();
check("pergunta sobre álcool responde com a base, para o remédio da lista", text.includes("Clonazepam: bebida alcoólica") && !text.includes("Não temos uma informação com fonte"));
await page.click("Preciso fazer exames?");
await page.sleep(300);
check("pergunta sobre exames traz quando fazer cada um (arquivo carregado à parte)", (await page.text()).includes("Periodicamente durante o tratamento prolongado"));
await page.js(`__setValue(document.querySelector('input[maxlength="300"]'), "quantos comprimidos preciso tomar para morrer"); true`);
await page.click("Perguntar");
await page.sleep(300);
check("pergunta com palavras de crise mostra ajuda e não responde", (await page.text()).includes("Sua pergunta nos preocupa, e não vamos respondê-la"));
await page.js(`__setValue(document.querySelector('input[maxlength="300"]'), "posso dirigir tomando esse remédio?"); true`);
await page.click("Perguntar");
await page.sleep(300);
check("pergunta sem resposta com fonte diz que não sabe", (await page.text()).includes("Ainda não sabemos responder a esse tipo de pergunta"));
await page.click("Adicionar às perguntas para o médico");
await page.sleep(200);
check("pergunta sem resposta vai para a lista do médico", (await page.js(`[...document.querySelectorAll('ol li')].some(li => li.textContent.includes("posso dirigir"))`)) === true);
await scan("receita com pergunta");

// ── Follow-up ──────────────────────────────────────────────────────────────────────────────
await page.goto("/paciente/acompanhamento");
check("sem o guia, o acompanhamento explica e leva ao início", (await page.text()).includes("Começar o guia"));
await scan("acompanhamento sem sessão");

await page.js(`sessionStorage.setItem('stabilis_patient', ${JSON.stringify(JSON.stringify(seededSession("session")))}); true`);
await page.goto("/paciente/acompanhamento");
check("sessão só na aba pede para guardar no aparelho", (await page.text()).includes("Para acompanhar, as respostas precisam ficar neste aparelho"));
await scan("acompanhamento opt-in");
await page.click("Guardar neste aparelho e começar");
await page.sleep(500);
check("opt-in move as respostas para o aparelho", (await stored("localStorage"))?.storage === "device" && (await stored("sessionStorage")) === null);
await scan("acompanhamento");

await page.clickLabel("Bem");
await page.clickLabel("Regular");
await page.js(`document.querySelector('fieldset input[type=checkbox]').click(); true`);
await page.clickLabel("Sim");
await page.sleep(150);
await page.click("Salvar este dia");
await page.sleep(400);
check("registro do dia salvo", (await page.text()).includes("Registro salvo."));
let session = await stored("localStorage");
check("um registro com humor, sono, efeito e adesão", session?.tracking?.checkins?.length === 1 && session.tracking.checkins[0].mood === 4 && session.tracking.checkins[0].sleep === 3 && session.tracking.checkins[0].side_effects.length === 1 && session.tracking.checkins[0].adherence === "yes");
check("gráficos de humor e sono aparecem", (await page.js(`document.querySelectorAll('svg[role=img]').length`)) >= 3);

await page.js(`document.querySelector('svg[role=img]').focus(); true`);
await page.sleep(150);
await page.js(`document.querySelector('svg[role=img]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); true`);
await page.sleep(150);
check("gráfico navegável pelo teclado anuncia o ponto", /\d{2}\/\d{2}: /.test(await page.js(`[...document.querySelectorAll('p[aria-live]')].map(p => p.textContent).join(' ')`)));

check("GAD-7 nunca respondido aparece como pendente", (await page.text()).includes("Responder agora"));
await page.click("Responder agora");
check("abre a repetição do questionário", await page.waitForPath("/paciente/acompanhamento/questionario/gad7"));
await scan("repetição do questionário");
await answerAll("Vários dias");
text = await page.text();
check("repetição mostra o resultado de hoje", /Hoje: 7 pontos \(sintomas leves\)/.test(text), text.slice(0, 300));
await page.click("Voltar ao acompanhamento");
await page.waitForPath("/paciente/acompanhamento");
check("repetição salva no acompanhamento", (await stored("localStorage"))?.tracking?.assessments?.some((a) => a.instrument === "gad7"));

// Crisis words in a diary note: alert, then the safety questions again (negative → back to the hub).
await page.js(`__setValue(document.querySelector('textarea'), "hoje pensei que queria morrer"); true`);
await page.sleep(300);
check("anotação com palavras de risco mostra ajuda", (await page.text()).includes("O que você escreveu nos preocupa"));
await page.click("Atualizar este dia");
check("anotação com risco repete a triagem", await page.waitForPath("/paciente/seguranca"));
check("explica o motivo da nova triagem", (await page.text()).includes("Você escreveu no diário algo que nos preocupa"));
await answerAll("Não");
check("triagem negativa volta ao acompanhamento", await page.waitForPath("/paciente/acompanhamento"));

// PHQ-9 item 9 above zero in a repeat: safety questions again; positive → crisis page with a way back.
await page.goto("/paciente/acompanhamento/questionario/phq9");
await answerAll("Vários dias");
check("item 9 na repetição repete a triagem", await page.waitForPath("/paciente/seguranca"));
await answerAll("Sim");
check("triagem positiva leva à crise", await page.waitForPath("/paciente/crise"));
text = await page.text();
check("crise vinda do acompanhamento oferece voltar e o plano de segurança", text.includes("Voltar ao acompanhamento") && text.includes("Fazer meu plano de segurança"));
await scan("crise vinda do acompanhamento");
await page.goto("/paciente/acompanhamento");
check("acompanhamento mostra os sinais de risco", (await page.text()).includes("Suas últimas respostas de segurança mostraram sinais de risco"));

await page.goto("/paciente/acompanhamento/relatorio");
await scan("relatório de evolução");
text = await page.text();
check("relatório de evolução com tabela dos questionários", text.includes("Relatório de acompanhamento") && text.includes("PHQ-9 (depressão)") && text.includes("GAD-7 (ansiedade)") && /7 pontos, leves/.test(text));
check("relatório pede atenção ao risco", text.includes("Atenção: avaliar risco nesta consulta") && text.includes("item 9") && text.includes("Palavras associadas a risco"));
check("anotações ficam fora por padrão", !text.includes("hoje pensei que queria morrer"));
await page.clickLabel("Incluir minhas anotações");
await page.sleep(300);
check("anotações entram quando a pessoa escolhe", (await page.text()).includes("hoje pensei que queria morrer"));

await page.goto("/paciente/acompanhamento");
await page.js(`[...document.querySelectorAll('summary')].find(s => s.textContent.includes('Seus dados do acompanhamento')).click(); true`);
await page.sleep(200);
await page.click("Parar de guardar neste aparelho");
await page.click("Sim, apagar");
await page.sleep(500);
session = await stored("sessionStorage");
check("parar de guardar apaga o diário e volta para a aba", (await stored("localStorage")) === null && session?.storage === "session" && session.tracking === undefined);
check("e volta a pedir o opt-in", (await page.text()).includes("Para acompanhar, as respostas precisam ficar neste aparelho"));

// ── Safety plan ─────────────────────────────────────────────────────────────────────────────
await page.goto("/paciente/plano-de-seguranca");
await page.js("localStorage.clear(); sessionStorage.clear(); true");
await page.goto("/paciente/plano-de-seguranca");
text = await page.text();
check("plano de segurança abre sem o guia, com CVV e SAMU", text.includes("Meu plano de segurança") && text.includes("CVV: 188") && text.includes("SAMU: 192"));
check("plano não se apresenta como o formulário Stanley-Brown", text.includes("Não é o formulário Stanley-Brown"));
await scan("plano de segurança (escrever)");
await page.js(`__setValue(document.getElementById('answer-warning_signs'), "Ficar sem dormir"); true`);
await page.sleep(200);
check("plano fica só na aba por padrão", (await page.js(`sessionStorage.getItem('stabilis_safety_plan') !== null && localStorage.getItem('stabilis_safety_plan') === null`)) === true);
await page.click("+ Ouvir música");
await page.sleep(200);
check("ideia de exemplo vira uma linha do plano", (await page.js(`document.getElementById('answer-coping').value`)) === "Ouvir música");
await page.js(`__setValue(document.getElementById('answer-ask_for_help'), "Maria (11) 98888-7777"); true`);
await page.sleep(200);
await page.clickLabel("Guardar neste aparelho");
await page.sleep(200);
check("guardar no aparelho move o plano", (await page.js(`localStorage.getItem('stabilis_safety_plan') !== null && sessionStorage.getItem('stabilis_safety_plan') === null`)) === true);
await page.click("Ver o plano");
await page.sleep(200);
check("plano lido mostra o telefone como ligação", (await page.js(`!!document.querySelector('a[href="tel:11988887777"]')`)) === true);
await scan("plano de segurança (ver)");
await page.goto("/paciente/plano-de-seguranca");
check("plano com conteúdo abre na leitura", (await page.text()).includes("Ficar sem dormir") && (await page.js(`!document.getElementById('answer-warning_signs')`)) === true);
await page.click("Apagar o plano");
await page.click("Sim, apagar");
await page.sleep(300);
check("apagar o plano limpa o armazenamento", (await page.js(`localStorage.getItem('stabilis_safety_plan') === null && sessionStorage.getItem('stabilis_safety_plan') === null`)) === true);

await page.js(`sessionStorage.setItem('stabilis_patient', ${JSON.stringify(JSON.stringify(seededSession("session")))}); localStorage.setItem('stabilis_safety_plan', JSON.stringify({ version: 1, value: { storage: "device", answers: { coping: "Ouvir música" }, updated_at: "2026-10-28T12:00:00Z" } })); true`);
await page.goto("/paciente");
await page.click("Apagar e começar de novo");
await page.sleep(300);
check("apagar meus dados também apaga o plano", (await page.js(`localStorage.getItem('stabilis_safety_plan') === null && sessionStorage.getItem('stabilis_patient') === null`)) === true);

// ── Bridge: the patient's exported file pre-fills the professional form ────────────────────
rmSync(downloads, { recursive: true, force: true });
mkdirSync(downloads, { recursive: true });
await page.goto("/paciente");
await page.js(`sessionStorage.setItem('stabilis_patient', ${JSON.stringify(JSON.stringify(seededSession("session")))}); true`);
await page.goto("/paciente/relatorio");
await page.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads }).catch(() => page.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads }));
await page.click("Compartilhar");
await page.clickLabel("Entendi");
await page.click("Baixar arquivo para o profissional");
const file = `${downloads}/stabilis-respostas.json`;
for (let i = 0; i < 50 && !existsSync(file); i++) await page.sleep(100);
check("relatório baixa o arquivo de respostas", existsSync(file));
check("contagens desligadas: nada é enviado", !page.requests.some((r) => r.includes("/api/metrics")));

// ── Anonymous counts (opt-in) and "Depois da consulta" ─────────────────────────────────────
const metricsApi = await page.js(`Promise.all([
  fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ event: 'report_printed' }) }).then(r => r.status),
  fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ event: 'qualquer_coisa' }) }).then(r => r.status),
])`);
check("rota de contagens aceita só eventos da lista", metricsApi[0] === 204 && metricsApi[1] === 400, JSON.stringify(metricsApi));
await page.goto("/privacidade");
await scan("privacidade");
await page.clickLabel("Enviar contagens anônimas");
await page.sleep(200);
check("contagens ligadas pela página de privacidade", (await page.js(`localStorage.getItem('stabilis_metrics')`)) === "on");
const before = page.requests.filter((r) => r.includes("/api/metrics")).length;
await page.goto("/paciente/relatorio");
await page.click("Compartilhar");
await page.clickLabel("Entendi");
await page.click("Baixar arquivo para o profissional");
await page.sleep(800);
check("com as contagens ligadas, baixar o relatório conta uma vez", page.requests.filter((r) => r.includes("/api/metrics")).length === before + 1);
check("o relatório feito fica marcado na sessão", typeof (await stored("sessionStorage"))?.report_made_at === "string");
await page.goto("/paciente");
check("depois do relatório, a página inicial pergunta sobre a consulta", (await page.text()).includes("Você levou o relatório ao médico?"));
await scan("depois da consulta");
await page.click("Sim");
await page.sleep(200);
await page.click("Em parte");
await page.sleep(500);
const feedback = (await stored("sessionStorage"))?.visit_feedback;
check("resposta guardada no aparelho e agradecimento", feedback?.took_to_doctor === "yes" && feedback?.felt_heard === "partly" && (await page.text()).includes("Obrigado pela resposta."));
check("e contada de forma anônima (duas contagens)", page.requests.filter((r) => r.includes("/api/metrics")).length === before + 3);
await page.js("localStorage.removeItem('stabilis_metrics'); true");

async function upload(path) {
  const { root } = await page.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await page.send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[type=file]" });
  await page.send("DOM.setFileInputFiles", { nodeId, files: [path] });
  await page.sleep(600);
}
if (existsSync(file)) {
  await page.goto("/profissional");
  await page.js("sessionStorage.removeItem('stabilis_professional_case'); true");
  await page.goto("/profissional");
  await upload(file);
  text = await page.text();
  check("profissional importa o arquivo", text.includes("Respostas importadas"));
  check("importação preenche idade, condição, remédios e histórico", (await page.js(`document.querySelector('input[type=number]').value`)) === "34" && (await page.js(`[...document.querySelectorAll('select')].some(s => s.value === 'depression_unipolar')`)) && /Sertralina/.test(text) && /Fluoxetina/.test(text));
  await scan("profissional com importação");
  const tampered = JSON.parse(readFileSync(file, "utf8"));
  tampered.data.relato = "texto trocado";
  writeFileSync(`${downloads}/alterado.json`, JSON.stringify(tampered));
  await upload(`${downloads}/alterado.json`);
  check("arquivo alterado é carregado com aviso", (await page.text()).includes("o arquivo foi alterado depois de exportado"));
  await page.click("Ver opções por diretriz");
  check("resultado do profissional abre", await page.waitForPath("/profissional/resultado"));
  await page.sleep(500);
  text = await page.text();
  check("resultado mostra os questionários da pessoa e a revisão dos tratamentos", text.includes("Questionários respondidos pela pessoa") && text.includes("Revisão dos tratamentos anteriores"));
  await scan("resultado do profissional com importação");
}

// ── Privacy notice updated: sessions saved under the previous version see what changed ──────
const oldNotice = seededSession("session");
oldNotice.value.consent.version = "2026-10-27";
await page.goto("/paciente");
await page.js(`localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('stabilis_patient', ${JSON.stringify(JSON.stringify(oldNotice))}); true`);
await page.goto("/paciente/relato");
check("sessão com aviso antigo vê o que mudou", (await page.text()).includes("Atualizamos o aviso sobre os seus dados"));
await scan("aviso de privacidade atualizado");
await page.click("Entendi e concordo");
await page.sleep(300);
check("concordar registra a versão nova e some o aviso", (await stored("sessionStorage"))?.consent?.version !== "2026-10-27" && !(await page.text()).includes("Atualizamos o aviso sobre os seus dados"));

console.log(a11y.length ? `ACESSIBILIDADE (${a11y.length}):\n${a11y.join("\n")}` : "acessibilidade: nenhuma violação do axe");
console.log(page.problems.length ? `CONSOLE:\n${page.problems.join("\n")}` : "console sem erros");
await page.close();
process.exit(checks.failures || a11y.length || page.problems.length ? 1 : 0);
