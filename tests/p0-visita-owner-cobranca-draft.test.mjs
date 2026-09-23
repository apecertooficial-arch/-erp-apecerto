import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20260923133937_visita_feedback_cobranca_canonica.sql", import.meta.url),
  "utf8",
);
const ativacao = readFileSync(
  new URL("../supabase/migrations/20260923134414_ativar_tipo_feedback_visita.sql", import.meta.url),
  "utf8",
);

test("migration versionada preserva push desligado", () => {
  assert.match(sql, /sincronizar\(false\)/);
  assert.doesNotMatch(sql, /^commit;$/m);
});

test("tipo de cobranca passa pelo filtro de notificacoes existente", () => {
  assert.match(ativacao, /insert into public\.ncrm_notificacao_tipos_ativos/);
  assert.match(ativacao, /visita_feedback_pendente/);
});

test("a RPC exige o corretor atual como dono da carteira", () => {
  assert.match(sql, /v_corretor_atual bigint := public\.current_broker_id\(\)/);
  assert.match(sql, /v_corretor_dono is distinct from v_corretor_atual/);
  assert.doesNotMatch(
    sql,
    /f2_pode_operar_lead\(v_visita\.funil_lead_id\)/,
    "o atalho administrativo nao pode autorizar feedback em nome do corretor",
  );
});

test("a cobranca possui identidade direta, FK e dedupe concorrente", () => {
  assert.match(sql, /add column if not exists visita_id uuid/);
  assert.match(sql, /foreign key \(visita_id\) references public\.f2_visita\(id\)/);
  assert.match(sql, /ux_ncrm_visita_feedback_aberta_publico/);
  assert.match(sql, /on public\.ncrm_notificacao\(visita_id, publico\)/);
  assert.match(sql, /on conflict \(visita_id,publico\)/);
});

test("corretor e gestao usam prazos configurados e a tarefa fecha com feedback", () => {
  assert.match(sql, /v_cfg\.feedback_visita_min/);
  assert.match(sql, /v_cfg\.feedback_visita_min\*2/);
  assert.match(sql, /tipo='visita_feedback_pendente'/);
  assert.match(sql, /resolvida_por=coalesce\(resolvida_por,'automatica_f2'\)/);
});

test("sincronizador e cron sao privados, idempotentes e sem efeito externo", () => {
  const executavel = sql.replace(/^\s*--.*$/gm, "");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /revoke all on function ncrm_private\.f2_visitas_feedback_sincronizar\(boolean\)/);
  assert.match(sql, /grant execute[\s\S]*to service_role/);
  assert.match(sql, /f2_visitas_feedback_sincronizar\(false\)/);
  assert.match(sql, /if p_enfileirar_push then/);
  assert.doesNotMatch(executavel, /http_post|net\.http|whatsapp|dapi-enviar/i);
});

test("a migration futura aborta se a invariavel nao estiver presente", () => {
  assert.match(sql, /F2_VISITA_COBRANCA_DUPLICADA/);
  assert.match(sql, /F2_VISITA_OWNER_GUARD_AUSENTE/);
  assert.match(sql, /having count\(\*\)>1/);
});

test("performance gerencial mede apenas feedback estruturado e preserva legado", () => {
  assert.match(sql, /f2_feedback_visita_performance/);
  assert.match(sql, /public\.f2_admin\(\) is not true/);
  assert.match(sql, /resultado_justificativa like 'FEEDBACK_VISITA_V1 \|%'/);
  assert.match(sql, /'historico_total',v_historico_total/);
  assert.match(sql, /'estruturados_total',v_estruturados_total/);
  assert.match(sql, /'legados_total',v_historico_total-v_estruturados_total/);
  assert.match(sql, /public\.f2_feedback_visita_nota\(v\.resultado_justificativa\)/);
  assert.match(sql, /dentro_prazo_percentual/);
  assert.match(sql, /revoke all on function public\.f2_feedback_visita_performance\(date,date\)/);
  assert.doesNotMatch(sql, /nota_retroativa|inferir_qualidade_legada/i);
});
