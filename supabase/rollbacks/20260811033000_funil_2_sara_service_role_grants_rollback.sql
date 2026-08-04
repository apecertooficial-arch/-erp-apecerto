drop policy if exists f2_sara_analise_service_role_select on public.f2_sara_analise;
drop policy if exists f2_sara_config_service_role_select on public.f2_sara_config;
drop policy if exists f2_momento_config_service_role_select on public.f2_momento_config;
drop policy if exists f2_lead_service_role_select on public.f2_lead;

revoke select on table public.f2_sara_config, public.f2_sara_analise,
  public.f2_momento_config, public.f2_lead
  from service_role;
