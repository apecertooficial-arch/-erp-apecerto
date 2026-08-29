-- Dispatcher persistente da Central de Automacoes.
-- Infraestrutura apenas: nao cria automacao, nao varre leads e nao altera cron.
-- A promocao shadow -> worker fica em migration separada e fail-closed.

do $preflight$
declare v_def text;
begin
  select pg_get_functiondef('public.motor_processar_fila()'::regprocedure) into v_def;
  if md5(v_def)<>'9a5263bde0a0ab54008037064a077693' then
    raise exception 'FUNCTION_STALE_VERSION: public.motor_processar_fila mudou: %',md5(v_def);
  end if;
  if to_regprocedure('public.motor_dispatcher_claim(text,integer)') is not null then
    raise exception 'DISPATCHER_ALREADY_INSTALLED: revise a migration aplicada antes de continuar';
  end if;
end
$preflight$;

alter table public.motor_fila
  add column if not exists worker_id text,
  add column if not exists lease_token uuid,
  add column if not exists lease_ate timestamptz,
  add column if not exists worker_heartbeat_em timestamptz;

create index if not exists motor_fila_dispatcher_due_idx
  on public.motor_fila(due_at,id)
  where status='pendente';

create index if not exists motor_fila_dispatcher_lease_idx
  on public.motor_fila(lease_ate,id)
  where status='processando' and worker_id is not null;

create table if not exists private.motor_dispatcher_estado(
  singleton boolean primary key default true check(singleton),
  modo text not null default 'cron' check(modo in ('cron','shadow','worker')),
  worker_id text,
  heartbeat_em timestamptz,
  shadow_desde timestamptz,
  worker_desde timestamptz,
  ultimo_claim_em timestamptz,
  ultimo_sucesso_em timestamptz,
  ultimo_erro_em timestamptz,
  ultimo_erro text,
  lag_seconds numeric(14,3) not null default 0,
  fallbacks integer not null default 0,
  motivo text not null default 'compatibilidade_cron_due_at',
  atualizado_em timestamptz not null default now()
);

insert into private.motor_dispatcher_estado(singleton,modo,motivo)
values(true,'cron','dispatcher_instalado_aguardando_shadow')
on conflict(singleton) do nothing;

revoke all on table private.motor_dispatcher_estado from public,anon,authenticated;

create or replace function private.motor_dispatcher_item_lock(p_fila_id bigint)
returns bigint
language sql
immutable
set search_path=''
as $function$
  select hashtextextended('motor_dispatcher_item:'||p_fila_id::text,0)
$function$;

revoke all on function private.motor_dispatcher_item_lock(bigint)
  from public,anon,authenticated;

create or replace function private.motor_dispatcher_recuperar_leases(
  p_limite integer default 20
)
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare v_recuperados integer:=0;
begin
  with candidatos as (
    select id
      from public.motor_fila
     where status='processando'
       and worker_id is not null
       and lease_ate<clock_timestamp()
     order by lease_ate,id
     limit greatest(1,least(coalesce(p_limite,20),100))
     for update skip locked
  ), expirados as (
    select id from candidatos
     where pg_try_advisory_xact_lock(private.motor_dispatcher_item_lock(id))
  )
  update public.motor_fila f
     set status='pendente',worker_id=null,lease_token=null,lease_ate=null,
         worker_heartbeat_em=null,processado_em=null,
         ultimo_erro='LEASE_EXPIRED_RECOVERED: execução anterior sem confirmação'
    from expirados e where f.id=e.id;
  get diagnostics v_recuperados=row_count;
  return v_recuperados;
end
$function$;

revoke all on function private.motor_dispatcher_recuperar_leases(integer)
  from public,anon,authenticated;

