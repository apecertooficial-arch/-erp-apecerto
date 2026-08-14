import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8");
const MOBILE = ler("../app/features/funil-2/Funil2Mobile.tsx");
const GATE = ler("../app/features/crm-nova-era/CrmNovaEraGate.tsx");
const INICIO = ler("../app/features/home/InicioApp.tsx");
const CSS = ler("../app/styles/app-mobile.css");

test("Inicio e CRM do celular usam o Funil 2.0, nunca as filas antigas", () => {
  assert.match(MOBILE, /fetch\("\/api\/funil2"/);
  assert.doesNotMatch(MOBILE, /\/api\/ncrm\/fila/);
  assert.match(INICIO, /modo="inicio"/);
  assert.match(GATE, /ehCelular === true[\s\S]*<Funil2Mobile/);
});

test("todo perfil operacional autenticado está autorizado no CRM mobile", () => {
  const ramoMobile = GATE.indexOf('if (ehCelular === true && variante === "nova-era" && podeLive)');
  assert.ok(ramoMobile >= 0, "falta a entrada oficial do CRM mobile");
  for (const papel of ["admin", "executivo", "gestor", "gerente", "diretor", "corretor"]) {
    assert.ok(GATE.includes(`\"${papel}\"`), `papel operacional ausente: ${papel}`);
  }
  assert.match(GATE.slice(ramoMobile), /podeLive[\s\S]*<Funil2Mobile/);
});

test("Meu Dia entrega o lead e a chamada; a orientação completa fica na ficha", () => {
  assert.match(MOBILE, /O QUE FAZER AGORA/);
  assert.match(MOBILE, /acaoVisivel\(lead\)/);
  assert.match(MOBILE, /BotaoWhatsApp/);
  assert.match(MOBILE, /Agora · \$\{contagens\.agora\}/);
  assert.match(MOBILE, /Hoje · \$\{contagens\.hoje\}/);
});

test("a ação principal do aplicativo é verde e tem alvo de toque", () => {
  assert.match(CSS, /--f2m-green: #168a4d/);
  const inicio = CSS.indexOf(".f2m-whatsapp .ncrm-wa-principal");
  const bloco = CSS.slice(inicio, CSS.indexOf("}", inicio));
  assert.match(bloco, /min-height: 48px/);
  assert.match(bloco, /background: var\(--f2m-green\)/);
});

test("CRM mobile troca o quadro de desktop por busca, filtros e cartões", () => {
  assert.match(MOBILE, /placeholder="Buscar cliente ou telefone"/);
  for (const etapa of ["Novos", "Tentando contato", "Em atendimento", "Pós-visita"]) {
    assert.ok(MOBILE.includes(etapa), `falta filtro ${etapa}`);
  }
  assert.match(MOBILE, /modo: "inicio" \| "crm"/);
});

test("WhatsApp continua nativo: a tela não chama endpoint de envio", () => {
  assert.doesNotMatch(MOBILE, /dapi-enviar|enviar-whatsapp|\/api\/crm\/chat|\/api\/live-chat/);
});
