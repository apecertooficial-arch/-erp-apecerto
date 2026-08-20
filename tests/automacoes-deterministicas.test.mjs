import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const builder = readFileSync(
  new URL('../app/features/automations/automationBuilderRuntime.js', import.meta.url),
  'utf8',
);
const migration = readFileSync(
  new URL(
    '../supabase/migrations/20260820154118_central_automacoes_deterministica_fase0.sql',
    import.meta.url,
  ),
  'utf8',
);
const hardening = readFileSync(
  new URL(
    '../supabase/migrations/20260820161821_central_automacoes_hardening_rpc.sql',
    import.meta.url,
  ),
  'utf8',
);
const entrada = readFileSync(
  new URL('../supabase/functions/entrada/index.ts', import.meta.url),
  'utf8',
);
const dapi = readFileSync(
  new URL('../supabase/functions/dapi-webhook/index.ts', import.meta.url),
  'utf8',
);

test('construtor salva rascunho, publica por RPC e não simula ações reais', () => {
  assert.match(builder, /mapa_rascunho:compile\(\)/);
  assert.match(builder, /sbRpc\('automacao_publicar'/);
  assert.match(builder, /Simulação segura ainda não está disponível/);
  assert.doesNotMatch(
    builder.match(/async function simular\(\)[\s\S]*?\n}/)?.[0] ?? '',
    /motor_rodar/,
  );
});

test('construtor expõe só módulos com contrato e valida ramificações', () => {
  assert.match(builder, /resposta:\{fam:'resposta'/);
  assert.match(builder, /PUBLISHABLE_TYPES\.has\(t\)/);
  assert.match(builder, /Módulo ainda não implementado no motor determinístico/);
  assert.match(builder, /Conecte a saída "respondeu"/);
  assert.match(builder, /PUBLISHABLE_ACTIONS\.has\(f\[0\]\)/);
  assert.match(builder, /PUBLISHABLE_CONDITIONS\.has\(f\[0\]\)/);
});

test('banco fixa versão e interrompe ou roteia falhas de abordagem', () => {
  assert.match(migration, /add column if not exists mapa_rascunho jsonb/);
  assert.match(migration, /add column if not exists versao_publicada_id bigint/);
  assert.match(migration, /automacao_versao_publicada_compat/);
  assert.match(migration, /motor_contextualizar_lead/);
  assert.match(migration, /__automacao_versao_id/);
  assert.match(migration, /motivo','conversa_existente'/);
  assert.match(migration, /Abordagem nao confirmou nenhum envio/);
  assert.match(migration, /errorNextBlockId/);
  assert.match(migration, /AUTOMATION_SIMULATION_DISABLED/);
  assert.match(migration, /create or replace function public\.motor_relogio_central/);
  assert.match(migration, /'motor-relogio-central'/);
  assert.match(migration, /cron\.unschedule\(jobname\)/);
  assert.match(hardening, /from public,anon,authenticated/);
  assert.match(hardening, /to service_role/);
});

test('entrada exige automação, token e idempotência explícitos', () => {
  assert.match(entrada, /AUTOMATION_ID_REQUIRED/);
  assert.doesNotMatch(entrada, /order=criado_em\.desc/);
  assert.match(entrada, /x-automation-token/);
  assert.match(entrada, /IDEMPOTENCY_KEY_REQUIRED/);
  assert.match(entrada, /motor_enfileirar_idempotente/);
});

test('webhook D-API autentica antes de persistir payload', () => {
  const authAt = dapi.indexOf('validSecret(providedSecret)');
  const parseAt = dapi.indexOf('payload = await request.json()');
  const storeAt = dapi.indexOf('.from("wa_eventos").insert');
  assert.ok(authAt > 0 && authAt < parseAt && parseAt < storeAt);
  assert.match(dapi, /WEBHOOK_UNAUTHORIZED/);
  assert.match(dapi, /EVENT_STORE_FAILED/);
});
