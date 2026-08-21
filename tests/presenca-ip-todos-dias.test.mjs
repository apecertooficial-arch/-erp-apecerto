import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260822010000_presenca_ip_obrigatoria_todos_dias.sql", import.meta.url),
  "utf8",
);
const functionBody = migration.split("DO $check$")[0];

test("regra final exige IP e presença atual em todos os dias", () => {
  assert.match(migration, /coalesce\(c\.no_escritorio,false\)/);
  assert.match(migration, /c\.ultima_presenca > p_agora-make_interval/);
  assert.doesNotMatch(functionBody, /IF v_fim_de_semana THEN/);
  assert.doesNotMatch(functionBody, /fim_de_semana_sem_exigencia_presenca/);
});

test("conexão D-API, suspensão e feedback continuam sendo travas", () => {
  assert.match(migration, /dapi_desconectada/);
  assert.match(migration, /'motivo','suspenso'/);
  assert.match(migration, /feedback_visita_pendente/);
});
