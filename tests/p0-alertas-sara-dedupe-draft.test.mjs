import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../docs/erp-reestruturacao/P0_ALERTAS_SARA_DEDUPE_DRAFT.sql", import.meta.url),
  "utf8",
);

test("o artefato permanece explicitamente fora de producao", () => {
  assert.match(sql, /DRAFT NAO EXECUTAVEL \/ NAO APLICADO EM PRODUCAO/);
  assert.match(sql, /supabase migration new/);
});

test("alerta da Sara tem identidade do card e uma unica abertura por publico", () => {
  assert.match(sql, /add column if not exists funil_lead_id uuid/);
  assert.match(sql, /ux_ncrm_sara_acao_aberta_lead_publico/);
  assert.match(sql, /on public\.ncrm_notificacao\(funil_lead_id, publico\)/);
  assert.match(sql, /sara:acao-vencida:f2:/);
  assert.doesNotMatch(
    sql,
    /'sara:acao-vencida:'\s*\|\|\s*v_a\.evento_execution_id/,
    "execution_id deve auditar a ocorrencia, nunca identificar a pendencia aberta",
  );
});

test("estoque e consolidado sem apagar historico", () => {
  assert.match(sql, /row_number\(\) over/);
  assert.match(sql, /resolvida_por = 'automatica_f2'/);
  assert.match(sql, /repeticoes = greatest/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.ncrm_notificacao/i);
});

test("evidencia, descarte e confirmacao operacional fecham a cobranca", () => {
  assert.match(sql, /v_a\.acao_anterior_executada is true/);
  assert.match(sql, /v_f\.descartado_em is not null/);
  assert.match(sql, /ultima_acao_confirmada_em is distinct from old\.ultima_acao_confirmada_em/);
  assert.match(sql, /trg_f2_sara_resolver_alerta_operacional/);
});

test("a concorrencia e fechada no banco e a funcao continua restrita", () => {
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /on conflict \(funil_lead_id, publico\)/);
  assert.match(sql, /revoke all on function public\.f2_sara_alertar_checkpoint_nao_executado\(bigint\)/);
  assert.match(sql, /grant execute on function public\.f2_sara_alertar_checkpoint_nao_executado\(bigint\)[\s\S]*to service_role/);
});

test("o contador cobre todo o escopo antes de limitar a lista", () => {
  const escopo = sql.indexOf("with escopo as materialized");
  const limite = sql.indexOf("limit 100", escopo);
  const contagem = sql.indexOf("'pendentes', (select count(*) from escopo)", escopo);
  assert.ok(escopo > -1 && limite > escopo && contagem > limite);
  assert.match(sql, /'itens'[\s\S]*from itens/);
});

test("a propria migracao aborta se restarem duplicatas ou descartados abertos", () => {
  assert.match(sql, /SARA_ALERTA_DEDUPE_FAILED/);
  assert.match(sql, /having count\(\*\) > 1/);
  assert.match(sql, /f\.descartado_em is not null/);
});
