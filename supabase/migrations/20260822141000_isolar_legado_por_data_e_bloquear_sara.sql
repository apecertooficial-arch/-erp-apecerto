-- A operacao automatica passa a reconhecer como frescos somente os cards
-- materializados no Funil 2.0 a partir de 20/08/2026 (America/Sao_Paulo).
-- Todo card anterior fica preservado em Leads legado e fora dos sensores.

begin;

set local statement_timeout = '60s';
set local lock_timeout = '10s';

select pg_advisory_xact_lock(hashtext('motor_relogio_central'));

create table if not exists private.central_legado_corte_audit (
  funil_lead_id uuid primary key,
  corte timestamptz not null,
  etapa_anterior text,
  momento_anterior text,
  acao_anterior text,
  acao_rotulo_anterior text,
  prazo_anterior timestamptz,
  cadencia_anterior smallint,
  versao_anterior integer,
  registrado_em timestamptz not null default now()
);

revoke all on table private.central_legado_corte_audit from public, anon, authenticated;

create or replace function public.f2_lead_automatico_elegivel(p_funil_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
      from public.f2_lead f
     where f.id = p_funil_lead_id
       and f.descartado_em is null
       and f.etapa <> 'legado'
       and f.criado_em >= timestamptz '2026-08-20 03:00:00+00'
  );
$fn$;

revoke all on function public.f2_lead_automatico_elegivel(uuid)
  from public, anon, authenticated;
grant execute on function public.f2_lead_automatico_elegivel(uuid) to service_role;

create or replace function public.motor_evento_mensagem(p_limite integer default 150)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $fn$
declare r record; v_leads int:=0; v_disparos int:=0;
begin
  if not exists(select 1 from motor_flags where nome='eventos' and ativo) then
    return jsonb_build_object('ok',true,'motivo','eventos desligados em motor_flags');
  end if;

  for r in
    select * from (
      select f.id card,f.momento_codigo,l.nome,l.telefone,l.email,
             'mensagem_recebida' evento,'lead-mensagem-recebida-trigger' gatilho,
             s.cliente_ultima marca
        from f2_lead f join negocios ng on ng.id=f.origem_negocio_id
        join leads l on l.id=ng.lead_id join sla_msg_cache s on s.lead_id=ng.lead_id
       where public.f2_lead_automatico_elegivel(f.id) and s.cliente_ultima is not null
         and s.cliente_ultima>coalesce((select v.marca from motor_evento_visto v
              where v.evento='mensagem_recebida' and v.funil_lead_id=f.id),'-infinity')
      union all
      select f.id,f.momento_codigo,l.nome,l.telefone,l.email,
             'mensagem_enviada','lead-mensagem-enviada-trigger',s.env_ultima
        from f2_lead f join negocios ng on ng.id=f.origem_negocio_id
        join leads l on l.id=ng.lead_id join sla_msg_cache s on s.lead_id=ng.lead_id
       where public.f2_lead_automatico_elegivel(f.id) and s.env_ultima is not null
         and s.env_ultima>coalesce((select v.marca from motor_evento_visto v
              where v.evento='mensagem_enviada' and v.funil_lead_id=f.id),'-infinity')
    ) novos
    order by marca
    limit greatest(1,least(coalesce(p_limite,150),500))
  loop
    v_disparos:=v_disparos+motor_evento_disparar(
      r.gatilho,jsonb_build_object(
        'nome',coalesce(r.nome,'Lead'),'telefone',coalesce(r.telefone,''),
        'email',coalesce(r.email,''),'__funil_lead_id',r.card,
        '__motor_priority',0,'__motor_evento',r.evento
      ),r.momento_codigo);
    insert into motor_evento_visto(evento,funil_lead_id,marca)
    values(r.evento,r.card,r.marca)
    on conflict(evento,funil_lead_id) do update
      set marca=excluded.marca,atualizado_em=now();
    v_leads:=v_leads+1;
  end loop;
  return jsonb_build_object('ok',true,'eventos_lidos',v_leads,
    'automacoes_disparadas',v_disparos);
end
$fn$;

create or replace function public.sara_checagem_diaria(p_limite integer default 12)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $fn$
declare v_n int:=0; r record;
begin
  for r in
    select f.id,f.momento_codigo,coalesce(l.nome,f.nome) nome,
           coalesce(l.telefone,f.telefone) tel,l.email,
           s.ultima_interacao,a.ultima_consulta_em
      from f2_lead f
      left join negocios ng on ng.id=f.origem_negocio_id
      left join leads l on l.id=ng.lead_id
      left join sla_msg_cache s on s.lead_id=ng.lead_id
      left join lateral(
        select sa.ultima_consulta_em from f2_sara_analise sa
         where sa.funil_lead_id=f.id order by sa.ultima_consulta_em desc limit 1
      ) a on true
     where public.f2_lead_automatico_elegivel(f.id)
       and (a.ultima_consulta_em is null
         or s.ultima_interacao>a.ultima_consulta_em
         or a.ultima_consulta_em<=now()-interval '24 hours')
     order by (s.ultima_interacao>a.ultima_consulta_em) desc nulls last,
              a.ultima_consulta_em nulls first,f.criado_em
     limit greatest(1,least(coalesce(p_limite,12),50))
  loop
    v_n:=v_n+motor_evento_disparar('checagem-diaria-trigger',
      jsonb_build_object(
        'nome',r.nome,'telefone',coalesce(r.tel,''),'email',coalesce(r.email,''),
        '__funil_lead_id',r.id,'__motor_priority',20,
        '__motor_evento','checagem_diaria'
      ),r.momento_codigo);
  end loop;
  return jsonb_build_object('ok',true,'disparos_na_central',v_n);
