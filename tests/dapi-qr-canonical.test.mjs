import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../supabase/functions/dapi-qr/index.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/connections/route.ts", import.meta.url), "utf8");

test("dapi-qr volta a ter fonte canonica local e JWT obrigatorio", () => {
  assert.match(config, /\[functions\.dapi-qr\][\s\S]*verify_jwt = true/);
  assert.match(source, /auth\.getUser\(token\)/);
  assert.match(api, /functions\.invoke\("dapi-qr"/);
});

test("a mesma RPC da tela autoriza a instancia pedida", () => {
  assert.match(source, /userClient\.rpc\("wa_v7_painel"\)/);
  assert.match(source, /legado_instancia_id/);
  assert.match(source, /instancia_nao_encontrada_ou_sem_acesso/);
  assert.doesNotMatch(source, /role\s*===|role\s*==|administrador/);
});

test("segredo do webhook vem somente do ambiente", () => {
  assert.match(source, /Deno\.env\.get\("DAPI_WEBHOOK_SECRET"\)/);
  assert.match(source, /encodeURIComponent\(WEBHOOK_SECRET\)/);
  assert.doesNotMatch(source, /dapi-webhook\?s=[A-Za-z0-9_-]{8,}/);
});

test("a funcao nao vaza erros nem respostas brutas do provedor", () => {
  assert.doesNotMatch(source, /String\(e\)|String\(err\)|detail:\s*String|detalhe:\s*String/);
  assert.doesNotMatch(source, /resultado:\s*(qr|webhook|restarted)\.body/);
  assert.match(source, /error: "falha_interna"/);
});

test("origem e operacoes sao limitadas", () => {
  assert.doesNotMatch(source, /Access-Control-Allow-Origin"\s*:\s*"\*"/);
  assert.match(source, /ALLOWED_ORIGINS\.has\(origin\)/);
  assert.match(source, /body\?\.action === "restart"/);
  assert.match(source, /body\?\.action === "qr"/);
  assert.doesNotMatch(source, /action === "list"/);
});

test("persistencia so confirma conexao depois de configurar o webhook", () => {
  const webhook = source.indexOf("const webhook = await dapi");
  const update = source.indexOf("const { error: updateError } = await admin");
  assert.ok(webhook > -1 && update > webhook);
  assert.match(source, /if \(!webhook\.ok\) return json/);
  assert.match(source, /if \(updateError\) return json/);
});
