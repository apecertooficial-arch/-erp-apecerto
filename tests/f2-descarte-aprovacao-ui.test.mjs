import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");
const desktop = fs.readFileSync(new URL("../app/features/funil-2/Funil2Workspace.tsx", import.meta.url), "utf8");
const mobile = fs.readFileSync(new URL("../app/features/funil-2/Funil2Mobile.tsx", import.meta.url), "utf8");

test("API encerra a porta de descarte imediato", () => {
  const trecho = route.slice(route.indexOf('action === "solicitarDescarte"'), route.indexOf("const { data, error } = await db.rpc", route.indexOf('action === "solicitarDescarte"')));
  assert.doesNotMatch(trecho, /rpc\s*=\s*"f2_descartar_lead"/);
  assert.match(trecho, /action === "descartar"[\s\S]*aprovacao_gestao_obrigatoria/);
});

test("solicitação e decisão usam RPCs canônicas com versão e idempotência", () => {
  assert.match(route, /action === "solicitarDescarte"[\s\S]*rpc = "f2_solicitar_descarte"/);
  assert.match(route, /p_idempotency_key: idempotencyKey/);
  assert.match(route, /action === "decidirDescarte"[\s\S]*rpc = "f2_decidir_descarte"/);
  assert.match(route, /p_solicitacao_id: solicitacaoId[\s\S]*p_versao: versao/);
});

test("ausência do contrato é explícita e não derruba a leitura do CRM", () => {
  assert.match(route, /contratoDescarteAusente/);
  assert.match(route, /descarteAprovacao:[\s\S]*status:[\s\S]*"indisponivel"/);
  assert.match(desktop, /A aprovação gerencial ainda não está ativa no banco/);
  assert.match(mobile, /A aprovação gerencial ainda não está ativa no banco/);
});

test("desktop mantém lead na carteira e oferece decisão à gestão", () => {
  assert.match(desktop, /O lead não sai do Meu Dia agora/);
  assert.match(desktop, /Enviar para aprovação/);
  assert.match(desktop, /DECISÃO DA GESTÃO/);
  assert.match(desktop, /Manter na carteira/);
  assert.match(desktop, /Aprovar descarte/);
});

test("aplicativo repete o mesmo contrato sem descarte otimista", () => {
  assert.match(mobile, /action: "solicitarDescarte"/);
  assert.match(mobile, /continua na sua carteira até a gestão decidir/);
  assert.match(mobile, /O lead só sai da carteira depois da decisão da gestão/);
  assert.match(mobile, /action: "decidirDescarte"/);
  assert.doesNotMatch(mobile, /action: "descartar"/);
});
