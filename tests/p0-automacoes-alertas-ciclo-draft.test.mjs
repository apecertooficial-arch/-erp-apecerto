import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../docs/erp-reestruturacao/P0_AUTOMACOES_ALERTAS_CICLO_DRAFT.sql", import.meta.url),
  "utf8",
);

test("contrato fica fora de producao e preserva historico", () => {
  assert.match(sql, /DRAFT NAO EXECUTAVEL \/ NAO APLICADO EM PRODUCAO/);
  assert.match(sql, /fora de supabase\/migrations/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.ncrm_notificacao/i);
  assert.doesNotMatch(sql, /set\s+resolvida_em\s*=\s*null/i, "histórico fechado nunca é reaberto");
});

test("aviso ganha autoridade direta e auditavel", () => {
  assert.match(sql, /add column if not exists automacao_id bigint/);
  assert.match(sql, /add column if not exists automacao_bloco_id text/);
  assert.match(sql, /add column if not exists lead_id bigint/);
  assert.match(sql, /foreign key \(automacao_id\) references public\.automacoes\(id\)/);
  assert.match(sql, /foreign key \(lead_id\) references public\.leads\(id\)/);
  assert.match(sql, /automacao_ciclo/);
});

test("backfill reconcilia chave legada e canonica sem perpetuar o legado", () => {
  assert.ok(sql.includes("^automacao:[0-9]+:[^:]+:[0-9]+(?::[^:]+:[^:]+)?$"));
  assert.match(sql, /join public\.automacoes a on a\.id = p\.automacao_id/);
  assert.match(sql, /left join public\.leads l on l\.id = p\.lead_id/);
  assert.match(sql, /nullif\(split_part\(n\.chave, ':', 4\), '0'\)/);
  assert.match(sql, /AUTOMACAO_NOTIFICACAO_CHAVE_LEGADA/);
  assert.match(sql, /AUTOMACAO_NOTIFICACAO_CHAVE_INVALIDA/);
});

test("configuracao valida bloco publico e tipo da acao publicada", () => {
  assert.match(sql, /p_mapa #> '\{automation,blocks\}'/);
  assert.match(sql, /@\.name == "send-notification-action"/);
  assert.match(sql, /bloco->>'id' = p_bloco_id/);
  assert.match(sql, /\{options,publico\}/);
  assert.match(sql, /\{options,tipo\}/);
});

test("somente autoridade inativa ou removida fecha a obrigacao", () => {
  assert.match(sql, /a\.ativa is distinct from true/);
  assert.match(sql, /a\.status is distinct from 'publicado'/);
  assert.match(sql, /coalesce\(a\.arquivada, false\)/);
  assert.match(sql, /not ncrm_private\.automacao_notificacao_configurada/);
  assert.match(sql, /resolvida_por = coalesce\(n\.resolvida_por, 'automacao_ciclo'\)/);
});

test("novos avisos sao vinculados sem recriar motor_acoes", () => {
  assert.match(sql, /trg_ncrm_notificacao_vincular_automacao/);
  assert.match(sql, /before insert or update of chave/);
  assert.match(sql, /AUTOMACAO_NOTIFICACAO_SEM_AUTORIDADE/);
  assert.match(sql, /AUTOMACAO_NOTIFICACAO_LEAD_INEXISTENTE/);
  assert.doesNotMatch(sql, /create or replace function public\.motor_acoes/);
});

test("mudanca de ciclo fecha pendencias e nunca reabre", () => {
  assert.match(sql, /trg_automacao_resolver_notificacoes_ciclo/);
  assert.match(sql, /after update of ativa, status, arquivada, mapa/);
  assert.match(sql, /new\.mapa is distinct from old\.mapa/);
  assert.match(sql, /Desarquivar\/republicar não reabre histórico/);
});

test("funcoes internas nao ficam expostas ao navegador", () => {
  assert.match(sql, /revoke all on function ncrm_private\.automacao_notificacao_configurada[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /revoke all on function ncrm_private\.notificacao_vincular_automacao\(\)[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /revoke all on function ncrm_private\.automacao_resolver_notificacoes_ciclo\(\)[\s\S]*from public, anon, authenticated/);
});

test("verificacao final aborta se restar aviso orfao ou sem autoridade", () => {
  assert.match(sql, /AUTOMACAO_ALERTA_CICLO_FAILED/);
  assert.match(sql, /v_sem_vinculo <> 0 or v_sem_autoridade <> 0 or v_formato_invalido <> 0/);
});
