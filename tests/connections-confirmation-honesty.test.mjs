import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../app/api/connections/route.ts", import.meta.url), "utf8");
const workspace = readFileSync(
  new URL("../app/features/settings/ConnectionsWorkspace.tsx", import.meta.url),
  "utf8",
);
const harness = readFileSync(
  new URL("./connections-visual-harness/main.tsx", import.meta.url),
  "utf8",
);

test("Conexoes nao repassa a resposta bruta do provedor ao navegador", () => {
  assert.match(api, /function normalizarResultadoQr/);
  assert.match(api, /result:\s*normalizarResultadoQr\(data\)/);
  assert.doesNotMatch(api, /result:\s*data\s*[,}]/);
  assert.match(api, /data:image.*png\|jpeg\|webp/);
});

test("confirmacao automatica falha fechada sem prova explicita do Edge", () => {
  assert.match(api, /confirmacaoAutomaticaComprovada:\s*raw\.confirmationReady === true/);
  assert.match(workspace, /confirmacaoAutomaticaComprovada\?: boolean/);
  assert.match(workspace, /result\.confirmacaoAutomaticaComprovada === true/);
});

test("UI diferencia conexao do WhatsApp de confirmacao automatica comprovada", () => {
  assert.match(workspace, /CONECTADA AO WHATSAPP/);
  assert.match(workspace, /Confirmação automática ainda não comprovada/);
  assert.match(workspace, /WhatsApp conectado/);
  assert.match(workspace, /WhatsApp e confirmação automática prontos/);
  assert.doesNotMatch(workspace, /Conectada com sucesso!/);
});

test("harness visual usa dados sanitizados e bloqueia rede externa", () => {
  assert.match(harness, /ConnectionsWorkspace/);
  assert.match(harness, /url\.origin !== window\.location\.origin/);
  assert.match(harness, /confirmacaoAutomaticaComprovada: false/);
  assert.doesNotMatch(harness, /@|\+55|apikey|service.role/i);
});
