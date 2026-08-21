import assert from "node:assert/strict";
import test from "node:test";
import {
  dataHoraLocalSaoPaulo,
  instanteSaoPaulo,
  normalizarInstanteSaoPaulo,
} from "../app/lib/timezone.ts";

test("09:00 de São Paulo é persistido como o instante UTC correto", () => {
  const instante = instanteSaoPaulo("2026-08-22", "09:00:00");
  assert.equal(instante, "2026-08-22T12:00:00.000Z");
  assert.equal(dataHoraLocalSaoPaulo(instante), "2026-08-22T09:00");
});

test("datetime-local não depende do fuso do servidor e ISO explícito não converte duas vezes", () => {
  assert.equal(normalizarInstanteSaoPaulo("2026-08-22T09:00"), "2026-08-22T12:00:00.000Z");
  assert.equal(normalizarInstanteSaoPaulo("2026-08-22T12:00:00.000Z"), "2026-08-22T12:00:00.000Z");
});

test("datas e horários inexistentes são rejeitados", () => {
  assert.equal(instanteSaoPaulo("2026-02-30", "09:00"), null);
  assert.equal(instanteSaoPaulo("2026-08-22", "25:00"), null);
});
