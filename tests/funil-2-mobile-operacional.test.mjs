import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8");
const MOBILE = ler("../app/features/funil-2/Funil2Mobile.tsx");
const ENTRADA = ler("../app/(erp)/crm/page.tsx");
const INICIO = ler("../app/features/home/InicioApp.tsx");
const CSS = ler("../app/styles/app-mobile.css");

test("Inicio e CRM do celular usam o Funil 2.0, nunca as filas antigas", () => {
  assert.match(MOBILE, /fetch\("\/api\/funil2"/);
  assert.doesNotMatch(MOBILE, /\/api\/ncrm\/fila/);
  assert.match(INICIO, /modo="inicio"/);
  assert.match(ENTRADA, /if \(ehCelular\)[\s\S]*<Funil2Mobile/);
});

test("todo perfil autorizado entra no F2 sem gate de piloto", () => {
  assert.match(ENTRADA, /GuardaModulo modulo="CRM"/);
  assert.match(ENTRADA, /<Funil2Mobile/);
  assert.match(ENTRADA, /<Funil2Workspace/);
  assert.doesNotMatch(ENTRADA, /CrmNovaEraGate|podeFunil2|liberado|piloto/i);
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
