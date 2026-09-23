import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20260923170000_transferencias_auditaveis.sql");
const api = read("../app/api/live-chat/route.ts");
const workspace = read("../app/features/chat/LiveChatWorkspace.tsx");

test("transferência canônica atualiza lead, negócio e card na mesma função", () => {
  assert.match(migration, /update public\.negocios n[\s\S]*set corretor_id = v_transferencia\.para_corretor_id/);
  assert.match(migration, /update public\.leads[\s\S]*set corretor_id = v_transferencia\.para_corretor_id/);
  assert.match(migration, /update public\.f2_lead[\s\S]*set corretor_id = v_transferencia\.para_corretor_id/);
  assert.doesNotMatch(migration.match(/create or replace function ncrm_private\.crm_transferencia_aplicar[\s\S]*?\$\$;/)?.[0] ?? "", /stage_id\s*=|momento_codigo\s*=|visitas?/i);
});

test("corretor só oferece negócio próprio e destino só decide o próprio convite", () => {
  assert.match(migration, /v_negocio\.corretor_id is distinct from v_corretor_atual/);
  assert.match(migration, /v_transferencia\.para_corretor_id <> v_corretor_atual/);
  assert.match(migration, /papel_no_grupo\('gestao'\)[\s\S]*can_manage_all\(\)[\s\S]*manages_broker\(v_negocio\.corretor_id\)/);
  assert.match(migration, /revoke all on function public\.transferir_negocio\(bigint, bigint\) from public, anon/);
});

test("auditoria exige motivo e fit quando aplicável", () => {
  assert.match(migration, /create table if not exists public\.crm_transferencias/);
  assert.match(migration, /tipo in \('voluntaria', 'gestao', 'fit_comercial'\)/);
  assert.match(migration, /crm_transferencias_fit_explicado/);
  assert.match(migration, /solicitada_por uuid not null/);
  assert.match(migration, /decidida_por uuid/);
});

test("API e interface usam o contrato auditável e oferecem aceite ou recusa", () => {
  assert.match(api, /crm_solicitar_transferencia/);
  assert.match(api, /crm_transferir_gestao/);
  assert.match(api, /crm_transferencias_pendentes/);
  assert.match(api, /crm_aceitar_transferencia/);
  assert.match(workspace, /Motivo da transferência/);
  assert.match(workspace, /Fit comercial/);
  assert.match(workspace, /Aceitar/);
  assert.match(workspace, /Recusar/);
});
