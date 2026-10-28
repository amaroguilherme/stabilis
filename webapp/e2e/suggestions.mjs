// Language-model suggestions in the patient journey (POLICY §15), in a build with the switch on and a
// scripted local backend (e2e/fake_backend.py):
//   NEXT_PUBLIC_PATIENT_SUGGESTIONS=on npm run build
//   ../venv/bin/python e2e/fake_backend.py &
//   STABILIS_API_URL=http://127.0.0.1:7861 HF_SPACE_TOKEN=teste npx next start -p 3100 &
//   node e2e/suggestions.mjs
import { checker, openPage } from "./cdp.mjs";

const { check, failures } = checker();
const page = await openPage();
const a11y = [];
async function scan(name) {
  for (const v of await page.axe()) a11y.push(`${name}: ${v.id} (${v.impact}, ${v.nodes}×) ${v.help} — ${v.target}`);
}
const now = new Date().toISOString();
const session = {
  version: 1,
  value: {
    started_at: now, storage: "session", consent: { version: "2026-10-27", accepted_at: now },
    screening: { answers: { asq_1: 0, asq_2: 0, asq_3: 0, asq_4: 0 }, completed_at: now, repeat_reason: null },
    profile: { age: 34, sex_at_birth: "female", reproductive: { pregnant: "no", breastfeeding: false, planning: false }, conditions: [], habits: [] },
    gender_identity: "", known_diagnoses: [], current_meds: [], relato: "", instruments: {}, skipped: [], history: [], priorities: [],
  },
};
const stored = () => page.js(`JSON.parse(sessionStorage.getItem('stabilis_patient')).value`);

await page.goto("/paciente");
await page.js(`localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('stabilis_patient', ${JSON.stringify(JSON.stringify(session))}); true`);
await page.goto("/paciente/relato");
check("com a chave ligada, o relato oferece a ajuda opcional", (await page.text()).includes("Quer ajuda para organizar o que você escreveu?"));
check("nada é enviado antes de abrir a página", !page.requests.some((url) => url.includes("/api/backend")));
await page.js(`__setValue(document.querySelector('textarea'), "uso Zoloft 50 mg todo dia, tenho pressão alta e fumo. tem dias que eu queria sumir"); true`);
await page.sleep(300);
check("sem consentimento, o botão fica desligado", (await page.js(`__button("Ler meu texto").disabled`)) === true);
await page.clickLabel("Concordo em enviar este texto");
await page.click("Ler meu texto");
let text = "";
for (let i = 0; i < 60; i++) {
  await page.sleep(500);
  text = await page.text();
  if (text.includes("Marque o que estiver certo") || text.includes("Não encontramos nada novo")) break;
}
check("sugestões aparecem com o trecho escrito pela pessoa", text.includes("Uso: Sertralina · 50 mg por dia") && text.includes("Você escreveu: “Zoloft 50 mg”"));
check("nada vem marcado", (await page.js(`[...document.querySelectorAll('fieldset input[type=checkbox]')].every(c => !c.checked)`)) === true);
check("risco visto só pelo modelo também pede ajuda", text.includes("O que você escreveu nos preocupa"));
await scan("relato com sugestões");
await page.clickLabel("Uso: Sertralina");
await page.clickLabel("Pressão alta");
await page.click("Adicionar os marcados");
await page.sleep(400);
const value = await stored();
check("só os itens marcados entram nas respostas", value.current_meds.some((m) => m.drug_id === "sertralina") && value.profile.conditions.includes("hypertension") && !value.profile.habits.includes("smoking"));
await page.click("Continuar");
check("risco do modelo repete as perguntas de segurança", await page.waitForPath("/paciente/seguranca"));

console.log(a11y.length ? `ACESSIBILIDADE (${a11y.length}):\n${a11y.join("\n")}` : "acessibilidade: nenhuma violação do axe");
console.log(page.problems.length ? `CONSOLE:\n${page.problems.join("\n")}` : "console sem erros");
await page.close();
process.exit(failures || a11y.length || page.problems.length ? 1 : 0);
