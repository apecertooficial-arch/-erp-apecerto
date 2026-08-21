import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260821223000_central_gestao_automatica_completa.sql", import.meta.url), "utf8");
const presence = readFileSync(new URL("../supabase/migrations/20260820175550_presenca_deterministica_fail_closed.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/automacoes-operacao/route.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../app/features/automations/CentralOperationsPanel.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/features/automations/AutomationsWorkspace.tsx", import.meta.url), "utf8");

test("fila antiga da Sara é arquivada e deixa de ser um segundo motor", () => {
  assert.match(migration, /central_sara_fila_legacy_archive/);
  assert.match(migration, /insert into private\.central_sara_fila_legacy_archive/);
  assert.match(migration, /delete from public\.f2_sara_fila/);
  assert.match(migration, /cron\.unschedule\(r\.jobid\)/);
  assert.match(migration, /'sara-tempo-real','f2-pescado-respondeu','f2_entrada_distribuicao'/);
});

test("recuperação de card é explícita, auditada e passa a Sara pela Central", () => {
  assert.match(migration, /central_recuperacao_cards_audit/);
  assert.match(migration, /v_card:=public\.f2_entrada_direta/);
  assert.match(migration, /public\.motor_evento_disparar\(/);
  assert.match(migration, /'checagem-diaria-trigger'/);
  assert.match(migration, /recuperacao_explicita/);
  assert.match(migration, /central_recuperacao_quarentena/);
  assert.doesNotMatch(migration, /insert into public\.leads/);
});

test("resultado não aplicável da IA termina como ignorado e não como pane", () => {
  assert.match(migration, /AI_RESULTADO_TERMINAL_IGNORADO/);
  assert.match(migration, /'lead_fora_do_funil','analise_nao_aplicavel'/);
  assert.match(migration, /'agente','ignorado'/);
  assert.match(migration, /AUTOMATION_RETRY: AI_UNAVAILABLE/);
});

test("notificação só nasce do mapa depois da distribuição", () => {
  assert.match(migration, /drop trigger if exists f2_lead_notificar_primeira_abordagem/);
  assert.match(migration, /Sem notificacao paralela/);
});

test("presença é um fato de entrada e elegibilidade é apurada na distribuição", () => {
  assert.match(presence, /ncrm_corretor_elegibilidade/);
  assert.match(presence, /ultima_presenca > p_agora-make_interval/);
  assert.match(presence, /cron\.unschedule\(v_job\)/);
  assert.doesNotMatch(
    presence.match(/CREATE OR REPLACE FUNCTION public\.ncrm_corretor_elegibilidade[\s\S]*?\n\$fn\$;/)?.[0] ?? "",
    /corretor_presencas|escritorio_ip_autoaprender/,
  );
});

test("saúde, quarentena e replay são operações administrativas explícitas", () => {
  assert.match(migration, /central_saude_operacional/);
  assert.match(migration, /central_reprocessar_fila/);
  assert.match(migration, /status='pendente',due_at=now\(\),processado_em=null,tentativas=0/);
  assert.match(migration, /identidade idempotente original/);
  assert.match(migration, /CENTRAL_ADMIN_REQUIRED/);
  assert.match(route, /central_saude_operacional/);
  assert.match(route, /central_reprocessar_fila/);
});

test("freio de mensagens fica visível e a migração nunca o libera", () => {
  assert.match(migration, /central_abordagem_emergencia/);
  assert.match(migration, /values\('abordagem_automatica',false,now\(\)\)/);
  assert.match(panel, /PARADA DE EMERGÊNCIA/);
  assert.match(panel, /Liberar abordagens/);
  assert.match(panel, /window\.confirm/);
});

test("painel operacional não recria a antiga tela intermediária", () => {
  assert.match(workspace, /CentralOperationsPanel/);
  assert.match(workspace, /original-automation-host/);
  assert.match(panel, /Saúde da Central/);
  assert.doesNotMatch(panel, /Nova automação|Biblioteca de rotinas/);
});

test("fila futura não é exibida como pane operacional", () => {
  assert.match(panel, /totalCritico = numero\(saude\?\.automacoes\?\.invalidas\)[\s\S]*numero\(saude\?\.fila\?\.quarentena\)/);
  assert.doesNotMatch(panel, /totalCritico = numero\(saude\?\.automacoes\?\.invalidas\)[\s\S]{0,120}numero\(saude\?\.fila\?\.pendentes\)/);
});

test("autoteste prova os nove contratos sem criar lead real", () => {
  const contratos = migration.match(/'contratos',jsonb_build_array\([\s\S]*?\n    \)\n  \) into v_result/)?.[0] ?? "";
  assert.equal((contratos.match(/jsonb_build_object\('nome'/g) ?? []).length, 9);
  assert.match(contratos, /Rastreamento Meta explicito/);
  assert.match(contratos, /Runtime revalida publicacao/);
  assert.doesNotMatch(migration, /teste_real|lead_de_teste|telefone_teste/);
});
