-- Sara em tempo real com custo previsivel.
-- Cada mensagem continua auditada individualmente, mas mensagens do mesmo card
-- em uma rajada curta compartilham uma unica analise. O dispatcher e a
-- motor_fila existentes continuam sendo o unico caminho de execucao.
begin;

set local statement_timeout='120s';
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('sara_tempo_real_eficiente',0));

alter table public.f2_sara_config
  add column if not exists quiet_window_seconds smallint not null default 6
    check (quiet_window_seconds between 1 and 15),
  add column if not exists max_batch_wait_seconds smallint not null default 15
    check (max_batch_wait_seconds between 5 and 30),
  add column if not exists monthly_budget_usd numeric(10,2) not null default 30
    check (monthly_budget_usd between 1 and 1000),
  add column if not exists daily_budget_usd numeric(10,2) not null default 1.50
    check (daily_budget_usd between 0.10 and 100),
  add column if not exists projected_call_usd numeric(10,4) not null default 0.005
    check (projected_call_usd between 0.0001 and 1);

alter table public.agente_execucoes
  add column if not exists tokens_cache_entrada integer not null default 0
    check (tokens_cache_entrada>=0),
  add column if not exists provider_request_id text;

alter table public.f2_sara_analise
  add column if not exists ia_execucao_id bigint references public.agente_execucoes(id) on delete set null,
  add column if not exists modelo text,
  add column if not exists tokens_entrada integer,
  add column if not exists tokens_cache_entrada integer,
  add column if not exists tokens_saida integer,
  add column if not exists custo_usd numeric,
  add column if not exists mensagens_novas integer,
  add column if not exists ultima_mensagem_id uuid;

-- Luna e o modelo de alto volume. A aplicacao da migration e deliberadamente
-- separada do deploy das Edge Functions, para permitir rollback de codigo antes
-- da troca de configuracao em producao.
update public.agentes_ia
   set modelo='gpt-5.6-luna',
       config=coalesce(config,'{}'::jsonb)||jsonb_build_object(
         'max_tokens',900,
         'reasoning_effort','low',
         'sara_context_mode','incremental-v1'
       )
 where id=16 and slug='sara';

create table private.sara_evento_mensagem (
  id bigint generated always as identity primary key,
  funil_lead_id uuid not null references public.f2_lead(id) on delete cascade,
  mensagem_id uuid not null references public.wa_mensagens(id) on delete cascade,
  evento_tipo text not null check (evento_tipo in (
    'conversation.message_received','conversation.message_sent'
  )),
  mensagem_em timestamptz not null,
  fila_id bigint references public.motor_fila(id) on delete set null,
  status text not null default 'pendente' check (status in (
    'pendente','analisado','revisao','erro'
  )),
  registrado_em timestamptz not null default clock_timestamp(),
  analisado_em timestamptz,
  unique (funil_lead_id,mensagem_id)
);

create index sara_evento_mensagem_fila_idx
  on private.sara_evento_mensagem(fila_id,status);
create index sara_evento_mensagem_sla_idx
  on private.sara_evento_mensagem(registrado_em,analisado_em);
revoke all on table private.sara_evento_mensagem from public,anon,authenticated;
grant select,insert,update on table private.sara_evento_mensagem to service_role;
grant usage,select on sequence private.sara_evento_mensagem_id_seq to service_role;

