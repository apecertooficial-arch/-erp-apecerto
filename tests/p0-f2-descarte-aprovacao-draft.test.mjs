import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(
  new URL("../docs/erp-reestruturacao/P0_F2_DESCARTE_APROVACAO_DRAFT.sql", import.meta.url),
  "utf8",
);

test("descarte F2 preserva o lead até decisão da gestão", () => {
  const solicitar = sql.slice(sql.indexOf("create or replace function public.f2_solicitar_descarte"), sql.indexOf("create or replace function public.f2_decidir_descarte"));
  assert.doesNotMatch(solicitar, /update public\.f2_lead[\s\S]*set descartado_em/i);
  assert.match(solicitar, /status', 'pendente'/);
  assert.match(sql, /where status = 'pendente'/);
});

test("solicitação é idempotente, serializada e otimista", () => {
  assert.match(sql, /idempotency_key uuid not null/);
  assert.match(sql, /unique index[\s\S]*idempotency_key/);
  assert.match(sql, /from public\.f2_lead[\s\S]*for update/);
  assert.match(sql, /v_lead\.versao is distinct from p_versao/);
  assert.match(sql, /descarte_ja_pendente/);
});

test("aprovação é gerencial e rejeição não descarta", () => {
  const decidir = sql.slice(sql.indexOf("create or replace function public.f2_decidir_descarte"), sql.indexOf("create or replace function public.f2_listar_solicitacoes_descarte"));
  assert.match(decidir, /public\.f2_admin\(\)/);
  assert.match(decidir, /public\.can_manage_all\(\)/);
  assert.match(decidir, /public\.manages_broker\(v_lead\.corretor_id\)/);
  assert.match(decidir, /if v_decisao = 'aprovar' then[\s\S]*update public\.f2_lead/);
  assert.match(decidir, /else 'rejeitada' end/);
});

test("atalho antigo é revogado e novas portas falham fechadas", () => {
  assert.match(sql, /revoke execute on function public\.f2_descartar_lead\(uuid,integer,text,text\)[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /revoke execute on function public\.f2_solicitar_descarte[\s\S]*from public, anon/);
  assert.match(sql, /grant execute on function public\.f2_decidir_descarte[\s\S]*to authenticated, service_role/);
  assert.match(sql, /alter table public\.f2_descarte_solicitacao enable row level security/);
  assert.match(sql, /revoke all on table public\.f2_descarte_solicitacao from public, anon, authenticated/);
});

test("histórico registra solicitação e decisão sem apagar dados", () => {
  assert.match(sql, /lead_descarte_solicitado/);
  assert.match(sql, /lead_descarte_aprovado/);
  assert.match(sql, /lead_descarte_rejeitado/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.f2_lead/i);
  assert.match(sql, /references public\.f2_lead\(id\) on delete restrict/);
});
