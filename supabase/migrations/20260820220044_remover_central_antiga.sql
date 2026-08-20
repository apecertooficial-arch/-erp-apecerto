-- Remoção definitiva da central antiga.
-- Preserva todas as fontes operacionais (Funil 2.0, leads, visitas, vendas,
-- presença, distribuição, eventos do site e atribuição). Remove somente RPCs,
-- índices e telemetria criados exclusivamente para a central aposentada.

drop trigger if exists trg_capturar_eventos_roleta on public.lead_dono_auditoria;

drop function if exists public.tracking_360_ceo(integer);
drop function if exists public.tracking_360_jornada_digital(integer);
drop function if exists public.tracking_360_digital_health(integer);
drop function if exists public.tracking_360_snapshot(integer);
drop function if exists public.tracking_delivery_health(integer);

drop function if exists public.intel_alertas(integer);
drop function if exists public.intel_aquisicao(integer);
drop function if exists public.intel_atendimento(integer);
drop function if exists public.intel_comportamento(integer);
drop function if exists public.intel_conversao(integer);
drop function if exists public.intel_corretores(integer);
drop function if exists public.intel_equipe(integer);
drop function if exists public.intel_financeiro(integer);
drop function if exists public.intel_gerentes(integer);
drop function if exists public.intel_imoveis(integer);
drop function if exists public.intel_privacidade(integer, text, text);
drop function if exists public.intel_proprietarios(integer);
drop function if exists public.intel_qualidade(integer);
drop function if exists public.intel_sara(integer);
drop function if exists public.intel_vendas(integer);
drop function if exists public.intel_visao_ceo(integer);
drop function if exists public.intel_visao_digital(integer);

drop function if exists public.corretor_atividade_heartbeat(boolean, boolean);
drop function if exists ncrm_private.inteligencia_corretor_telemetria(bigint, timestamptz);
drop function if exists ncrm_private.capturar_eventos_roleta();

drop table if exists ncrm_private.motor_roleta_eventos;
drop table if exists ncrm_private.corretor_atividade_diaria;
drop table if exists ncrm_private.corretor_atividade_estado;
drop table if exists ncrm_private.inteligencia_telemetria_config;

drop index if exists public.negocios_criado_em_tracking_idx;
drop index if exists public.leads_criado_em_tracking_idx;
drop index if exists public.visitas_criado_em_tracking_idx;
drop index if exists public.ncrm_proposta_criada_em_tracking_idx;
drop index if exists public.vendas_created_at_tracking_idx;
drop index if exists public.captacoes_portal_criado_em_tracking_idx;
drop index if exists public.f2_lead_proxima_acao_vencida_tracking_idx;
