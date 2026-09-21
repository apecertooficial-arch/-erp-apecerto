import assert from "node:assert/strict";
import test from "node:test";
import { agruparPendenciasVisita } from "../app/lib/gestao-mobile.ts";

test("agrupa a dívida de feedback por corretor sem expor o cliente", () => {
  const resultado = agruparPendenciasVisita([
    { corretor_id: 7, cliente: "não deve sair da API móvel" },
    { corretor_id: 7, cliente: "não deve sair da API móvel" },
    { corretor_id: "8", cliente: "não deve sair da API móvel" },
    { corretor_id: null, cliente: "não deve sair da API móvel" },
  ]);
  assert.ok(resultado);
  assert.equal(resultado.total, 4);
  assert.equal(resultado.semCorretor, 1);
  assert.deepEqual([...resultado.porCorretor.entries()], [["7", 2], ["8", 1]]);
  assert.equal("cliente" in resultado, false);
});

test("fila malformada falha fechada em vez de mostrar zero", () => {
  assert.equal(agruparPendenciasVisita(null), null);
  assert.equal(agruparPendenciasVisita([null]), null);
  assert.equal(agruparPendenciasVisita([{ corretor_id: {} }]), null);
  assert.equal(agruparPendenciasVisita([{ corretor_id: "" }]), null);
});
