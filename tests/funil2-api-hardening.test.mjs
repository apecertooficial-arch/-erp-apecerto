import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/funil2/route.ts", import.meta.url),
  "utf8",
);
const carteira = readFileSync(
  new URL("../app/api/funil2/carteira/route.ts", import.meta.url),
  "utf8",
);
const conversa = readFileSync(
  new URL("../app/api/funil2/conversa/route.ts", import.meta.url),
  "utf8",
);

test("Funil 2 não devolve nem registra detalhes brutos do banco", () => {
  assert.match(route, /function respostaFalhaBanco/);
  assert.match(route, /console\.error\("\[funil2\] falha_banco", \{[\s\S]*?contexto,[\s\S]*?codigo:/);
  assert.doesNotMatch(route, /error:\s*(?:primeiroErro|leadAntesErro|error)\??\.message/);
  assert.doesNotMatch(route, /console\.error\([^\n]*(?:message|error)/);
});

test("carga e mutações usam a resposta sanitizada", () => {
  assert.match(route, /respostaFalhaBanco\(primeiroErro, "GET:carga_inicial"\)/);
  assert.match(route, /respostaFalhaBanco\(error, `POST:\$\{action\}:\$\{rpc\}`\)/);
  assert.match(route, /respostaFalhaBanco\(leadAntesErro, "PATCH:atualizarMomento:leitura"\)/);
  assert.match(route, /respostaFalhaBanco\(error, `PATCH:\$\{action\}:\$\{rpc\}`\)/);
});

test("código de negócio desconhecido não atravessa como mensagem", () => {
  assert.doesNotMatch(route, /RECUSAS\[chave\]\s*\|\|\s*resultado\.erro/);
  assert.match(route, /RECUSAS\[chave\] \|\| "Ação não permitida\."/);
});

test("carteira e conversa também sanitizam todas as falhas", () => {
  assert.match(carteira, /function falhaCarteira/);
  assert.match(conversa, /function falhaConversa/);
  assert.doesNotMatch(`${carteira}\n${conversa}`, /error:\s*\w+Error\.message/);
  assert.match(carteira, /codigo: error\.code \?\? "desconhecido"/);
  assert.match(conversa, /codigo: error\.code \?\? "desconhecido"/);
  assert.doesNotMatch(`${carteira}\n${conversa}`, /console\.error\([^\n]*(?:message|error)/);
});
