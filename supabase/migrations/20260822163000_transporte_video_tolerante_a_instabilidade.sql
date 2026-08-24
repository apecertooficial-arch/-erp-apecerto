-- O transporte pode falhar sem desfazer a distribuicao. Respostas HTTP
-- transitorias sao retentadas; resultados incertos sao conferidos no historico
-- da instancia antes de qualquer novo envio, evitando perda e duplicacao.

begin;

alter table public.motor_mensagem_partes
  add column if not exists tentada_em timestamptz,
  add column if not exists verificacoes_confirmacao integer not null default 0,
  add column if not exists ultima_verificacao_em timestamptz;

do $patch_despacho$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'private.motor_despachar_parte(bigint)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'bc04f60014855ac10c00d4b0ca941fa9' then
    raise exception 'motor_despachar_parte mudou: %',md5(v_def);
  end if;

  v_new:=replace(
    v_def,
    $old$set status='processando',tentativas=tentativas+1,erro=null$old$,
    $new$set status='processando',tentativas=tentativas+1,erro=null,
           tentada_em=now(),verificacoes_confirmacao=0,
           ultima_verificacao_em=null$new$
  );
  v_new:=replace(
    v_new,
    $old$set status='erro_incerto',erro=left(sqlerrm,500)$old$,
    $new$set status='erro_incerto',erro=left(sqlerrm,500),
           proxima_tentativa_em=coalesce(proxima_tentativa_em,now()+interval '20 seconds')$new$
  );
  if v_new=v_def then raise exception 'ancoras do despacho nao encontradas'; end if;
  execute v_new;
end
$patch_despacho$;

do $patch_confirmacao$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.motor_confirmar_mensagem_evento(text,text,text,text,text,text,text,timestamptz,text)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'35959e3dcd841aea2305f2d8afaa9a37' then
    raise exception 'motor_confirmar_mensagem_evento mudou: %',md5(v_def);
  end if;

  v_new:=replace(v_def,
    $old$and p.status='aceita'$old$,
    $new$and p.status in ('aceita','erro_incerto')$new$
  );
  v_new:=replace(v_new,
    $old$and p.aceita_em between p_evento_em-interval '10 minutes'
                           and p_evento_em+interval '1 minute'$old$,
    $new$and coalesce(p.aceita_em,p.tentada_em) between p_evento_em-interval '10 minutes'
                                                      and p_evento_em+interval '1 minute'$new$
  );
  v_new:=replace(v_new,
    $old$v_parte.status in ('aceita','enviada','entregue','lida')$old$,
    $new$v_parte.status in ('aceita','erro_incerto','enviada','entregue','lida')$new$
  );
  v_new:=replace(v_new,
    $old$case when status='aceita' then 'enviada' else status end$old$,
    $new$case when status in ('aceita','erro_incerto') then 'enviada' else status end$new$
  );
  if v_new=v_def then raise exception 'ancoras da confirmacao nao encontradas'; end if;
  execute v_new;
end
$patch_confirmacao$;

