// Validação de payloads da API do CRM Nova Era. node --test.
import test from "node:test";
import assert from "node:assert/strict";
import { validarAcao, validarQuery, inteiroPositivo, dataValidaISO, uuidValido } from "../../app/api/ncrm/validate.ts";

test("helpers básicos", () => {
  assert.equal(inteiroPositivo("100"), 100);
  assert.equal(inteiroPositivo("0"), null);
  assert.equal(inteiroPositivo("-5"), null);
  assert.equal(inteiroPositivo("1.5"), null);
  assert.equal(inteiroPositivo("abc"), null);
  assert.ok(dataValidaISO("2026-07-28T12:00:00Z"));
  assert.equal(dataValidaISO("nao-data"), null);
  assert.ok(uuidValido("40000000-0000-4000-8000-000000000001"));
  assert.equal(uuidValido("xyz"), null);
});

test("validarQuery: scope/limit/offset", () => {
  assert.equal(validarQuery(new URLSearchParams("scope=foo")).ok, false);
  const v = validarQuery(new URLSearchParams("scope=board&limit=999&offset=10"));
  assert.ok(v.ok && v.value.limit === 200 && v.value.offset === 10);
  assert.equal(validarQuery(new URLSearchParams("offset=-1")).ok, false);
});

test("registrarTentativa: canal/resultado/enum obrigatórios", () => {
  assert.equal(validarAcao({ action: "registrarTentativa", negocioId: 1, versao: 1, canal: "x", resultado: "nao_respondeu" }).ok, false);
  assert.equal(validarAcao({ action: "registrarTentativa", negocioId: 1, versao: 1, canal: "whatsapp", resultado: "zzz" }).ok, false);
  const ok = validarAcao({ action: "registrarTentativa", negocioId: 5, versao: 2, canal: "whatsapp", resultado: "nao_respondeu" });
  assert.ok(ok.ok && ok.value.args.negocioId === 5 && ok.value.args.proximaEm === null);
});

test("registrarTentativa respondeu: prazo no passado ainda passa na API (banco valida no fim)", () => {
  // A API valida FORMATO; a regra 'não no passado' é do banco (fail-closed).
  const r = validarAcao({ action: "registrarTentativa", negocioId: 1, versao: 1, canal: "ligacao", resultado: "respondeu", proximaTipo: "entender_necessidade", proximaEm: "2020-01-01T00:00:00Z" });
  assert.ok(r.ok);
});

test("saidaProposta: valor deve ser positivo", () => {
  assert.equal(validarAcao({ action: "saidaProposta", negocioId: 1, versao: 1, valor: 0 }).ok, false);
  assert.equal(validarAcao({ action: "saidaProposta", negocioId: 1, versao: 1, valor: -3 }).ok, false);
  assert.ok(validarAcao({ action: "saidaProposta", negocioId: 1, versao: 1, valor: 450000 }).ok);
});

test("saidaVisita: exige uuid válido", () => {
  assert.equal(validarAcao({ action: "saidaVisita", negocioId: 1, versao: 1, visitaId: "nope" }).ok, false);
  assert.ok(validarAcao({ action: "saidaVisita", negocioId: 1, versao: 1, visitaId: "40000000-0000-4000-8000-000000000001" }).ok);
});

test("descarte 'outro' exige detalhe; ação desconhecida rejeitada", () => {
  assert.equal(validarAcao({ action: "saidaDescarte", negocioId: 1, versao: 1, motivo: "outro" }).ok, false);
  assert.ok(validarAcao({ action: "saidaDescarte", negocioId: 1, versao: 1, motivo: "outro", detalhe: "x" }).ok);
  assert.equal(validarAcao({ action: "inexistente", negocioId: 1, versao: 1 }).ok, false);
  assert.equal(validarAcao({ action: "registrarTentativa", negocioId: "-1", versao: 1, canal: "whatsapp", resultado: "nao_respondeu" }).ok, false);
});
