-- O teto novo da Sara controla somente o consumo posterior a sua ativacao.
-- Custos historicos do modelo anterior continuam auditados, mas nao bloqueiam
-- o primeiro ciclo da politica de US$ 30.
begin;

alter table public.f2_sara_config
  add column if not exists budget_started_at timestamptz not null
  default clock_timestamp();

create or replace function public.f2_sara_orcamento_status(
  p_projected_usd numeric default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_cfg public.f2_sara_config%rowtype;
  v_mes numeric:=0;
  v_dia numeric:=0;
  v_projetado numeric;
  v_inicio_mes timestamptz;
  v_inicio_dia timestamptz;
begin
  select * into strict v_cfg from public.f2_sara_config where id;
  v_projetado:=greatest(0,coalesce(p_projected_usd,v_cfg.projected_call_usd));
  v_inicio_mes:=greatest(
    v_cfg.budget_started_at,
    date_trunc('month',clock_timestamp() at time zone 'America/Sao_Paulo')
      at time zone 'America/Sao_Paulo'
  );
  v_inicio_dia:=greatest(
    v_cfg.budget_started_at,
    date_trunc('day',clock_timestamp() at time zone 'America/Sao_Paulo')
      at time zone 'America/Sao_Paulo'
  );
  select coalesce(sum(e.custo_usd),0),
         coalesce(sum(e.custo_usd) filter (where e.criado_em>=v_inicio_dia),0)
    into v_mes,v_dia
    from public.agente_execucoes e
   where e.agente_slug='sara'
     and e.status='ok'
     and e.criado_em>=v_inicio_mes;
  return jsonb_build_object(
    'ok',true,
    'permitido',v_mes+v_projetado<=v_cfg.monthly_budget_usd
      and v_dia+v_projetado<=v_cfg.daily_budget_usd,
    'ciclo_iniciado_em',v_cfg.budget_started_at,
    'custo_mes_usd',round(v_mes,6),
    'custo_dia_usd',round(v_dia,6),
    'restante_mes_usd',greatest(0,v_cfg.monthly_budget_usd-v_mes),
    'restante_dia_usd',greatest(0,v_cfg.daily_budget_usd-v_dia),
    'projecao_usd',v_projetado
  );
end
$function$;

revoke all on function public.f2_sara_orcamento_status(numeric)
  from public,anon,authenticated;
grant execute on function public.f2_sara_orcamento_status(numeric) to service_role;

commit;
