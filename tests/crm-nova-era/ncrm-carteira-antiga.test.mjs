import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITE_LOTE, hashContexto, qualidadeContexto, quantidadeDoLote } from "../../app/features/crm-nova-era/lib/carteiraAntiga.ts";

test("o lote da carteira antiga tem teto rígido de 10", () => {
  assert.equal(LIMITE_LOTE, 10);
});

test("hash do contexto é estável, curto e válido para o guarda do banco (>=4)", () => {
  const a = hashContexto("negocio-1|3|[]");
  const b = hashContexto("negocio-1|3|[]");
  const c = hashContexto("negocio-1|4|[]");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a.length >= 4 && a.length <= 200);
});

test("sem conversa => contexto insuficiente (a Sara não é chamada sem base)", () => {
  assert.equal(qualidadeContexto(0, 0, 0), "insuficiente");
});

test("conversa curta, sem resposta do cliente ou com áudio pendente => parcial", () => {
  assert.equal(qualidadeContexto(2, 1, 0), "parcial");
  assert.equal(qualidadeContexto(10, 0, 0), "parcial");
  assert.equal(qualidadeContexto(10, 4, 2), "parcial");
});

test("conversa com histórico e resposta do cliente => base boa", () => {
  assert.equal(qualidadeContexto(10, 4, 0), "boa");
});

test("a quantidade pedida nunca ultrapassa o teto do lote", () => {
  assert.equal(quantidadeDoLote("3"), 3);
  assert.equal(quantidadeDoLote("50"), LIMITE_LOTE);
  assert.equal(quantidadeDoLote("0"), LIMITE_LOTE);
  assert.equal(quantidadeDoLote("abc"), LIMITE_LOTE);
  assert.equal(quantidadeDoLote(null), LIMITE_LOTE);
  assert.equal(quantidadeDoLote(7.9), 7);
});