-- No maximo um lote pendente por automacao e card. Um lote em processamento
-- nao entra no indice: mensagem concorrente cria a proxima versao pendente.
create unique index motor_fila_sara_batch_pendente_uniq
  on public.motor_fila(automacao_id,(lead->>'__funil_lead_id'))
  where status='pendente' and lead->>'__sara_batch'='true';

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
begin
  select * into strict v_cfg from public.f2_sara_config where id;
  v_projetado:=greatest(0,coalesce(p_projected_usd,v_cfg.projected_call_usd));
  select coalesce(sum(e.custo_usd),0),
         coalesce(sum(e.custo_usd) filter (
           where e.criado_em>=date_trunc(
             'day',clock_timestamp() at time zone 'America/Sao_Paulo'
           ) at time zone 'America/Sao_Paulo'
         ),0)
    into v_mes,v_dia
    from public.agente_execucoes e
   where e.agente_slug='sara'
     and e.status='ok'
     and e.criado_em>=date_trunc(
       'month',clock_timestamp() at time zone 'America/Sao_Paulo'
     ) at time zone 'America/Sao_Paulo';
  return jsonb_build_object(
    'ok',true,
    'permitido',v_mes+v_projetado<=v_cfg.monthly_budget_usd
      and v_dia+v_projetado<=v_cfg.daily_budget_usd,
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

create or replace function private.sara_enfileirar_mensagem(p_mensagem_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_msg public.wa_mensagens%rowtype;
  v_gatilho text:='sara-ciclo-event-trigger';
  v_evento text;
  v_marca timestamptz;
  v_enfileiradas integer:=0;
  v_coalescidas integer:=0;
  v_duplicadas integer:=0;
  v_cards integer:=0;
  v_card_aceito boolean;
  v_audit_id bigint;
  v_fila_id bigint;
  v_primeira timestamptz;
  v_silencio integer;
  v_maximo integer;
  r record;
  a record;
begin
  select * into v_msg from public.wa_mensagens where id=p_mensagem_id;
  if not found then
    return jsonb_build_object('ok',false,'erro','mensagem_inexistente');
  end if;
  if coalesce(v_msg.is_grupo,false) then
    return jsonb_build_object('ok',true,'ignorada','mensagem_de_grupo');
  end if;

  if lower(coalesce(v_msg.direcao,'')) in ('recebida','entrada','in','inbound','received') then
    v_evento:='conversation.message_received';
  elsif lower(coalesce(v_msg.direcao,'')) in ('enviada','saida','out','outbound','sent') then
    v_evento:='conversation.message_sent';
  else
    return jsonb_build_object('ok',true,'ignorada','direcao_nao_operacional');
  end if;
  v_marca:=coalesce(v_msg.enviado_em,v_msg.criado_em,clock_timestamp());
  select quiet_window_seconds,max_batch_wait_seconds
    into v_silencio,v_maximo from public.f2_sara_config where id;
  v_silencio:=greatest(1,least(coalesce(v_silencio,6),15));
  v_maximo:=greatest(v_silencio,least(coalesce(v_maximo,15),30));

  for r in
    select distinct f.id card,
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
         and au.ativa is true and au.status='publicado'
         and coalesce(au.arquivada,false) is false
    loop
      perform pg_advisory_xact_lock(
        hashtextextended('sara-batch:'||a.id::text||':'||r.card::text,0)
      );

      v_audit_id:=null;
      insert into private.sara_evento_mensagem(
        funil_lead_id,mensagem_id,evento_tipo,mensagem_em
      ) values(r.card,p_mensagem_id,v_evento,v_marca)
      on conflict(funil_lead_id,mensagem_id) do nothing
      returning id into v_audit_id;
      if v_audit_id is null then
        v_duplicadas:=v_duplicadas+1;
        v_card_aceito:=true;
        continue;
      end if;

      -- Fato objetivo disponivel imediatamente, sem chamar IA e sem alterar os
      -- cinco campos decididos pela Sara.
      update public.f2_lead
         set ultima_interacao_em=greatest(coalesce(ultima_interacao_em,v_marca),v_marca),
             atualizado_em=clock_timestamp()
       where id=r.card;
      insert into public.f2_evento(
        funil_lead_id,tipo,titulo,detalhe,payload,criado_por
      ) values(
        r.card,'observacao','sara_mensagem_observada',
        case when v_evento='conversation.message_sent'
          then 'Mensagem do corretor registrada; consolidação da Sara pendente.'
          else 'Resposta do cliente registrada; consolidação da Sara pendente.' end,
        jsonb_build_object(
          'origem','wa_mensagens','mensagem_id',p_mensagem_id,
          'evento_tipo',v_evento,'mensagem_em',v_marca
        ),null
      );

      update public.motor_fila
         set status='cancelado',processado_em=clock_timestamp(),
             ultimo_erro='checkpoint_substituido_por_mensagem'
       where automacao_id=a.id and status='pendente'
         and lead->>'__sara_checkpoint'='true'
         and lead->>'__funil_lead_id'=r.card::text;

      v_fila_id:=null;
      v_primeira:=null;
      select f.id,coalesce(
               nullif(f.lead->>'__sara_first_message_at','')::timestamptz,
               f.criado_em
             )
        into v_fila_id,v_primeira
        from public.motor_fila f
       where f.automacao_id=a.id and f.status='pendente'
         and f.lead->>'__sara_batch'='true'
         and f.lead->>'__funil_lead_id'=r.card::text
       order by f.id desc limit 1 for update;

      if v_fila_id is null then
        v_primeira:=clock_timestamp();
        v_fila_id:=public.motor_enfileirar(a.id,jsonb_build_object(
          'nome',r.nome,'telefone',r.telefone,'email',r.email,
          '__funil_lead_id',r.card,
          '__motor_priority',0,
          '__motor_evento',v_evento,
          '__sara_event_type',v_evento,
          '__sara_source_id',p_mensagem_id,
          '__sara_message_id',p_mensagem_id,
          '__sara_message_ids',jsonb_build_array(p_mensagem_id::text),
          '__sara_event_types',jsonb_build_array(v_evento),
          '__sara_batch',true,
          '__sara_first_message_at',v_primeira,
          '__sara_last_message_at',v_marca,
          '__sara_message_count',1
        ));
        update public.motor_fila
           set due_at=clock_timestamp()+make_interval(secs=>v_silencio)
         where id=v_fila_id;
        v_enfileiradas:=v_enfileiradas+1;
      else
        update public.motor_fila
           set lead=jsonb_set(
                 jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(
                         lead,
                         '{__sara_message_ids}',
                         coalesce(lead->'__sara_message_ids','[]'::jsonb)
                           ||jsonb_build_array(p_mensagem_id::text),true
                       ),
                       '{__sara_event_types}',
                       coalesce(lead->'__sara_event_types','[]'::jsonb)
                         ||jsonb_build_array(v_evento),true
                     ),
                     '{__sara_source_id}',to_jsonb(p_mensagem_id::text),true
                   ),
                   '{__sara_message_id}',to_jsonb(p_mensagem_id::text),true
                 ),
                 '{__sara_last_message_at}',to_jsonb(v_marca),true
               )||jsonb_build_object(
                 '__sara_event_type',v_evento,
                 '__sara_message_count',
                   coalesce(nullif(lead->>'__sara_message_count','')::integer,0)+1
               ),
               due_at=least(
                 v_primeira+make_interval(secs=>v_maximo),
                 clock_timestamp()+make_interval(secs=>v_silencio)
               )
         where id=v_fila_id and status='pendente';
        v_coalescidas:=v_coalescidas+1;
      end if;

      update private.sara_evento_mensagem set fila_id=v_fila_id
       where id=v_audit_id;
      v_card_aceito:=true;
    end loop;

    if v_card_aceito then
      insert into public.motor_evento_visto(evento,funil_lead_id,marca)
      values(v_evento,r.card,v_marca)
      on conflict(evento,funil_lead_id) do update
        set marca=greatest(public.motor_evento_visto.marca,excluded.marca),
            atualizado_em=clock_timestamp();
      v_cards:=v_cards+1;
    end if;
  end loop;

  delete from private.sara_evento_mensagem_falha where mensagem_id=p_mensagem_id;
  return jsonb_build_object(
    'ok',true,'evento',v_evento,'cards',v_cards,
    'enfileiradas',v_enfileiradas,'coalescidas',v_coalescidas,
    'duplicadas',v_duplicadas,'quiet_window_seconds',v_silencio,
    'max_batch_wait_seconds',v_maximo
  );
