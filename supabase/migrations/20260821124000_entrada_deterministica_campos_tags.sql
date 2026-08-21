-- Central de Automacoes: entrada, campos e tags como modulos deterministas.
--
-- O webhook apenas registra o evento bruto. A materializacao do lead acontece
-- no bloco de Entrada. O bloco de Campos recebe o JSON, persiste uma copia
-- integral para rastreabilidade, mapeia os destinos configurados e devolve o
-- contexto normalizado ao proximo bloco. Tags sao aplicadas apenas no bloco de
-- Tags, inclusive a retirada explicita do selo Aquario.

begin;

create or replace function public.motor_campo_valor_json(
  p_raw text,
  p_lead jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $function$
declare
  v_raw text:=coalesce(p_raw,'');
  v_key text;
  v_value jsonb;
  v_explicit boolean:=false;
begin
  if position('|' in v_raw)>0 then
    v_raw:=substring(v_raw from position('|' in v_raw)+1);
  end if;

  if v_raw ~ '^\[[^]]*\].+$' then
    v_key:=regexp_replace(v_raw,'^\[[^]]*\]','');
    v_explicit:=true;
  elsif v_raw ~ '^\{[^{}]+\}$' then
    v_key:=substring(v_raw from 2 for length(v_raw)-2);
    v_explicit:=true;
  elsif v_raw ~ '^[A-Za-z0-9_ .-]{1,80}$' then
    v_key:=btrim(v_raw);
  end if;

  if nullif(v_key,'') is not null then
    v_value:=p_lead->v_key;
    if v_value is null then
      select value into v_value
        from jsonb_each(coalesce(p_lead,'{}'::jsonb))
       where lower(key)=lower(v_key)
       limit 1;
    end if;
    if v_value is not null then return v_value; end if;
    if v_explicit then return null; end if;
  end if;

  return to_jsonb(public.motor_subst(p_raw,coalesce(p_lead,'{}'::jsonb)));
end
$function$;

revoke all on function public.motor_campo_valor_json(text,jsonb)
  from public,anon,authenticated;
grant execute on function public.motor_campo_valor_json(text,jsonb)
  to service_role;

create or replace function public.motor_entrada_modulo(
  p_auto bigint,
  p_nome text,
  p_bloco text,
  p_bloco_config jsonb,
  p_lead jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_trigger text:=p_bloco_config#>>'{options,triggers,0,name}';
  v_contexto jsonb:=coalesce(p_lead,'{}'::jsonb);
  v_lead_id bigint;
begin
  if v_trigger in ('json-http-request-trigger','site-lead-created-trigger') then
    begin
      v_lead_id:=nullif(v_contexto->>'__lead_id','')::bigint;
    exception when others then
      v_lead_id:=null;
    end;

    if v_lead_id is null then
      v_contexto:=public.motor_materializar_entrada(v_contexto);
      v_lead_id:=nullif(v_contexto->>'__lead_id','')::bigint;
    end if;

    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      p_auto,p_nome,p_bloco,'entrada','ok',v_contexto->>'nome',
      regexp_replace(coalesce(v_contexto->>'telefone',''),'\D','','g'),
      'Entrada materializou/reutilizou exatamente o lead #'||v_lead_id
    );
  end if;
  return v_contexto;
end
$function$;

revoke all on function public.motor_entrada_modulo(bigint,text,text,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.motor_entrada_modulo(bigint,text,text,jsonb,jsonb)
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
    if v_skip_empty and (v_value is null or v_value='null'::jsonb or btrim(coalesce(v_text,''))='') then
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
      if nullif(v_extra,'') is null then raise exception 'ADDITIONAL_FIELD_NAME_REQUIRED'; end if;
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

-- O webhook deixa de criar/reutilizar o cadastro antes do construtor. Ele
-- registra o payload bruto e a versao; o bloco de Entrada materializa depois.
create or replace function public.motor_enfileirar_idempotente(
  p_auto_id bigint,
  p_lead jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_key text:=left(btrim(coalesce(p_idempotency_key,'')),240);
  v_hash text:=md5(coalesce(p_lead,'{}'::jsonb)::text);
  v_evento_id bigint;
  v_fila_id bigint;
  v_hash_existente text;
begin
  if v_key='' then
    raise exception using errcode='22023',message='IDEMPOTENCY_KEY_REQUIRED';
  end if;
  insert into public.automacao_eventos_entrada(
    automacao_id,idempotency_key,payload_hash
  ) values (p_auto_id,v_key,v_hash)
  on conflict (automacao_id,idempotency_key) do nothing
  returning id into v_evento_id;

  if v_evento_id is null then
    select payload_hash,fila_id into v_hash_existente,v_fila_id
      from public.automacao_eventos_entrada
     where automacao_id=p_auto_id and idempotency_key=v_key;
    if v_hash_existente is distinct from v_hash then
      raise exception using errcode='23505',message='IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('ok',true,'duplicado',true,'fila_id',v_fila_id);
  end if;

  v_fila_id:=public.motor_enfileirar(p_auto_id,coalesce(p_lead,'{}'::jsonb));
  update public.automacao_eventos_entrada set fila_id=v_fila_id where id=v_evento_id;
  return jsonb_build_object('ok',true,'duplicado',false,'fila_id',v_fila_id);
end
$function$;

revoke all on function public.motor_enfileirar_idempotente(bigint,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.motor_enfileirar_idempotente(bigint,jsonb,text)
  to service_role;

-- Encadeia as saidas reais dos modulos no contexto entregue ao proximo bloco.
do $patch_executor$
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

  v_new:=replace(v_def,
    $old$    if tipo='trigger' then
      trace:=trace||E'>> Gatilho\n'; cur:=b#>>'{options,nextBlockId}';
$old$,
    $new$    if tipo='trigger' then
      p_lead:=public.motor_entrada_modulo(p_auto_id,a_nome,cur,b,p_lead);
      begin
        v_lead_id:=nullif(p_lead->>'__lead_id','')::bigint;
      exception when others then
        v_lead_id:=null;
      end;
      if v_lead_id is not null then
        select id into v_negocio_id from public.negocios
         where lead_id=v_lead_id order by id desc limit 1;
      end if;
      trace:=trace||E'>> Entrada\n'; cur:=b#>>'{options,nextBlockId}';
$new$);

  v_new:=replace(v_new,
    $old$        v_lead_id := motor_campos(p_auto_id,a_nome,cur,p_lead,
          coalesce(b#>'{options,fieldOperations}',b#>'{options,mapeamento}','[]'::jsonb),
          v_lead_id,v_negocio_id);
$old$,
    $new$        _res:=public.motor_campos_deterministico(
          p_auto_id,a_nome,cur,p_lead,
          coalesce(b#>'{options,fieldOperations}',b#>'{options,mapeamento}','[]'::jsonb),
          v_lead_id,v_negocio_id
        );
        v_lead_id:=nullif(_res->>'lead_id','')::bigint;
        p_lead:=coalesce(_res->'contexto',p_lead);
$new$);

  if v_new=v_def
     or position('motor_entrada_modulo' in v_new)=0
     or position('motor_campos_deterministico' in v_new)=0
     or position('p_lead:=coalesce(_res->''contexto''' in v_new)=0 then
    raise exception 'executor nao recebeu o contrato entrada/campos';
  end if;
  execute v_new;
end
$patch_executor$;

-- Tags dinamicas opcionais nao viram etiquetas literais quando a origem nao
-- enviou o campo. A decisao continua declarada na propria acao.
do $patch_tags$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_acoes'
     and pg_get_function_identity_arguments(p.oid)=
       'p_auto bigint, p_nome text, p_bloco text, p_lead jsonb, p_actions jsonb, p_lead_id bigint, p_neg_id bigint, p_depth integer';
  if v_def is null then raise exception 'motor_acoes ausente'; end if;
  v_new:=replace(v_def,
    $old$      v_tag := public.motor_subst(coalesce(ao->>'tag',''), p_lead);
      if v_lead_id is null then
$old$,
    $new$      v_tag := public.motor_subst(coalesce(ao->>'tag',''), p_lead);
      if coalesce((ao->>'skipWhenBlank')::boolean,false)
         and (v_tag ~ '\{[^}]+\}' or v_tag ~ ':\s*$') then
        insert into motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values (
          p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',v_tel,
          'Tag dinamica ignorada porque o valor mapeado veio vazio'
        );
        continue;
      end if;
      if v_lead_id is null then
$new$);
  if v_new=v_def or position('skipWhenBlank' in v_new)=0 then
    raise exception 'motor_acoes nao recebeu trava de tag vazia';
  end if;
  execute v_new;
end
$patch_tags$;

-- O validador de publicacao passa a reconhecer o mapeamento explicito do JSON
-- integral como operacao do bloco de Campos.
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
  v_new:=replace(v_def,
    $old$    'set-field-operation','parse-phone-field-operation'
$old$,
    $new$    'set-field-operation','parse-phone-field-operation',
    'store-json-payload-field-operation'
$new$);
  if v_new=v_def or position('store-json-payload-field-operation' in v_new)=0 then
    raise exception 'validador nao reconheceu JSON completo';
  end if;
  execute v_new;
end
$patch_validator$;

-- Publica uma nova versao de cada automacao de entrada. Nao distribui e nao
-- envia mensagem durante a migracao.
do $publish_entries$
declare
  r record;
  v_map jsonb;
  v_blocks jsonb;
  v_field_id text;
  v_dist_id text;
  v_tag_id text;
  v_field_ops jsonb;
  v_tag_actions jsonb;
  v_version integer;
  v_version_id bigint;
  v_valid jsonb;
  v_approach text;
begin
  for r in
    select id,nome,mapa from public.automacoes
     where id in (42,65,66,67) and ativa is true and arquivada is false
     order by id for update
  loop
    v_map:=r.mapa;
    select b->>'id' into v_field_id
      from jsonb_array_elements(v_map->'automation'->'blocks') b
     where b->>'type'='field-operation' limit 1;
    select b->>'id' into v_dist_id
      from jsonb_array_elements(v_map->'automation'->'blocks') b
     where b->>'type'='distribution-simple' limit 1;
    if v_field_id is null or v_dist_id is null then
      raise exception 'Entrada % sem Campos/Distribuicao',r.nome;
    end if;
    v_tag_id:='b-tags-entrada-'||r.id::text;
    v_approach:=case when r.id=42
      then 'PADRAO | Site/Google (link dinamico)'
      else 'NAO CADASTRADA' end;

    v_field_ops:=jsonb_build_array(
      jsonb_build_object('name','store-json-payload-field-operation','group','field','stepId','raw-json',
        'options',jsonb_build_object('parameter','additional-field[entrada_payload]')),
      jsonb_build_object('name','set-field-operation','group','field','stepId','legacy-email',
        'options',jsonb_build_object('value','[Api-request-1]e-mail','parameter','leadEmail','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','legacy-campaign',
        'options',jsonb_build_object('value','[Api-request-1]campânia','parameter','additional-field[meta_campaign_name]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','legacy-adset',
        'options',jsonb_build_object('value','[Api-request-1]conjunto','parameter','additional-field[meta_adset_name]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','legacy-ad',
        'options',jsonb_build_object('value','[Api-request-1]anúncio','parameter','additional-field[meta_ad_name]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','legacy-qualification',
        'options',jsonb_build_object('value','[Api-request-1]Qualificação','parameter','additional-field[qualificacao]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','name',
        'options',jsonb_build_object('value','[Api-request-1]nome','parameter','leadName','skipEmpty',true)),
      jsonb_build_object('name','parse-phone-field-operation','group','field','stepId','phone',
        'options',jsonb_build_object('phone','[Api-request-1]telefone','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','email',
        'options',jsonb_build_object('value','[Api-request-1]email','parameter','leadEmail','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','origin',
        'options',jsonb_build_object('value','[Api-request-1]origem','parameter','leadOrigin','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','event-id',
        'options',jsonb_build_object('value','[Api-request-1]event_id','parameter','additional-field[event_id]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','leadgen-id',
        'options',jsonb_build_object('value','[Api-request-1]leadgen_id','parameter','additional-field[leadgen_id]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','source',
        'options',jsonb_build_object('value','[Api-request-1]source','parameter','additional-field[source]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','medium',
        'options',jsonb_build_object('value','[Api-request-1]medium','parameter','additional-field[medium]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','platform',
        'options',jsonb_build_object('value','[Api-request-1]platform','parameter','additional-field[platform]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-lead',
        'options',jsonb_build_object('value','[Api-request-1]meta_lead_id','parameter','additional-field[meta_lead_id]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-page',
        'options',jsonb_build_object('value','[Api-request-1]meta_page_id','parameter','additional-field[meta_page_id]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-form',
        'options',jsonb_build_object('value','[Api-request-1]meta_form_id','parameter','additional-field[meta_form_id]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-campaign-id',
        'options',jsonb_build_object('value','[Api-request-1]meta_campaign_id','parameter','additional-field[meta_campaign_id]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-campaign-name',
        'options',jsonb_build_object('value','[Api-request-1]meta_campaign_name','parameter','additional-field[meta_campaign_name]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-adset-id',
        'options',jsonb_build_object('value','[Api-request-1]meta_adset_id','parameter','additional-field[meta_adset_id]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-adset-name',
        'options',jsonb_build_object('value','[Api-request-1]meta_adset_name','parameter','additional-field[meta_adset_name]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-ad-id',
        'options',jsonb_build_object('value','[Api-request-1]meta_ad_id','parameter','additional-field[meta_ad_id]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-ad-name',
        'options',jsonb_build_object('value','[Api-request-1]meta_ad_name','parameter','additional-field[meta_ad_name]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-created',
        'options',jsonb_build_object('value','[Api-request-1]meta_created_time','parameter','additional-field[meta_created_time]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','meta-organic',
        'options',jsonb_build_object('value','[Api-request-1]meta_is_organic','parameter','additional-field[meta_is_organic]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','site-lead',
        'options',jsonb_build_object('value','[Api-request-1]site_lead_id','parameter','additional-field[site_lead_id]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','lead-type',
        'options',jsonb_build_object('value','[Api-request-1]lead_type','parameter','additional-field[lead_type]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','empreendimento-id',
        'options',jsonb_build_object('value','[Api-request-1]empreendimento_id','parameter','additional-field[empreendimento_id]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','empreendimento-name',
        'options',jsonb_build_object('value','[Api-request-1]empreendimento_nome','parameter','additional-field[empreendimento_nome]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','preference',
        'options',jsonb_build_object('value','[Api-request-1]preferencia_horario','parameter','additional-field[preferencia_horario]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','property-link',
        'options',jsonb_build_object('value','[Api-request-1]imovel_link','parameter','additional-field[imovel_link]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','tracking',
        'options',jsonb_build_object('value','[Api-request-1]tracking','parameter','additional-field[tracking]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','context',
        'options',jsonb_build_object('value','[Api-request-1]context','parameter','additional-field[context]','skipEmpty',true)),
      jsonb_build_object('name','set-field-operation','group','field','stepId','automation-origin',
        'options',jsonb_build_object('value',r.nome,'parameter','additional-field[automacao_origem]')),
      jsonb_build_object('name','set-field-operation','group','field','stepId','approach',
        'options',jsonb_build_object('value',v_approach,'parameter','additional-field[abordagem_nome]'))
    );

    v_tag_actions:=jsonb_build_array(
      jsonb_build_object('name','remove-tag-action','group','Leads',
        'options',jsonb_build_object('tag','Aquário')),
      jsonb_build_object('name','add-tag-action','group','Leads',
        'options',jsonb_build_object('tag','Origem: {origem}','skipWhenBlank',true)),
      jsonb_build_object('name','add-tag-action','group','Leads',
        'options',jsonb_build_object('tag','Automacao: '||r.nome)),
      jsonb_build_object('name','add-tag-action','group','Leads',
        'options',jsonb_build_object('tag','Campanha: {meta_campaign_name}','skipWhenBlank',true)),
      jsonb_build_object('name','add-tag-action','group','Leads',
        'options',jsonb_build_object('tag','Conjunto: {meta_adset_name}','skipWhenBlank',true)),
      jsonb_build_object('name','add-tag-action','group','Leads',
        'options',jsonb_build_object('tag','Anuncio: {meta_ad_name}','skipWhenBlank',true)),
      jsonb_build_object('name','add-tag-action','group','Leads',
        'options',jsonb_build_object('tag','Produto: {empreendimento_nome}','skipWhenBlank',true)),
      jsonb_build_object('name','add-tag-action','group','Leads',
        'options',jsonb_build_object('tag','Abordagem: '||v_approach))
    );

    select jsonb_agg(
      case
        when b->>'type'='trigger' then
          jsonb_set(b,'{options,nextBlockId}',to_jsonb(v_field_id),true)
        when b->>'id'=v_field_id then
          jsonb_set(
            jsonb_set(b,'{options,fieldOperations}',v_field_ops,true),
            '{options,nextBlockId}',to_jsonb(v_tag_id),true
          )
        else b
      end order by ord
    ) into v_blocks
    from jsonb_array_elements(v_map->'automation'->'blocks')
      with ordinality x(b,ord)
    where b->>'id' not in ('b-tags-origem',v_tag_id)
      and not (
        b->>'type'='action'
        and jsonb_array_length(coalesce(b#>'{options,actions}','[]'::jsonb))>0
        and not exists(
          select 1 from jsonb_array_elements(b#>'{options,actions}') old_action
           where old_action->>'name' not in (
             'add-tag-action','create-tags-action','remove-tag-action'
           )
        )
      );

    v_blocks:=v_blocks||jsonb_build_array(jsonb_build_object(
      'id',v_tag_id,'type','action',
      'options',jsonb_build_object(
        'actions',v_tag_actions,'nextBlockId',v_dist_id,'errorNextBlockId',''
      ),
      'presentation',jsonb_build_object('x',700,'y',100),
      'sourceBlockId','entrada-tags-'||r.id::text
    ));
    v_map:=jsonb_set(v_map,'{automation,blocks}',v_blocks,true);
    v_valid:=public.automacao_validar_mapa(v_map);
    if coalesce((v_valid->>'ok')::boolean,false) is not true then
      raise exception 'Automacao % invalida: %',r.nome,v_valid->'erros';
    end if;

    select coalesce(max(versao),0)+1 into v_version
      from public.automacao_versoes where automacao_id=r.id;
    insert into public.automacao_versoes(
      automacao_id,versao,nome,mapa,observacao,criado_por
    ) values (
      r.id,v_version,r.nome,v_map,
      'Entrada materializa; Campos mapeia JSON; Tags explicitas','migration'
    ) returning id into v_version_id;
    update public.automacoes
       set mapa=v_map,mapa_rascunho=v_map,versao_publicada_id=v_version_id,
           status='publicado',publicado_em=now(),atualizada_em=now()
     where id=r.id;

    -- Corrige somente eventos que ja entraram por esta automacao, executando
    -- os mesmos modulos de Campos e Tags. Nao chama distribuicao nem mensagem.
    for v_map in
      select distinct on (f.lead->>'__lead_id') f.lead
        from public.automacao_eventos_entrada e
        join public.motor_fila f on f.id=e.fila_id
       where e.automacao_id=r.id and nullif(f.lead->>'__lead_id','') is not null
       order by f.lead->>'__lead_id',e.criado_em desc
    loop
      v_valid:=public.motor_campos_deterministico(
        r.id,r.nome,v_field_id,v_map,v_field_ops,
        nullif(v_map->>'__lead_id','')::bigint,null
      );
      perform public.motor_acoes(
        r.id,r.nome,v_tag_id,coalesce(v_valid->'contexto',v_map),v_tag_actions,
        nullif(v_valid->>'lead_id','')::bigint,null,0
      );
    end loop;
  end loop;
end
$publish_entries$;

do $verify$
declare
  r record;
  v_map jsonb;
  v_valid jsonb;
begin
  for r in select id,nome,mapa from public.automacoes where id in (42,65,66,67)
  loop
    v_map:=r.mapa;
    v_valid:=public.automacao_validar_mapa(v_map);
    if coalesce((v_valid->>'ok')::boolean,false) is not true then
      raise exception 'Mapa invalido em %',r.nome;
    end if;
    if not exists(
      select 1 from jsonb_array_elements(v_map->'automation'->'blocks') b
       where b->>'type'='field-operation'
         and exists(
           select 1 from jsonb_array_elements(b#>'{options,fieldOperations}') op
            where op->>'name'='store-json-payload-field-operation'
         )
    ) then raise exception 'JSON completo ausente em %',r.nome; end if;
    if not exists(
      select 1 from jsonb_array_elements(v_map->'automation'->'blocks') b
       where b->>'type'='action'
         and exists(
           select 1 from jsonb_array_elements(b#>'{options,actions}') a
            where a->>'name'='remove-tag-action'
              and a#>>'{options,tag}'='Aquário'
         )
    ) then raise exception 'Modulo de tags ausente em %',r.nome; end if;
  end loop;
end
$verify$;

commit;