create or replace function public.motor_dispatcher_heartbeat(
  p_worker_id text,
  p_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_estado private.motor_dispatcher_estado%rowtype;
  v_lag numeric:=0;
  v_modo text;
begin
  if coalesce(p_worker_id,'')!~'^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,119}$' then
    raise exception 'WORKER_ID_INVALID';
  end if;
  if p_lease_seconds not between 30 and 300 then
    raise exception 'LEASE_INTERVAL_INVALID';
  end if;

  select coalesce(extract(epoch from clock_timestamp()-min(due_at)),0)
    into v_lag
    from public.motor_fila
   where status='pendente' and due_at<=clock_timestamp();

  select * into strict v_estado
    from private.motor_dispatcher_estado where singleton for update;

  if v_estado.modo in ('shadow','worker')
     and v_estado.worker_id is distinct from p_worker_id then
    return jsonb_build_object(
      'ok',true,'modo','standby','saudavel',false,
      'motivo','outro_worker_primario','lag_seconds',greatest(v_lag,0)
    );
  end if;

  update private.motor_dispatcher_estado
     set worker_id=p_worker_id,
         heartbeat_em=clock_timestamp(),
         lag_seconds=greatest(v_lag,0),
         atualizado_em=clock_timestamp()
   where singleton
   returning modo into v_modo;

  return jsonb_build_object(
    'ok',true,'modo',v_modo,'saudavel',true,
    'lag_seconds',greatest(v_lag,0),'lease_seconds',p_lease_seconds
  );
end
$function$;

create or replace function public.motor_dispatcher_definir_modo(
  p_modo text,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare v_estado private.motor_dispatcher_estado%rowtype;
begin
  if p_modo not in ('cron','shadow') then
    raise exception 'MODE_CHANGE_NOT_ALLOWED: promocao para worker pertence a migration de corte';
  end if;
  select * into strict v_estado
    from private.motor_dispatcher_estado where singleton for update;
  if p_modo='shadow' and (
    v_estado.worker_id is distinct from p_worker_id
    or v_estado.heartbeat_em is null
    or v_estado.heartbeat_em<clock_timestamp()-interval '45 seconds'
  ) then
    raise exception 'WORKER_NOT_HEALTHY_FOR_SHADOW';
  end if;
  update private.motor_dispatcher_estado
     set modo=p_modo,
         worker_id=case when p_modo='shadow' then p_worker_id else worker_id end,
         shadow_desde=case when p_modo='shadow' then clock_timestamp() else null end,
         worker_desde=null,
         motivo=case when p_modo='shadow' then 'shadow_em_observacao' else 'fallback_manual_cron' end,
         atualizado_em=clock_timestamp()
   where singleton;
  return jsonb_build_object('ok',true,'modo',p_modo,'worker_id',p_worker_id);
end
$function$;

create or replace function public.motor_dispatcher_claim(
  p_worker_id text,
  p_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare r record;
begin
  if p_lease_seconds not between 30 and 300 then raise exception 'LEASE_INTERVAL_INVALID'; end if;
  if not exists(
    select 1 from private.motor_dispatcher_estado
     where singleton and modo='worker' and worker_id=p_worker_id
       and heartbeat_em>=clock_timestamp()-interval '45 seconds'
  ) then
    return null;
  end if;

  -- Um item abandonado so volta a pendente se nenhum processador ainda detem
  -- o advisory lock daquele item. Isso impede retry concorrente apos lease lento.
  perform private.motor_dispatcher_recuperar_leases(20);

  select id,due_at,tentativas into r
    from public.motor_fila
   where status='pendente' and due_at<=clock_timestamp()
   order by case when lead->>'__motor_priority'~'^[0-9]+$'
     then (lead->>'__motor_priority')::integer else 10 end,due_at,id
   limit 1
   for update skip locked;
  if not found then return null; end if;

  update public.motor_fila
     set status='processando',tentativas=tentativas+1,
         worker_id=p_worker_id,lease_token=gen_random_uuid(),
         lease_ate=clock_timestamp()+make_interval(secs=>p_lease_seconds),
         worker_heartbeat_em=clock_timestamp(),ultimo_erro=null
   where id=r.id and status='pendente'
   returning id,due_at,tentativas,lease_token into r;
  if not found then return null; end if;

  update private.motor_dispatcher_estado
     set ultimo_claim_em=clock_timestamp(),atualizado_em=clock_timestamp()
   where singleton;
  return jsonb_build_object(
    'id',r.id,'due_at',r.due_at,'tentativas',r.tentativas,
    'lease_token',r.lease_token
  );
end
$function$;

create or replace function public.motor_dispatcher_renovar_lease(
  p_fila_id bigint,
  p_worker_id text,
  p_lease_token uuid,
  p_lease_seconds integer default 90
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
begin
  if p_lease_seconds not between 30 and 300 then raise exception 'LEASE_INTERVAL_INVALID'; end if;
  update public.motor_fila
     set lease_ate=clock_timestamp()+make_interval(secs=>p_lease_seconds),
         worker_heartbeat_em=clock_timestamp()
   where id=p_fila_id and status='processando'
     and worker_id=p_worker_id and lease_token=p_lease_token;
  return found;
end
$function$;

create or replace function private.motor_dispatcher_processar_item(
  p_fila_id bigint,
  p_worker_id text default null,
  p_lease_token uuid default null,
  p_exigir_lease boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  r public.motor_fila%rowtype;
  v_ok boolean;
  v_erro text;
  v_delay integer;
  v_claimed integer;
begin
  if not pg_try_advisory_xact_lock(private.motor_dispatcher_item_lock(p_fila_id)) then
    return jsonb_build_object('ok',true,'status','already_processing','fila_id',p_fila_id);
  end if;

  select * into r from public.motor_fila where id=p_fila_id;
  if not found then raise exception 'QUEUE_ITEM_NOT_FOUND'; end if;
  if r.status<>'processando' then
    raise exception 'QUEUE_ITEM_NOT_CLAIMED: %',r.status;
  end if;
  if p_exigir_lease and (
    r.worker_id is distinct from p_worker_id
    or r.lease_token is distinct from p_lease_token
    or r.lease_ate<clock_timestamp()
  ) then
    raise exception 'LEASE_LOST';
  end if;

  select a.ativa is true and a.status='publicado' and not coalesce(a.arquivada,false)
    into v_ok from public.automacoes a where a.id=r.automacao_id;
  if coalesce(v_ok,false) is not true then
    update public.motor_fila set status='cancelado',processado_em=clock_timestamp(),
      ultimo_erro='AUTOMATION_NOT_RUNNABLE',worker_id=null,lease_token=null,
      lease_ate=null,worker_heartbeat_em=null
     where id=r.id and status='processando'
       and (not p_exigir_lease or (worker_id=p_worker_id and lease_token=p_lease_token));
    if to_regprocedure('public.motor_resolver_alerta_fila(bigint,text)') is not null then
      perform public.motor_resolver_alerta_fila(r.id,'automacao_inativa');
    end if;
    return jsonb_build_object('ok',true,'status','cancelado','fila_id',r.id);
  end if;

  begin
    perform public.motor_rodar(
      r.automacao_id,
      (r.lead-'__automacao_versao_id')||jsonb_build_object(
        '__automacao_versao_id',r.automacao_versao_id
      ),
      nullif(r.bloco_id,'START'),
      case when r.bloco_id='START' then 0 else 1 end
    );
    update public.motor_fila set status='ok',processado_em=clock_timestamp(),
      ultimo_erro=null,worker_id=null,lease_token=null,lease_ate=null,
      worker_heartbeat_em=null
     where id=r.id and status='processando'
       and (not p_exigir_lease or (worker_id=p_worker_id and lease_token=p_lease_token));
    get diagnostics v_claimed=row_count;
    if v_claimed=0 then raise exception 'LEASE_LOST'; end if;
    if to_regprocedure('public.motor_resolver_alerta_fila(bigint,text)') is not null then
      perform public.motor_resolver_alerta_fila(r.id,'fila_retomada');
    end if;
    update private.motor_dispatcher_estado
       set ultimo_sucesso_em=clock_timestamp(),ultimo_erro=null,
           atualizado_em=clock_timestamp() where singleton;
    return jsonb_build_object('ok',true,'status','ok','fila_id',r.id);
  exception when others then
    v_erro:=left(sqlstate||': '||sqlerrm,1000);
    if sqlerrm='LEASE_LOST' then raise; end if;
    if sqlerrm like 'AUTOMATION_RETRY: DISTRIBUTION_UNAVAILABLE%' then
      v_delay:=least(300,30+least(greatest(r.tentativas-1,0),9)*30);
      update public.motor_fila set status='pendente',
        due_at=clock_timestamp()+make_interval(secs=>v_delay),processado_em=null,
        ultimo_erro='WAITING_FOR_ELIGIBLE_BROKER: '||v_erro,
        worker_id=null,lease_token=null,lease_ate=null,worker_heartbeat_em=null
       where id=r.id and status='processando'
         and (not p_exigir_lease or (worker_id=p_worker_id and lease_token=p_lease_token));
      get diagnostics v_claimed=row_count;
      if v_claimed=0 then raise exception 'LEASE_LOST'; end if;
      if to_regprocedure('public.motor_alertar_fila_sem_elegiveis(bigint,bigint,bigint,text,integer,integer,timestamp with time zone)') is not null then
        perform public.motor_alertar_fila_sem_elegiveis(
          r.id,r.automacao_id,r.automacao_versao_id,r.bloco_id,
          r.tentativas,v_delay,clock_timestamp()
        );
      end if;
      if r.tentativas=1 or mod(r.tentativas,30)=0 then
        insert into public.motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values(
          r.automacao_id,(select a.nome from public.automacoes a where a.id=r.automacao_id),
          r.bloco_id,'fila','alerta',r.lead->>'nome',r.lead->>'telefone',
          'Aguardando corretor elegivel; nova avaliacao em '||v_delay||'s'
        );
      end if;
    elsif sqlerrm like 'AUTOMATION_RETRY:%' and r.tentativas<=5 then
      v_delay:=least(900,(30*power(2,least(greatest(r.tentativas-1,0),5)))::integer);
      update public.motor_fila set status='pendente',
        due_at=clock_timestamp()+make_interval(secs=>v_delay),processado_em=null,
        ultimo_erro=v_erro,worker_id=null,lease_token=null,lease_ate=null,
        worker_heartbeat_em=null
       where id=r.id and status='processando'
         and (not p_exigir_lease or (worker_id=p_worker_id and lease_token=p_lease_token));
      get diagnostics v_claimed=row_count;
      if v_claimed=0 then raise exception 'LEASE_LOST'; end if;
    else
      update public.motor_fila set status='erro',processado_em=clock_timestamp(),
        ultimo_erro=v_erro,worker_id=null,lease_token=null,lease_ate=null,
        worker_heartbeat_em=null
       where id=r.id and status='processando'
         and (not p_exigir_lease or (worker_id=p_worker_id and lease_token=p_lease_token));
      get diagnostics v_claimed=row_count;
      if v_claimed=0 then raise exception 'LEASE_LOST'; end if;
      if to_regprocedure('public.motor_resolver_alerta_fila(bigint,text)') is not null then
        perform public.motor_resolver_alerta_fila(r.id,'fila_encerrada_com_erro');
      end if;
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values(
        r.automacao_id,(select a.nome from public.automacoes a where a.id=r.automacao_id),
        r.bloco_id,'fila','erro',r.lead->>'nome',r.lead->>'telefone',
        'Execucao encerrada sem presumir sucesso: '||left(v_erro,240)
      );
    end if;
    update private.motor_dispatcher_estado
       set ultimo_erro_em=clock_timestamp(),ultimo_erro=left(v_erro,500),
           atualizado_em=clock_timestamp() where singleton;
    return jsonb_build_object(
      'ok',true,'status',case when v_delay is null then 'erro' else 'retry' end,
      'fila_id',r.id,'retry_seconds',v_delay
    );
  end;
end
$function$;

create or replace function public.motor_dispatcher_processar(
  p_fila_id bigint,
  p_worker_id text,
  p_lease_token uuid
)
returns jsonb
language sql
security definer
set search_path=''
as $function$
  select private.motor_dispatcher_processar_item(
    p_fila_id,p_worker_id,p_lease_token,true
  )
$function$;

-- O consumidor cron usa o mesmo processador de item durante cron/shadow.
-- A migration de corte troca apenas o despachante, nunca o motor de negocio.
create or replace function public.motor_processar_fila()
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare r record; n integer:=0; v_claimed integer;
begin
  for r in
    select id from public.motor_fila
     where status='pendente' and due_at<=clock_timestamp()
     order by case when lead->>'__motor_priority'~'^[0-9]+$'
       then (lead->>'__motor_priority')::integer else 10 end,due_at,id
     limit 10 for update skip locked
  loop
    update public.motor_fila
       set status='processando',tentativas=tentativas+1,ultimo_erro=null,
           worker_id=null,lease_token=null,lease_ate=null,worker_heartbeat_em=null
     where id=r.id and status='pendente';
    get diagnostics v_claimed=row_count;
    if v_claimed=0 then continue; end if;
    perform private.motor_dispatcher_processar_item(r.id,null,null,false);
    n:=n+1;
  end loop;
  return n;
end
$function$;

create or replace function public.motor_dispatcher_parar(p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare v_changed boolean:=false;
begin
  update private.motor_dispatcher_estado
     set modo='cron',worker_id=null,worker_desde=null,shadow_desde=null,
         motivo='worker_shutdown_gracioso',atualizado_em=clock_timestamp()
   where singleton and worker_id=p_worker_id
   returning true into v_changed;
  return jsonb_build_object('ok',true,'modo','cron','alterado',coalesce(v_changed,false));
end
$function$;

create or replace function public.motor_dispatcher_diagnostico()
returns jsonb
language sql
volatile
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'ok',true,
    'modo',e.modo,
    'worker_id',e.worker_id,
    'heartbeat_em',e.heartbeat_em,
    'heartbeat_age_seconds',case when e.heartbeat_em is null then null
      else extract(epoch from clock_timestamp()-e.heartbeat_em) end,
    'shadow_desde',e.shadow_desde,
    'worker_desde',e.worker_desde,
    'lag_seconds',e.lag_seconds,
    'fallbacks',e.fallbacks,
    'motivo',e.motivo,
    'pendentes_due',(
      select count(*) from public.motor_fila
       where status='pendente' and due_at<=clock_timestamp()
    ),
    'leases_ativos',(
      select count(*) from public.motor_fila
       where status='processando' and worker_id is not null
         and lease_ate>=clock_timestamp()
    ),
    'leases_expirados',(
      select count(*) from public.motor_fila
       where status='processando' and worker_id is not null
         and lease_ate<clock_timestamp()
    )
  )
  from private.motor_dispatcher_estado e where e.singleton
$function$;

create or replace function public.motor_dispatcher_cron_tick()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_estado private.motor_dispatcher_estado%rowtype;
  v_modo text;
  v_motivo text;
  v_recuperados integer:=0;
  v_resultado jsonb:='{}'::jsonb;
begin
  select * into strict v_estado
    from private.motor_dispatcher_estado where singleton;
  v_modo:=v_estado.modo;
  v_motivo:=v_estado.motivo;

  if v_modo='worker' and (
    v_estado.heartbeat_em is null
    or v_estado.heartbeat_em<clock_timestamp()-interval '45 seconds'
  ) then
    v_modo:='cron';
    v_motivo:='worker_heartbeat_expirado';
    update private.motor_dispatcher_estado
       set modo='cron',worker_id=null,worker_desde=null,shadow_desde=null,
           fallbacks=fallbacks+1,motivo=v_motivo,atualizado_em=clock_timestamp()
     where singleton and modo='worker'
       and (heartbeat_em is null
         or heartbeat_em<clock_timestamp()-interval '45 seconds');
    if not found then
      select * into strict v_estado
        from private.motor_dispatcher_estado where singleton;
      v_modo:=v_estado.modo;
      v_motivo:=v_estado.motivo;
    end if;
  end if;

  if v_modo='worker' then
    return jsonb_build_object(
      'ok',true,'executor','worker','cron_consumiu',false,
      'heartbeat_em',v_estado.heartbeat_em,'lag_seconds',v_estado.lag_seconds
    );
  end if;

  v_recuperados:=private.motor_dispatcher_recuperar_leases(20);

  begin
    v_resultado:=v_resultado||jsonb_build_object('fila',public.motor_processar_fila());
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('fila_erro',sqlstate||': '||sqlerrm);
  end;
  begin
    insert into public.motor_relogio_estado(chave,ultima_execucao) values('prazo',clock_timestamp())
    on conflict(chave) do update set ultima_execucao=excluded.ultima_execucao
      where public.motor_relogio_estado.ultima_execucao<=clock_timestamp()-interval '1 minute';
    if found then
      v_resultado:=v_resultado||jsonb_build_object('prazo',public.motor_evento_prazo(150));
    end if;
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('prazo_erro',sqlstate||': '||sqlerrm);
  end;
  return jsonb_build_object(
    'ok',true,'executor','cron','cron_consumiu',true,
    'modo',v_modo,'motivo',v_motivo,'leases_recuperados',v_recuperados,
    'fontes',v_resultado
  );
end
$function$;

revoke all on function public.motor_dispatcher_heartbeat(text,integer)
  from public,anon,authenticated;
revoke all on function public.motor_dispatcher_definir_modo(text,text)
  from public,anon,authenticated;
revoke all on function public.motor_dispatcher_claim(text,integer)
  from public,anon,authenticated;
revoke all on function public.motor_dispatcher_renovar_lease(bigint,text,uuid,integer)
  from public,anon,authenticated;
revoke all on function private.motor_dispatcher_processar_item(bigint,text,uuid,boolean)
  from public,anon,authenticated;
revoke all on function public.motor_dispatcher_processar(bigint,text,uuid)
  from public,anon,authenticated;
revoke all on function public.motor_dispatcher_parar(text)
  from public,anon,authenticated;
revoke all on function public.motor_dispatcher_diagnostico()
  from public,anon,authenticated;
revoke all on function public.motor_dispatcher_cron_tick()
  from public,anon,authenticated;
revoke all on function public.motor_processar_fila()
  from public,anon,authenticated;

grant execute on function public.motor_dispatcher_heartbeat(text,integer) to service_role;
grant execute on function public.motor_dispatcher_definir_modo(text,text) to service_role;
grant execute on function public.motor_dispatcher_claim(text,integer) to service_role;
grant execute on function public.motor_dispatcher_renovar_lease(bigint,text,uuid,integer) to service_role;
grant execute on function public.motor_dispatcher_processar(bigint,text,uuid) to service_role;
grant execute on function public.motor_dispatcher_parar(text) to service_role;
grant execute on function public.motor_dispatcher_diagnostico() to service_role;
grant execute on function public.motor_dispatcher_cron_tick() to service_role;
grant execute on function public.motor_processar_fila() to service_role;
