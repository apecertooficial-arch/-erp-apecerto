-- Central canonica: uma automacao de inteligencia, um evento por mensagem e
-- nenhum polling/revalidacao diaria da Sara. Esta migracao nao foi aplicada em
-- producao; os checksums fazem a execucao falhar fechada se o snapshot mudar.
begin;

set local statement_timeout='120s';
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('central_sara_evento_unico',0));

do $preflight$
declare
  v_def text;
  r record;
begin
  select pg_get_functiondef('private.sara_enfileirar_mensagem(uuid)'::regprocedure)
    into v_def;
  if md5(v_def)<>'d4da44eec6a0fbc2e85b2a05f9c3c0a5' then
    raise exception 'FUNCTION_STALE_VERSION: private.sara_enfileirar_mensagem mudou: %',md5(v_def);
  end if;

  select pg_get_functiondef('public.motor_relogio_central()'::regprocedure)
    into v_def;
  if md5(v_def)<>'5d2d61f61618e10191291ae9c60c8f75' then
    raise exception 'FUNCTION_STALE_VERSION: public.motor_relogio_central mudou: %',md5(v_def);
  end if;

  select pg_get_functiondef('public.motor_evento_prazo(integer)'::regprocedure)
    into v_def;
  if md5(v_def)<>'cd9e274a95e560ab8fcaa4378a57ab6b' then
    raise exception 'FUNCTION_STALE_VERSION: public.motor_evento_prazo mudou: %',md5(v_def);
  end if;

  select pg_get_functiondef('public.automacao_validar_mapa(jsonb)'::regprocedure)
    into v_def;
  if md5(v_def)<>'a8dd741d6fb4a8d53c3407d5259154af' then
    raise exception 'FUNCTION_STALE_VERSION: public.automacao_validar_mapa mudou: %',md5(v_def);
  end if;

  select pg_get_functiondef(
    'public.f2_sara_registrar_sugestao_v2(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamp with time zone,numeric,text,text,numeric,jsonb)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'2aa79b9776e4ca1d99206af596d806e6' then
    raise exception 'FUNCTION_STALE_VERSION: f2_sara_registrar_sugestao_v2 mudou: %',md5(v_def);
  end if;

  select pg_get_functiondef(
    'public.f2_sara_aplicar_analise_v2(bigint,boolean,boolean,boolean,boolean,boolean)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'545ad9a5674429c447dbd4d7b49e44d7' then
    raise exception 'FUNCTION_STALE_VERSION: f2_sara_aplicar_analise_v2 mudou: %',md5(v_def);
  end if;

  for r in
    select * from (values
      (49::bigint,114::bigint,'40906ba96e44fda928c58b9d58124398'::text),
      (51::bigint,41::bigint,'75427cf3589325aa0dfed036034d4da8'::text),
      (52::bigint,42::bigint,'c901b513f66c9c19d5db3c4d4f3df8e8'::text),
      (58::bigint,45::bigint,'5f825df13031faf1043aba7bbcf605aa'::text),
      (64::bigint,115::bigint,'5b0b866f0ca6553a8b1a51f8c75591d0'::text),
      (67::bigint,91::bigint,'3e6956345c131475dd204429474c8efa'::text),
      (69::bigint,118::bigint,'c3ce46b74852a6891b9484f120198392'::text)
    ) x(id,versao_publicada_id,mapa_md5)
  loop
    if not exists(
      select 1 from public.automacoes a
       where a.id=r.id
         and a.versao_publicada_id=r.versao_publicada_id
         and md5(a.mapa::text)=r.mapa_md5
    ) then
      raise exception 'AUTOMATION_STALE_VERSION: automacao % divergiu do snapshot auditado',r.id;
    end if;
  end loop;
end
$preflight$;

-- A elegibilidade historica do motor possui um corte de implantacao e continua
-- intacta. A Sara recebe uma regra propria, replicavel para SaaS: card ativo e
-- nao legado. Assim, mensagens futuras de cards pre-corte entram sem reabrir a
-- base legada e sem varredura retroativa.
create or replace function public.f2_sara_evento_elegivel(p_funil_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists(
    select 1 from public.f2_lead f
     where f.id=p_funil_lead_id
       and f.descartado_em is null
       and f.etapa<>'legado'
  );
$function$;

revoke all on function public.f2_sara_evento_elegivel(uuid)
  from public,anon,authenticated;
grant execute on function public.f2_sara_evento_elegivel(uuid) to service_role;

create unique index if not exists motor_fila_sara_checkpoint_ativo_uniq
  on public.motor_fila(automacao_id,(lead->>'__funil_lead_id'))
  where status='pendente' and lead->>'__sara_checkpoint'='true';

create unique index if not exists motor_fila_sara_checkpoint_evento_uniq
  on public.motor_fila(
    automacao_id,
    (lead->>'__funil_lead_id'),
    (lead->>'__sara_lead_version'),
    (lead->>'__sara_event_type'),
    (lead->>'__sara_source_id')
  )
  where lead->>'__sara_checkpoint'='true';

create or replace function public.f2_sara_agendar_checkpoint(
  p_funil_lead_id uuid,
  p_lead_version integer,
  p_event_type text,
  p_source_id text,
  p_executar_em timestamptz,
  p_proxima_acao jsonb
) returns bigint
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id bigint;
  v_lead public.f2_lead%rowtype;
  v_nome text;
  v_telefone text;
  v_email text;
begin
  if p_event_type not in ('lead.next_action_due','lead.cadence_due') then
    raise exception 'SARA_CHECKPOINT_EVENT_TYPE_INVALID';
  end if;
  if p_executar_em is null then raise exception 'SARA_CHECKPOINT_DUE_AT_REQUIRED'; end if;
  if coalesce(p_source_id,'')='' then raise exception 'SARA_CHECKPOINT_SOURCE_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended('sara-checkpoint:'||p_funil_lead_id::text,0));
  select f,coalesce(l.nome,f.nome,'Lead'),coalesce(l.telefone,f.telefone,''),coalesce(l.email,'')
    into v_lead,v_nome,v_telefone,v_email
    from public.f2_lead f
    join public.negocios n on n.id=f.origem_negocio_id
    left join public.leads l on l.id=n.lead_id
   where f.id=p_funil_lead_id
   for update of f;
  if not found or not public.f2_sara_evento_elegivel(p_funil_lead_id) then return null; end if;
  if v_lead.versao<>p_lead_version then raise exception 'SARA_CHECKPOINT_STALE_VERSION'; end if;

  select id into v_id from public.motor_fila
   where automacao_id=49
     and lead->>'__funil_lead_id'=p_funil_lead_id::text
     and lead->>'__sara_lead_version'=p_lead_version::text
     and lead->>'__sara_event_type'=p_event_type
     and lead->>'__sara_source_id'=p_source_id
   order by id desc limit 1;
  if v_id is not null then return v_id; end if;

  update public.motor_fila
     set status='cancelado',processado_em=now(),ultimo_erro='checkpoint_substituido_por_nova_analise'
   where automacao_id=49 and status='pendente'
     and lead->>'__sara_checkpoint'='true'
     and lead->>'__funil_lead_id'=p_funil_lead_id::text;

  v_id:=public.motor_enfileirar(49,jsonb_build_object(
    'nome',v_nome,'telefone',v_telefone,'email',v_email,
    '__funil_lead_id',p_funil_lead_id,
    '__motor_priority',10,
    '__motor_evento',p_event_type,
    '__sara_checkpoint',true,
    '__sara_lead_version',p_lead_version,
    '__sara_event_type',p_event_type,
    '__sara_source_id',p_source_id,
    '__sara_proxima_acao',coalesce(p_proxima_acao,'{}'::jsonb)
  ));
  update public.motor_fila set due_at=p_executar_em where id=v_id;
  return v_id;
end
$function$;

revoke all on function public.f2_sara_agendar_checkpoint(
  uuid,integer,text,text,timestamptz,jsonb
) from public,anon,authenticated;
grant execute on function public.f2_sara_agendar_checkpoint(
  uuid,integer,text,text,timestamptz,jsonb
) to service_role;

do $aplicar_elegibilidade_sara$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef(
    'public.f2_sara_registrar_sugestao_v2(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamp with time zone,numeric,text,text,numeric,jsonb)'::regprocedure
  ) into v_def;
  v_novo:=replace(v_def,
    'public.f2_lead_automatico_elegivel',
    'public.f2_sara_evento_elegivel'
  );
  if v_novo=v_def then raise exception 'FUNCTION_PATCH_FAILED: registro sem ancora de elegibilidade'; end if;
  execute v_novo;

  select pg_get_functiondef(
    'public.f2_sara_aplicar_analise_v2(bigint,boolean,boolean,boolean,boolean,boolean)'::regprocedure
  ) into v_def;
  v_novo:=replace(v_def,
    'public.f2_lead_automatico_elegivel',
    'public.f2_sara_evento_elegivel'
  );
  v_novo:=replace(v_novo,
    $old$  return jsonb_build_object('ok',true,'aplicado',true,'analise_id',v_a.id,'status',v_status_final,$old$,
    $new$  perform public.f2_sara_agendar_checkpoint(
    v_f.id,
    v_f.versao+1,
    case when v_m.codigo='CADENCIA_SEM_RESPOSTA'
      then 'lead.cadence_due' else 'lead.next_action_due' end,
    v_a.id::text,
    v_prazo,
    jsonb_build_object(
      'codigo',v_m.acao_codigo,
      'tipo',case when v_m.codigo='CADENCIA_SEM_RESPOSTA' then 'cadencia' else 'proxima_acao' end,
      'responsavel','corretor_atual',
      'executar_em',v_prazo,
      'criterio_conclusao','evidencia posterior confirma a acao esperada',
      'evidencia_esperada','mensagem ou evento operacional auditavel posterior a analise'
    )
  );
  insert into public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  values(v_f.id,'sara_checkpoint_agendado','Sara definiu a proxima checagem',left(v_a.resumo,500),
    jsonb_build_object(
      'analise_id',v_a.id,'origem',v_a.origem,'motivo',v_status_final,
      'versao_base',v_a.versao_base,'versao_nova',v_f.versao+1,
      'momento_antes',v_f.momento_codigo,'momento_depois',case when p_aplicar_momento then v_m.codigo else v_f.momento_codigo end,
      'etapa_antes',v_f.etapa,'etapa_depois',case when p_aplicar_etapa then v_m.etapa else v_f.etapa end,
      'evidencias',v_a.evidencias,'confianca',v_a.confianca,
      'proxima_acao',jsonb_build_object('codigo',v_m.acao_codigo,'executar_em',v_prazo)
    ),null);
  return jsonb_build_object('ok',true,'aplicado',true,'analise_id',v_a.id,'status',v_status_final,$new$);
  if v_novo=v_def or position('f2_sara_agendar_checkpoint' in v_novo)=0 then
    raise exception 'FUNCTION_PATCH_FAILED: aplicacao sem ancora de elegibilidade/checkpoint';
  end if;
  execute v_novo;
end
$aplicar_elegibilidade_sara$;

-- A fila e historica (itens concluidos nao sao apagados). O indice reforca a
-- idempotencia duravel por automacao, card e mensagem, inclusive sob corrida.
create unique index if not exists motor_fila_sara_mensagem_uniq
  on public.motor_fila(
    automacao_id,
    (lead->>'__funil_lead_id'),
    (lead->>'__sara_message_id')
  )
  where lead ? '__sara_message_id';

create or replace function private.sara_enfileirar_mensagem(p_mensagem_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_msg public.wa_mensagens%rowtype;
  v_gatilho text;
  v_evento text;
  v_marca timestamptz;
  v_enfileiradas integer:=0;
  v_duplicadas integer:=0;
  v_cards integer:=0;
  v_card_aceito boolean;
  r record;
  a record;
begin
  select * into v_msg
    from public.wa_mensagens
   where id=p_mensagem_id;
  if not found then
    return jsonb_build_object('ok',false,'erro','mensagem_inexistente');
  end if;
  if coalesce(v_msg.is_grupo,false) then
    return jsonb_build_object('ok',true,'ignorada','mensagem_de_grupo');
  end if;

  if lower(coalesce(v_msg.direcao,'')) in ('recebida','entrada','in','inbound','received') then
    v_gatilho:='sara-ciclo-event-trigger';
    v_evento:='conversation.message_received';
  elsif lower(coalesce(v_msg.direcao,'')) in ('enviada','saida','out','outbound','sent') then
    v_gatilho:='sara-ciclo-event-trigger';
    v_evento:='conversation.message_sent';
  else
    return jsonb_build_object('ok',true,'ignorada','direcao_nao_operacional');
  end if;
  v_marca:=coalesce(v_msg.enviado_em,v_msg.criado_em,now());

  for r in
    select distinct f.id card,f.momento_codigo,
           coalesce(l.nome,f.nome,'Lead') nome,
           coalesce(l.telefone,f.telefone,'') telefone,
           coalesce(l.email,'') email
      from public.wa_conversas cv
      join public.wa_contatos ct on ct.id=cv.contato_id
      join public.f2_lead f on public.f2_sara_evento_elegivel(f.id)
      join public.negocios n on n.id=f.origem_negocio_id
      left join public.leads l on l.id=n.lead_id
     where cv.id=v_msg.conversa_id
       and (
         ct.lead_id=n.lead_id
         or exists(
           select 1 from public.f2_historico_vinculo hv
            where hv.funil_lead_id=f.id and hv.contato_id=ct.id
         )
       )
       and (f.historico_completo or v_marca>=f.corte_conversa_em)
  loop
    v_card_aceito:=false;
    for a in
      select distinct au.id
        from public.automacoes au
        cross join lateral jsonb_array_elements(
          public.automacao_mapa_executavel(au.id,null)->'automation'->'blocks'
        ) b
        cross join lateral jsonb_array_elements(
          coalesce(b->'options'->'triggers','[]'::jsonb)
        ) t
       where t->>'name'=v_gatilho
         and au.ativa is true
         and au.status='publicado'
         and coalesce(au.arquivada,false) is false
    loop
      perform pg_advisory_xact_lock(
        hashtextextended('sara-mensagem:'||a.id::text||':'||r.card::text,0)
      );

      if exists(
        select 1 from public.motor_fila f
         where f.automacao_id=a.id
           and f.lead->>'__funil_lead_id'=r.card::text
           and f.lead->>'__sara_message_id'=p_mensagem_id::text
      ) then
        v_duplicadas:=v_duplicadas+1;
        v_card_aceito:=true;
        continue;
      end if;

      update public.motor_fila
         set status='cancelado',processado_em=now(),
             ultimo_erro='checkpoint_substituido_por_mensagem'
       where automacao_id=a.id and status='pendente'
         and lead->>'__sara_checkpoint'='true'
         and lead->>'__funil_lead_id'=r.card::text;

      -- Nao coalescer: duas mensagens recebidas durante um processamento sao
      -- dois eventos auditaveis, cada um com seu proprio execution_id.
      perform public.motor_enfileirar(
        a.id,
        jsonb_build_object(
          'nome',r.nome,
          'telefone',r.telefone,
          'email',r.email,
          '__funil_lead_id',r.card,
          '__motor_priority',0,
          '__motor_evento',v_evento,
          '__sara_message_id',p_mensagem_id,
          '__sara_message_at',v_marca
        )
      );
      v_enfileiradas:=v_enfileiradas+1;
      v_card_aceito:=true;
    end loop;

    if v_card_aceito then
      insert into public.motor_evento_visto(evento,funil_lead_id,marca)
      values(v_evento,r.card,v_marca)
      on conflict(evento,funil_lead_id) do update
        set marca=greatest(public.motor_evento_visto.marca,excluded.marca),
            atualizado_em=now();
      v_cards:=v_cards+1;
    end if;
  end loop;

  delete from private.sara_evento_mensagem_falha
   where mensagem_id=p_mensagem_id;
  return jsonb_build_object(
    'ok',true,
    'evento',v_evento,
    'cards',v_cards,
    'enfileiradas',v_enfileiradas,
    'coalescidas',0,
    'duplicadas',v_duplicadas
  );
end
$function$;

revoke all on function private.sara_enfileirar_mensagem(uuid)
  from public,anon,authenticated;
grant execute on function private.sara_enfileirar_mensagem(uuid) to service_role;

-- Compatibilidade de transicao: o relogio antigo captura somente cards que
-- ainda nao possuem checkpoint duravel. A responsabilidade deixa de apontar
-- para automacoes 51/58 e entra pelos gatilhos da unica Sara.
create or replace function public.motor_evento_prazo(p_limite integer default 150)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $function$
declare
  r record;
  v_leads integer:=0;
  v_disparos integer:=0;
  v_gatilho text;
  v_evento text;
begin
  if not exists(select 1 from motor_flags where nome='eventos' and ativo) then
    return jsonb_build_object('ok',true,'motivo','eventos desligados em motor_flags');
  end if;
  for r in
    select f.id card,f.versao,f.momento_codigo,f.proxima_acao_em,l.nome,l.telefone,l.email
      from f2_lead f
      join negocios ng on ng.id=f.origem_negocio_id
      join leads l on l.id=ng.lead_id
     where public.f2_sara_evento_elegivel(f.id)
       and f.proxima_acao_em is not null and f.proxima_acao_em<now()
       and f.proxima_acao_em>coalesce((
         select v.marca from motor_evento_visto v
          where v.evento='sara_due' and v.funil_lead_id=f.id
       ),'-infinity'::timestamptz)
       and not exists(
         select 1 from motor_fila mf
          where mf.automacao_id=49
            and mf.lead->>'__sara_checkpoint'='true'
            and mf.lead->>'__funil_lead_id'=f.id::text
            and mf.lead->>'__sara_lead_version'=f.versao::text
       )
     order by f.proxima_acao_em
     limit greatest(1,least(coalesce(p_limite,150),500))
  loop
    v_evento:=case when r.momento_codigo='CADENCIA_SEM_RESPOSTA'
      then 'lead.cadence_due' else 'lead.next_action_due' end;
    v_gatilho:='sara-ciclo-event-trigger';
    v_disparos:=v_disparos+motor_evento_disparar(v_gatilho,jsonb_build_object(
      'nome',coalesce(r.nome,'Lead'),'telefone',coalesce(r.telefone,''),
      'email',coalesce(r.email,''),'__funil_lead_id',r.card,
      '__motor_evento',v_evento,'__sara_lead_version',r.versao,
      '__sara_event_type',v_evento,'__sara_source_id',r.proxima_acao_em
    ),r.momento_codigo);
    insert into motor_evento_visto(evento,funil_lead_id,marca)
    values('sara_due',r.card,r.proxima_acao_em)
    on conflict(evento,funil_lead_id) do update
      set marca=excluded.marca,atualizado_em=now();
    v_leads:=v_leads+1;
  end loop;
  return jsonb_build_object('ok',true,'leads',v_leads,'automacoes_disparadas',v_disparos,
    'modo','compatibilidade_sem_checkpoint');
end
$function$;

-- O relogio continua transportando fila/retries e rotinas deterministicas. A
-- deteccao de mensagem pertence somente ao trigger AFTER INSERT; a Sara nao
-- possui mais varredura diaria no caminho canonico.
create or replace function public.motor_relogio_central()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare v_resultado jsonb:='{}'::jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('motor_relogio_central')) then
    return jsonb_build_object('ok',true,'ignorado','relogio_ja_em_execucao');
  end if;
  begin
    v_resultado:=v_resultado||jsonb_build_object('fila',public.motor_processar_fila());
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('fila_erro',sqlstate||': '||sqlerrm);
  end;
  begin
    v_resultado:=v_resultado||jsonb_build_object(
      'mensagens_confirmadas',private.motor_reconciliar_mensagens_aceitas(10)
    );
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object(
      'mensagens_confirmadas_erro',sqlstate||': '||sqlerrm
    );
  end;
  begin
    v_resultado:=v_resultado||jsonb_build_object(
      'mensagens_retentadas',private.motor_reprocessar_mensagens_recusadas(5)
    );
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object(
      'mensagens_retentadas_erro',sqlstate||': '||sqlerrm
    );
  end;
  begin
    perform public.sla_msg_cache_refresh();
    v_resultado:=v_resultado||jsonb_build_object('cache_mensagens','atualizado');
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('cache_mensagens_erro',sqlstate||': '||sqlerrm);
  end;
  v_resultado:=v_resultado||jsonb_build_object('mensagem','event_driven_trigger');
  begin
    insert into public.motor_relogio_estado(chave,ultima_execucao) values('prazo',now())
    on conflict(chave) do update set ultima_execucao=excluded.ultima_execucao
      where public.motor_relogio_estado.ultima_execucao<=now()-interval '1 minute';
    if found then
      v_resultado:=v_resultado||jsonb_build_object('prazo',public.motor_evento_prazo(150));
    end if;
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('prazo_erro',sqlstate||': '||sqlerrm);
  end;
  v_resultado:=v_resultado||jsonb_build_object('checagem_diaria','desativada_event_driven');
  return jsonb_build_object('ok',true,'fontes',v_resultado);
end
$function$;

do $registrar_gatilhos_ciclo_sara$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef('public.automacao_validar_mapa(jsonb)'::regprocedure)
    into v_def;
  v_novo:=replace(v_def,
    $old$'lead-mensagem-recebida-trigger','lead-mensagem-enviada-trigger',$old$,
    $new$'lead-mensagem-recebida-trigger','lead-mensagem-enviada-trigger',
    'sara-ciclo-event-trigger',$new$
  );
  if v_novo=v_def then raise exception 'FUNCTION_PATCH_FAILED: lista de gatilhos sem ancora'; end if;
  execute v_novo;
end
$registrar_gatilhos_ciclo_sara$;

do $publicar_contrato$
declare
  v_auto public.automacoes%rowtype;
  v_mapa jsonb;
  v_blocos jsonb;
  v_validacao jsonb;
  v_versao integer;
  v_versao_id bigint;
begin
  select * into strict v_auto from public.automacoes where id=49 for update;

  select jsonb_agg(
    case
      when b->>'id'='b1' then
        jsonb_set(
          jsonb_set(b,'{options,triggers}',jsonb_build_array(
            jsonb_build_object(
              'name','sara-ciclo-event-trigger','group','system',
              'options',jsonb_build_object('eventTypes',jsonb_build_array(
                'conversation.message_received','conversation.message_sent',
                'lead.next_action_due','lead.cadence_due'
              ))
            )
          ),true),
          '{options,nextBlockId}',to_jsonb('b2'::text),true
        )
      when b->>'id'='b2' then
        jsonb_set(
          jsonb_set(b,'{options,agenteId}',to_jsonb(16),true),
          '{options,nextBlockId}',to_jsonb('ai_apply_bf5ca61f9c51'::text),true
        )
      when b->>'id'='ai_apply_bf5ca61f9c51' then
        jsonb_set(b,'{options,actions,0}',jsonb_build_object(
          'name','apply-ai-analysis-action','group','lead','options',jsonb_build_object(
            'aplicarEtapa',true,
            'aplicarMomento',true,
            'aplicarAcao',true,
            'aplicarTemperatura',true,
            'aplicarQualidade',true
          )
        ),true)
      else b
    end order by ord
  ) into v_blocos
    from jsonb_array_elements(v_auto.mapa#>'{automation,blocks}') with ordinality x(b,ord)
   where b->>'id'<>'b3';

  v_mapa:=jsonb_set(v_auto.mapa,'{automation,blocks}',v_blocos,true);
  v_mapa:=jsonb_set(v_mapa,'{editor,blocks}',
    coalesce(v_mapa#>'{editor,blocks}','{}'::jsonb)-'b3',true);
  v_mapa:=jsonb_set(v_mapa,'{editor,wires}',jsonb_build_array(
    jsonb_build_object('from','b1','to','b2','port','out'),
    jsonb_build_object('from','b2','to','ai_apply_bf5ca61f9c51','port','out')
  ),true);
  v_mapa:=jsonb_set(v_mapa,'{editor,uid}',
    to_jsonb(coalesce((v_mapa#>>'{editor,uid}')::integer,0)+1),true);

  v_validacao:=public.automacao_validar_mapa(v_mapa);
  if coalesce((v_validacao->>'ok')::boolean,false) is not true then
    raise exception 'AUTOMATION_INVALID: %',v_validacao->'erros';
  end if;

  select coalesce(max(versao),0)+1 into v_versao
    from public.automacao_versoes where automacao_id=49;
  insert into public.automacao_versoes(
    automacao_id,versao,nome,mapa,observacao,criado_por
  ) values(
    49,v_versao,'Inteligencia de Conversa',v_mapa,
    'Contrato unico por mensagem recebida/enviada; modulo Sara 16 e aplicacao explicita unica',
    'migration:20260828203000'
  ) returning id into v_versao_id;

  update public.automacoes
     set nome='Inteligencia de Conversa',mapa=v_mapa,mapa_rascunho=v_mapa,
         versao_publicada_id=v_versao_id,status='publicado',ativa=true,
         arquivada=false,publicado_em=now(),atualizada_em=now()
   where id=49;

  -- 51/58: ciclo temporal absorvido; 52: notificacao absorvida pelas entradas;
  -- 64: varredura diaria proibida; 67: campanha incompleta; 69: absorvida por 49.
  -- Nenhuma linha ou versao historica e excluida.
  update public.automacoes
     set ativa=false,
         arquivada=true,
         atualizada_em=now()
   where id in (51,52,58,64,67,69);
end
$publicar_contrato$;

do $verify$
declare
  v_mapa jsonb;
  v_trigger_count integer;
begin
  select mapa into strict v_mapa
    from public.automacoes
   where id=49 and ativa and status='publicado' and not coalesce(arquivada,false);

  select count(*) into v_trigger_count
    from jsonb_array_elements(v_mapa#>'{automation,blocks}') b
    cross join lateral jsonb_array_elements(coalesce(b#>'{options,triggers}','[]'::jsonb)) t
   where t->>'name'='sara-ciclo-event-trigger'
     and t#>'{options,eventTypes}' @> '["conversation.message_received","conversation.message_sent","lead.next_action_due","lead.cadence_due"]'::jsonb;
  if v_trigger_count<>1 then raise exception 'VERIFY_FAILED: gatilho composto da Sara ausente'; end if;
  if jsonb_array_length(v_mapa#>'{automation,blocks}')<>3 then
    raise exception 'VERIFY_FAILED: gatilho composto, uma Sara e uma aplicacao esperados';
  end if;
  if exists(select 1 from public.automacoes where id in (51,52,58,64,67,69) and (ativa or not arquivada)) then
    raise exception 'VERIFY_FAILED: automacao absorvida ainda ativa';
  end if;
  if position('public.motor_evento_mensagem(300)' in pg_get_functiondef(
    'public.motor_relogio_central()'::regprocedure
  ))>0 then raise exception 'VERIFY_FAILED: polling de mensagem ainda ligado'; end if;
  if position('public.sara_checagem_diaria(null)' in pg_get_functiondef(
    'public.motor_relogio_central()'::regprocedure
  ))>0 then raise exception 'VERIFY_FAILED: checagem diaria ainda ligada'; end if;
  if position('public.f2_lead_automatico_elegivel' in pg_get_functiondef(
    'public.f2_sara_registrar_sugestao_v2(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamp with time zone,numeric,text,text,numeric,jsonb)'::regprocedure
  ))>0 then raise exception 'VERIFY_FAILED: registro ainda usa corte historico'; end if;
  if position('public.f2_lead_automatico_elegivel' in pg_get_functiondef(
    'public.f2_sara_aplicar_analise_v2(bigint,boolean,boolean,boolean,boolean,boolean)'::regprocedure
  ))>0 then raise exception 'VERIFY_FAILED: aplicacao ainda usa corte historico'; end if;
end
$verify$;

comment on function private.sara_enfileirar_mensagem(uuid) is
  'Evento canonico por mensagem persistida: uma fila por automacao/card/message_id; sem coalescencia.';

comment on function public.f2_sara_evento_elegivel(uuid) is
  'Sara event-driven cobre cards ativos nao legados, sem corte de implantacao e sem replay retroativo.';

commit;
