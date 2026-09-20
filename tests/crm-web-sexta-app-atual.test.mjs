import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/(erp)/crm/page.tsx");
const entry = read("../app/features/funil-2/FunilEntry.tsx");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const webCssSource = read("../app/styles/funil.css");
const webCssPublic = read("../public/funil-web-sexta.css");

test("CRM separa explicitamente o web de sexta do app atualmente publicado", () => {
  assert.match(page, /<FunilEntry/);
  assert.match(entry, /ehCelular[\s\S]*<Funil2Mobile/);
  assert.match(entry, /<Funil2Workspace/);
  assert.match(entry, /@import url\("\/funil-web-sexta\.css"\) screen and \(min-width: 901px\)/);
  assert.equal(webCssPublic, webCssSource);
});

test("desktop recupera a hierarquia operacional aprovada na sexta", () => {
  assert.match(workspace, /<Funil2BoardToolbar/);
  assert.match(workspace, /className="f2-card-sinais"/);
  assert.match(workspace, /<span>Momento<\/span>/);
  assert.match(workspace, /<span>Temperatura<\/span>/);
  assert.match(workspace, /className="f2-card-chat"/);
});

test("aplicativo móvel preserva os contratos operacionais em vez de um hash histórico", () => {
  assert.match(mobile, /modo: "inicio" \| "crm"/);
  assert.match(mobile, /<MobileCrmNavigation areaAtual="carteira"/);
  assert.match(mobile, /<BotaoWhatsApp telefone=\{lead\.telefone\}/);
  assert.match(mobile, />Agendar visita</);
  assert.match(mobile, /aria-label=\{modo === "inicio" \? `Meu Dia de/);
});
