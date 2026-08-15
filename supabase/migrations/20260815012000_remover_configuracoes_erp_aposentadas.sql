-- A tela canônica de Configurações contém apenas Conexões. Este contrato antigo
-- agregava empresa, funis e usuários numa segunda camada de configuração, sem
-- consumidores no ERP atual e com todas as três tabelas vazias.
drop function if exists public.erp_settings_salvar(text, jsonb);
drop function if exists public.erp_config_atual();

drop table if exists public.erp_settings;
drop table if exists public.erp_pipeline_config;
drop table if exists public.erp_user_config;