end
$fn$;

create or replace function public.motor_evento_prazo(p_limite integer default 150)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $fn$
declare r record; v_leads int := 0; v_disparos int := 0;
begin
  if not exists(select 1 from motor_flags where nome='eventos' and ativo) then
    return jsonb_build_object('ok', true, 'motivo', 'eventos desligados em motor_flags');
  end if;
  for r in
    select f.id as card, f.momento_codigo, f.proxima_acao_em, l.nome, l.telefone, l.email
      from f2_lead f join negocios ng on ng.id = f.origem_negocio_id
      join leads l on l.id = ng.lead_id
     where public.f2_lead_automatico_elegivel(f.id)
       and f.proxima_acao_em is not null and f.proxima_acao_em < now()
       and f.proxima_acao_em > coalesce((select v.marca from motor_evento_visto v
         where v.evento = 'prazo' and v.funil_lead_id = f.id),'-infinity'::timestamptz)
     order by f.proxima_acao_em
     limit greatest(1, least(coalesce(p_limite,150), 500))
  loop
    v_disparos := v_disparos + motor_evento_disparar('momento-prazo-vencido-trigger',
      jsonb_build_object('nome',coalesce(r.nome,'Lead'),'telefone',coalesce(r.telefone,''),
        'email',coalesce(r.email,''),'__funil_lead_id',r.card),r.momento_codigo);
    insert into motor_evento_visto(evento,funil_lead_id,marca)
    values ('prazo',r.card,r.proxima_acao_em)
    on conflict(evento,funil_lead_id) do update set marca=excluded.marca,atualizado_em=now();
    v_leads:=v_leads+1;
  end loop;
  return jsonb_build_object('ok',true,'leads',v_leads,'automacoes_disparadas',v_disparos);
end
$fn$;

create or replace function public.motor_evento_retomar(p_limite integer default 100)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $fn$
declare r record; v_leads int := 0; v_disparos int := 0;
begin
  if not exists(select 1 from motor_flags where nome='eventos' and ativo) then
    return jsonb_build_object('ok', true, 'motivo', 'eventos desligados em motor_flags');
  end if;
  for r in
    select f.id as card,f.momento_codigo,f.proxima_acao_em,l.nome,l.telefone,l.email
      from f2_lead f join negocios ng on ng.id=f.origem_negocio_id
      join leads l on l.id=ng.lead_id
     where public.f2_lead_automatico_elegivel(f.id)
       and f.momento_codigo='RETOMAR_NA_DATA' and f.proxima_acao_em is not null
       and f.proxima_acao_em<=now()
       and f.proxima_acao_em>coalesce((select v.marca from motor_evento_visto v
         where v.evento='retomar' and v.funil_lead_id=f.id),'-infinity'::timestamptz)
     order by f.proxima_acao_em
     limit greatest(1,least(coalesce(p_limite,100),300))
  loop
    v_disparos:=v_disparos+motor_evento_disparar('retomar-na-data-trigger',
      jsonb_build_object('nome',coalesce(r.nome,'Lead'),'telefone',coalesce(r.telefone,''),
        'email',coalesce(r.email,''),'__funil_lead_id',r.card),r.momento_codigo);
    insert into motor_evento_visto(evento,funil_lead_id,marca)
    values('retomar',r.card,r.proxima_acao_em)
    on conflict(evento,funil_lead_id) do update set marca=excluded.marca,atualizado_em=now();
    v_leads:=v_leads+1;
  end loop;
  return jsonb_build_object('ok',true,'leads',v_leads,'automacoes_disparadas',v_disparos);
end
$fn$;

