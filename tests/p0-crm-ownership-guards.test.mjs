import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../docs/erp-reestruturacao/P0_CRM_OWNERSHIP_GUARDS_DRAFT.sql");
const route = read("../app/api/live-chat/route.ts");
const ui = read("../app/features/chat/LiveChatWorkspace.tsx");

test("draft preserva assinaturas e fixa search_path nas mutações humanas", () => {
  const functions = [
    "transferir_negocio",
    "transferir_com_aceite",
    "aceitar_transferencia",
    "solicitar_descarte",
    "aprovar_descarte",
    "registrar_acao",
    "registrar_observacao",
  ];
  for (const name of functions) {
    assert.match(sql, new RegExp(`create or replace function public\\.${name}\\(`));
  }
  assert.equal((sql.match(/security definer/g) ?? []).length, functions.length);
  assert.equal((sql.match(/set search_path = ''/g) ?? []).length, functions.length);
});

test("transferência exige ownership, destino ativo, lock e aceite explícito", () => {
  assert.match(sql, /from public\.negocios[\s\S]*for update/);
  assert.match(sql, /public\.current_broker_id\(\)/);
  assert.match(sql, /public\.manages_broker\(v_neg\.corretor_id\)/);
  assert.match(sql, /v_neg\.transferencia_status = 'pendente'[\s\S]*v_neg\.transferencia_para = p_corretor_id/);
  assert.match(sql, /transferencia_nao_destinada_ao_usuario/);
  assert.match(sql, /where s\.pipeline_id = v_neg\.pipeline_id[\s\S]*s\.chave = 'em_atendimento'/);
  assert.match(sql, /'unchanged', true/);
});

test("descarte exige motivo canônico e aprovação da gestão", () => {
  assert.match(sql, /from public\.motivos_descarte m where m\.motivo = v_motivo/);
  assert.match(sql, /v_neg\.descarte_status <> 'solicitado'/);
  assert.match(sql, /'gestao_obrigatoria'/);
  assert.match(sql, /s\.pipeline_id = v_neg\.pipeline_id[\s\S]*s\.chave = 'descarte'/);
  assert.match(sql, /perform public\.registrar_auditoria\([\s\S]*'aprovar_descarte'/);
});

test("ações e observações ficam escopadas e deduplicam retry curto", () => {
  assert.match(sql, /a\.criado_em >= pg_catalog\.now\(\) - interval '10 seconds'/);
  assert.match(sql, /v_self is distinct from v_neg\.corretor_id/);
  assert.match(sql, /v_self is distinct from v_lead\.corretor_id/);
  assert.match(sql, /pg_catalog\.make_interval\(hours => p_prox_horas\)/);
  assert.match(sql, /atendimento_acoes_negocio_criado_idx/);
});

test("roleta sem chave idempotente deixa de ser comando humano", () => {
  assert.match(sql, /revoke execute on function public\.redistribuir_lead\(bigint\)[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.redistribuir_lead\(bigint\) to service_role/);
  assert.match(sql, /has_function_privilege\([\s\S]*'authenticated'[\s\S]*public\.redistribuir_lead/);
});

test("Chat ao Vivo valida carteira e oferece aceite para corretor", () => {
  assert.match(route, /from\("negocios"\)\.select\("id,corretor_id"\)/);
  assert.match(route, /rpc\("listar_corretores_transferencia"\)/);
  assert.match(route, /resolveEffectiveAccess\(auth\.supabase, auth\.user\.id\)/);
  assert.match(route, /papelNoGrupo\(access\.role, "gestao"\)/);
  assert.match(route, /const command = direct \? "transferir_negocio" : "transferir_com_aceite"/);
  assert.match(route, /transferStatus: direct \? "transferred" : "pending_acceptance"/);
  assert.match(route, /não existe ou não pertence à sua carteira/);
  assert.match(ui, /O corretor oferece o atendimento para aceite\. A gestão pode reassociar diretamente\./);
  assert.match(ui, /result\.message \|\|/);
});

test("draft continua fora de migrations e não remove dados", () => {
  const executable = sql.replace(/^\s*--.*$/gm, "");
  assert.match(sql, /DRAFT NÃO APLICADO/);
  assert.match(sql, /begin;/);
  assert.match(sql, /commit;/);
  assert.doesNotMatch(executable, /\b(?:drop table|delete from|truncate)\b/i);
});