create or replace function private.motor_resolver_resultados_incertos(
  p_limite integer default 3
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private','extensions'
as $function$
declare
  r record;
  v_resp record;
  v_body jsonb;
  v_chat_id text;
  v_msg jsonb;
  v_message_id text;
  v_status text;
  v_resultado jsonb;
  v_verificadas integer:=0;
  v_confirmadas integer:=0;
  v_retentaveis integer:=0;
  v_falhas_api integer:=0;
  v_negativas integer:=0;
begin
  p_limite:=greatest(1,least(coalesce(p_limite,3),10));
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','12000');

  for r in
    select p.*,ic.apikey
      from public.motor_mensagem_partes p
      join public.instancias i
        on i.id=p.instancia_id and i.instancia_dapi=p.session_id
      join public.instancias_credenciais ic on ic.instancia_id=i.id
     where (
             p.status='erro_incerto'
             or (p.status='aceita' and nullif(p.provider_message_id,'') is null)
           )
       and coalesce(p.tentada_em,p.aceita_em)<=now()-interval '10 seconds'
       and coalesce(p.proxima_tentativa_em,now())<=now()
       and coalesce(p.ultima_verificacao_em,'-infinity'::timestamptz)
             <=now()-interval '20 seconds'
       and nullif(ic.apikey,'') is not null
     order by coalesce(p.tentada_em,p.aceita_em),p.id
     limit p_limite
     for update of p skip locked
  loop
    v_verificadas:=v_verificadas+1;
    update public.motor_mensagem_partes
       set ultima_verificacao_em=now()
     where id=r.id;

    begin
      select status,content into v_resp
        from extensions.http((
          'GET',
          'https://api.d-api.cloud/api/v1/chats/?sessionId='||
            extensions.urlencode(r.session_id::varchar)||'&search='||
            extensions.urlencode(regexp_replace(r.destino,'\D','','g')::varchar)||
            '&limit=1',
          array[extensions.http_header('Authorization',r.apikey)],
          null,null
        )::extensions.http_request);
      if v_resp.status not between 200 and 299 then
        v_falhas_api:=v_falhas_api+1;
        continue;
      end if;
      v_body:=v_resp.content::jsonb;
      v_chat_id:=coalesce(
        nullif(v_body#>>'{data,0,id}',''),
        nullif(v_body#>>'{data,0,chatId}','')
      );

      v_msg:=null;
      if v_chat_id is not null then
        select status,content into v_resp
          from extensions.http((
            'GET',
            'https://api.d-api.cloud/api/v1/chats/'||
              extensions.urlencode(v_chat_id::varchar)||'/messages?sessionId='||
              extensions.urlencode(r.session_id::varchar)||
              '&page=1&limit=100&sort_order=desc',
            array[extensions.http_header('Authorization',r.apikey)],
            null,null
          )::extensions.http_request);
        if v_resp.status not between 200 and 299 then
          v_falhas_api:=v_falhas_api+1;
          continue;
        end if;
        v_body:=v_resp.content::jsonb;
        select e.value into v_msg
          from jsonb_array_elements(coalesce(v_body->'data','[]'::jsonb)) e(value)
         where coalesce((e.value->>'from_me')::boolean,false)
           and e.value->>'type'=r.tipo
           and nullif(e.value->>'message_id','') is not null
           and (e.value->>'timestamp')::timestamptz
                 between coalesce(r.tentada_em,r.aceita_em)-interval '1 minute'
                     and now()+interval '1 minute'
           and (
             (nullif(r.provider_message_id,'') is not null
               and e.value->>'message_id'=r.provider_message_id)
             or
             (nullif(r.provider_message_id,'') is null and (
               (r.tipo='text' and
                 regexp_replace(coalesce(e.value->>'content',''),E'\\n',E'\n','g')=
                 regexp_replace(coalesce(r.conteudo,''),E'\\n',E'\n','g'))
               or
               (r.tipo<>'text' and (
                 nullif(e.value->>'s3_url','')=r.media_url
                 or nullif(e.value->>'s3_url','') is null
               ))
             ))
           )
         order by (e.value->>'timestamp')::timestamptz
         limit 1;
      end if;

      if v_msg is not null then
        v_message_id:=v_msg->>'message_id';
        v_status:=case
          when lower(coalesce(v_msg->>'status','')) like '%read%' then 'lida'
          when lower(coalesce(v_msg->>'status','')) like '%deliver%' then 'entregue'
          else 'enviada'
        end;
        v_resultado:=public.motor_confirmar_mensagem_evento(
          r.session_id,v_message_id,v_status,r.destino,r.tipo,
          nullif(v_msg->>'content',''),nullif(v_msg->>'s3_url',''),
          (v_msg->>'timestamp')::timestamptz,'reconciliacao-resultado-incerto'
        );
        if coalesce((v_resultado->>'ok')::boolean,false) then
          v_confirmadas:=v_confirmadas+1;
        end if;
      else
        update public.motor_mensagem_partes
           set verificacoes_confirmacao=verificacoes_confirmacao+1
         where id=r.id
         returning verificacoes_confirmacao into v_negativas;
      end if;

      if v_msg is null and v_negativas>=3
         and coalesce(r.tentada_em,r.aceita_em)<=now()-interval '90 seconds' then
        update public.motor_mensagem_partes
           set status='erro',
               erro='HTTP 408: envio ausente no historico confirmado',
               proxima_tentativa_em=now()
         where id=r.id
           and status in ('erro_incerto','aceita');
        if found then v_retentaveis:=v_retentaveis+1; end if;
      end if;
    exception when others then
      v_falhas_api:=v_falhas_api+1;
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values(
        r.automacao_id,r.automacao_nome,r.bloco_id,'mensagem','alerta',
        r.lead_nome,r.destino,
        'Resultado incerto preservado; verificacao D-API sera repetida: '||left(sqlerrm,120)
      );
    end;
  end loop;

  return jsonb_build_object(
    'verificadas',v_verificadas,'confirmadas',v_confirmadas,
    'liberadas_para_retry',v_retentaveis,'falhas_api',v_falhas_api
  );
end
$function$;

revoke all on function private.motor_resolver_resultados_incertos(integer)
  from public,anon,authenticated;
grant execute on function private.motor_resolver_resultados_incertos(integer)
  to service_role;

create or replace function private.motor_reprocessar_mensagens_recusadas(
  p_limite integer default 5
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $function$
declare
  r record;
  v_resultado jsonb;
  v_incertos jsonb;
  v_processadas integer:=0;
  v_recuperadas integer:=0;
begin
  p_limite:=greatest(1,least(coalesce(p_limite,5),20));
  v_incertos:=private.motor_resolver_resultados_incertos(3);

  for r in
    select p.id
      from public.motor_mensagem_partes p
     where p.status='erro'
       and p.retentativas_transporte<5
       and coalesce(p.proxima_tentativa_em,now())<=now()
       and (
         p.erro='Instancia exata indisponivel'
         or p.erro~'^HTTP (408|409|425|429|5[0-9][0-9])(:|$)'
       )
     order by p.id
     limit p_limite
     for update skip locked
  loop
    update public.motor_mensagem_partes
       set status='pendente',
           retentativas_transporte=retentativas_transporte+1,
           proxima_tentativa_em=now()+
             make_interval(secs=>(30*power(2,least(retentativas_transporte,5)))::integer)
     where id=r.id;
    v_resultado:=private.motor_despachar_parte(r.id);
    v_processadas:=v_processadas+1;
    if coalesce((v_resultado->>'ok')::boolean,false) then
      v_recuperadas:=v_recuperadas+1;
      update public.motor_mensagem_partes
         set proxima_tentativa_em=null
       where id=r.id;
    elsif exists(
      select 1 from public.motor_mensagem_partes p
       where p.id=r.id and p.status='erro' and p.retentativas_transporte>=5
    ) then
      update public.motor_mensagem_partes p
         set status='erro',erro='Parte anterior esgotou as retentativas de transporte'
       where p.execution_id=(select x.execution_id from public.motor_mensagem_partes x where x.id=r.id)
         and p.automacao_id=(select x.automacao_id from public.motor_mensagem_partes x where x.id=r.id)
         and p.bloco_id=(select x.bloco_id from public.motor_mensagem_partes x where x.id=r.id)
         and p.parte>(select x.parte from public.motor_mensagem_partes x where x.id=r.id)
         and p.status='pendente';
    end if;
  end loop;
  return jsonb_build_object(
    'incertos',v_incertos,'processadas',v_processadas,'recuperadas',v_recuperadas
  );
end
$function$;

revoke all on function private.motor_reprocessar_mensagens_recusadas(integer)
  from public,anon,authenticated;
grant execute on function private.motor_reprocessar_mensagens_recusadas(integer)
  to service_role;

commit;