-- As duas protecoes abaixo fecham a corrida entre um sensor e a fila: mesmo
-- que um item antigo ja tivesse sido reclamado, a IA nao consulta nem aplica.
do $patch_guards$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_agente' limit 1;
  if position('if v_card is null then return jsonb_build_object' in v_def)=0 then
    raise exception 'motor_agente_sem_ancora_de_elegibilidade';
  end if;
  v_new:=replace(v_def,
    'if v_card is null then return jsonb_build_object(''ok'',false,''erro'',''lead_fora_do_funil''); end if;',
    'if v_card is null or not public.f2_lead_automatico_elegivel(v_card) then return jsonb_build_object(''ok'',false,''erro'',''lead_fora_do_funil''); end if;');
  if v_new=v_def then raise exception 'motor_agente_guard_nao_aplicado'; end if;
  execute v_new;

  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='f2_sara_aplicar_analise' limit 1;
  v_new:=replace(v_def,
    'if not found then return jsonb_build_object(''ok'',false,''erro'',''lead_inexistente''); end if;',
    'if not found then return jsonb_build_object(''ok'',false,''erro'',''lead_inexistente''); end if;'||chr(10)||
    '  if not public.f2_lead_automatico_elegivel(v_f.id) then return jsonb_build_object(''ok'',false,''erro'',''lead_fora_do_funil''); end if;');
  if v_new=v_def then raise exception 'f2_sara_aplicar_guard_nao_aplicado'; end if;
  execute v_new;

  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='f2_sara_registrar_sugestao' limit 1;
  v_new:=replace(v_def,
    'if not found then return jsonb_build_object(''ok'',false,''erro'',''lead_inexistente''); end if;',
    'if not found then return jsonb_build_object(''ok'',false,''erro'',''lead_inexistente''); end if;'||chr(10)||
    '  if not public.f2_lead_automatico_elegivel(v_lead.id) then return jsonb_build_object(''ok'',false,''erro'',''lead_fora_do_funil''); end if;');
  if v_new=v_def then raise exception 'f2_sara_registrar_guard_nao_aplicado'; end if;
  execute v_new;
end
$patch_guards$;

insert into private.central_legado_corte_audit(
  funil_lead_id,corte,etapa_anterior,momento_anterior,acao_anterior,
  acao_rotulo_anterior,prazo_anterior,cadencia_anterior,versao_anterior
)
select f.id,timestamptz '2026-08-20 03:00:00+00',f.etapa,f.momento_codigo,
       f.acao_codigo,f.acao_rotulo,f.proxima_acao_em,f.cadencia_passo,f.versao
  from public.f2_lead f
 where f.criado_em<timestamptz '2026-08-20 03:00:00+00'
on conflict(funil_lead_id) do nothing;

update public.motor_fila mf
   set status='cancelado',processado_em=now(),ultimo_erro='LEAD_LEGADO_FORA_DA_AUTOMACAO'
 where mf.status='pendente' and mf.automacao_id in (49,64,69)
   and nullif(mf.lead->>'__funil_lead_id','')::uuid in (
     select f.id from public.f2_lead f
      where f.criado_em<timestamptz '2026-08-20 03:00:00+00'
   );

update public.f2_sara_analise a
   set status='obsoleta'
 where a.status='sugerida'
   and a.funil_lead_id in (
     select f.id from public.f2_lead f
      where f.criado_em<timestamptz '2026-08-20 03:00:00+00'
   );

select set_config('motor.suppress','1',true);

insert into public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
select f.id,'momento_alterado','Movido para Leads legado',
       'Card anterior a 20/08/2026 isolado das atualizacoes automaticas.',
       jsonb_build_object('motivo','corte_deterministico_2026_08_20',
         'etapa_anterior',f.etapa,'momento_anterior',f.momento_codigo),null
  from public.f2_lead f
 where f.criado_em<timestamptz '2026-08-20 03:00:00+00'
   and (f.etapa<>'legado' or f.momento_codigo<>'LEAD_LEGADO');

update public.f2_lead f
   set etapa='legado',momento_codigo='LEAD_LEGADO',
       acao_codigo='reativar_quando_quente',acao_rotulo='Fora da fila ativa',
       proxima_acao_em=public.f2_sem_prazo(),cadencia_passo=0,
       atualizado_em=now(),versao=f.versao+1,
       ultima_reavaliacao_resumo='Lead legado fora das atualizacoes automaticas desde 20/08/2026.'
 where f.criado_em<timestamptz '2026-08-20 03:00:00+00'
   and (f.etapa<>'legado' or f.momento_codigo<>'LEAD_LEGADO');

revoke all on function public.motor_evento_mensagem(integer),
  public.sara_checagem_diaria(integer),public.motor_evento_prazo(integer),
  public.motor_evento_retomar(integer) from public,anon,authenticated;
grant execute on function public.motor_evento_mensagem(integer),
  public.sara_checagem_diaria(integer),public.motor_evento_prazo(integer),
  public.motor_evento_retomar(integer) to service_role;

do $verify$
begin
  if exists(select 1 from public.f2_lead f
    where f.criado_em<timestamptz '2026-08-20 03:00:00+00'
      and (f.etapa<>'legado' or f.momento_codigo<>'LEAD_LEGADO')) then
    raise exception 'LEGADO_NAO_ISOLADO';
  end if;
  if exists(select 1 from public.f2_lead f
    where f.criado_em<timestamptz '2026-08-20 03:00:00+00'
      and public.f2_lead_automatico_elegivel(f.id)) then
    raise exception 'LEGADO_AINDA_ELEGIVEL';
  end if;
end
$verify$;

commit;
