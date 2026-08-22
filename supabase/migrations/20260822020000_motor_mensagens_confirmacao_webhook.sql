-- A resposta HTTP da D-API confirma apenas aceite da requisicao.
-- A proxima parte da abordagem so e liberada pelo webhook messages.sent.

do $preflight$
declare
  v_checksum text;
begin
  select md5(pg_get_functiondef(
    'public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)'::regprocedure
  )) into v_checksum;
  if v_checksum <> 'bf5a0c3d9631b0f2ea46bb2df116c8ad' then
    raise exception 'motor_envia_abordagem mudou; esperado bf5a0c3d9631b0f2ea46bb2df116c8ad, encontrado %',v_checksum;
  end if;
end
$preflight$;

alter table public.motor_mensagem_partes
  drop constraint motor_mensagem_partes_status_check;

alter table public.motor_mensagem_partes
  rename column enviada_em to aceita_em;

alter table public.motor_mensagem_partes
  add column if not exists automacao_nome text,
  add column if not exists lead_id bigint,
  add column if not exists lead_nome text,
  add column if not exists instancia_id bigint,
  add column if not exists session_id text,
  add column if not exists destino text,
  add column if not exists tipo text,
  add column if not exists conteudo text,
  add column if not exists media_url text,
  add column if not exists corpo jsonb,
  add column if not exists provider_message_id text,
  add column if not exists confirmada_em timestamptz,
  add column if not exists entregue_em timestamptz,
  add column if not exists lida_em timestamptz,
  add column if not exists erro text,
  add column if not exists tentativas integer not null default 0,
  add column if not exists atraso_antes_segundos numeric not null default 0;

update public.motor_mensagem_partes
   set status='aceita',
       erro=coalesce(erro,'Registro legado: apenas HTTP 2xx, sem confirmacao messages.sent')
 where status='enviada';

alter table public.motor_mensagem_partes
  alter column aceita_em drop not null,
  alter column aceita_em drop default,
  alter column corpo set default '{}'::jsonb;

alter table public.motor_mensagem_partes
  add constraint motor_mensagem_partes_status_check
  check(status in ('pendente','processando','aceita','enviada','entregue','lida','erro','erro_incerto')),
  add constraint motor_mensagem_partes_tipo_check
  check(tipo is null or tipo in ('text','image','video')),
  add constraint motor_mensagem_partes_tentativas_check
  check(tentativas>=0),
  add constraint motor_mensagem_partes_atraso_check
  check(atraso_antes_segundos between 0 and 10);

create unique index if not exists motor_mensagem_partes_provider_uidx
  on public.motor_mensagem_partes(provider_message_id)
  where provider_message_id is not null;

create index if not exists motor_mensagem_partes_correlacao_idx
  on public.motor_mensagem_partes(session_id,destino,tipo,status,aceita_em)
  where status in ('aceita','enviada','entregue','lida');

comment on column public.motor_mensagem_partes.status is
  'pendente/processando/aceita sao estados internos; enviada/entregue/lida so chegam por webhook D-API.';

create or replace function private.motor_despachar_parte(p_parte_id bigint)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private','extensions'
as $function$
declare
  v_parte public.motor_mensagem_partes%rowtype;
  v_key text;
  v_resp record;
  v_json jsonb;
  v_provider_id text;
  v_evento record;
  v_confirmacao jsonb;
  v_proxima_id bigint;
