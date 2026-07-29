// Fase 5 — helpers puros do Meu Dia.
import { test } from "node:test";
import assert from "node:assert/strict";
import { esperaHumana } from "../../app/features/crm-nova-era/lib/meuDia.ts";

test("espera humana formata minutos, horas e dias", () => {
  assert.equal(esperaHumana(0), "agora");
  assert.equal(esperaHumana(45), "45 min");
  assert.equal(esperaHumana(150), "2h 30min");
  assert.equal(esperaHumana(60 * 24 * 2 + 60 * 3), "2d 3h");
});
