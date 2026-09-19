-- DRAFT NÃO APLICADO — P0: ownership nas mutações humanas do CRM.
--
-- Evidência no projeto canônico em 2026-09-19: RPCs SECURITY DEFINER de
-- transferência, descarte, ação e observação alteram linhas sem validar o
-- dono do negócio/lead. SECURITY DEFINER ignora o RLS das tabelas.
--
-- Este arquivo preserva as assinaturas usadas pelo ERP, adiciona lock por
-- objeto, escopo por corretor/hierarquia, transições determinísticas,
-- idempotência de estado e auditoria sanitizada. `redistribuir_lead` fica
-- service-only: gestão deve escolher o destino por `transferir_negocio`.
--
-- Gate obrigatório: executar primeiro em Supabase/Postgres isolado com
-- corretor dono, corretor alheio, destinatário, gerente da equipe, gestor fora
-- da equipe, admin e service_role. O projeto principal NÃO é laboratório.

begin;

create index if not exists atendimento_acoes_negocio_criado_idx
  on public.atendimento_acoes(negocio_id, criado_em desc);

create or replace function public.transferir_negocio(
  p_negocio_id bigint,
  p_corretor_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce((select auth.role()), '');
  v_actor uuid := (select auth.uid());
  v_self bigint := public.current_broker_id();
  v_neg public.negocios%rowtype;
  v_accepting boolean := false;
  v_can_manage boolean := false;
  v_stage bigint;
begin
  if v_role not in ('authenticated', 'service_role') then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'nao_autorizado');
  end if;
  if p_corretor_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'corretor_invalido');
  end if;
  if not exists (
    select 1 from public.corretores c
    where c.id = p_corretor_id and c.ativo
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'corretor_indisponivel');
  end if;

  select * into v_neg
    from public.negocios
   where id = p_negocio_id
   for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'negocio_nao_encontrado');
  end if;

  if v_neg.corretor_id = p_corretor_id then
    return pg_catalog.jsonb_build_object(
      'ok', true, 'unchanged', true, 'negocio', p_negocio_id,
      'lead', v_neg.lead_id, 'corretor', p_corretor_id
    );
  end if;

  v_can_manage := v_role = 'service_role'
    or public.can_manage_all()
    or public.manages_broker(v_neg.corretor_id);
  v_accepting := v_role = 'authenticated'
    and v_self = p_corretor_id
    and v_neg.transferencia_status = 'pendente'
    and v_neg.transferencia_para = p_corretor_id;

  if not v_can_manage and not v_accepting then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'fora_do_escopo');
  end if;

  if v_accepting then
    select s.id into v_stage
      from public.pipeline_stages s
     where s.pipeline_id = v_neg.pipeline_id
       and s.chave = 'em_atendimento'
     order by s.ordem, s.id
     limit 1;
    if v_stage is null then
      return pg_catalog.jsonb_build_object('ok', false, 'error', 'etapa_em_atendimento_ausente');
    end if;
  end if;

  update public.negocios
     set corretor_id = p_corretor_id,
         stage_id = case when v_accepting then v_stage else stage_id end,
         transferencia_para = null,
         transferencia_status = case when v_accepting then 'aceito' else 'concluida' end,
         ultima_movimentacao = pg_catalog.now()
   where id = p_negocio_id;

  update public.leads
     set corretor_id = p_corretor_id,
         atualizado_em = pg_catalog.now()
   where id = v_neg.lead_id;

  if v_actor is not null then
    perform public.registrar_auditoria(
      case when v_accepting then 'aceitar_transferencia' else 'transferir_negocio' end,
      'crm', 'negocios', p_negocio_id::text,
      pg_catalog.jsonb_build_object('corretor_id', v_neg.corretor_id),
      pg_catalog.jsonb_build_object('corretor_id', p_corretor_id),
      case when v_accepting then 'aceite_do_destinatario' else 'reassignacao_gestao' end
    );
  end if;

  begin
    perform public.perf_log(
      p_corretor_id, 'lead_recebido', v_neg.lead_id, p_negocio_id,
      1, null, 'transferencia', pg_catalog.now(),
      pg_catalog.jsonb_build_object('negocio', p_negocio_id)
    );
  exception when others then
    null;
  end;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'negocio', p_negocio_id, 'lead', v_neg.lead_id,
    'corretor', p_corretor_id,
    'modo', case when v_accepting then 'aceite' else 'gestao' end
  );
