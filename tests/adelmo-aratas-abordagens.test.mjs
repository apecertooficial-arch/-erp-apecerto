import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260822013000_adelmo_aratas_abordagens_deterministicas.sql", import.meta.url),
  "utf8",
);

test("Adelmo publica um unico modulo de abordagem Aratas em round-robin", () => {
  assert.match(migration, /grupo='Aratãs · AP0348'/);
  assert.match(migration, /'\[27,28,29\]'::jsonb/);
  assert.match(migration, /'id','b17','type','send-approach'/);
  assert.match(migration, /'selectionMode','round-robin'/);
  assert.match(migration, /b->>'id'='b14' and b#>>'\{options,nextBlockId\}'='b17'/);
});

test("publicacao falha fechada se flag ou mapa mudarem", () => {
  assert.match(migration, /ABORDAGEM_AUTOMATICA_DEVE_ESTAR_DESLIGADA/);
  assert.match(migration, /AUTOMATION_STALE_VERSION/);
  assert.match(migration, /automacao_validar_mapa/);
  assert.match(migration, /POSTCONDITION_FAILED/);
});
