-- Central de Automacoes: fecha as ultimas rotas que podiam produzir efeitos
-- fora do bloco desenhado.
--
-- 1. A atribuicao Meta deixa de acontecer ao inserir na fila e passa a ser
--    uma operacao explicita do bloco Operacoes de campos.
-- 2. O runtime revalida o snapshot publicado antes de executar; codigo legado
--    de chat/API/distribuicao composta nao pode ser alcancado por mapa antigo.
-- 3. A confirmacao do envio e isolada por automacao+bloco para uma execucao
--    nunca aproveitar o log de outra execucao concorrente.

begin;

-- Remove o efeito oculto que existia na infraestrutura da fila.
drop trigger if exists trg_motor_fila_meta_attribution on public.motor_fila;
drop function if exists private.sync_meta_lead_attribution_from_queue();

create or replace function private.motor_atribuicao_meta_por_campos(
  p_lead_id bigint,
  p_contexto jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_payload jsonb:=coalesce(p_contexto->'entrada_payload',p_contexto,'{}'::jsonb);
  v_meta_lead_id text:=btrim(coalesce(v_payload->>'meta_lead_id',v_payload->>'leadgen_id',''));
  v_existing_lead_id bigint;
  v_touch jsonb;
  v_seen_at timestamptz:=now();
begin
  if p_lead_id is null then
    raise exception using errcode='22023',message='META_ATTRIBUTION_LEAD_REQUIRED';
  end if;
  if v_meta_lead_id='' then
    return jsonb_build_object('ok',true,'aplicado',false,'motivo','meta_lead_id_ausente');
  end if;
  if v_meta_lead_id !~ '^[0-9]{15,17}$' then
    raise exception using errcode='22023',message='META_LEAD_ID_INVALID';
  end if;

  if nullif(v_payload->>'meta_created_time','') is not null then
    begin
      v_seen_at:=(v_payload->>'meta_created_time')::timestamptz;
    exception when others then
      raise exception using errcode='22007',message='META_CREATED_TIME_INVALID';
    end;
  end if;

  select a.lead_id into v_existing_lead_id
    from private.lead_attribution a
   where a.meta_lead_id=v_meta_lead_id
   limit 1;
  if v_existing_lead_id is not null and v_existing_lead_id<>p_lead_id then
    raise exception using errcode='23505',message='META_LEAD_ID_CONFLICT';
  end if;

  v_touch:=jsonb_strip_nulls(jsonb_build_object(
    'source',nullif(v_payload->>'source',''),
    'medium',nullif(v_payload->>'medium',''),
    'platform',nullif(v_payload->>'platform',''),
    'campaign',nullif(v_payload->>'meta_campaign_name',''),
    'campaign_id',nullif(v_payload->>'meta_campaign_id',''),
    'adset',nullif(v_payload->>'meta_adset_name',''),
    'adset_id',nullif(v_payload->>'meta_adset_id',''),
    'ad',nullif(v_payload->>'meta_ad_name',''),
    'ad_id',nullif(v_payload->>'meta_ad_id',''),
    'form_id',nullif(v_payload->>'meta_form_id',''),
    'page_id',nullif(v_payload->>'meta_page_id',''),
    'leadgen_id',v_meta_lead_id,
    'is_organic',nullif(v_payload->>'meta_is_organic',''),
    'created_time',v_seen_at
  ));

  insert into private.lead_attribution(
    lead_id,first_touch,last_touch,source,medium,campaign,campaign_id,
    adset_id,ad_id,meta_lead_id,first_seen_at,last_seen_at,updated_at
  ) values (
    p_lead_id,v_touch,v_touch,
    nullif(v_payload->>'source',''),nullif(v_payload->>'medium',''),
    nullif(v_payload->>'meta_campaign_name',''),
    nullif(v_payload->>'meta_campaign_id',''),
    nullif(v_payload->>'meta_adset_id',''),nullif(v_payload->>'meta_ad_id',''),
    v_meta_lead_id,v_seen_at,v_seen_at,now()
  )
  on conflict (lead_id) do update set
    first_touch=case
      when private.lead_attribution.first_touch='{}'::jsonb then excluded.first_touch
      else private.lead_attribution.first_touch
    end,
    last_touch=excluded.last_touch,
    source=coalesce(excluded.source,private.lead_attribution.source),
    medium=coalesce(excluded.medium,private.lead_attribution.medium),
    campaign=coalesce(excluded.campaign,private.lead_attribution.campaign),
    campaign_id=coalesce(excluded.campaign_id,private.lead_attribution.campaign_id),
    adset_id=coalesce(excluded.adset_id,private.lead_attribution.adset_id),
    ad_id=coalesce(excluded.ad_id,private.lead_attribution.ad_id),
    meta_lead_id=excluded.meta_lead_id,
    last_seen_at=greatest(private.lead_attribution.last_seen_at,excluded.last_seen_at),
    updated_at=now();

  return jsonb_build_object('ok',true,'aplicado',true,'meta_lead_id',v_meta_lead_id);
end
$function$;

revoke all on function private.motor_atribuicao_meta_por_campos(bigint,jsonb)
  from public,anon,authenticated;
grant execute on function private.motor_atribuicao_meta_por_campos(bigint,jsonb)
  to service_role;

create or replace function public.motor_campos_deterministico(
  p_auto bigint,
  p_nome text,
  p_bloco text,
  p_lead jsonb,
  p_map jsonb,
  p_lead_id bigint,
  p_neg_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_item jsonb;
  v_options jsonb;
  v_name text;
  v_param text;
  v_extra text;
  v_text text;
  v_value jsonb;
  v_contexto jsonb:=coalesce(p_lead,'{}'::jsonb);
  v_payload jsonb;
  v_sync jsonb;
  v_lead_id bigint:=p_lead_id;
  v_skip_empty boolean;
begin
  if v_lead_id is null then
    begin
      v_lead_id:=nullif(v_contexto->>'__lead_id','')::bigint;
    exception when others then
      v_lead_id:=null;
    end;
  end if;
  if v_lead_id is null then
    raise exception using errcode='P0001',
      message='FIELD_OPERATION_REQUIRES_ENTRY_OUTPUT';
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_map,'[]'::jsonb))
  loop
    v_name:=v_item->>'name';
    v_options:=coalesce(v_item->'options','{}'::jsonb);
    v_param:=v_options->>'parameter';
    v_skip_empty:=coalesce((v_options->>'skipEmpty')::boolean,false);

    if v_name='store-json-payload-field-operation' then
      v_extra:=regexp_replace(
        coalesce(nullif(v_param,''),'additional-field[entrada_payload]'),
        '^additional-field\[|\]$','','g'
      );
      v_payload:=coalesce(p_lead,'{}'::jsonb)
        - '__lead_id' - '__motor_execution_id' - '__automacao_versao_id';
      update public.leads
         set extras=coalesce(extras,'{}'::jsonb)||jsonb_build_object(v_extra,v_payload),
             atualizado_em=now()
       where id=v_lead_id;
      v_contexto:=v_contexto||jsonb_build_object(v_extra,v_payload);
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (
        p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',p_lead->>'telefone',
        'JSON completo armazenado em '||v_extra
      );
      continue;
    elsif v_name='sync-meta-attribution-field-operation' then
      v_sync:=private.motor_atribuicao_meta_por_campos(v_lead_id,v_contexto);
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (
        p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',p_lead->>'telefone',
        case when coalesce((v_sync->>'aplicado')::boolean,false)
          then 'Rastreamento Meta registrado pelo modulo de campos'
          else 'Rastreamento Meta nao aplicado: '||coalesce(v_sync->>'motivo','sem dados')
        end
      );
      continue;
    elsif v_name='parse-phone-field-operation' then
      v_param:='leadPhone';
      v_value:=public.motor_campo_valor_json(v_options->>'phone',p_lead);
      v_text:=regexp_replace(coalesce(v_value#>>'{}',''),'\D','','g');
      v_value:=to_jsonb(v_text);
    elsif v_name='set-field-operation' then
      v_value:=public.motor_campo_valor_json(v_options->>'value',p_lead);
      v_text:=case
        when jsonb_typeof(v_value)='string' then v_value#>>'{}'
        when v_value is null or v_value='null'::jsonb then null
        else v_value::text
      end;
    else
      raise exception 'UNSUPPORTED_FIELD_OPERATION: %',coalesce(v_name,'NULL');
    end if;

    if nullif(v_param,'') is null then
      raise exception 'FIELD_DESTINATION_REQUIRED';
    end if;
    if v_skip_empty and (
      v_value is null or v_value='null'::jsonb or btrim(coalesce(v_text,''))=''
    ) then
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (
        p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',p_lead->>'telefone',
        'Campo '||v_param||' ignorado porque a origem veio vazia'
      );
      continue;
    end if;

    if v_param='leadName' then
      update public.leads set nome=v_text,atualizado_em=now() where id=v_lead_id;
      v_contexto:=v_contexto||jsonb_build_object('nome',v_text);
    elsif v_param='leadPhone' then
      v_text:=regexp_replace(coalesce(v_text,''),'\D','','g');
      update public.leads set telefone=nullif(v_text,''),atualizado_em=now() where id=v_lead_id;
      v_contexto:=v_contexto||jsonb_build_object('telefone',v_text);
    elsif v_param='leadEmail' then
      update public.leads set email=nullif(v_text,''),atualizado_em=now() where id=v_lead_id;
      v_contexto:=v_contexto||jsonb_build_object('email',coalesce(v_text,''));
    elsif v_param='leadInstagram' then
      update public.leads set instagram=nullif(v_text,''),atualizado_em=now() where id=v_lead_id;
      v_contexto:=v_contexto||jsonb_build_object('instagram',coalesce(v_text,''));
    elsif v_param='leadOrigin' then
      update public.leads set origem=nullif(v_text,''),atualizado_em=now() where id=v_lead_id;
      v_contexto:=v_contexto||jsonb_build_object('origem',coalesce(v_text,''));
    elsif v_param='leadStatus' then
      update public.leads set status=v_text,atualizado_em=now() where id=v_lead_id;
      v_contexto:=v_contexto||jsonb_build_object('status',v_text);
    elsif v_param='leadCpfCnpj' then
      update public.leads
         set extras=coalesce(extras,'{}'::jsonb)||jsonb_build_object('cpf_cnpj',v_value),
             atualizado_em=now()
       where id=v_lead_id;
      v_contexto:=v_contexto||jsonb_build_object('cpf_cnpj',v_value);
    elsif v_param ~ '^additional-field\[' then
      v_extra:=regexp_replace(v_param,'^additional-field\[|\]$','','g');
      if nullif(v_extra,'') is null then
        raise exception 'ADDITIONAL_FIELD_NAME_REQUIRED';
      end if;
      update public.leads
         set extras=coalesce(extras,'{}'::jsonb)||jsonb_build_object(v_extra,v_value),
             atualizado_em=now()
       where id=v_lead_id;
      v_contexto:=v_contexto||jsonb_build_object(v_extra,v_value);
    else
      update public.leads
         set extras=coalesce(extras,'{}'::jsonb)||jsonb_build_object(v_param,v_value),
             atualizado_em=now()
       where id=v_lead_id;
      v_contexto:=v_contexto||jsonb_build_object(v_param,v_value);
    end if;

    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',p_lead->>'telefone',
      'Campo '||v_param||' mapeado pelo modulo'
    );
  end loop;

  return jsonb_build_object('ok',true,'lead_id',v_lead_id,'contexto',v_contexto);
end
$function$;

revoke all on function public.motor_campos_deterministico(
  bigint,text,text,jsonb,jsonb,bigint,bigint
) from public,anon,authenticated;
grant execute on function public.motor_campos_deterministico(
  bigint,text,text,jsonb,jsonb,bigint,bigint
) to service_role;

-- O banco reconhece a operacao explicita e continua rejeitando qualquer
-- operacao de campos desconhecida.
do $patch_validator$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='automacao_validar_mapa'
     and pg_get_function_identity_arguments(p.oid)='p_mapa jsonb';
  if v_def is null then raise exception 'automacao_validar_mapa ausente'; end if;
  if position('sync-meta-attribution-field-operation' in v_def)=0 then
    v_new:=regexp_replace(
      v_def,
      '(''store-json-payload-field-operation'')',
      E'\\1,\n    ''sync-meta-attribution-field-operation'''
    );
    if v_new=v_def or position('sync-meta-attribution-field-operation' in v_new)=0 then
      raise exception 'validador nao recebeu rastreamento Meta explicito';
    end if;
    execute v_new;
  end if;
end
$patch_validator$;

-- Um snapshot antigo so executa se ainda respeitar o mesmo contrato que o
-- construtor e o publicador aceitam hoje.
create or replace function public.motor_rodar(
  p_auto_id bigint,
  p_lead jsonb,
  p_start_block text default null,
  p_depth integer default 0
)
returns text
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_ativa boolean;
  v_status text;
  v_arquivada boolean;
  v_tel text;
  v_nome text;
  v_trigger text;
  v_lead jsonb;
  v_mapa jsonb;
  v_validacao jsonb;
begin
  select a.ativa,a.status,coalesce(a.arquivada,false),a.nome
    into v_ativa,v_status,v_arquivada,v_nome
    from public.automacoes a where a.id=p_auto_id;
  if not found then
    raise exception using errcode='P0001',message='AUTOMATION_NOT_FOUND: automacao nao encontrada';
  end if;
  if v_ativa is distinct from true or v_status is distinct from 'publicado' or v_arquivada then
    raise exception using errcode='P0001',message='AUTOMATION_NOT_RUNNABLE: publique e ative a automacao antes de executar';
  end if;
  if coalesce(auth.jwt()->>'role','')='authenticated' then
    raise exception using errcode='0A000',message='AUTOMATION_SIMULATION_DISABLED: simulacao real foi desativada';
  end if;

  v_lead:=public.motor_contextualizar_lead(p_auto_id,p_lead);
  v_mapa:=public.automacao_mapa_executavel(
    p_auto_id,(v_lead->>'__automacao_versao_id')::bigint
  );
  if v_mapa is null then
    raise exception using errcode='P0001',message='AUTOMATION_VERSION_NOT_RUNNABLE';
  end if;
  v_validacao:=public.automacao_validar_mapa(v_mapa);
  if coalesce((v_validacao->>'ok')::boolean,false) is not true then
    raise exception using errcode='P0001',
      message='AUTOMATION_RUNTIME_CONTRACT_INVALID: '||(v_validacao->'erros')::text;
  end if;

  select elem->>'id' into v_trigger
    from jsonb_array_elements(v_mapa->'automation'->'blocks') e(elem)
   where elem->>'type'='trigger' limit 1;

  v_tel:=right(regexp_replace(coalesce(v_lead->>'telefone',''),'\D','','g'),11);
  if v_tel<>'' then perform pg_advisory_xact_lock(hashtext('motor_lead_'||v_tel)); end if;

  if p_start_block is null and v_tel<>'' and exists (
    select 1 from public.motor_execucoes me
     where me.automacao_id=p_auto_id and me.evento='entrada' and me.status='ok'
       and right(regexp_replace(coalesce(me.lead_telefone,''),'\D','','g'),11)=v_tel
       and me.criado_em>now()-interval '15 seconds'
  ) then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe
    ) values (
      p_auto_id,v_nome,v_trigger,'entrada','alerta',v_lead->>'nome',v_tel,
      'Webhook duplicado ignorado (mesmo telefone em menos de 15s)'
    );
    return 'Duplicata de webhook ignorada (15s) - nada executado.';
  end if;

  return public.motor_rodar_unchecked(p_auto_id,v_lead,p_start_block,p_depth);