end;
$function$;

create or replace function public.transferir_com_aceite(
  p_negocio bigint,
  p_corretor bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce((select auth.role()), '');
  v_self bigint := public.current_broker_id();
  v_neg public.negocios%rowtype;
  v_stage bigint;
  v_can_manage boolean := false;
begin
  if v_role not in ('authenticated', 'service_role') then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'nao_autorizado');
  end if;
  if p_corretor is null or not exists (
    select 1 from public.corretores c where c.id = p_corretor and c.ativo
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'corretor_indisponivel');
  end if;

  select * into v_neg
    from public.negocios
   where id = p_negocio
   for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'negocio_nao_encontrado');
  end if;
  if v_neg.corretor_id = p_corretor then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'ja_e_responsavel');
  end if;

  v_can_manage := v_role = 'service_role'
    or public.can_manage_all()
    or public.manages_broker(v_neg.corretor_id);
  if not v_can_manage and v_self is distinct from v_neg.corretor_id then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'fora_do_escopo');
  end if;

  if v_neg.transferencia_status = 'pendente'
     and v_neg.transferencia_para = p_corretor then
    return pg_catalog.jsonb_build_object(
      'ok', true, 'unchanged', true, 'aguardando_aceite', p_corretor
    );
  end if;

  select s.id into v_stage
    from public.pipeline_stages s
   where s.pipeline_id = v_neg.pipeline_id
     and s.chave = 'repassar_corretor'
   order by s.ordem, s.id
   limit 1;
  if v_stage is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'etapa_repassar_ausente');
  end if;

  update public.negocios
     set transferencia_para = p_corretor,
         transferencia_status = 'pendente',
         stage_id = v_stage,
         ultima_movimentacao = pg_catalog.now()
   where id = p_negocio;

  if auth.uid() is not null then
    perform public.registrar_auditoria(
      'oferecer_transferencia', 'crm', 'negocios', p_negocio::text,
      pg_catalog.jsonb_build_object('corretor_id', v_neg.corretor_id),
      pg_catalog.jsonb_build_object('transferencia_para', p_corretor, 'status', 'pendente'),
      'aguardando_aceite_do_destinatario'
    );
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'aguardando_aceite', p_corretor);
end;
$function$;

create or replace function public.aceitar_transferencia(
  p_negocio bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce((select auth.role()), '');
  v_self bigint := public.current_broker_id();
  v_neg public.negocios%rowtype;
begin
  if v_role <> 'authenticated' or v_self is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'nao_autorizado');
  end if;

  select * into v_neg
    from public.negocios
   where id = p_negocio
   for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'negocio_nao_encontrado');
  end if;
  if v_neg.transferencia_status = 'aceito' and v_neg.corretor_id = v_self then
    return pg_catalog.jsonb_build_object('ok', true, 'unchanged', true, 'corretor', v_self);
  end if;
  if v_neg.transferencia_status <> 'pendente'
     or v_neg.transferencia_para is distinct from v_self then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'transferencia_nao_destinada_ao_usuario');
  end if;

  return public.transferir_negocio(p_negocio, v_self);
end;
$function$;

