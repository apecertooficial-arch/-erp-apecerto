// Fórmula de métricas (denominador correto). node --test.
import test from "node:test";
import assert from "node:assert/strict";
import { taxaRespostaPct } from "../../app/api/ncrm/metricasCalc.ts";

test("taxa de resposta NÃO duplica respondidos no denominador", () => {
  assert.equal(taxaRespostaPct(30, 100), 30); // 30 de 100, não 30/(100+30)
  assert.equal(taxaRespostaPct(1, 3), 33);
  assert.equal(taxaRespostaPct(0, 0), 0, "total 0 => 0 (sem divisão por zero)");
  assert.equal(taxaRespostaPct(5, 0), 0);
  assert.equal(taxaRespostaPct(-1, 10), 0);
});
