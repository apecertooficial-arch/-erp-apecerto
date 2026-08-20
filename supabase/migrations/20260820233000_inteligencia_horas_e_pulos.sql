-- Inteligência operacional: tempo real de uso do ERP e histórico da roleta.
--
-- Não tentamos reconstruir o passado. Confirmações de presença antigas provam
-- apenas que o botão foi clicado; elas não provam quantas horas o ERP ficou
-- aberto. Da mesma forma, a auditoria antiga informa quem recebeu o lead, mas
-- não preserva a elegibilidade dos demais naquele instante.

begin;

create table if not exists ncrm_private.inteligencia_telemetria_config (
  id smallint primary key check (id = 1),
  horas_desde timestamptz not null,
  pulos_desde timestamptz not null
);

insert into ncrm_private.inteligencia_telemetria_config(id,horas_desde,pulos_desde)
values (1,now(),now())
on conflict (id) do nothing;

create table if not exists ncrm_private.corretor_atividade_estado (
  corretor_id bigint primary key references public.corretores(id) on delete cascade,
  ultimo_heartbeat_em timestamptz not null,
  ativo boolean not null default false,
  no_escritorio boolean not null default false
);

create table if not exists ncrm_private.corretor_atividade_diaria (
  corretor_id bigint not null references public.corretores(id) on delete cascade,
  dia date not null,
  segundos_logado bigint not null default 0 check (segundos_logado >= 0),
  segundos_ativo bigint not null default 0 check (segundos_ativo >= 0),
  segundos_no_escritorio bigint not null default 0 check (segundos_no_escritorio >= 0),
  primeiro_heartbeat_em timestamptz not null,
  ultimo_heartbeat_em timestamptz not null,
  primary key (corretor_id,dia)
);

create index if not exists ix_corretor_atividade_diaria_dia
  on ncrm_private.corretor_atividade_diaria(dia,corretor_id);

create table if not exists ncrm_private.motor_roleta_eventos (
  id bigint generated always as identity primary key,
  auditoria_id bigint not null references public.lead_dono_auditoria(id) on delete cascade,
  criado_em timestamptz not null,
  automacao_id bigint not null,
  lead_id bigint not null references public.leads(id) on delete cascade,
  corretor_id bigint not null references public.corretores(id) on delete cascade,
  escolhido_corretor_id bigint references public.corretores(id) on delete set null,
  resultado text not null check (resultado in ('recebeu','aguardou','pulado')),
  motivo text not null,
  unique (auditoria_id,corretor_id)
);

create index if not exists ix_motor_roleta_eventos_corretor_periodo
  on ncrm_private.motor_roleta_eventos(corretor_id,criado_em desc,resultado);

revoke all on ncrm_private.inteligencia_telemetria_config,
  ncrm_private.corretor_atividade_estado,
  ncrm_private.corretor_atividade_diaria,
  ncrm_private.motor_roleta_eventos
  from public,anon,authenticated;
grant select on ncrm_private.inteligencia_telemetria_config,
  ncrm_private.corretor_atividade_estado,
  ncrm_private.corretor_atividade_diaria,
  ncrm_private.motor_roleta_eventos
  to service_role;

create or replace function public.corretor_atividade_heartbeat(
  p_ativo boolean default false,
  p_no_escritorio boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_corretor_id bigint;
  v_agora timestamptz := clock_timestamp();
  v_dia date := (v_agora at time zone 'America/Sao_Paulo')::date;
  v_anterior ncrm_private.corretor_atividade_estado%rowtype;
  v_delta integer := 0;
begin
  select c.id into v_corretor_id
  from public.corretores c
  where c.usuario_id=auth.uid() and c.ativo
  limit 1;

  if v_corretor_id is null then
    return jsonb_build_object('ok',false,'motivo','usuario_sem_corretor_ativo');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('corretor_atividade:'||v_corretor_id,0));
  select * into v_anterior
  from ncrm_private.corretor_atividade_estado e
  where e.corretor_id=v_corretor_id
  for update;

  if v_anterior.corretor_id is not null then
    -- O navegador consulta a cada 20 s. Acima de 45 s houve suspensão, perda
    -- de rede ou aba congelada; esse intervalo não é vendido como trabalho.
    v_delta := greatest(0,least(45,floor(extract(epoch from (v_agora-v_anterior.ultimo_heartbeat_em)))::integer));
  end if;

  insert into ncrm_private.corretor_atividade_diaria(
    corretor_id,dia,segundos_logado,segundos_ativo,segundos_no_escritorio,
    primeiro_heartbeat_em,ultimo_heartbeat_em
  ) values (
    v_corretor_id,v_dia,v_delta,
    case when coalesce(v_anterior.ativo,p_ativo) then v_delta else 0 end,
    case when coalesce(v_anterior.no_escritorio,p_no_escritorio) then v_delta else 0 end,
    v_agora,v_agora
  )
  on conflict(corretor_id,dia) do update set
    segundos_logado=ncrm_private.corretor_atividade_diaria.segundos_logado+excluded.segundos_logado,
    segundos_ativo=ncrm_private.corretor_atividade_diaria.segundos_ativo+excluded.segundos_ativo,
    segundos_no_escritorio=ncrm_private.corretor_atividade_diaria.segundos_no_escritorio+excluded.segundos_no_escritorio,
    ultimo_heartbeat_em=excluded.ultimo_heartbeat_em;

  insert into ncrm_private.corretor_atividade_estado(corretor_id,ultimo_heartbeat_em,ativo,no_escritorio)
  values(v_corretor_id,v_agora,coalesce(p_ativo,false),coalesce(p_no_escritorio,false))
  on conflict(corretor_id) do update set
    ultimo_heartbeat_em=excluded.ultimo_heartbeat_em,
    ativo=excluded.ativo,
    no_escritorio=excluded.no_escritorio;

  return jsonb_build_object('ok',true,'corretor_id',v_corretor_id,'segundos_somados',v_delta);