create or replace function public.solicitar_descarte(
  p_negocio bigint,
  p_motivo text,
  p_obs text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce((select auth.role()), '');
  v_self bigint := public.current_broker_id();
  v_neg public.negocios%rowtype;
  v_stage bigint;
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_obs text := nullif(pg_catalog.btrim(coalesce(p_obs, '')), '');
  v_can_manage boolean := false;
begin
  if v_role not in ('authenticated', 'service_role') then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'nao_autorizado');
  end if;
  if not exists (select 1 from public.motivos_descarte m where m.motivo = v_motivo) then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'motivo_invalido');
  end if;
  if pg_catalog.length(coalesce(v_obs, '')) > 2000 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'observacao_muito_longa');
  end if;

  select * into v_neg
    from public.negocios
   where id = p_negocio
   for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'negocio_nao_encontrado');
  end if;

  v_can_manage := v_role = 'service_role'
    or public.can_manage_all()
    or public.manages_broker(v_neg.corretor_id);
  if not v_can_manage and v_self is distinct from v_neg.corretor_id then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'fora_do_escopo');
  end if;
  if v_neg.descarte_status = 'solicitado' and v_neg.descarte_motivo = v_motivo then
    return pg_catalog.jsonb_build_object('ok', true, 'unchanged', true);
  end if;

  select s.id into v_stage
    from public.pipeline_stages s
   where s.pipeline_id = v_neg.pipeline_id
     and s.chave = 'sol_descarte'
   order by s.ordem, s.id
   limit 1;
  if v_stage is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'etapa_solicitacao_descarte_ausente');
  end if;

  update public.negocios
     set descarte_status = 'solicitado',
         descarte_motivo = v_motivo,
         stage_id = v_stage,
         ultima_movimentacao = pg_catalog.now()
   where id = p_negocio;

  perform public.registrar_acao(
    p_negocio, 'observacao',
    'Solicitou descarte: ' || v_motivo || coalesce(' — ' || v_obs, ''),
    'sistema', null, 24
  );
  if auth.uid() is not null then
    perform public.registrar_auditoria(
      'solicitar_descarte', 'crm', 'negocios', p_negocio::text,
      pg_catalog.jsonb_build_object('status', v_neg.descarte_status),
      pg_catalog.jsonb_build_object('status', 'solicitado', 'motivo', v_motivo),
      null
    );
  end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.aprovar_descarte(
  p_negocio bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce((select auth.role()), '');
  v_neg public.negocios%rowtype;
  v_stage bigint;
  v_can_manage boolean := false;
begin
  if v_role not in ('authenticated', 'service_role') then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'nao_autorizado');
  end if;

  select * into v_neg
    from public.negocios
   where id = p_negocio
   for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'negocio_nao_encontrado');
  end if;
  if v_neg.descarte_status = 'aprovado' and v_neg.status = 'descartado' then
    return pg_catalog.jsonb_build_object('ok', true, 'unchanged', true);
  end if;

  v_can_manage := v_role = 'service_role'
    or public.can_manage_all()
    or public.manages_broker(v_neg.corretor_id);
  if not v_can_manage then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'gestao_obrigatoria');
  end if;
  if v_neg.descarte_status <> 'solicitado' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'descarte_nao_solicitado');
  end if;

  select s.id into v_stage
    from public.pipeline_stages s
   where s.pipeline_id = v_neg.pipeline_id
     and s.chave = 'descarte'
   order by s.ordem, s.id
   limit 1;
  if v_stage is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'etapa_descarte_ausente');
  end if;

  update public.negocios
     set descarte_status = 'aprovado',
         status = 'descartado',
         stage_id = v_stage,
         ultima_movimentacao = pg_catalog.now()
   where id = p_negocio;

  if auth.uid() is not null then
    perform public.registrar_auditoria(
      'aprovar_descarte', 'crm', 'negocios', p_negocio::text,
      pg_catalog.jsonb_build_object('status', v_neg.status, 'descarte_status', v_neg.descarte_status),
      pg_catalog.jsonb_build_object('status', 'descartado', 'descarte_status', 'aprovado'),
      null
    );
  end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.registrar_acao(
  p_negocio bigint,
  p_tipo text,
  p_texto text default null,
  p_canal text default null,
  p_resultado text default null,
  p_prox_horas integer default 24
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce((select auth.role()), '');
  v_actor uuid := (select auth.uid());
  v_self bigint := public.current_broker_id();
  v_neg public.negocios%rowtype;
  v_tipo text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_tipo, '')));
  v_texto text := nullif(pg_catalog.btrim(coalesce(p_texto, '')), '');
  v_tent smallint;
  v_perf text;
  v_existing bigint;
  v_action bigint;
  v_can_manage boolean := false;
