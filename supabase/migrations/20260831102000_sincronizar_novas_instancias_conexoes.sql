-- Conexões deve refletir uma sessão recém-criada no D-API sem depender de o
-- usuário esperar o próximo ciclo do cron. A sessão também precisa ganhar o
-- registro local usado pelo QR, mas o corretor continua sendo uma decisão
-- explícita da operação: nenhuma associação é inferida pelo nome da sessão.

create or replace function wa_core.materializar_sessoes_novas(p_account bigint default 1)
returns integer
language plpgsql
set search_path = pg_catalog, wa_core, public
as $function$
declare
  v_inseridas integer := 0;
begin
  -- Evita duas atualizações simultâneas criarem duas linhas para a mesma
  -- sessão. A tabela histórica ainda não possui unique(instancia_dapi).
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wa_core.materializar_sessoes_novas', p_account)
  );

  with novas as (
    select
      s.provider_session_id as nome,
      s.provider_session_id as instancia_dapi,
      s.telefone_observado as telefone,
      null::bigint as corretor_id,
      (s.estado_confirmado = 'connected') as conectada,
      s.estado_confirmado as status_dapi
    from wa_core.sessao s
    where s.provider_account_id = p_account
      and s.arquivada_em is null
      and s.legado_instancia_id is null
      and not exists (
        select 1
        from public.instancias i
        where i.instancia_dapi = s.provider_session_id
      )
    order by s.id
  )
  insert into public.instancias (
    nome, instancia_dapi, ativa, telefone, corretor_id,
    conectada, conectada_em, status_dapi
  )
  select
    n.nome, n.instancia_dapi, true, n.telefone, n.corretor_id,
    n.conectada, case when n.conectada then pg_catalog.now() else null end,
    n.status_dapi
  from novas n;

  get diagnostics v_inseridas = row_count;

  update wa_core.sessao s
     set legado_instancia_id = i.id,
         atualizado_em = pg_catalog.now()
    from (
      select instancia_dapi, min(id) as id
      from public.instancias
      group by instancia_dapi
    ) i
   where s.provider_account_id = p_account
     and s.legado_instancia_id is null
     and i.instancia_dapi = s.provider_session_id;

  return v_inseridas;
end
$function$;

revoke all on function wa_core.materializar_sessoes_novas(bigint) from public, anon, authenticated;
grant execute on function wa_core.materializar_sessoes_novas(bigint) to service_role;

create or replace function wa_core.sincronizar_inventario(
  p_account bigint default 1,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, wa_core, public
as $function$
declare
  v_ultimo_completo timestamptz;
  v_snapshot bigint;
  v_inseridas integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wa_core.sincronizar_inventario', p_account)
  );

  select max(s.concluido_em)
    into v_ultimo_completo
    from wa_core.snapshot s
   where s.provider_account_id = p_account
     and s.completo;

  -- O botão Atualizar pode ser tocado várias vezes; uma coleta recente é
  -- reaproveitada para não pressionar o provedor.
  if p_force
     or v_ultimo_completo is null
     or v_ultimo_completo < pg_catalog.now() - interval '20 seconds' then
    v_snapshot := wa_core.coletar_snapshot(p_account);
  end if;

  v_inseridas := wa_core.materializar_sessoes_novas(p_account);

  return jsonb_build_object(
    'snapshot_id', v_snapshot,
    'instancias_registradas', v_inseridas,
    'sincronizado_em', pg_catalog.now()
  );
end
$function$;

revoke all on function wa_core.sincronizar_inventario(bigint, boolean) from public, anon, authenticated;
grant execute on function wa_core.sincronizar_inventario(bigint, boolean) to service_role;

create or replace function public.wa_v7_atualizar_painel()
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, wa_core
as $function$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Sessão inválida.';
  end if;

  if not public.wa_v7_pode_ver_tudo()
     and public.wa_v7_meu_corretor() is null then
    raise insufficient_privilege using message = 'Usuário sem acesso às conexões.';
  end if;

  perform wa_core.sincronizar_inventario(1, false);
  return public.wa_v7_painel();
end
$function$;

comment on function public.wa_v7_atualizar_painel() is
  'Atualiza o inventário D-API com limite de frequência, registra sessões novas '
  'sem inferir corretor e devolve o painel já escopado ao usuário autenticado.';

revoke all on function public.wa_v7_atualizar_painel() from public, anon;
grant execute on function public.wa_v7_atualizar_painel() to authenticated;

-- O cron continua garantindo convergência mesmo quando ninguém abre a tela.
do $block$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'wa_core_inventario'
  limit 1;

  if v_jobid is null then
    perform cron.schedule(
      'wa_core_inventario',
      '*/5 * * * *',
      'select wa_core.sincronizar_inventario(1, true);'
    );
  else
    perform cron.alter_job(
      job_id := v_jobid,
      command := 'select wa_core.sincronizar_inventario(1, true);'
    );
  end if;
end
$block$;

-- Corrige imediatamente qualquer sessão que já chegou ao inventário, como a
-- recém-criada antes desta migration.
select wa_core.materializar_sessoes_novas(1);
