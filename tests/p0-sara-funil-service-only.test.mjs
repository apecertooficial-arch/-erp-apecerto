import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../docs/erp-reestruturacao/P0_SARA_FUNIL_SERVICE_ONLY_DRAFT.sql", import.meta.url),
  "utf8",
);

const serviceOnly = [
  "public.funil_mover(uuid,text,bigint,text,text,jsonb,integer,boolean)",
  "public.funil_aplicar_sara(boolean,integer)",
  "public.funil_cascata_tick(boolean)",
  "public.ia_salvar_avaliacao(bigint,bigint,numeric,jsonb,jsonb)",
];

test("draft fecha somente as quatro RPCs internas comprovadas", () => {
  for (const signature of serviceOnly) assert.match(sql, new RegExp(signature.replace(/[().]/g, "\\$&")));
  assert.match(sql, /revoke execute on function %s from public, anon, authenticated/);
  assert.match(sql, /grant execute on function %s to service_role/);
});

test("contrato prova negação para anon/authenticated e preserva serviço", () => {
  assert.match(sql, /has_function_privilege\('anon', v_fn, 'execute'\)/);
  assert.match(sql, /has_function_privilege\('authenticated', v_fn, 'execute'\)/);
  assert.match(sql, /not has_function_privilege\('service_role', v_fn, 'execute'\)/);
});

test("identidade dedicada da Sara não é confundida com usuário comum", () => {
  assert.match(sql, /public\.ncrm_sara_classificar\(bigint,integer,jsonb,text\)/);
  assert.match(sql, /app_metadata\.app_role = 'sara'/);
  assert.match(sql, /ncrm_sara_classificar perdeu o contrato do agente Sara/);
});

test("draft exige ensaio isolado e não altera corpos nem dados", () => {
  const executable = sql.replace(/^\s*--.*$/gm, "");
  assert.match(sql, /DRAFT NÃO APLICADO/);
  assert.match(sql, /ensaiado em Postgres isolado/);
  assert.doesNotMatch(executable, /create or replace function|delete from|truncate|drop table/i);
});
