// Reconciliação da visita (falha parcial) + fórmula de métricas. node --test.
import test from "node:test";
import assert from "node:assert/strict";
import { proximoEstadoVisita } from "../../app/features/crm-nova-era/live/reconciliacao.ts";
import { taxaRespostaPct } from "../../app/api/ncrm/metricasCalc.ts";

test("visita: criação falhou => lead permanece (falha_criacao)", () => {
  const e = proximoEstadoVisita({ ok: false, visitaId: null, erro: "sem permissão" }, null);
  assert.equal(e.status, "falha_criacao");
});

test("visita criada + encaminhada => encaminhado", () => {
  const e = proximoEstadoVisita({ ok: true, visitaId: "40000000-0000-4000-8000-000000000001" }, true);
  assert.equal(e.status, "encaminhado");
});

test("FALHA PARCIAL: visita criada mas encaminhamento falhou => pendente (retry idempotente, não apaga visita)", () => {
  const vid = "40000000-0000-4000-8000-000000000001";
  const e = proximoEstadoVisita({ ok: true, visitaId: vid }, false);
  assert.equal(e.status, "pendente");
  assert.equal(e.visitaId, vid, "mantém o mesmo visita_id para retry idempotente");
});

test("taxa de resposta NÃO duplica respondidos no denominador", () => {
  // 30 respondidos em 100 abordados = 30% (denominador é o total, não total+respondidos).
  assert.equal(taxaRespostaPct(30, 100), 30);
  assert.equal(taxaRespostaPct(1, 3), 33);
  assert.equal(taxaRespostaPct(0, 0), 0, "total 0 => 0, sem divisão por zero");
  assert.equal(taxaRespostaPct(5, 0), 0);
});
