import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../docs/erp-reestruturacao/P0_PRESENCA_ALERTAS_CICLO_DRAFT.sql", import.meta.url), "utf8");
const dispatcher = readFileSync(new URL("../supabase/migrations/20260829001000_central_dispatcher_cohost_sem_cron.sql", import.meta.url), "utf8");

test("resolução de presença ocorre antes de qualquer retorno por configuração ou janela", () => {
  const resolve = sql.indexOf("update public.ncrm_notificacao n");
  const inativa = sql.indexOf("if not found or not v_cfg.ativa");
  const janela = sql.indexOf("if not (");
  assert.ok(resolve > 0 && resolve < inativa && resolve < janela);
  assert.match(sql, /e\.aguardando_desde is not null/);
  assert.match(sql, /avisos_resolvidos/);
});

test("criação continua dentro da janela e preserva a chave idempotente", () => {
  assert.match(sql, /extract\(isodow from v_local\)/);
  assert.match(sql, /'presenca:' \|\| c\.id::text/);
  assert.match(sql, /on conflict \(chave\) where resolvida_em is null do nothing/);
  assert.match(sql, /perform ncrm_private\.push_enfileirar\(200\)/);
});

test("rotinas internas ficam service-only e com verificação fail-closed", () => {
  for (const name of ["presenca_avisar_pendentes", "presenca_derrubar_expirados", "sla_msg_cache_refresh"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\(\\)`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(\\)[\\s\\S]*to service_role`));
  }
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /PRESENCA_ALERTA_SUPERADO_AINDA_ABERTO/);
  assert.match(dispatcher, /motor_dispatcher_manutencao_tick[\s\S]*presenca_avisar_pendentes/);
  assert.match(dispatcher, /revoke all on function public\.motor_dispatcher_manutencao_tick\(text\)[\s\S]*from public,anon,authenticated/);
});

test("draft preserva histórico e permanece fora de migrations", () => {
  assert.doesNotMatch(sql, /delete\s+from\s+public\.ncrm_notificacao/i);
  assert.match(sql, /Nenhuma linha é apagada ou reaberta/);
  assert.match(sql, /DRAFT NAO EXECUTAVEL/);
});