end
$function$;

revoke all on function public.motor_rodar(bigint,jsonb,text,integer)
  from public,anon,authenticated;
grant execute on function public.motor_rodar(bigint,jsonb,text,integer)
  to service_role;

-- Serializa o bloco de envio e usa o ID do log como fronteira. Assim, duas
-- execucoes simultaneas nunca compartilham a confirmacao de envio.
do $patch_send_confirmation$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_rodar_unchecked'
     and pg_get_function_identity_arguments(p.oid)=
       'p_auto_id bigint, p_lead jsonb, p_start_block text, p_depth integer';
  if v_def is null then raise exception 'motor_rodar_unchecked ausente'; end if;

  if position('send-confirmation-lock' in v_def)=0 then
    v_new:=replace(v_def,
      $old$    elsif tipo='send-approach' then
      _dist_cor := null;
$old$,
      $new$    elsif tipo='send-approach' then
      -- send-confirmation-lock: uma confirmacao pertence somente a esta execucao.
      perform pg_advisory_xact_lock(hashtext('module:'||p_auto_id::text||':'||cur));
      _dist_cor := null;
$new$);
    v_new:=replace(v_new,
      $old$      _send_started := clock_timestamp();
$old$,
      $new$      select coalesce(max(id),0) into _module_log_id from motor_execucoes;
      _send_started := clock_timestamp();
$new$);
    v_new:=replace(v_new,'me.criado_em>=_send_started','me.id>_module_log_id');
    if v_new=v_def
       or position('send-confirmation-lock' in v_new)=0
       or position('me.criado_em>=_send_started' in v_new)>0
       or position('me.id>_module_log_id' in v_new)=0 then
      raise exception 'confirmacao de envio nao foi isolada';
    end if;
    execute v_new;
  end if;
