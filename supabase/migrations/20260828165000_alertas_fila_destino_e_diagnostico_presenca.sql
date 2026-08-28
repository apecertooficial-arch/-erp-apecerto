-- Lacunas operacionais da Central comprovadas em 28/08/2026.
-- Esta migration nao publica mapas, nao altera presenca/IP e nao cria envio.
-- Ela permanece somente local ate uma autorizacao explicita de aplicacao.

begin;

set local lock_timeout='5s';
set local statement_timeout='120s';
select pg_advisory_xact_lock(hashtextextended('central_alertas_fila_destino_20260828',0));

-- Vinculo pesquisavel com a execucao da Central, sem FK: a notificacao deve
-- continuar auditavel mesmo se uma politica futura arquivar a fila antiga.
alter table public.ncrm_notificacao
  add column if not exists execution_id bigint;

comment on column public.ncrm_notificacao.execution_id is
  'Execucao da Central que originou o alerta operacional; nao e id de mensagem externa.';

create index if not exists ncrm_notificacao_execution_id_idx
  on public.ncrm_notificacao(execution_id,criada_em desc)
  where execution_id is not null;

create or replace function public.motor_alertar_fila_sem_elegiveis(
  p_execution_id bigint,
  p_automacao_id bigint,
  p_versao_id bigint,
  p_bloco_id text,
  p_tentativas integer,
  p_delay_segundos integer,
  p_agora timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_criado_em timestamptz;
  v_status text;
  v_inseriu bigint;
  v_chave text:='central:zero-elegiveis:'||p_execution_id::text;
begin
  select f.criado_em,f.status into v_criado_em,v_status
    from public.motor_fila f
   where f.id=p_execution_id and f.automacao_id=p_automacao_id;

  if not found or v_status not in ('pendente','processando') then
    return jsonb_build_object('ok',true,'alertou',false,'motivo','execucao_nao_pendente');
  end if;
  if coalesce(p_tentativas,0)<3
     or v_criado_em > p_agora - interval '5 minutes' then
    return jsonb_build_object('ok',true,'alertou',false,'motivo','fila_ainda_nao_envelheceu');
  end if;
  if exists(
    select 1 from public.ncrm_notificacao n
     where n.execution_id=p_execution_id
       and n.tipo='lead_sem_corretor'
       and n.chave=v_chave
  ) then
    return jsonb_build_object('ok',true,'alertou',false,'idempotente',true);
  end if;

  insert into public.ncrm_notificacao(
    chave,tipo,publico,prioridade,titulo,detalhe,deep_link,repeticoes,execution_id
  ) values(
    v_chave,'lead_sem_corretor','gestao',1,
    'Lead aguardando corretor elegível',
    'Execução '||p_execution_id::text||' · automação '||p_automacao_id::text||
      ' · versão '||coalesce(p_versao_id::text,'?')||' · bloco '
      ||coalesce(nullif(p_bloco_id,''),'START')||' · tentativa '
      ||greatest(coalesce(p_tentativas,0),0)::text||'. Nova avaliação em até '
      ||greatest(coalesce(p_delay_segundos,0),0)::text||'s.',
    '/automacoes',0,p_execution_id
  )
  on conflict (chave) where resolvida_em is null do nothing
  returning id into v_inseriu;

  if v_inseriu is not null then
    begin
      perform ncrm_private.push_enfileirar(200);
    exception when others then
      raise warning 'push_zero_elegiveis_falhou: %',sqlerrm;
    end;
  end if;
  return jsonb_build_object(
    'ok',true,'alertou',v_inseriu is not null,
    'idempotente',v_inseriu is null,'execution_id',p_execution_id
  );
end
$fn$;

create or replace function public.motor_resolver_alerta_fila(
  p_execution_id bigint,
  p_motivo text
) returns integer
language plpgsql
security definer
set search_path=''
as $fn$
declare v_n integer;
begin
  update public.ncrm_notificacao n
     set resolvida_em=coalesce(n.resolvida_em,now()),
         resolvida_por=coalesce(n.resolvida_por,left('central:'||coalesce(nullif(p_motivo,''),'fila_encerrada'),80))
   where n.execution_id=p_execution_id
     and n.chave='central:zero-elegiveis:'||p_execution_id::text
     and n.resolvida_em is null;
  get diagnostics v_n=row_count;
  return v_n;
end
$fn$;

create or replace function public.motor_alertar_destino_ausente(
  p_execution_id bigint,
  p_automacao_id bigint,
  p_bloco_id text,
  p_lead_id bigint,
  p_corretor_id bigint
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_negocio_id bigint;
  v_link text;
  v_inseridas integer:=0;
  v_agora_inseridas integer:=0;
  v_chave_gestao text:='central:destino-ausente:'||p_execution_id::text||':gestao';
  v_chave_corretor text:='central:destino-ausente:'||p_execution_id::text||':corretor';
begin
  select n.id into v_negocio_id
    from public.negocios n where n.lead_id=p_lead_id order by n.id desc limit 1;
  v_link:=case when v_negocio_id is null then '/notificacoes'
    else '/negocio/'||v_negocio_id::text end;

  if not exists(
    select 1 from public.ncrm_notificacao n
     where n.execution_id=p_execution_id
       and n.tipo='qualidade_dados'
       and n.chave=v_chave_gestao
  ) then
    insert into public.ncrm_notificacao(
      chave,tipo,publico,prioridade,titulo,detalhe,negocio_id,corretor_id,
      deep_link,repeticoes,execution_id
    ) values(
      v_chave_gestao,'qualidade_dados','gestao',1,
      'Abordagem bloqueada: telefone ausente',
      'Execução '||p_execution_id::text||' · automação '||p_automacao_id::text
        ||' · bloco '||coalesce(nullif(p_bloco_id,''),'?')
        ||'. Corrija o telefone antes de qualquer reenvio.',
      v_negocio_id,p_corretor_id,v_link,0,p_execution_id
    )
    on conflict (chave) where resolvida_em is null do nothing;
    get diagnostics v_inseridas=row_count;
  end if;

  if p_corretor_id is not null and not exists(
    select 1 from public.ncrm_notificacao n
     where n.execution_id=p_execution_id
       and n.tipo='qualidade_dados'
       and n.chave=v_chave_corretor
  ) then
    insert into public.ncrm_notificacao(
      chave,tipo,publico,prioridade,titulo,detalhe,negocio_id,corretor_id,
      deep_link,repeticoes,execution_id
    ) values(
      v_chave_corretor,'qualidade_dados','corretor',1,
      'Confira o telefone antes da abordagem',
      'A abordagem automática foi bloqueada sem chamada externa. Corrija o telefone no CRM.',
      v_negocio_id,p_corretor_id,v_link,0,p_execution_id
    )
    on conflict (chave) where resolvida_em is null do nothing;
    get diagnostics v_agora_inseridas=row_count;
    v_inseridas:=v_inseridas+v_agora_inseridas;
  end if;

  if v_inseridas>0 then
    begin
      perform ncrm_private.push_enfileirar(200);
    exception when others then
      raise warning 'push_destino_ausente_falhou: %',sqlerrm;
    end;
  end if;
  return jsonb_build_object(
    'ok',true,'alertas_criados',v_inseridas,
    'idempotente',v_inseridas=0,'execution_id',p_execution_id
  );
end
$fn$;

revoke all on function public.motor_alertar_fila_sem_elegiveis(
  bigint,bigint,bigint,text,integer,integer,timestamptz
) from public,anon,authenticated;
revoke all on function public.motor_resolver_alerta_fila(bigint,text)
  from public,anon,authenticated;
revoke all on function public.motor_alertar_destino_ausente(
  bigint,bigint,text,bigint,bigint
) from public,anon,authenticated;
grant execute on function public.motor_alertar_fila_sem_elegiveis(
  bigint,bigint,bigint,text,integer,integer,timestamptz
) to service_role;
grant execute on function public.motor_resolver_alerta_fila(bigint,text)
  to service_role;
grant execute on function public.motor_alertar_destino_ausente(
  bigint,bigint,text,bigint,bigint
) to service_role;

-- Injeta o alerta no consumidor canônico, preservando o retry existente.
do $patch_queue$
declare v_def text; v_new text;
begin
  select pg_get_functiondef('public.motor_processar_fila()'::regprocedure) into v_def;
  if md5(v_def)<>'9a5263bde0a0ab54008037064a077693' then
    raise exception 'motor_processar_fila mudou: %',md5(v_def);
  end if;

  v_new:=replace(v_def,
    $old$      update public.motor_fila set status='ok',processado_em=now(),ultimo_erro=null where id=r.id;$old$,
    $new$      update public.motor_fila set status='ok',processado_em=now(),ultimo_erro=null where id=r.id;
      perform public.motor_resolver_alerta_fila(r.id,'fila_retomada');$new$);

  v_new:=replace(v_new,
    $old$      update public.motor_fila set status='cancelado',processado_em=now(),
        ultimo_erro='AUTOMATION_NOT_RUNNABLE' where id=r.id;
      continue;$old$,
    $new$      update public.motor_fila set status='cancelado',processado_em=now(),
        ultimo_erro='AUTOMATION_NOT_RUNNABLE' where id=r.id;
      perform public.motor_resolver_alerta_fila(r.id,'automacao_inativa');
      continue;$new$);

  v_new:=replace(v_new,
    $old$        update public.motor_fila set status='pendente',
          due_at=now()+make_interval(secs=>v_delay),processado_em=null,
          ultimo_erro='WAITING_FOR_ELIGIBLE_BROKER: '||v_erro where id=r.id;$old$,
    $new$        update public.motor_fila set status='pendente',
          due_at=now()+make_interval(secs=>v_delay),processado_em=null,
          ultimo_erro='WAITING_FOR_ELIGIBLE_BROKER: '||v_erro where id=r.id;
        perform public.motor_alertar_fila_sem_elegiveis(
          r.id,r.automacao_id,r.automacao_versao_id,r.bloco_id,
          r.tentativas+1,v_delay,now()
        );$new$);

  v_new:=replace(v_new,
    $old$        update public.motor_fila set status='erro',processado_em=now(),
          ultimo_erro=v_erro where id=r.id;
        insert into public.motor_execucoes($old$,
    $new$        update public.motor_fila set status='erro',processado_em=now(),
          ultimo_erro=v_erro where id=r.id;
        perform public.motor_resolver_alerta_fila(r.id,'fila_encerrada_com_erro');
        insert into public.motor_execucoes($new$);

  if v_new=v_def
     or position('motor_alertar_fila_sem_elegiveis' in v_new)=0
     or position('motor_resolver_alerta_fila' in v_new)=0
     or position('automacao_inativa' in v_new)=0
     or position('fila_encerrada_com_erro' in v_new)=0
     or position('WAITING_FOR_ELIGIBLE_BROKER' in v_new)=0
     or position('due_at=now()+make_interval(secs=>v_delay)' in v_new)=0 then
    raise exception 'patch idempotente da fila nao encontrou as ancoras';
  end if;
  execute v_new;
end
$patch_queue$;

-- Bloqueia telefone vazio antes do preflight, da escolha de instância, da
-- criação de partes e de qualquer chamada ao transporte externo.
do $patch_sender$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(
    'public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'9e5eae8d304c4efa37cdc832c6fbf737' then
    raise exception 'motor_envia_abordagem mudou: %',md5(v_def);
  end if;

  v_new:=replace(v_def,
    $old$  v_preflight:=public.motor_abordagem_preflight_execucao($old$,
    $new$  if v_tel='' then
    if v_exec!~'^[1-9][0-9]*$' then
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',null,
        'Abordagem bloqueada: execução sem identidade numérica; nenhuma chamada externa realizada');
      return;
    end if;
    perform public.motor_alertar_destino_ausente(
      v_exec::bigint,p_auto,p_bloco,p_lead_id,p_corretor_id
    );
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','alerta',p_lead->>'nome',null,
      'Abordagem bloqueada: destino ausente; nenhuma chamada externa realizada');
    return;
  end if;
  v_preflight:=public.motor_abordagem_preflight_execucao($new$);

  if v_new=v_def
     or position('if v_tel='''' then' in v_new)=0
     or position('v_preflight:=' in v_new)=0
     or position('if v_tel='''' then' in v_new) > position('v_preflight:=' in v_new)
     or position('motor_alertar_destino_ausente' in v_new)=0 then
    raise exception 'patch do destino ausente nao encontrou as ancoras';
  end if;
  execute v_new;
end
$patch_sender$;

do $verify$
declare v_def text;
begin
  select pg_get_functiondef('public.motor_processar_fila()'::regprocedure) into v_def;
  if position('motor_alertar_fila_sem_elegiveis' in v_def)=0
     or position('automacao_inativa' in v_def)=0
     or position('fila_encerrada_com_erro' in v_def)=0
     or position('WAITING_FOR_ELIGIBLE_BROKER' in v_def)=0 then
    raise exception 'fila sem alerta ou sem retry';
  end if;

  select pg_get_functiondef(
    'public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)'::regprocedure
  ) into v_def;
  if position('motor_alertar_destino_ausente' in v_def)=0
     or position('if v_tel='''' then' in v_def)=0
     or position('if v_tel='''' then' in v_def) > position('v_preflight:=' in v_def) then
    raise exception 'emissor nao bloqueia destino antes do preflight';
  end if;
end
$verify$;

commit;