begin
  select * into v_parte
    from public.motor_mensagem_partes
   where id=p_parte_id
   for update;
  if not found then
    return jsonb_build_object('ok',false,'erro','PARTE_INEXISTENTE');
  end if;
  if v_parte.status<>'pendente' then
    return jsonb_build_object('ok',true,'status',v_parte.status,'idempotente',true);
  end if;
  if exists(
    select 1 from public.motor_mensagem_partes p
     where p.execution_id=v_parte.execution_id
       and p.automacao_id=v_parte.automacao_id
       and p.bloco_id=v_parte.bloco_id
       and p.parte<v_parte.parte
       and p.status not in ('enviada','entregue','lida')
  ) then
    return jsonb_build_object('ok',true,'status','aguardando_parte_anterior');
  end if;

  select ic.apikey into v_key
    from public.instancias i
    join public.instancias_credenciais ic on ic.instancia_id=i.id
   where i.id=v_parte.instancia_id
     and i.instancia_dapi=v_parte.session_id
     and coalesce(i.ativa,true)
     and coalesce(i.conectada,false)
     and i.status_dapi='connected'
     and nullif(ic.apikey,'') is not null;
  if v_key is null then
    update public.motor_mensagem_partes
       set status='erro',erro='Instancia exata indisponivel'
     where id=v_parte.id;
    return jsonb_build_object('ok',false,'erro','INSTANCIA_EXATA_INDISPONIVEL');
  end if;

  if v_parte.atraso_antes_segundos>0 then
    perform pg_sleep(v_parte.atraso_antes_segundos);
  end if;
  update public.motor_mensagem_partes
     set status='processando',tentativas=tentativas+1,erro=null
   where id=v_parte.id;

  begin
    perform extensions.http_set_curlopt(
      'CURLOPT_TIMEOUT_MS',
      case when v_parte.tipo='text' then '15000' else '45000' end
    );
    select status,left(content,4000) content into v_resp
      from extensions.http((
        'POST',
        'https://api.d-api.cloud/api/v1/messages/send/'||v_parte.tipo,
        array[extensions.http_header('Authorization',v_key)],
        'application/json',
        v_parte.corpo::text
      )::extensions.http_request);
  exception when others then
    update public.motor_mensagem_partes
       set status='erro_incerto',erro=left(sqlerrm,500)
     where id=v_parte.id;
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      v_parte.automacao_id,v_parte.automacao_nome,v_parte.bloco_id,
      'mensagem','erro',v_parte.lead_nome,v_parte.destino,
      'Parte '||v_parte.parte||' com resultado incerto; nao sera repetida automaticamente'
    );
    return jsonb_build_object('ok',false,'erro','RESULTADO_INCERTO');
  end;

  if v_resp.status not between 200 and 299 then
    update public.motor_mensagem_partes
       set status='erro',erro='HTTP '||v_resp.status
     where id=v_parte.id;
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      v_parte.automacao_id,v_parte.automacao_nome,v_parte.bloco_id,
      'mensagem','erro',v_parte.lead_nome,v_parte.destino,
      'Parte '||v_parte.parte||' recusada pela D-API [HTTP '||v_resp.status||']'
    );
    return jsonb_build_object('ok',false,'erro','HTTP_'||v_resp.status);
  end if;

  begin
    v_json:=v_resp.content::jsonb;
    v_provider_id:=coalesce(
      nullif(v_json->>'id',''),
      nullif(v_json->>'messageId',''),
      nullif(v_json->>'message_id',''),
      nullif(v_json#>>'{data,id}',''),
      nullif(v_json#>>'{data,messageId}',''),
      nullif(v_json#>>'{data,message_id}','')
    );
  exception when others then
    v_json:=null;
    v_provider_id:=null;
  end;

  update public.motor_mensagem_partes
     set status='aceita',aceita_em=now(),provider_message_id=v_provider_id,erro=null
   where id=v_parte.id;
  insert into public.motor_execucoes(
    automacao_id,automacao_nome,bloco_id,evento,status,
    lead_nome,lead_telefone,detalhe
  ) values (
    v_parte.automacao_id,v_parte.automacao_nome,v_parte.bloco_id,
    'mensagem','ok',v_parte.lead_nome,v_parte.destino,
    'Parte '||v_parte.parte||' aceita pela D-API; aguardando confirmacao messages.sent'
  );

  -- Se o webhook chegou enquanto esta transacao aguardava a D-API, ele ja esta
  -- armazenado em wa_eventos. Reconcilia agora; no caminho inverso, o proprio
  -- webhook encontra esta parte depois do commit. Assim nenhuma ordem de chegada
  -- permite liberar a parte seguinte sem confirmacao real.
  select
    coalesce(
      nullif(e.payload#>>'{data,id}',''),
      nullif(e.payload#>>'{data,message_id}',''),
      nullif(e.payload#>>'{data,messageId}','')
    ) as message_id,
    coalesce(
      nullif(e.payload#>>'{data,to,jid}',''),
      nullif(e.payload#>>'{data,to}',''),
      nullif(e.payload#>>'{data,remote_jid}','')
    ) as destino_jid,
    nullif(e.payload#>>'{data,type}','') as tipo,
    coalesce(
      nullif(e.payload#>>'{data,message}',''),
      nullif(e.payload#>>'{data,body}',''),
      nullif(e.payload#>>'{data,text}','')
    ) as conteudo,
    coalesce(
      nullif(e.payload#>>'{data,media_data,pending_media_url}',''),
      nullif(e.payload#>>'{data,pending_media_url}',''),
      nullif(e.payload#>>'{data,media_url}','')
    ) as media_url,
    e.recebido_em
  into v_evento
  from public.wa_eventos e
  where lower(e.evento)='messages.sent'
    and e.session_id=v_parte.session_id
    and e.recebido_em between now()-interval '10 minutes' and now()+interval '1 minute'
    and regexp_replace(coalesce(
      e.payload#>>'{data,to,jid}',e.payload#>>'{data,to}',e.payload#>>'{data,remote_jid}',''
    ),'\D','','g')=regexp_replace(coalesce(v_parte.destino,''),'\D','','g')
    and coalesce(
      nullif(e.payload#>>'{data,id}',''),
      nullif(e.payload#>>'{data,message_id}',''),
      nullif(e.payload#>>'{data,messageId}','')
    ) is not null
    and (
      v_provider_id is null or v_provider_id=coalesce(
        nullif(e.payload#>>'{data,id}',''),
        nullif(e.payload#>>'{data,message_id}',''),
        nullif(e.payload#>>'{data,messageId}','')
      )
    )
    and (
      nullif(e.payload#>>'{data,type}','') is null
      or e.payload#>>'{data,type}'=v_parte.tipo
    )
    and (
      v_parte.tipo<>'text'
      or coalesce(
        nullif(e.payload#>>'{data,message}',''),
        nullif(e.payload#>>'{data,body}',''),
        nullif(e.payload#>>'{data,text}','')
      ) is null
      or coalesce(
        nullif(e.payload#>>'{data,message}',''),
        nullif(e.payload#>>'{data,body}',''),
        nullif(e.payload#>>'{data,text}','')
      )=v_parte.conteudo
    )
  order by e.recebido_em,e.id
  limit 1;

  if found then
    update public.motor_mensagem_partes
       set provider_message_id=coalesce(provider_message_id,v_evento.message_id),
           status='enviada',confirmada_em=v_evento.recebido_em,erro=null
     where id=v_parte.id and status='aceita'
     returning * into v_parte;
    select p.id into v_proxima_id
      from public.motor_mensagem_partes p
     where p.execution_id=v_parte.execution_id
       and p.automacao_id=v_parte.automacao_id
       and p.bloco_id=v_parte.bloco_id
       and p.parte=v_parte.parte+1
       and p.status='pendente';
    if v_proxima_id is not null then
      execute 'select private.motor_despachar_parte($1)'
        into v_confirmacao using v_proxima_id;
    end if;
  end if;
  return jsonb_build_object(
    'ok',true,'status',v_parte.status,'parte_id',v_parte.id,
    'provider_message_id',v_provider_id,'reconciliacao',v_confirmacao
  );
end
$function$;

revoke all on function private.motor_despachar_parte(bigint)
  from public,anon,authenticated,service_role;

create or replace function public.motor_confirmar_mensagem_evento(
  p_session_id text,
  p_message_id text,
  p_status text,
  p_destino_jid text default null,
  p_tipo text default null,
  p_conteudo text default null,
  p_media_url text default null,
  p_evento_em timestamptz default now(),
  p_trace_id text default null
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $function$
declare
  v_parte public.motor_mensagem_partes%rowtype;
  v_destino text;
  v_proxima_id bigint;
  v_despacho jsonb;
begin
  if nullif(p_message_id,'') is null
     or p_status not in ('enviada','entregue','lida','erro') then
    return jsonb_build_object('ok',false,'erro','EVENTO_INVALIDO');
  end if;
  v_destino:=regexp_replace(coalesce(p_destino_jid,''),'\D','','g');

  select * into v_parte
    from public.motor_mensagem_partes
   where provider_message_id=p_message_id
   order by id
   limit 1
   for update;

  if not found and p_status in ('enviada','entregue','lida') and v_destino<>'' then
    select * into v_parte
      from public.motor_mensagem_partes p
     where p.session_id=p_session_id
       and p.status='aceita'
       and regexp_replace(coalesce(p.destino,''),'\D','','g')=v_destino
       and (p_tipo is null or p.tipo=p_tipo)
       and p.aceita_em between p_evento_em-interval '10 minutes'
                           and p_evento_em+interval '1 minute'
       and (
         p.tipo<>'text' or p_conteudo is null
         or md5(coalesce(p.conteudo,''))=md5(p_conteudo)
       )
       and (
         p.tipo='text' or p_media_url is null
         or p.media_url=p_media_url
       )
     order by p.aceita_em,p.id
     limit 1
     for update skip locked;
  end if;

  if not found then
    return jsonb_build_object('ok',false,'erro','PARTE_NAO_CORRELACIONADA','retry',p_status='enviada');
  end if;

  if p_status='enviada' and v_parte.status in ('aceita','enviada','entregue','lida') then
    update public.motor_mensagem_partes
       set provider_message_id=coalesce(provider_message_id,p_message_id),
           status=case when status='aceita' then 'enviada' else status end,
           confirmada_em=coalesce(confirmada_em,p_evento_em),
           erro=null
     where id=v_parte.id
     returning * into v_parte;

    select p.id into v_proxima_id
      from public.motor_mensagem_partes p
     where p.execution_id=v_parte.execution_id
       and p.automacao_id=v_parte.automacao_id
       and p.bloco_id=v_parte.bloco_id
       and p.parte=v_parte.parte+1
       and p.status='pendente';
    if v_proxima_id is not null then
      v_despacho:=private.motor_despachar_parte(v_proxima_id);
    end if;
  elsif p_status='entregue' and v_parte.status in ('aceita','enviada','entregue','lida') then
    update public.motor_mensagem_partes
       set provider_message_id=coalesce(provider_message_id,p_message_id),
           status=case when status='lida' then 'lida' else 'entregue' end,
           confirmada_em=coalesce(confirmada_em,p_evento_em),
           entregue_em=coalesce(entregue_em,p_evento_em)
     where id=v_parte.id
     returning * into v_parte;
    select p.id into v_proxima_id
      from public.motor_mensagem_partes p
     where p.execution_id=v_parte.execution_id
       and p.automacao_id=v_parte.automacao_id
       and p.bloco_id=v_parte.bloco_id
       and p.parte=v_parte.parte+1
       and p.status='pendente';
    if v_proxima_id is not null then
      v_despacho:=private.motor_despachar_parte(v_proxima_id);
    end if;
  elsif p_status='lida' and v_parte.status in ('aceita','enviada','entregue','lida') then
    update public.motor_mensagem_partes
       set provider_message_id=coalesce(provider_message_id,p_message_id),
           status='lida',
           confirmada_em=coalesce(confirmada_em,p_evento_em),
           entregue_em=coalesce(entregue_em,p_evento_em),
           lida_em=coalesce(lida_em,p_evento_em)
     where id=v_parte.id
     returning * into v_parte;
    select p.id into v_proxima_id
      from public.motor_mensagem_partes p
     where p.execution_id=v_parte.execution_id
       and p.automacao_id=v_parte.automacao_id
       and p.bloco_id=v_parte.bloco_id
       and p.parte=v_parte.parte+1
       and p.status='pendente';
    if v_proxima_id is not null then
      v_despacho:=private.motor_despachar_parte(v_proxima_id);
    end if;
  elsif p_status='erro' then
    update public.motor_mensagem_partes
       set status='erro',erro='Falha confirmada pela D-API'
     where id=v_parte.id
     returning * into v_parte;
  end if;

  return jsonb_build_object(
    'ok',true,'parte_id',v_parte.id,'status',v_parte.status,
    'proxima_parte_id',v_proxima_id,'despacho',v_despacho,'trace_id',p_trace_id
  );
end
$function$;

revoke all on function public.motor_confirmar_mensagem_evento(
  text,text,text,text,text,text,text,timestamptz,text
) from public,anon,authenticated;
grant execute on function public.motor_confirmar_mensagem_evento(
  text,text,text,text,text,text,text,timestamptz,text
) to service_role;

create or replace function public.motor_envia_abordagem(
  p_auto bigint,p_nome text,p_bloco text,p_lead jsonb,p_lead_id bigint,
  p_corretor_id bigint,p_produto_id bigint,p_abordagem_ids jsonb
) returns void
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $function$
declare
  v_exec text; v_tel text; v_destino text; v_cor_nome text; v_prod_nome text;
  v_ab_id bigint; v_ab_nome text; v_ab_grupo text; v_msgs jsonb;
  v_inst_id bigint; v_inst text; v_parte integer:=0; v_delay numeric:=0;
  v_msg jsonb; v_tipo text; v_texto text; v_url text; v_caption text;
  v_body jsonb; v_primeira_id bigint; v_total integer:=0; v_resultado jsonb;
begin
  v_exec:=nullif(p_lead->>'__motor_execution_id','');
  v_tel:=regexp_replace(coalesce(p_lead->>'telefone',''),'\D','','g');
  if v_exec is null then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: execucao sem identidade idempotente');
    return;
  end if;
  if public.ncrm_bloqueia_abordagem_automatica(p_lead_id) then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Abordagem bloqueada pela trava de primeira abordagem/cliente existente');
    return;
  end if;
  if jsonb_typeof(coalesce(p_abordagem_ids,'null'::jsonb))<>'array' then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: lista de abordagens invalida');
    return;
  end if;
  if jsonb_array_length(p_abordagem_ids)=0
     or exists(
       select 1 from jsonb_array_elements_text(p_abordagem_ids) x(value)
        where value!~'^[1-9][0-9]*$'
     )
     or exists(
       select 1 from jsonb_array_elements_text(p_abordagem_ids) x(value)
       group by value having count(*)>1
     ) then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: lista de abordagens invalida');
    return;
  end if;

  v_ab_id:=private.motor_escolher_abordagem(v_exec,p_auto,p_bloco,p_abordagem_ids);
  select nome,grupo,mensagens into v_ab_nome,v_ab_grupo,v_msgs
    from public.abordagens
   where id=v_ab_id and coalesce(ativo,true);
  if not found then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: abordagem escolhida nao esta ativa');
    return;
  end if;

  select c.nome into v_cor_nome from public.corretores c
   where c.id=p_corretor_id and coalesce(c.ativo,true);
  if v_cor_nome is null then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: dono atual inexistente ou inativo');
    return;
  end if;
  select i.id,i.instancia_dapi into v_inst_id,v_inst
    from public.instancias i
    join public.instancias_credenciais ic on ic.instancia_id=i.id
   where i.corretor_id=p_corretor_id
     and coalesce(i.ativa,true)
     and coalesce(i.conectada,false)
     and i.status_dapi='connected'
     and nullif(i.instancia_dapi,'') is not null
     and nullif(ic.apikey,'') is not null
   order by i.id limit 1;
  if v_inst is null then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio nao realizado: a instancia do dono '||v_cor_nome||
      ' esta indisponivel; nenhum failover foi feito');
    return;
  end if;

  if p_produto_id is not null then
    select nome into v_prod_nome from public.produtos where id=p_produto_id;
  end if;
  v_prod_nome:=coalesce(
    v_prod_nome,nullif(p_lead->>'empreendimento_nome',''),nullif(p_lead->>'produto','')
  );
  v_destino:=public.motor_fone_br(v_tel);

  update public.leads
     set extras=coalesce(extras,'{}'::jsonb)||jsonb_build_object(
       'abordagem_id',v_ab_id,'abordagem_nome',v_ab_nome,
       'abordagem_grupo',coalesce(v_ab_grupo,''),
       'abordagem_escolhida_em',now()
     )
   where id=p_lead_id;

  for v_msg in select value from jsonb_array_elements(coalesce(v_msgs,'[]'::jsonb))
  loop
    if v_msg->>'name'='delay' then
      v_delay:=least(
        10,
        v_delay+greatest(coalesce(nullif(v_msg#>>'{options,valor}','')::numeric,0),0)
      );
      continue;
    end if;
    if v_msg->>'name' not in ('send-text-message','send-image-message','send-video-message') then
      continue;
    end if;

    v_parte:=v_parte+1;
    v_total:=v_total+1;
    v_tipo:=case v_msg->>'name'
      when 'send-text-message' then 'text'
      when 'send-image-message' then 'image'
      else 'video'
    end;
    v_texto:=public.motor_subst(coalesce(v_msg#>>'{options,text}',''),p_lead);
    v_texto:=replace(v_texto,'{corretor}',v_cor_nome);
    v_texto:=replace(v_texto,'{corretor_primeiro_nome}',split_part(v_cor_nome,' ',1));
    v_texto:=replace(v_texto,'{produto}',coalesce(v_prod_nome,''));
    v_texto:=replace(v_texto,'{imovel_link}',coalesce(p_lead->>'imovel_link',''));
    v_url:=coalesce(v_msg#>>'{options,url}','');
    v_caption:=public.motor_subst(coalesce(v_msg#>>'{options,caption}',''),p_lead);
    v_caption:=replace(v_caption,'{corretor}',v_cor_nome);
    v_caption:=replace(v_caption,'{corretor_primeiro_nome}',split_part(v_cor_nome,' ',1));
    v_caption:=replace(v_caption,'{produto}',coalesce(v_prod_nome,''));
    v_caption:=replace(v_caption,'{imovel_link}',coalesce(p_lead->>'imovel_link',''));
    if (v_tipo='text' and v_texto='')
       or (v_tipo<>'text' and v_url='') then
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
        'Parte '||v_parte||' invalida: conteudo obrigatorio ausente');
      return;
    end if;
    v_body:=case when v_tipo='text'
      then jsonb_build_object('sessionId',v_inst,'to',v_destino,'text',v_texto)
      else jsonb_strip_nulls(jsonb_build_object(
        'sessionId',v_inst,'to',v_destino,v_tipo,v_url,
        'caption',nullif(v_caption,'')
      ))
    end;

    insert into public.motor_mensagem_partes(
      execution_id,automacao_id,automacao_nome,bloco_id,parte,abordagem_id,
      lead_id,lead_nome,instancia_id,session_id,destino,tipo,conteudo,media_url,
      corpo,status,atraso_antes_segundos
    ) values (
      v_exec,p_auto,p_nome,p_bloco,v_parte,v_ab_id,
      p_lead_id,p_lead->>'nome',v_inst_id,v_inst,v_destino,v_tipo,
      case when v_tipo='text' then v_texto else v_caption end,
      nullif(v_url,''),v_body,'pendente',v_delay
    )
    on conflict (execution_id,automacao_id,bloco_id,parte) do nothing
    returning id into v_primeira_id;
    if v_parte>1 then v_primeira_id:=null; end if;
    v_delay:=0;
  end loop;

  if v_total=0 then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Abordagem sem partes enviaveis');
    return;
  end if;

  if v_primeira_id is null then
    select id into v_primeira_id
      from public.motor_mensagem_partes
     where execution_id=v_exec and automacao_id=p_auto and bloco_id=p_bloco
       and parte=1 and status='pendente';
  end if;
  if v_primeira_id is not null then
    v_resultado:=private.motor_despachar_parte(v_primeira_id);
  else
    v_resultado:=jsonb_build_object('ok',true,'idempotente',true);
  end if;
end
$function$;

revoke all on function public.motor_envia_abordagem(
  bigint,text,text,jsonb,bigint,bigint,bigint,jsonb
) from public,anon,authenticated;
grant execute on function public.motor_envia_abordagem(
  bigint,text,text,jsonb,bigint,bigint,bigint,jsonb
) to service_role;
