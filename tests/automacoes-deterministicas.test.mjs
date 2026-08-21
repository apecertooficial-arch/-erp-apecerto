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
const saraRealtime = readFileSync(
  new URL(
    '../supabase/migrations/20260820223000_central_automacoes_sara_conversa_tempo_real.sql',
    import.meta.url,
  ),
  'utf8',
);
const deterministicEntryFields = readFileSync(
  new URL(
    '../supabase/migrations/20260821124000_entrada_deterministica_campos_tags.sql',
    import.meta.url,
  ),
  'utf8',
);
const safePublish = readFileSync(
  new URL(
    '../supabase/migrations/20260821124500_publicacao_sem_sobrescrever_e_miruna.sql',
    import.meta.url,
  ),
  'utf8',
);
const adelmoMerge = readFileSync(
  new URL(
    '../supabase/migrations/20260821125000_mesclar_adelmo_sem_redistribuir.sql',
    import.meta.url,
  ),
  'utf8',
);
const moduleBackfill = readFileSync(
  new URL(
    '../supabase/migrations/20260821125500_corrigir_evento_adelmo_pelos_modulos.sql',
    import.meta.url,
  ),
  'utf8',
);
const saraExactCard = readFileSync(
  new URL(
    '../supabase/migrations/20260821132000_sara_card_exato_e_prioridade.sql',
    import.meta.url,
  ),
  'utf8',
);
const shortQueueBatch = readFileSync(
  new URL(
    '../supabase/migrations/20260821133500_motor_fila_lotes_curtos.sql',
    import.meta.url,
  ),
  'utf8',
);
const saraConversationCutoff = readFileSync(
  new URL(
    '../supabase/migrations/20260821134500_sara_respeitar_recorte_conversa.sql',
    import.meta.url,
  ),
  'utf8',
);
const autonomyFinal = readFileSync(
  new URL(
    '../supabase/migrations/20260821165928_central_automacoes_autonomia_final.sql',
    import.meta.url,
  ),
  'utf8',
);
const campaignApproaches = readFileSync(
  new URL(
    '../supabase/migrations/20260821235500_miruna_abordagens_deterministicas_e_adelmo_presenca.sql',
    import.meta.url,
  ),
  'utf8',
);
const weekendPresence = readFileSync(
  new URL(
    '../supabase/migrations/20260822002000_visita_pendente_retorna_segunda.sql',
    import.meta.url,
  ),
  'utf8',
);
const weekdayVisitFeedback = readFileSync(
  new URL(
    '../supabase/migrations/20260822002500_feedback_visita_ativo_dias_uteis.sql',
    import.meta.url,
  ),
  'utf8',
);
const entrada = readFileSync(
  new URL('../supabase/functions/entrada/index.ts', import.meta.url),
  'utf8',
);
const publicWebhook = readFileSync(
  new URL(
    '../supabase/migrations/20260820195736_webhook_entrada_publico_sem_senha.sql',
    import.meta.url,
  ),
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

test('entrada respeita configuração explícita e deriva idempotência sem header', () => {
  assert.match(entrada, /AUTOMATION_ID_REQUIRED/);
  assert.doesNotMatch(entrada, /order=criado_em\.desc/);
  assert.match(entrada, /webhook_token_enforced === true/);
  assert.match(entrada, /WEBHOOK_UNAUTHORIZED/);
  assert.match(entrada, /stableJson/);
  assert.match(entrada, /crypto\.subtle\.digest/);
  assert.match(entrada, /idempotencia_automatica/);
  assert.match(entrada, /motor_enfileirar_idempotente/);
});

test('construtor mostra webhook público sem senha ou token', () => {
  assert.match(builder, /'protegida':'pública'/);
  assert.match(builder, /Sem senha e sem token/);
  assert.match(builder, /webhook_token_enforced/);
  assert.doesNotMatch(builder, /Header obrigatório/);
});

test('publicar preserva a configuração de segurança do webhook', () => {
  assert.doesNotMatch(publicWebhook, /set webhook_token_enforced\s*=\s*false/);
  assert.doesNotMatch(publicWebhook, /webhook_token_enforced=case/);
  assert.match(publicWebhook, /select a\.webhook_token,a\.webhook_token_enforced/);
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

test('construtor explica variação de abordagem sem sorteio oculto', () => {
  assert.doesNotMatch(builder, /o sistema alterna entre elas/i);
  assert.match(builder, /Para alternar modelos, use um <b>Randomizador<\/b>/);
  assert.match(builder, /type="radio" name="send-approach-/);
  assert.match(builder, /\{primeiro_nome\}.*\{corretor_primeiro_nome\}/s);
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

test('toda mudança da conversa acorda a Sara sem criar um efeito oculto', () => {
  assert.match(builder, /lead-mensagem-enviada-trigger/);
  assert.match(builder, /Corretor enviou mensagem/);
  assert.match(saraRealtime, /lead-mensagem-recebida-trigger/);
  assert.match(saraRealtime, /lead-mensagem-enviada-trigger/);
  assert.match(saraRealtime, /mensagem_recebida/);
  assert.match(saraRealtime, /mensagem_enviada/);
  assert.match(saraRealtime, /f2_sara_aplicar_analise/);
  assert.match(saraRealtime, /'aplicado',false,'terminal',true/);
  assert.match(saraRealtime, /ultima_consulta_em/);
  assert.match(saraRealtime, /cron\.unschedule\(r\.jobid\)/);
  assert.match(saraRealtime, /drop trigger if exists trg_resp_antecipar/);
  assert.match(saraRealtime, /set modelo='gpt-5\.4-mini',status='publicado'/);
  assert.match(saraRealtime, /where id=57/);
  assert.match(saraRealtime, /where id=60/);
  assert.doesNotMatch(saraRealtime, /insert into public\.wa_mensagens/);
});

test('sensor entrega o card exato e mensagens têm prioridade sobre a varredura', () => {
  assert.match(saraExactCard, /'__funil_lead_id',r\.card/);
  assert.match(saraExactCard, /'__funil_lead_id',r\.id/);
  assert.match(saraExactCard, /v_card_contexto:=nullif\(p_lead->>'__funil_lead_id'/);
  assert.match(saraExactCard, /where f\.id=v_card_contexto and f\.descartado_em is null/);
  assert.match(saraExactCard, /'__motor_priority',0/);
  assert.match(saraExactCard, /'__motor_priority',20/);
  assert.match(saraExactCard, /order by[\s\S]*__motor_priority/);
  assert.match(shortQueueBatch, /limit 10 for update skip locked/);
});

test('Sara valida evidência por ID real da mensagem do cliente', () => {
  assert.match(sara, /evidencia_ids/);
  assert.match(sara, /entradasPorId/);
  assert.match(sara, /normalizarEvidencia/);
  assert.match(sara, /contrato:"evidencia-id-v3-recorte"/);
  assert.match(sara, /Nunca use ID de CORRETOR/);
  assert.match(saraConversationCutoff, /v_lead\.historico_completo/);
  assert.match(saraConversationCutoff, /coalesce\(wm\.enviado_em,wm\.criado_em\)>=v_lead\.corte_conversa_em/);
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

test('entrada entrega JSON aos módulos de campos e tags sem atalho oculto', () => {
  assert.doesNotMatch(
    deterministicEntryFields.match(
      /create or replace function public\.motor_enfileirar_idempotente[\s\S]*?revoke all on function public\.motor_enfileirar_idempotente/,
    )?.[0] ?? '',
    /motor_materializar_entrada/,
  );
  assert.match(deterministicEntryFields, /motor_entrada_modulo/);
  assert.match(deterministicEntryFields, /motor_campos_deterministico/);
  assert.match(deterministicEntryFields, /store-json-payload-field-operation/);
  assert.match(deterministicEntryFields, /'contexto',v_contexto/);
  assert.match(deterministicEntryFields, /p_lead:=coalesce\(_res->'contexto',p_lead\)/);
  assert.match(deterministicEntryFields, /'remove-tag-action'.*'Aquário'/s);
  assert.match(deterministicEntryFields, /meta_campaign_name/);
  assert.match(deterministicEntryFields, /additional-field\[tracking\]/);
  assert.match(builder, /guardar JSON completo/);
  assert.match(builder, /store-json-payload-field-operation/);
});

test('rastreamento Meta só existe como operação explícita do módulo de campos', () => {
  assert.match(builder, /registrar rastreamento Meta/);
  assert.match(builder, /sync-meta-attribution-field-operation/);
  assert.match(autonomyFinal, /drop trigger if exists trg_motor_fila_meta_attribution/);
  assert.match(autonomyFinal, /drop function if exists private\.sync_meta_lead_attribution_from_queue/);
  assert.match(autonomyFinal, /private\.motor_atribuicao_meta_por_campos/);
  assert.match(autonomyFinal, /v_name='sync-meta-attribution-field-operation'/);
  assert.match(autonomyFinal, /'json-http-request-trigger','site-lead-created-trigger'/);
  assert.match(autonomyFinal, /Existe entrada ativa sem o modulo explicito de rastreamento Meta/);
  assert.match(autonomyFinal, /Rastreamento Meta executado somente pelo bloco de Campos/);
});

test('runtime rejeita snapshot legado e isola confirmação concorrente de envio', () => {
  assert.match(autonomyFinal, /AUTOMATION_RUNTIME_CONTRACT_INVALID/);
  assert.match(autonomyFinal, /v_validacao:=public\.automacao_validar_mapa\(v_mapa\)/);
  assert.match(autonomyFinal, /send-confirmation-lock/);
  assert.match(autonomyFinal, /pg_advisory_xact_lock\(hashtext\('module:'/);
  assert.match(autonomyFinal, /me\.id>_module_log_id/);
  assert.doesNotMatch(
    autonomyFinal.match(/do \$patch_send_confirmation\$[\s\S]*?\$patch_send_confirmation\$;/)?.[0] ?? '',
    /execute\s+public\.motor_rodar|motor_enfileirar/,
  );
});

test('uma aba antiga não consegue apagar uma publicação mais nova', () => {
  assert.match(builder, /p_expected_version_id:cur\.versao_publicada_id/);
  assert.match(builder, /AUTOMATION_STALE_VERSION/);
  assert.match(safePublish, /p_expected_version_id bigint/);
  assert.match(safePublish, /v_atual_id is distinct from p_expected_version_id/);
  assert.match(safePublish, /AUTOMATION_STALE_VERSION/);
  assert.match(safePublish, /Mescla segura: campos\/tags deterministas/);
});

test('tag manual do Adelmo é mesclada sem repetir distribuição ou mensagem', () => {
  assert.match(adelmoMerge, /Adelmo 2100/);
  assert.match(adelmoMerge, /b-tags-entrada-65/);
  assert.doesNotMatch(adelmoMerge, /motor_roleta|motor_envia_abordagem/);
});

test('backfill encontra a saída da Entrada e chama apenas Campos e Tags', () => {
  assert.match(moduleBackfill, /jsonb_build_object\('__lead_id',l\.id\)/);
  assert.match(moduleBackfill, /meta-lead-2045245893021711/);
  assert.match(moduleBackfill, /where id=65/);
  assert.match(moduleBackfill, /motor_campos_deterministico/);
  assert.match(moduleBackfill, /motor_acoes/);
  assert.doesNotMatch(moduleBackfill, /motor_roleta|motor_envia_abordagem/);
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

test('Miruna escolhe, registra e envia uma unica abordagem por ramo', () => {
  assert.match(campaignApproaches, /'Miruna 603 \| 01','perc',34/);
  assert.match(campaignApproaches, /'Miruna 603 \| 02','perc',33/);
  assert.match(campaignApproaches, /'Miruna 603 \| 03','perc',33/);
  assert.match(campaignApproaches, /additional-field\[abordagem_nome\]/);
  assert.match(campaignApproaches, /'type','send-approach'/);
  assert.match(campaignApproaches, /'abordagemIds',jsonb_build_array\(v_a1\)/);
  assert.match(campaignApproaches, /ABORDAGEM_AUTOMATICA_DEVE_ESTAR_DESLIGADA/);
  assert.match(campaignApproaches, /Entrada Adelmo[\s\S]*onlineOnly\}','true'/);
});

test('fim de semana ignora presenca e visita pendente; segunda restaura as regras', () => {
  assert.match(weekendPresence, /v_fim_de_semana/);
  assert.match(weekendPresence, /status_dapi='connected'/);
  assert.match(weekendPresence, /feedback_visita_pendente/);
  assert.match(weekendPresence, /'motivo','suspenso'/);
  assert.match(weekendPresence, /fim_de_semana_sem_exigencia_presenca/);
  assert.match(weekendPresence, /if v_fim_de_semana then[\s\S]*'elegivel',true/);
  assert.match(weekendPresence, /'feedback_visita_exigido',false/);
  assert.ok(
    weekendPresence.indexOf('if v_fim_de_semana then') <
      weekendPresence.indexOf('if coalesce(cfg.exigir_feedback_visita,true) then'),
    'a excecao de fim de semana precisa acontecer antes do bloqueio por visita',
  );
  assert.match(weekdayVisitFeedback, /set exigir_feedback_visita=true/);
});