begin
  if v_role not in ('authenticated', 'service_role') then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'nao_autorizado');
  end if;
  if v_tipo !~ '^[a-z0-9_]{2,40}$'
     or pg_catalog.length(coalesce(v_texto, '')) > 4000
     or pg_catalog.length(coalesce(p_canal, '')) > 80
     or pg_catalog.length(coalesce(p_resultado, '')) > 1000
     or p_prox_horas not between 1 and 720 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'acao_invalida');
  end if;

  select * into v_neg
    from public.negocios
   where id = p_negocio
   for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'negocio_nao_encontrado');
  end if;

  v_can_manage := v_role = 'service_role'
    or public.can_manage_all()
    or public.manages_broker(v_neg.corretor_id);
  if not v_can_manage and v_self is distinct from v_neg.corretor_id then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'fora_do_escopo');
  end if;

  select a.id into v_existing
    from public.atendimento_acoes a
   where a.negocio_id = p_negocio
     and a.tipo = v_tipo
     and a.criado_por is not distinct from v_actor
     and a.texto is not distinct from v_texto
     and a.resultado is not distinct from p_resultado
     and a.criado_em >= pg_catalog.now() - interval '10 seconds'
   order by a.criado_em desc
   limit 1;
  if v_existing is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'unchanged', true, 'acao_id', v_existing);
  end if;

  v_tent := coalesce(v_neg.tentativa, 0);
  insert into public.atendimento_acoes(
    negocio_id, lead_id, corretor_id, tipo, canal, texto, resultado, criado_por
  ) values (
    p_negocio, v_neg.lead_id, v_neg.corretor_id, v_tipo,
    nullif(pg_catalog.btrim(coalesce(p_canal, '')), ''),
    v_texto, nullif(pg_catalog.btrim(coalesce(p_resultado, '')), ''), v_actor
  ) returning id into v_action;

  v_perf := case v_tipo
    when 'ligacao' then 'ligacao'
    when 'visita' then 'visita_marcada'
    when 'proposta' then 'proposta_emitida'
    when 'followup' then 'followup'
    else 'mensagem_enviada'
  end;
  begin
    perform public.perf_log(
      v_neg.corretor_id, v_perf, v_neg.lead_id, p_negocio,
      1, null, 'atendimento', pg_catalog.now(),
      pg_catalog.jsonb_build_object('tipo', v_tipo, 'canal', p_canal, 'resultado', p_resultado)
    );
  exception when others then
    null;
  end;

  if v_tipo = 'followup' then
    v_tent := pg_catalog.least(v_tent + 1, coalesce(v_neg.max_tentativas, 6));
    update public.negocios
       set tentativa = v_tent, ultima_movimentacao = pg_catalog.now()
     where id = p_negocio;
    insert into public.crm_tarefas(
      lead_id, negocio_id, corretor_id, titulo, vencimento, prioridade, criado_por
    ) values (
      v_neg.lead_id, p_negocio, v_neg.corretor_id,
      'Follow-up tentativa ' || (v_tent + 1) || ' de ' || coalesce(v_neg.max_tentativas, 6),
      pg_catalog.now() + pg_catalog.make_interval(hours => p_prox_horas),
      'normal', v_actor
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'negocio', p_negocio, 'tentativa', v_tent,
    'acao', v_tipo, 'acao_id', v_action
  );
end;
$function$;

