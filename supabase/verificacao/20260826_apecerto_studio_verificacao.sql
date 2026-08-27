-- Verificação somente leitura para homologação do apêcerto Studio.
-- Executar após a migration 20260826210311; qualquer divergência aborta.
do $$
declare
  t text;
  missing_tables text[] := '{}'::text[];
  unsafe_tables text[] := '{}'::text[];
begin
  foreach t in array array[
    'social_organizations','social_memberships','social_campaigns','social_briefs','social_product_snapshots',
    'social_assets','social_asset_derivatives','social_templates','social_template_versions','social_template_slots',
    'social_pieces','social_piece_versions','social_generation_jobs','social_approvals','social_schedules',
    'social_publications','social_integrations','social_budgets','social_audit_events','social_meta_oauth_states'
  ] loop
    if to_regclass('public.' || t) is null then missing_tables := array_append(missing_tables,t);
    elsif not exists(select 1 from pg_class where oid=to_regclass('public.'||t) and relrowsecurity) then unsafe_tables := array_append(unsafe_tables,t);
    end if;
    if has_table_privilege('anon','public.'||t,'SELECT') or has_table_privilege('anon','public.'||t,'INSERT') or has_table_privilege('anon','public.'||t,'UPDATE') or has_table_privilege('anon','public.'||t,'DELETE') then
      raise exception 'anon possui privilégio indevido em %',t;
    end if;
  end loop;
  if cardinality(missing_tables)>0 then raise exception 'tabelas ausentes: %',missing_tables; end if;
  if cardinality(unsafe_tables)>0 then raise exception 'RLS ausente: %',unsafe_tables; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename like 'social_%') < 30 then raise exception 'policies insuficientes'; end if;
  if not exists(select 1 from storage.buckets where id='social-studio' and public=false) then raise exception 'bucket privado ausente'; end if;
  if exists(select 1 from public.social_integrations where secret_ref ~* '(bearer |eyj|token=|secret=|password=)') then raise exception 'secret_ref contém material sensível'; end if;
  if exists(select 1 from public.social_budgets where limite_usd<consumido_usd or limite_usd<0) then raise exception 'budget inválido'; end if;
  if (select count(*) from public.social_template_versions where status='publicada') < 4 then raise exception 'catálogo oficial incompleto'; end if;
  if not exists(select 1 from public.agentes_ia where slug='social-media-apecerto' and ativo) then raise exception 'agente governado ausente'; end if;
  if not exists(select 1 from pg_trigger where tgname='social_snapshots_immutable' and tgenabled<>'D') then raise exception 'proteção de snapshot ausente'; end if;
  if not exists(select 1 from pg_trigger where tgname='social_piece_versions_immutable' and tgenabled<>'D') then raise exception 'proteção de versão ausente'; end if;
  if has_function_privilege('anon','public.social_prepare_publication(uuid)','EXECUTE') then raise exception 'anon executa publicação'; end if;
  if has_function_privilege('authenticated','public.social_service_read_meta_token(uuid)','EXECUTE') then raise exception 'authenticated lê token Meta'; end if;
  if has_function_privilege('authenticated','public.social_service_claim_render_job(text,uuid)','EXECUTE') then raise exception 'authenticated reivindica job do renderer'; end if;
  if not has_function_privilege('service_role','public.social_service_complete_render_job(uuid,text,jsonb)','EXECUTE') then raise exception 'service_role não conclui render'; end if;
  if exists(select 1 from public.social_integrations where provider='renderer' and config_publica->>'engine'='browser-canvas-v1') then raise exception 'renderer canônico ainda está no navegador'; end if;
end $$;

select provider,status,config_publica,verificado_em from public.social_integrations order by provider;
select provider,mes,limite_usd,consumido_usd,alerta_percentual from public.social_budgets order by provider,mes desc;
select formato,count(*) as versoes_publicadas from public.social_templates t join public.social_template_versions v on v.template_id=t.id and v.status='publicada' group by formato order by formato;
