import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../docs/erp-reestruturacao/P0_AUTOMACOES_ALERTAS_EVIDENCIA_DRAFT.sql", import.meta.url),
  "utf8",
);

test("draft fica fora de producao e idade nunca encerra alerta", () => {
  assert.match(sql, /DRAFT NAO EXECUTAVEL \/ NAO APLICADO EM PRODUCAO/);
  assert.match(sql, /Idade nunca e evidencia/);
  assert.match(sql, /fora de supabase\/migrations/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.ncrm_notificacao/i);
  assert.doesNotMatch(sql, /criada_em\s*<\s*now\(\)\s*-\s*interval/i);
});

test("resolucao guarda trilha sanitizada da evidencia", () => {
  assert.match(sql, /add column if not exists resolucao_evidencia_tipo text/);
  assert.match(sql, /add column if not exists resolucao_evidencia_ref text/);
  assert.match(sql, /add column if not exists resolucao_evidencia_em timestamptz/);
  assert.match(sql, /automacao_evidencia/);
  assert.match(sql, /troca_dono_f2/);
  assert.match(sql, /resolvida_por like 'central:%'/);
  assert.match(sql, /provider_message_id nao sao copiados/);
});

test("primeira abordagem segue o estado canonico e troca de dono", () => {
  assert.match(sql, /n\.tipo='primeira_abordagem_pendente'/);
  assert.match(sql, /p_etapa is distinct from 'novo'/);
  assert.match(sql, /p_ultima_acao_confirmada_em is not null/);
  assert.match(sql, /n\.corretor_id is distinct from p_corretor_id/);
  assert.match(sql, /f2_troca_dono/);
});

test("canal indisponivel nao fecha por mera mudanca de etapa", () => {
  assert.match(sql, /n\.tipo='canal_indisponivel' and p_descartado_em is not null/);
  assert.doesNotMatch(
    sql,
    /n\.tipo='canal_indisponivel' and p_etapa is distinct from/,
  );
  assert.match(sql, /motor_saida_confirmada/);
  assert.match(sql, /dapi_saida_sincronizada/);
});

test("estados da Sara fecham somente quando deixam de ser verdadeiros", () => {
  assert.match(sql, /n\.tipo='lead_em_atendimento'/);
  assert.match(sql, /p_etapa is distinct from 'em_atendimento'/);
  assert.match(sql, /n\.tipo='lead_quente'/);
  assert.match(sql, /p_temperatura is distinct from 'quente'/);
});

test("novos fatos reconciliam card, motor e webhook D-API", () => {
  assert.match(sql, /trg_automacao_alerta_reconciliar_f2/);
  assert.match(sql, /trg_automacao_alerta_reconciliar_insert/);
  assert.match(sql, /trg_automacao_alerta_saida_motor/);
  assert.match(sql, /trg_automacao_alerta_saida_dapi/);
  assert.match(sql, /status in \('enviada','entregue','lida'\)/);
  assert.match(sql, /lower\(coalesce\(new\.direcao,''\)\) not in/);
});

test("funcoes internas permanecem fora da Data API", () => {
  for (const nome of [
    "automacao_resolver_por_saida",
    "automacao_resolver_por_estado_f2",
    "automacao_alerta_reconciliar_f2",
    "automacao_alerta_reconciliar_insert",
    "automacao_alerta_saida_motor",
    "automacao_alerta_saida_dapi",
  ]) {
    assert.match(
      sql,
      new RegExp(`revoke all on function ncrm_private\\.${nome}\\([\\s\\S]*?from public, anon, authenticated`),
    );
  }
});

test("reconciliacao historica usa apenas estado e saidas confirmadas", () => {
  assert.match(sql, /do \$reconcile_f2\$/);
  assert.match(sql, /join public\.motor_mensagem_partes mp on mp\.lead_id=n\.lead_id/);
  assert.match(sql, /join public\.wa_contatos wc on wc\.lead_id=n\.lead_id/);
  assert.match(sql, /coalesce\(wm\.enviado_em,wm\.criado_em\)>=n\.criada_em/);
});

test("verificacao final rejeita resolucao sem prova e prova ignorada", () => {
  assert.match(sql, /AUTOMACAO_ALERTA_EVIDENCIA_FAILED/);
  assert.match(sql, /v_sem_trilha<>0 or v_estado_obsoleto<>0 or v_saida_ignorada<>0/);
});
