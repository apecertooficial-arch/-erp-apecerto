import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../docs/erp-reestruturacao/P1_HOJE_OPERACAO_SEARCH_PATH_DRAFT.sql", import.meta.url),
  "utf8",
);

test("hoje_operacao fixa somente o search_path no pg_catalog", () => {
  assert.match(sql, /alter function public\.hoje_operacao\(\)[\s\S]*set search_path = pg_catalog/);
  const executable = sql.replace(/^\s*--.*$/gm, "");
  assert.doesNotMatch(executable, /create or replace function|drop function|revoke|grant/i);
});

test("draft prova a configuração e registra rollback específico", () => {
  assert.match(sql, /search_path=pg_catalog/);
  assert.match(sql, /pg_get_function_identity_arguments\(p\.oid\) = ''/);
  assert.match(sql, /alter function public\.hoje_operacao\(\) reset search_path/);
  assert.match(sql, /DRAFT NÃO APLICADO/);
  assert.match(sql, /Postgres isolado/);
});