end
$patch_send_confirmation$;

-- Publica somente a nova operacao de rastreamento em toda entrada ativa que
-- materializa dados de campanha (webhook do Make ou entrada do site).
-- Nao processa, distribui ou envia nenhum lead durante esta migracao.
do $publish_meta_operation$
declare
  r record;
  v_map jsonb;
  v_draft jsonb;
  v_blocks jsonb;
  v_draft_blocks jsonb;
  v_valid jsonb;
  v_version integer;
  v_version_id bigint;
  v_operation jsonb:=jsonb_build_object(
    'name','sync-meta-attribution-field-operation',
    'group','field','stepId','meta-attribution','options','{}'::jsonb
  );
begin
  for r in
    select a.id,a.nome,a.mapa_rascunho,v.mapa
      from public.automacoes a
      join public.automacao_versoes v on v.id=a.versao_publicada_id
     where a.ativa is true
       and a.status='publicado' and not coalesce(a.arquivada,false)
       and exists(
         select 1
           from jsonb_array_elements(coalesce(v.mapa->'automation'->'blocks','[]'::jsonb)) b,
                lateral jsonb_array_elements(coalesce(b#>'{options,triggers}','[]'::jsonb)) t
          where b->>'type'='trigger'
            and t->>'name' in ('json-http-request-trigger','site-lead-created-trigger')
       )
       and exists(
         select 1
           from jsonb_array_elements(coalesce(v.mapa->'automation'->'blocks','[]'::jsonb)) b
          where b->>'type'='field-operation'
       )
     order by a.id for update of a
  loop
    v_map:=r.mapa;
    select jsonb_agg(
      case when b->>'type'='field-operation' and not exists(
        select 1 from jsonb_array_elements(coalesce(b#>'{options,fieldOperations}','[]'::jsonb)) op
         where op->>'name'='sync-meta-attribution-field-operation'
      ) then jsonb_set(
        b,'{options,fieldOperations}',
        coalesce(b#>'{options,fieldOperations}','[]'::jsonb)||jsonb_build_array(v_operation),true
      ) else b end order by ord
    ) into v_blocks
    from jsonb_array_elements(v_map->'automation'->'blocks') with ordinality x(b,ord);
    v_map:=jsonb_set(v_map,'{automation,blocks}',v_blocks,true);

    v_valid:=public.automacao_validar_mapa(v_map);
    if coalesce((v_valid->>'ok')::boolean,false) is not true then
      raise exception 'Automacao % invalida: %',r.nome,v_valid->'erros';
    end if;
    if not exists(
      select 1 from jsonb_array_elements(v_map->'automation'->'blocks') b,
        lateral jsonb_array_elements(coalesce(b#>'{options,fieldOperations}','[]'::jsonb)) op
       where b->>'type'='field-operation'
         and op->>'name'='sync-meta-attribution-field-operation'
    ) then raise exception 'Operacao Meta ausente em %',r.nome; end if;

    v_draft:=coalesce(r.mapa_rascunho,v_map);
    select jsonb_agg(
      case when b->>'type'='field-operation' and not exists(
        select 1 from jsonb_array_elements(coalesce(b#>'{options,fieldOperations}','[]'::jsonb)) op
         where op->>'name'='sync-meta-attribution-field-operation'
      ) then jsonb_set(
        b,'{options,fieldOperations}',
        coalesce(b#>'{options,fieldOperations}','[]'::jsonb)||jsonb_build_array(v_operation),true
      ) else b end order by ord
    ) into v_draft_blocks
    from jsonb_array_elements(v_draft->'automation'->'blocks') with ordinality x(b,ord);
    v_draft:=jsonb_set(v_draft,'{automation,blocks}',v_draft_blocks,true);

    select coalesce(max(versao),0)+1 into v_version
      from public.automacao_versoes where automacao_id=r.id;
    insert into public.automacao_versoes(
      automacao_id,versao,nome,mapa,observacao,criado_por
    ) values (
      r.id,v_version,r.nome,v_map,
      'Rastreamento Meta executado somente pelo bloco de Campos','migration'
    ) returning id into v_version_id;
    update public.automacoes
       set mapa=v_map,mapa_rascunho=v_draft,versao_publicada_id=v_version_id,
           status='publicado',publicado_em=now(),atualizada_em=now()
     where id=r.id;
  end loop;

  if exists(
    select 1
      from public.automacoes a
     where a.ativa and a.status='publicado' and not coalesce(a.arquivada,false)
       and exists(
         select 1
           from jsonb_array_elements(coalesce(a.mapa->'automation'->'blocks','[]'::jsonb)) b,
                lateral jsonb_array_elements(coalesce(b#>'{options,triggers}','[]'::jsonb)) t
          where b->>'type'='trigger'
            and t->>'name' in ('json-http-request-trigger','site-lead-created-trigger')
       )
       and exists(
         select 1
           from jsonb_array_elements(coalesce(a.mapa->'automation'->'blocks','[]'::jsonb)) b
          where b->>'type'='field-operation'
       )
       and not exists(
         select 1
           from jsonb_array_elements(coalesce(a.mapa->'automation'->'blocks','[]'::jsonb)) b,
                lateral jsonb_array_elements(coalesce(b#>'{options,fieldOperations}','[]'::jsonb)) op
          where b->>'type'='field-operation'
            and op->>'name'='sync-meta-attribution-field-operation'
       )
  ) then
    raise exception 'Existe entrada ativa sem o modulo explicito de rastreamento Meta';
  end if;
end
$publish_meta_operation$;

do $verify$
declare
  v_test jsonb;
begin
  if exists(
    select 1 from pg_trigger t
     where t.tgrelid='public.motor_fila'::regclass
       and t.tgname='trg_motor_fila_meta_attribution'
       and not t.tgisinternal
  ) then raise exception 'Gatilho oculto de atribuicao continua ativo'; end if;
  if to_regprocedure('private.sync_meta_lead_attribution_from_queue()') is not null then
    raise exception 'Funcao oculta de atribuicao continua instalada';
  end if;
  if position('AUTOMATION_RUNTIME_CONTRACT_INVALID' in
    pg_get_functiondef('public.motor_rodar(bigint,jsonb,text,integer)'::regprocedure))=0 then
    raise exception 'Runtime nao revalida o snapshot';
  end if;
  if position('send-confirmation-lock' in
    pg_get_functiondef('public.motor_rodar_unchecked(bigint,jsonb,text,integer)'::regprocedure))=0 then
    raise exception 'Envio concorrente nao foi isolado';
  end if;
  v_test:=public.automacao_validar_mapa(jsonb_build_object(
    'automation',jsonb_build_object('blocks',jsonb_build_array(
      jsonb_build_object('id','t','type','trigger','options',jsonb_build_object(
        'triggers',jsonb_build_array(jsonb_build_object('name','json-http-request-trigger')),
        'nextBlockId','f'
      )),
      jsonb_build_object('id','f','type','field-operation','options',jsonb_build_object(
        'fieldOperations',jsonb_build_array(jsonb_build_object(
          'name','sync-meta-attribution-field-operation','options','{}'::jsonb
        ))
      ))
    )))
  );
  if coalesce((v_test->>'ok')::boolean,false) is not true then
    raise exception 'Validador rejeitou operacao Meta explicita: %',v_test;
  end if;
end
$verify$;

commit;