create or replace function public.registrar_observacao(
  p_lead_id bigint,
  p_texto text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce((select auth.role()), '');
  v_actor uuid := (select auth.uid());
  v_self bigint := public.current_broker_id();
  v_lead public.leads%rowtype;
  v_texto text := pg_catalog.btrim(coalesce(p_texto, ''));
  v_existing bigint;
  v_action bigint;
  v_can_manage boolean := false;
begin
  if v_role not in ('authenticated', 'service_role') then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'nao_autorizado');
  end if;
  if v_texto = '' or pg_catalog.length(v_texto) > 4000 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'texto_invalido');
  end if;

  select * into v_lead
    from public.leads
   where id = p_lead_id
   for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'lead_nao_encontrado');
  end if;

  v_can_manage := v_role = 'service_role'
    or public.can_manage_all()
    or public.manages_broker(v_lead.corretor_id);
  if not v_can_manage and v_self is distinct from v_lead.corretor_id then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'fora_do_escopo');
  end if;

  select a.id into v_existing
    from public.atendimento_acoes a
   where a.lead_id = p_lead_id
     and a.tipo = 'observacao'
     and a.criado_por is not distinct from v_actor
     and a.texto = v_texto
     and a.criado_em >= pg_catalog.now() - interval '10 seconds'
   order by a.criado_em desc
   limit 1;
  if v_existing is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'unchanged', true, 'acao_id', v_existing);
  end if;

  insert into public.atendimento_acoes(
    lead_id, corretor_id, tipo, canal, texto, criado_por, criado_em
  ) values (
    p_lead_id, v_lead.corretor_id, 'observacao', 'chat', v_texto,
    v_actor, pg_catalog.now()
  ) returning id into v_action;

  if v_actor is not null then
    perform public.registrar_auditoria(
      'registrar_observacao', 'crm', 'leads', p_lead_id::text,
      null, pg_catalog.jsonb_build_object('acao_id', v_action), null
    );
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'acao_id', v_action);
end;
$function$;

-- A roleta sem chave idempotente não pode ser uma ação humana repetível.
-- Mantém o corpo atual para os workers, mas fecha a execução direta do usuário.
revoke execute on function public.redistribuir_lead(bigint)
  from public, anon, authenticated;
grant execute on function public.redistribuir_lead(bigint) to service_role;

do $contract$
declare
  v_authenticated regprocedure[] := array[
    'public.transferir_negocio(bigint,bigint)'::regprocedure,
    'public.transferir_com_aceite(bigint,bigint)'::regprocedure,
    'public.aceitar_transferencia(bigint)'::regprocedure,
    'public.solicitar_descarte(bigint,text,text)'::regprocedure,
    'public.aprovar_descarte(bigint)'::regprocedure,
    'public.registrar_acao(bigint,text,text,text,text,integer)'::regprocedure,
    'public.registrar_observacao(bigint,text)'::regprocedure
  ];
  v_fn regprocedure;
begin
  foreach v_fn in array v_authenticated loop
    execute pg_catalog.format('revoke execute on function %s from public, anon', v_fn);
    execute pg_catalog.format('grant execute on function %s to authenticated, service_role', v_fn);
    if has_function_privilege('anon', v_fn, 'execute')
       or not has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception 'contrato de execução inválido em %', v_fn;
    end if;
  end loop;

  if has_function_privilege(
       'authenticated', 'public.redistribuir_lead(bigint)'::regprocedure, 'execute'
     ) or not has_function_privilege(
       'service_role', 'public.redistribuir_lead(bigint)'::regprocedure, 'execute'
     ) then
    raise exception 'redistribuir_lead não ficou service-only';
  end if;
end;
$contract$;

commit;

-- ROLLBACK DE EMERGÊNCIA:
-- 1. reaplicar as definições capturadas no baseline canônico;
-- 2. drop index if exists public.atendimento_acoes_negocio_criado_idx;
-- 3. restaurar grants somente após identificar o chamador afetado.
-- Nunca restaurar EXECUTE para PUBLIC.
