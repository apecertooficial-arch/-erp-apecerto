-- A Sara é executada exclusivamente pelo backend/worker com service_role.
-- Os grants explícitos evitam depender dos privilégios padrão do ambiente.

revoke all on table public.f2_sara_config, public.f2_sara_analise,
  public.f2_momento_config, public.f2_lead
  from public, anon;

grant select on table public.f2_sara_config, public.f2_sara_analise,
  public.f2_momento_config, public.f2_lead
  to service_role;

drop policy if exists f2_sara_config_service_role_select on public.f2_sara_config;
create policy f2_sara_config_service_role_select
  on public.f2_sara_config for select to service_role using (true);

drop policy if exists f2_sara_analise_service_role_select on public.f2_sara_analise;
create policy f2_sara_analise_service_role_select
  on public.f2_sara_analise for select to service_role using (true);

drop policy if exists f2_momento_config_service_role_select on public.f2_momento_config;
create policy f2_momento_config_service_role_select
  on public.f2_momento_config for select to service_role using (true);

drop policy if exists f2_lead_service_role_select on public.f2_lead;
create policy f2_lead_service_role_select
  on public.f2_lead for select to service_role using (true);

do $$
begin
  if has_table_privilege('anon', 'public.f2_sara_config', 'SELECT')
     or not has_table_privilege('service_role', 'public.f2_sara_config', 'SELECT')
     or not has_table_privilege('service_role', 'public.f2_sara_analise', 'SELECT')
     or not has_table_privilege('service_role', 'public.f2_momento_config', 'SELECT')
     or not has_table_privilege('service_role', 'public.f2_lead', 'SELECT') then
    raise exception 'Grants da Sara do Funil 2.0 não ficaram fail-closed';
  end if;
end
$$;
