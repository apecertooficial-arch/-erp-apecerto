import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const agendaApi = read("../app/api/agenda-publica/route.ts");
const fichaApi = read("../app/api/ficha-publica/route.ts");
const agendaPage = read("../app/agenda/[token]/page.tsx");
const fichaPage = read("../app/ficha/[token]/page.tsx");
const helper = read("../app/lib/public-api.ts");

test("token público deixa a URL da API e respostas nunca entram em cache", () => {
  assert.doesNotMatch(agendaPage, /agenda-publica\?token=/);
  assert.doesNotMatch(fichaPage, /ficha-publica\?token=/);
  assert.match(agendaPage, /"X-Apecerto-Public-Token": token/);
  assert.match(fichaPage, /"X-Apecerto-Public-Token": token/);
  assert.doesNotMatch(fichaPage, /JSON\.stringify\(\{\s*token,/);
  assert.match(helper, /no-store, no-cache, must-revalidate/);
  assert.match(helper, /"Referrer-Policy": "no-referrer"/);
});

test("APIs públicas não devolvem nem registram erro bruto ou segredo", () => {
  for (const route of [agendaApi, fichaApi]) {
    assert.doesNotMatch(route, /Response\.json/);
    assert.doesNotMatch(route, /error\.message/);
    assert.doesNotMatch(route, /console\.error\([^\n]*(token|dados|payload)/i);
    assert.match(route, /publicJson/);
  }
});

test("ficha limita e valida o corpo antes de tocar no banco", () => {
  const rpcAt = fichaApi.indexOf('"ficha_publica_enviar"');
  for (const contract of ["contentLength > 32_768", "TextEncoder", "Array.isArray(parsed)", "JSON inválido", "Array.isArray(body.dados)"]) {
    const at = fichaApi.indexOf(contract);
    assert.ok(at > 0 && at < rpcAt, `${contract} deve preceder a RPC`);
  }
  assert.match(fichaApi, /result\.ok !== true/);
});

test("leitura da ficha minimiza PII preexistente e usa uma allowlist", () => {
  assert.match(fichaApi, /comprador_nome: null/);
  assert.match(fichaApi, /telefone: null/);
  assert.match(fichaApi, /email: null/);
  assert.doesNotMatch(fichaApi, /return publicJson\(data\)/);
});

test("agenda limita intervalo e rejeita resposta sem visitas comprovadas", () => {
  assert.match(agendaApi, /62 \* 86_400_000/);
  assert.match(agendaApi, /const bissexto = ano % 4 === 0/);
  assert.match(agendaApi, /numeroDia <= diasPorMes\[mes - 1\]/);
  assert.match(agendaApi, /!Array\.isArray\(\(data as \{ visitas\?: unknown \}\)\.visitas\)/);
});
