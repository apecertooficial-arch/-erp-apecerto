drop policy if exists f2_sara_analise_service_role_select on public.f2_sara_analise;
drop policy if exists f2_sara_config_service_role_select on public.f2_sara_config;

revoke select on table public.f2_sara_config, public.f2_sara_analise
  from service_role;