end;
$$;

revoke all on function public.corretor_atividade_heartbeat(boolean,boolean)
  from public,anon;
grant execute on function public.corretor_atividade_heartbeat(boolean,boolean)
  to authenticated,service_role;

create or replace function ncrm_private.capturar_eventos_roleta()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_automacao_id bigint;
begin
  if new.origem !~ '^roleta_automacao_[0-9]+$' then return new; end if;
  v_automacao_id := substring(new.origem from '([0-9]+)$')::bigint;

  insert into ncrm_private.motor_roleta_eventos(
    auditoria_id,criado_em,automacao_id,lead_id,corretor_id,
    escolhido_corretor_id,resultado,motivo
  )
  with participantes as (
    select c.id corretor_id,
      bool_or(coalesce((b.bloco#>>'{options,distribuicao,onlineOnly}')::boolean,true)) exige_presenca
    from public.automacoes a
    cross join lateral jsonb_array_elements(coalesce(a.mapa#>'{automation,blocks}','[]'::jsonb)) b(bloco)
    cross join lateral jsonb_array_elements(coalesce(b.bloco#>'{options,distribuicao,items}','[]'::jsonb)) i(item)
    join public.corretores c
      on public.nome_normalizado(c.nome)=public.nome_normalizado(i.item->>'corretor')
    where a.id=v_automacao_id
      and b.bloco->>'type' in ('distribution','distribution-simple')
      and coalesce((i.item->>'on')::boolean,true)
      and coalesce(nullif(i.item->>'peso','')::numeric,1)>0
      and c.ativo
    group by c.id
  ), avaliados as (
    select p.*,
      case when p.exige_presenca then public.ncrm_corretor_elegibilidade(p.corretor_id,new.quando)
           else jsonb_build_object('elegivel',true,'motivo','bloco_sem_exigencia_de_presenca') end elegibilidade
    from participantes p
  )
  select new.id,new.quando,v_automacao_id,new.lead_id,a.corretor_id,new.para,
    case when a.corretor_id=new.para then 'recebeu'
         when coalesce((a.elegibilidade->>'elegivel')::boolean,false) then 'aguardou'
         else 'pulado' end,
    case when a.corretor_id=new.para then 'lead_recebido'
         when coalesce((a.elegibilidade->>'elegivel')::boolean,false) then 'rodizio_normal'
         else coalesce(a.elegibilidade->>'motivo','inelegivel_sem_motivo') end
  from avaliados a
  on conflict(auditoria_id,corretor_id) do nothing;

  return new;
exception when others then
  -- Telemetria jamais pode bloquear a entrega do lead.
  raise warning 'falha_telemetria_roleta auditoria=% erro=%',new.id,sqlerrm;
  return new;
end;
$$;

revoke all on function ncrm_private.capturar_eventos_roleta()
  from public,anon,authenticated;

drop trigger if exists trg_capturar_eventos_roleta on public.lead_dono_auditoria;
create trigger trg_capturar_eventos_roleta
after insert on public.lead_dono_auditoria
for each row execute function ncrm_private.capturar_eventos_roleta();

create or replace function ncrm_private.inteligencia_corretor_telemetria(
  p_corretor_id bigint,
  p_desde timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'horas_erp',coalesce((
      select round(sum(d.segundos_logado)::numeric/3600,2)
      from ncrm_private.corretor_atividade_diaria d
      where d.corretor_id=p_corretor_id
        and d.dia >= (p_desde at time zone 'America/Sao_Paulo')::date
    ),0),
    'horas_ativas_erp',coalesce((
      select round(sum(d.segundos_ativo)::numeric/3600,2)
      from ncrm_private.corretor_atividade_diaria d
      where d.corretor_id=p_corretor_id
        and d.dia >= (p_desde at time zone 'America/Sao_Paulo')::date
    ),0),
    'horas_no_escritorio',coalesce((
      select round(sum(d.segundos_no_escritorio)::numeric/3600,2)
      from ncrm_private.corretor_atividade_diaria d
      where d.corretor_id=p_corretor_id
        and d.dia >= (p_desde at time zone 'America/Sao_Paulo')::date
    ),0),
    'atividade_diaria',coalesce((
      select jsonb_agg(jsonb_build_object(
        'dia',d.dia,
        'horas_logado',round(d.segundos_logado::numeric/3600,2),
        'horas_ativas',round(d.segundos_ativo::numeric/3600,2),
        'horas_no_escritorio',round(d.segundos_no_escritorio::numeric/3600,2)
      ) order by d.dia desc)
      from ncrm_private.corretor_atividade_diaria d
      where d.corretor_id=p_corretor_id
        and d.dia >= (p_desde at time zone 'America/Sao_Paulo')::date
    ),'[]'::jsonb),
    'pulos_distribuicao',(
      select count(*) from ncrm_private.motor_roleta_eventos e
      where e.corretor_id=p_corretor_id and e.criado_em>=p_desde and e.resultado='pulado'
    ),
    'recebidos_distribuicao',(
      select count(*) from ncrm_private.motor_roleta_eventos e
      where e.corretor_id=p_corretor_id and e.criado_em>=p_desde and e.resultado='recebeu'
    ),
    'pulos_motivos',coalesce((
      select jsonb_agg(jsonb_build_object('motivo',x.motivo,'quantidade',x.quantidade) order by x.quantidade desc)
      from (
        select e.motivo,count(*)::bigint quantidade
        from ncrm_private.motor_roleta_eventos e
        where e.corretor_id=p_corretor_id and e.criado_em>=p_desde and e.resultado='pulado'
        group by e.motivo
      ) x
    ),'[]'::jsonb),
    'horas_medidas_desde',(select horas_desde from ncrm_private.inteligencia_telemetria_config where id=1),
    'pulos_medidos_desde',(select pulos_desde from ncrm_private.inteligencia_telemetria_config where id=1),
    'horas_erp_motivo','Logado = ERP aberto com heartbeat. Ativo = tela visível e interação recente. Intervalos suspensos não entram.',
    'pulos_distribuicao_motivo','Conta somente quando estava configurado, mas inelegível. Corretor elegível aguardando o rodízio não é pulo.'
  );
$$;

revoke all on function ncrm_private.inteligencia_corretor_telemetria(bigint,timestamptz)
  from public,anon,authenticated;

-- Enriquece a RPC canônica existente; não cria uma segunda camada de leitura.
do $patch$
declare
  v_oid oid;
  v_def text;
  v_old text := $old$
      'horas_erp',null,'horas_erp_motivo','O ERP ainda não registra início e fim de sessão individual.',
      'pulos_distribuicao',null,'pulos_distribuicao_motivo','A roleta ainda não persiste cada pulo por corretor.'
$old$;
  v_new text := $new$
      'telemetria_operacional',true
    ) || ncrm_private.inteligencia_corretor_telemetria(b.corretor_id,v_since
$new$;
  v_fontes_old text := $old$
      jsonb_build_object('nome','Presença','status','parcial','motivo','Mede confirmações e dias úteis sem confirmação; não mede horas.'),
      jsonb_build_object('nome','Horas no ERP','status','ausente','motivo','Ainda não existe sessão individual confiável.'),
      jsonb_build_object('nome','Pulos da distribuição','status','ausente','motivo','A roleta não grava o histórico de cada pulo.')
$old$;
  v_fontes_new text := $new$
      jsonb_build_object('nome','Presença e horas no ERP','status','conectado','motivo','Heartbeat separado em tempo logado, ativo e no escritório.'),
      jsonb_build_object('nome','Pulos da distribuição','status','conectado','motivo','Cada decisão futura da roleta preserva recebido, aguardou ou pulado e o motivo.')
$new$;
begin
  select p.oid,pg_get_functiondef(p.oid) into v_oid,v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='tracking_360_ceo'
    and pg_get_function_identity_arguments(p.oid)='p_days integer';
  if v_oid is null then raise exception 'tracking_360_ceo_nao_encontrada'; end if;
  if position(v_old in v_def)=0 then raise exception 'ancora_telemetria_nao_encontrada'; end if;
  if position(v_fontes_old in v_def)=0 then raise exception 'ancora_fontes_nao_encontrada'; end if;
  v_def := replace(v_def,v_old,v_new);
  v_def := replace(v_def,v_fontes_old,v_fontes_new);
  execute v_def;
end;
$patch$;

comment on function public.corretor_atividade_heartbeat(boolean,boolean) is
  'Acumula tempo logado, ativo e no escritório por corretor sem contar abas duplicadas.';
comment on table ncrm_private.motor_roleta_eventos is
  'Histórico imutável das decisões da roleta: recebeu, aguardou o rodízio ou foi pulado por inelegibilidade.';

commit;
