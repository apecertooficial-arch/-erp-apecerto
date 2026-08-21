import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260821233000_presenca_fim_de_semana_deterministica.sql", import.meta.url),
  "utf8",
);

test("fim de semana ignora apenas a presenca fisica no ponto unico", () => {
  assert.match(migration, /extract\([\s\S]*isodow[\s\S]*IN \(6,7\)/);
  assert.match(migration, /fim_de_semana_sem_exigencia_presenca/);
  assert.match(migration, /IF NOT conectado THEN[\s\S]*IF v_fim_de_semana THEN/);
  assert.match(migration, /feedback_visita_pendente[\s\S]*IF v_fim_de_semana THEN/);
});

test("dias uteis continuam exigindo presenca atual e nao inferida", () => {
  assert.match(migration, /coalesce\(c\.no_escritorio,false\)[\s\S]*c\.ultima_presenca > p_agora/);
  assert.doesNotMatch(migration, /historico|comparecimento|presenca_registrar_dia/i);
});

test("regra usa o fuso da operacao com fallback explicito", () => {
  assert.match(migration, /AT TIME ZONE coalesce\(cfg\.timezone,'America\/Sao_Paulo'\)/);
});
