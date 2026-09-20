import assert from "node:assert/strict";
import test from "node:test";
import { planejarSlotsCampanha } from "../app/lib/campaign-schedule.ts";

test("cadência usa a hora de parede de São Paulo e paraleliza por instância", () => {
  const result = planejarSlotsCampanha({ start: "2026-09-21T09:00:00", endTime: "10:00", periodDays: 1, days: "weekdays", rate: 60, instanceCount: 2, recipientCount: 4, nowMs: Date.parse("2026-09-20T12:00:00.000Z") });
  assert.deepEqual(result, { ok: true, slots: ["2026-09-21T12:00:00.000Z", "2026-09-21T12:01:00.000Z"] });
});

test("dias úteis pulam o fim de semana sem depender do fuso do servidor", () => {
  const result = planejarSlotsCampanha({ start: "2026-09-19T09:00:00", endTime: "10:00", periodDays: 3, days: "weekdays", rate: 20, instanceCount: 1, recipientCount: 1, nowMs: Date.parse("2026-09-18T12:00:00.000Z") });
  assert.deepEqual(result, { ok: true, slots: ["2026-09-21T12:00:00.000Z"] });
});

test("janela insuficiente e horário final anterior falham antes da escrita", () => {
  const base = { start: "2026-09-21T09:00:00", periodDays: 1, days: "all", rate: 60, instanceCount: 1, recipientCount: 3, nowMs: Date.parse("2026-09-20T12:00:00.000Z") };
  assert.deepEqual(planejarSlotsCampanha({ ...base, endTime: "09:02" }), { ok: false, error: "A janela escolhida não comporta todos os leads. Aumente o período, o horário final ou a velocidade." });
  assert.deepEqual(planejarSlotsCampanha({ ...base, endTime: "08:00" }), { ok: false, error: "O horário final precisa ser posterior ao horário inicial." });
});

test("início passado e parâmetros inventados são rejeitados", () => {
  const base = { start: "2026-09-21T09:00:00", endTime: "10:00", periodDays: 1, days: "all", rate: 20, instanceCount: 1, recipientCount: 1 };
  assert.deepEqual(planejarSlotsCampanha({ ...base, nowMs: Date.parse("2026-09-21T12:00:00.000Z") }), { ok: false, error: "O início da campanha precisa estar no futuro." });
  assert.equal(planejarSlotsCampanha({ ...base, days: "domingo", nowMs: 0 }).ok, false);
  assert.equal(planejarSlotsCampanha({ ...base, rate: 0, nowMs: 0 }).ok, false);
});

test("o último passo da abordagem também precisa caber antes do horário final", () => {
  const base = { start: "2026-09-21T09:00:00", endTime: "09:02", periodDays: 1, days: "all", rate: 60, instanceCount: 1, recipientCount: 2, nowMs: Date.parse("2026-09-20T12:00:00.000Z") };
  assert.deepEqual(planejarSlotsCampanha({ ...base, tailMs: 60_000 }), { ok: false, error: "A janela escolhida não comporta todos os leads. Aumente o período, o horário final ou a velocidade." });
  assert.deepEqual(planejarSlotsCampanha({ ...base, endTime: "09:03", tailMs: 60_000 }), { ok: true, slots: ["2026-09-21T12:00:00.000Z", "2026-09-21T12:01:00.000Z"] });
});