end
$function$;

revoke all on function private.sara_enfileirar_mensagem(uuid)
  from public,anon,authenticated;
grant execute on function private.sara_enfileirar_mensagem(uuid) to service_role;

-- O contrato HTTP recebe os IDs do lote sem mudar o motor nem o mapa visivel.
do $patch_motor_agente_batch$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(
    'public.motor_agente(bigint,text,text,jsonb,bigint,bigint,text)'::regprocedure
  ) into v_def;
  v_new:=replace(v_def,
    $old$'expected_action',coalesce(p_lead->'__sara_proxima_acao','null'::jsonb)$old$,
    $new$'expected_action',coalesce(p_lead->'__sara_proxima_acao','null'::jsonb),
          'message_ids',coalesce(p_lead->'__sara_message_ids','[]'::jsonb),
          'batch_first_message_at',nullif(p_lead->>'__sara_first_message_at',''),
          'batch_last_message_at',nullif(p_lead->>'__sara_last_message_at','')$new$
  );
  if v_new=v_def or position($needle$'message_ids',coalesce(p_lead->'__sara_message_ids'$needle$ in v_new)=0 then
    raise exception 'SARA_BATCH_MOTOR_PATCH_FAILED: contexto de lote ausente';
  end if;

  v_new:=replace(v_new,
    $old$  v_status:=v_reg->>'status';$old$,
    $new$  update public.f2_sara_analise
     set ia_execucao_id=nullif(v_item->>'ia_execucao_id','')::bigint,
         modelo=nullif(v_item->>'modelo',''),
         tokens_entrada=nullif(v_item->>'tokens_entrada','')::integer,
         tokens_cache_entrada=nullif(v_item->>'tokens_cache_entrada','')::integer,
         tokens_saida=nullif(v_item->>'tokens_saida','')::integer,
         custo_usd=nullif(v_item->>'custo_usd','')::numeric,
         mensagens_novas=nullif(v_item->>'mensagens_novas','')::integer,
         ultima_mensagem_id=nullif(v_item->>'ultima_mensagem_id','')::uuid
   where id=(v_reg->>'analise_id')::bigint;
  v_status:=v_reg->>'status';
  update private.sara_evento_mensagem
     set status=case when v_status in ('revisao_humana','sem_historico','obsoleta')
           then 'revisao' else 'analisado' end,
         analisado_em=clock_timestamp()
   where fila_id=nullif(p_lead->>'__motor_execution_id','')::bigint;$new$
  );
  if position('tokens_cache_entrada' in v_new)=0
     or position('private.sara_evento_mensagem' in v_new)=0 then
    raise exception 'SARA_TELEMETRY_MOTOR_PATCH_FAILED';
  end if;
  execute v_new;
end
$patch_motor_agente_batch$;

-- Retry preserva o evento como pendente. Somente a dead-letter final marca o
-- lote como erro, evitando que a observabilidade mostre um evento eternamente
-- aguardando depois de a fila ter encerrado.
do $patch_dispatcher_audit_error$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(
    'private.motor_dispatcher_processar_item(bigint,text,uuid,boolean)'::regprocedure
  ) into v_def;
  v_new:=replace(v_def,
    $old$      get diagnostics v_claimed=row_count;
      if v_claimed=0 then raise exception 'LEASE_LOST'; end if;
      if to_regprocedure('public.motor_resolver_alerta_fila(bigint,text)') is not null then
        perform public.motor_resolver_alerta_fila(r.id,'fila_encerrada_com_erro');$old$,
    $new$      get diagnostics v_claimed=row_count;
      if v_claimed=0 then raise exception 'LEASE_LOST'; end if;
      update private.sara_evento_mensagem
         set status='erro',analisado_em=clock_timestamp()
       where fila_id=r.id and status='pendente';
      if to_regprocedure('public.motor_resolver_alerta_fila(bigint,text)') is not null then
        perform public.motor_resolver_alerta_fila(r.id,'fila_encerrada_com_erro');$new$
  );
  if v_new=v_def or position('update private.sara_evento_mensagem' in v_new)=0 then
    raise exception 'SARA_DISPATCHER_AUDIT_PATCH_FAILED';
  end if;
  execute v_new;
end
$patch_dispatcher_audit_error$;

create or replace function public.f2_sara_tempo_real_diagnostico()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  with eventos as (
    select * from private.sara_evento_mensagem
     where registrado_em>=clock_timestamp()-interval '24 hours'
  ), custo as (
    select coalesce(sum(custo_usd),0) total
      from public.agente_execucoes
     where agente_slug='sara' and status='ok'
       and criado_em>=date_trunc(
         'month',clock_timestamp() at time zone 'America/Sao_Paulo'
       ) at time zone 'America/Sao_Paulo'
  )
  select jsonb_build_object(
    'ok',true,
    'eventos_24h',(select count(*) from eventos),
    'eventos_analisados_24h',(select count(*) from eventos where analisado_em is not null),
    'fora_sla_60s_24h',(select count(*) from eventos
      where analisado_em is not null and analisado_em-registrado_em>interval '60 seconds'),
    'latencia_ms_p95',(select coalesce(round(percentile_cont(.95) within group(
      order by extract(epoch from(analisado_em-registrado_em))*1000)::numeric),0)
      from eventos where analisado_em is not null),
    'lotes_pendentes',(select count(*) from public.motor_fila
      where automacao_id=49 and status='pendente' and lead->>'__sara_batch'='true'),
    'custo_mes_usd',(select round(total,6) from custo)
  );
$function$;

revoke all on function public.f2_sara_tempo_real_diagnostico()
  from public,anon,authenticated;
grant execute on function public.f2_sara_tempo_real_diagnostico() to service_role;

commit;
