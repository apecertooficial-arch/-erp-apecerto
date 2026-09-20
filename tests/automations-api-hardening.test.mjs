import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const operation = readFileSync(new URL("../app/api/automacoes-operacao/route.ts", import.meta.url), "utf8");
const explainer = readFileSync(new URL("../app/api/automacoes-explicar/route.ts", import.meta.url), "utf8");

test("Central exige papel administrativo e permissões granulares no servidor", () => {
  assert.match(operation, /resolveEffectiveAccess\(auth\.db, auth\.user\.id\)/);
  assert.match(operation, /papelNoGrupo\(access\.role, "acesso_total"\)/);
  assert.match(operation, /autorizar\(request, "consultar_execucoes"\)/);
  assert.match(operation, /autorizar\(request, "executar"\)/);
  assert.match(operation, /denyIfCannot\(access, \[\["automacoes", action\]\]\)/);
});

test("Explicador exige permissão de leitura no servidor", () => {
  assert.match(explainer, /resolveEffectiveAccess\(auth\.db, auth\.user\.id\)/);
  assert.match(explainer, /denyIfCannot\(access, \[\["automacoes", "ver"\]\]\)/);
});

test("rotas não expõem mensagens internas do banco", () => {
  assert.doesNotMatch(operation, /Response\.json\(\{ error: error\.message/);
  assert.doesNotMatch(explainer, /Response\.json\(\{ error: error\.message/);
  assert.match(operation, /erro: forbidden \? "sem_permissao" : "falha_banco"/);
  assert.match(explainer, /erro: "falha_banco"/);
});

test("comandos inválidos, grandes e respostas incertas falham fechados", () => {
  assert.match(operation, /tamanho > 4_096/);
  assert.match(operation, /texto\.length > 4_096/);
  assert.match(operation, /typeof body === "object" && !Array\.isArray\(body\)/);
  assert.match(operation, /if \(!respostaConfirmada\(data\)\) return falhaDeDominio\(data\)/);
  assert.match(operation, /status: 409/);
});
