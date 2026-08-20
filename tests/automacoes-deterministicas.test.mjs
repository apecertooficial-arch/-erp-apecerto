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
const moduleHardening = readFileSync(
  new URL(
    '../supabase/migrations/20260820171225_central_automacoes_modulos_atomicos.sql',
    import.meta.url,
  ),
  'utf8',
);
const aiPure = readFileSync(
  new URL(
    '../supabase/migrations/20260820203000_central_automacoes_ia_pura_e_envio_isolado.sql',
    import.meta.url,
  ),
  'utf8',
);
const isolatedSend = readFileSync(
  new URL(
    '../supabase/migrations/20260820204500_central_automacoes_envio_sem_failover.sql',
    import.meta.url,
  ),
  'utf8',
);
const atomicFields = readFileSync(
  new URL(
    '../supabase/migrations/20260820205500_central_automacoes_entrada_e_campos_atomicos.sql',
    import.meta.url,
  ),
  'utf8',
);
const canonicalSensors = readFileSync(
  new URL(
    '../supabase/migrations/20260820210500_central_automacoes_site_e_whatsapp_sem_atalhos.sql',
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
const sara = readFileSync(
  new URL('../supabase/functions/f2-sara-reclassificar/index.ts', import.meta.url),
  'utf8',
);
const funilModel = readFileSync(
  new URL('../app/features/funil-2/modelo.ts', import.meta.url),
  'utf8',
);
const funilWorkspace = readFileSync(
  new URL('../app/features/funil-2/Funil2Workspace.tsx', import.meta.url),
  'utf8',
);
const saraTasks = readFileSync(
  new URL('../app/features/tasks/SaraTasksMobile.tsx', import.meta.url),
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
  assert.match(builder, /Operações de campos sem nenhum mapeamento/);
  assert.match(builder, /Exigir <b>elegibilidade operacional<\/b>/);
  assert.match(builder, /Essas regras não são acrescentadas fora deste botão/);
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

test('entrada pública exige automação e deriva idempotência sem senha', () => {
  assert.match(entrada, /AUTOMATION_ID_REQUIRED/);
  assert.doesNotMatch(entrada, /order=criado_em\.desc/);
  assert.doesNotMatch(entrada, /x-automation-token/);
  assert.doesNotMatch(entrada, /WEBHOOK_UNAUTHORIZED/);
  assert.match(entrada, /stableJson/);
  assert.match(entrada, /crypto\.subtle\.digest/);
  assert.match(entrada, /idempotencia_automatica/);
  assert.match(entrada, /motor_enfileirar_idempotente/);
});

test('construtor mostra webhook público sem senha ou token', () => {
  assert.match(builder, /URL pública do webhook/);
  assert.match(builder, /Sem senha e sem token/);
  assert.doesNotMatch(builder, /Header obrigatório/);
  assert.doesNotMatch(builder, /webhook_token/);
});

test('webhook D-API autentica antes de persistir payload', () => {
  const authAt = dapi.indexOf('validSecret(providedSecret)');
  const parseAt = dapi.indexOf('payload = await request.json()');
  const storeAt = dapi.indexOf('.from("wa_eventos").insert');
  assert.ok(authAt > 0 && authAt < parseAt && parseAt < storeAt);
  assert.match(dapi, /WEBHOOK_UNAUTHORIZED/);
  assert.match(dapi, /EVENT_STORE_FAILED/);
});

test('distribuição usa somente os membros e pesos do snapshot', () => {
  const roleta = moduleHardening.match(
    /create or replace function public\.motor_roleta\([\s\S]*?revoke all on function public\.motor_roleta/,
  )?.[0] ?? '';
  assert.match(roleta, /jsonb_array_elements\(coalesce\(p_items/);
  assert.match(roleta, /do update set peso=excluded\.peso/);
  assert.match(roleta, /credito=rc\.credito\+rc\.peso/);
  assert.doesNotMatch(roleta, /distribuicao_marcados|automacao_mapa_executavel/);
  assert.match(moduleHardening, /AUTOMATION_RETRY: DISTRIBUTION_UNAVAILABLE/);
  assert.match(moduleHardening, /motor_sincronizar_dono_f2/);
  assert.match(moduleHardening, /lead e negocio divergem; reparo de dono exige decisao humana/);
});

test('ação e operações de campos revertem o bloco quando registram erro', () => {
  assert.match(moduleHardening, /Operacoes de campos revertidas/);
  assert.match(moduleHardening, /Bloco de acoes revertido/);
  assert.match(moduleHardening, /AUTOMATION_MODULE_FAILED: field-operation/);
  assert.match(moduleHardening, /AUTOMATION_MODULE_FAILED: action/);
  assert.match(moduleHardening, /AUTOMATION_LOOP_LIMIT/);
  assert.match(moduleHardening, /sqlerrm like 'AUTOMATION_RETRY:%'/);
  assert.match(moduleHardening, /pg_advisory_xact_lock\(hashtext\('module:'/);
  assert.match(moduleHardening, /me\.id>_module_log_id/);
  assert.doesNotMatch(moduleHardening, /criado_em>=_module_started/);
  assert.match(moduleHardening, /acao nao concluiu exatamente o que foi configurado/);
  assert.match(moduleHardening, /Acao '.*negocio inexistente/s);
  assert.match(moduleHardening, /and ativo is true/);
  assert.match(moduleHardening, /Aviso ja existia \(idempotencia\)/);
});

test('randomizador repete o mesmo ramo no retry da mesma execução', () => {
  assert.match(moduleHardening, /__motor_execution_id/);
  assert.match(moduleHardening, /hashtextextended/);
  assert.match(moduleHardening, /position\('__motor_execution_id' in v_new\)=0/);
});

test('condições inválidas falham sem presumir resultado verdadeiro', () => {
  assert.match(moduleHardening, /lead-has-tag sem tag/);
  assert.match(moduleHardening, /pipeline configurada nao existe/);
  assert.match(moduleHardening, /condicao nao implementada/);
  assert.match(
    moduleHardening,
    /position\('exception when others then return true' in v_new\)>0/,
  );
  assert.match(builder, /Condição de tag sem tag escolhida/);
  assert.match(builder, /Condição de campo sem campo escolhido/);
});

test('IA processa o card exato com o agente escolhido', () => {
  assert.match(moduleHardening, /f2_sara_candidato\(p_funil_lead_id uuid\)/);
  assert.match(moduleHardening, /'funil_lead_id',v_card/);
  assert.match(moduleHardening, /'agente_slug',v_ag\.slug/);
  assert.match(moduleHardening, /v_item->>'id'=v_card::text/);
  assert.match(sara, /db\.rpc\("f2_sara_candidato",\{p_funil_lead_id:funilLeadId\}\)/);
  assert.match(sara, /processar\(db,c,catalogo,agenteSlug\)/);
  assert.match(sara, /agente_slug:agenteSlug/);
  assert.match(sara, /agente: agenteSlug/);
  assert.doesNotMatch(sara, /f2_sara_registrar_classificacao/);
  assert.match(sara, /somente_analise:true/);
  assert.match(sara, /qualidade_nota/);
  assert.match(aiPure, /f2_sara_registrar_sugestao/);
  assert.match(aiPure, /apply-ai-analysis-action/);
  assert.match(aiPure, /__last_ai_analysis_id/);
  assert.match(aiPure, /IA somente analisa; Acao explicita aplica/);
  assert.match(builder, /Analisar conversa \(não altera o lead\)/);
  assert.match(builder, /Aplicar análise da IA/);
});

test('efeito da IA só acontece no bloco de ação explícito', () => {
  const registrar = aiPure.match(
    /create or replace function public\.f2_sara_registrar_sugestao[\s\S]*?revoke all on function public\.f2_sara_registrar_sugestao/,
  )?.[0] ?? '';
  const aplicar = aiPure.match(
    /create or replace function public\.f2_sara_aplicar_analise[\s\S]*?revoke all on function public\.f2_sara_aplicar_analise/,
  )?.[0] ?? '';
  assert.doesNotMatch(registrar, /update public\.f2_lead/);
  assert.match(aplicar, /update public\.f2_lead set/);
  assert.match(aplicar, /v_f\.versao<>v_a\.versao_base/);
  assert.match(aiPure, /current_setting\('motor\.suppress'/);
  assert.match(aiPure, /drop trigger if exists wa_msg_respondeu/);
  assert.match(funilModel, /qualidade_atendimento_nota: number \| null/);
  assert.match(funilWorkspace, /Nota do atendimento/);
  assert.match(saraTasks, /qualidade_atendimento_resumo/);
});

test('envio usa um modelo e somente a instância do dono, sem transferência', () => {
  assert.match(builder, /Selecione exatamente uma abordagem/);
  assert.match(isolatedSend, /v_count<>1/);
  assert.match(isolatedSend, /i\.corretor_id=p_corretor_id/);
  assert.match(isolatedSend, /nenhum failover foi feito/);
  assert.doesNotMatch(isolatedSend, /update leads set corretor_id/);
  assert.doesNotMatch(isolatedSend, /motor_roleta_transferir_contagem/);
  assert.match(isolatedSend, /motor_mensagem_partes/);
  assert.match(isolatedSend, /AUTOMATION_RETRY: MESSAGE_SEND_FAILED/);
});

test('entrada materializa o contato e operações de campos não criam lead', () => {
  assert.match(atomicFields, /motor_materializar_entrada/);
  assert.match(atomicFields, /FIELD_OPERATION_REQUIRES_EXISTING_LEAD/);
  assert.match(atomicFields, /insert into leads\(nome,telefone,email,origem,status\)/);
  assert.match(atomicFields, /position\('insert into leads\(nome,telefone,email,origem,status\)' in v_new\)>0/);
});

test('site e WhatsApp não mantêm motores paralelos fora do mapa', () => {
  assert.match(builder, /site-lead-created-trigger/);
  assert.match(moduleHardening, /site-lead-created-trigger/);
  assert.match(canonicalSensors, /SITE_AUTOMATION_MISSING/);
  assert.match(canonicalSensors, /motor_enfileirar_idempotente/);
  assert.match(canonicalSensors, /drop trigger if exists trg_wa_enfileirar/);
  const siteSensor = canonicalSensors.match(
    /create or replace function public\.site_lead_sync_crm[\s\S]*?revoke all on function public\.site_lead_sync_crm/,
  )?.[0] ?? '';
  assert.doesNotMatch(siteSensor, /insert into public\.leads|insert into public\.negocios/);
  assert.doesNotMatch(siteSensor, /automacao_id\s*=\s*42/);
});

test('validador do banco repete os contratos críticos da interface', () => {
  assert.match(moduleHardening, /FIELD_OPERATION_EMPTY/);
  assert.match(moduleHardening, /CONDITION_ROUTES_REQUIRED/);
  assert.match(moduleHardening, /DISTRIBUTION_MEMBER_DUPLICATED/);
  assert.match(moduleHardening, /AI_FUNCTION_UNSUPPORTED/);
  assert.match(moduleHardening, /ACTION_PIPELINE_AND_STAGE_REQUIRED/);
  assert.match(moduleHardening, /CONDITION_RANGE_REQUIRED/);
  assert.match(moduleHardening, /BROKEN_ROUTE:.*randomizer/s);
  assert.match(moduleHardening, /revoke all on function public\.motor_acoes/);
  assert.match(moduleHardening, /revoke all on function public\.motor_campos/);
  assert.match(moduleHardening, /revoke all on function public\.motor_cond/);
});
