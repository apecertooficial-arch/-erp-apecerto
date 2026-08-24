import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260824150339_fixar_instancia_claudia_3785.sql", import.meta.url),
  "utf8",
);

test("Claudia usa exclusivamente a instancia conectada terminada em 3785", () => {
  assert.match(migration, /like '%3785'/);
  assert.match(migration, /set corretor_id = null,[\s\S]*ativa = false/);
  assert.match(migration, /delete from public\.corretor_instancias[\s\S]*instancia_id <> v_instancia_3785/);
  assert.match(migration, /values \(v_corretor_id, v_instancia_3785\)/);
  assert.match(migration, /status = 'desconectado'/);
  assert.match(migration, /A instancia 3785 nao esta conectada e credenciada/);
});
