-- Central deterministica: transporte nao desfaz distribuicao, confirma mensagens
-- pelo historico real da D-API e torna os avisos modulos explicitos dos fluxos.

-- 1) A falha do transporte pausa somente o modulo de mensagem. Tudo que os
-- modulos anteriores ja produziram (lead, campos, distribuicao e negocio) fica
-- confirmado no banco e pode ser retomado pelo trabalhador de transporte.
do $patch$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef(
    'public.motor_rodar_unchecked(bigint,jsonb,text,integer)'::regprocedure
  ) into v_def;

  if md5(v_def) <> '4d46af3bfe69cbca76a852a7df8e168c' then
    raise exception 'motor_rodar_unchecked mudou: %', md5(v_def);
  end if;

  v_novo := replace(
    v_def,
    $old$        if cur is null then
          raise exception using errcode='P0001',
            message='AUTOMATION_RETRY: MESSAGE_SEND_FAILED';
        end if;
        continue;$old$,
    $new$        if cur is null then
          return trace||'-- mensagem pendente de transporte; modulos anteriores confirmados --';
        end if;
        continue;$new$
  );

  if v_novo = v_def then
    raise exception 'ancora MESSAGE_SEND_FAILED nao encontrada';
  end if;
  execute v_novo;
end
$patch$;

alter table public.motor_mensagem_partes
  add column if not exists retentativas_transporte integer not null default 0,
  add column if not exists proxima_tentativa_em timestamptz;

-- 2) A confirmacao nao e inferida pelo HTTP de envio. O trabalhador consulta o
-- chat da instancia exata e so confirma se encontra o provider_message_id real.
create or replace function private.motor_reconciliar_mensagens_aceitas(
  p_limite integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog','public','private','extensions'
as $function$
declare
  r record;
  v_resp record;
  v_body jsonb;
  v_chat_id text;
  v_msg jsonb;
  v_status_dapi text;
  v_status_motor text;
  v_resultado jsonb;
  v_confirmadas integer := 0;
  v_nao_encontradas integer := 0;
  v_falhas integer := 0;
begin
  p_limite := greatest(1, least(coalesce(p_limite,10), 30));
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','12000');

  for r in
    select p.id,p.session_id,p.destino,p.provider_message_id,p.tipo,p.aceita_em,
           ic.apikey
      from public.motor_mensagem_partes p
      join public.instancias i
        on i.id=p.instancia_id and i.instancia_dapi=p.session_id
      join public.instancias_credenciais ic on ic.instancia_id=i.id
     where p.status='aceita'
       and nullif(p.provider_message_id,'') is not null
       and p.aceita_em <= now()-interval '5 seconds'
       and nullif(ic.apikey,'') is not null
     order by p.aceita_em,p.id
     limit p_limite
     for update of p skip locked
  loop
    begin
      select status,content into v_resp
        from extensions.http((
          'GET',
          'https://api.d-api.cloud/api/v1/chats/?sessionId='||
            extensions.urlencode(r.session_id::varchar)||'&search='||
            extensions.urlencode(regexp_replace(r.destino,'\\D','','g')::varchar)||
            '&limit=1',
          array[extensions.http_header('Authorization',r.apikey)],
          null,
          null
        )::extensions.http_request);

      if v_resp.status not between 200 and 299 then
        v_falhas := v_falhas+1;
        continue;
      end if;
      v_body := v_resp.content::jsonb;
      v_chat_id := coalesce(
        nullif(v_body#>>'{data,0,id}',''),
        nullif(v_body#>>'{data,0,chatId}','')
      );
      if v_chat_id is null then
        v_nao_encontradas := v_nao_encontradas+1;
        continue;
      end if;

      select status,content into v_resp
        from extensions.http((
          'GET',
          'https://api.d-api.cloud/api/v1/chats/'||
            extensions.urlencode(v_chat_id::varchar)||'/messages?sessionId='||
            extensions.urlencode(r.session_id::varchar)||
            '&page=1&limit=100&sort_order=desc',
          array[extensions.http_header('Authorization',r.apikey)],
          null,
          null
        )::extensions.http_request);

      if v_resp.status not between 200 and 299 then
        v_falhas := v_falhas+1;
        continue;
      end if;
      v_body := v_resp.content::jsonb;
      v_msg := null;
      select e.value into v_msg
        from jsonb_array_elements(coalesce(v_body->'data','[]'::jsonb)) e(value)
       where coalesce(
               nullif(e.value->>'message_id',''),
               nullif(e.value->>'messageId',''),
               nullif(e.value->>'id','')
             )=r.provider_message_id
       limit 1;

      if v_msg is null then
        v_nao_encontradas := v_nao_encontradas+1;
        continue;
      end if;

      v_status_dapi := lower(coalesce(v_msg->>'status',''));
      v_status_motor := case
        when v_status_dapi like '%read%' or v_status_dapi like '%lida%' then 'lida'
        when v_status_dapi like '%deliver%' or v_status_dapi like '%entreg%' then 'entregue'
        else 'enviada'
      end;

      v_resultado := public.motor_confirmar_mensagem_evento(
        r.session_id,r.provider_message_id,v_status_motor,
        r.destino,r.tipo,null,null,
        coalesce(r.aceita_em,now()),'reconciliacao-historico-dapi'
      );
      if coalesce((v_resultado->>'ok')::boolean,false) then
        v_confirmadas := v_confirmadas+1;
      else
        v_falhas := v_falhas+1;
      end if;
    exception when others then
      v_falhas := v_falhas+1;
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      )
      select p.automacao_id,p.automacao_nome,p.bloco_id,'mensagem','alerta',
             p.lead_nome,p.destino,
             'Reconciliacao D-API adiou a verificacao: '||left(sqlerrm,120)
        from public.motor_mensagem_partes p where p.id=r.id;
    end;
  end loop;

  return jsonb_build_object(
    'confirmadas',v_confirmadas,
    'nao_encontradas',v_nao_encontradas,
    'falhas',v_falhas
  );
end
$function$;

revoke all on function private.motor_reconciliar_mensagens_aceitas(integer)
  from public,anon,authenticated;
grant execute on function private.motor_reconciliar_mensagens_aceitas(integer)
  to service_role;

-- 3) Recusas deterministicas (instancia temporariamente fora ou HTTP
-- transitorio) sao repetidas com backoff. Resultado incerto nunca e reenviado.
create or replace function private.motor_reprocessar_mensagens_recusadas(
  p_limite integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog','public','private'
as $function$
declare
  r record;
  v_resultado jsonb;
  v_processadas integer := 0;
  v_recuperadas integer := 0;
begin
  p_limite := greatest(1,least(coalesce(p_limite,5),20));
  for r in
    select p.id
      from public.motor_mensagem_partes p
     where p.status='erro'
       and p.retentativas_transporte<5
       and coalesce(p.proxima_tentativa_em,now())<=now()
       and (
         p.erro='Instancia exata indisponivel'
         or p.erro ~ '^HTTP (408|409|425|429|5[0-9][0-9])$'
       )
     order by p.id
     limit p_limite
     for update skip locked
  loop
    update public.motor_mensagem_partes
       set status='pendente',
           retentativas_transporte=retentativas_transporte+1,
           proxima_tentativa_em=now()+
             make_interval(secs => (30*power(2,least(retentativas_transporte,5)))::integer)
     where id=r.id;
    v_resultado := private.motor_despachar_parte(r.id);
    v_processadas := v_processadas+1;
    if coalesce((v_resultado->>'ok')::boolean,false) then
      v_recuperadas := v_recuperadas+1;
      update public.motor_mensagem_partes
         set proxima_tentativa_em=null
       where id=r.id;
    end if;
  end loop;
  return jsonb_build_object('processadas',v_processadas,'recuperadas',v_recuperadas);
end
$function$;

revoke all on function private.motor_reprocessar_mensagens_recusadas(integer)
  from public,anon,authenticated;
grant execute on function private.motor_reprocessar_mensagens_recusadas(integer)
  to service_role;

-- Os dois trabalhadores pertencem ao relogio da Central. Eles cuidam somente
-- do transporte e nao criam nenhuma regra comercial oculta.
do $patch$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef('public.motor_relogio_central()'::regprocedure)
    into v_def;
  if md5(v_def) <> 'fdac5e9ea76278ae30788441b124cc7c' then
    raise exception 'motor_relogio_central mudou: %',md5(v_def);
  end if;
  v_novo := replace(
    v_def,
    $old$  begin
    v_resultado:=v_resultado||jsonb_build_object('fila',public.motor_processar_fila());
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('fila_erro',sqlstate||': '||sqlerrm);
  end;$old$,
    $new$  begin
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
  end;$new$
  );
  if v_novo=v_def then raise exception 'ancora do relogio nao encontrada'; end if;
  execute v_novo;
end
$patch$;

-- 4) O modulo de notificacao grava o endereco canonico do negocio e descreve
-- corretamente o publico. A fila de push existente faz a entrega em ate 30 s.
do $patch$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef(
    'public.motor_acoes(bigint,text,text,jsonb,jsonb,bigint,bigint,integer)'::regprocedure
  ) into v_def;
  if md5(v_def) <> '86f1e03f187a791d7c4a53e7b2304938' then
    raise exception 'motor_acoes mudou: %',md5(v_def);
  end if;
  v_novo := replace(
    v_def,
    $old$        insert into ncrm_notificacao(chave, tipo, publico, prioridade, titulo, detalhe, negocio_id, corretor_id)
        values (v_chave,
                v_tipo,
                coalesce(nullif(ao->>'publico',''), 'corretor'),
                coalesce(nullif(ao->>'prioridade','')::smallint, 3::smallint),
                v_titulo, nullif(v_detalhe,''), v_negocio_id, v_cor)$old$,
    $new$        insert into ncrm_notificacao(chave, tipo, publico, prioridade, titulo, detalhe, negocio_id, corretor_id, deep_link)
        values (v_chave,
                v_tipo,
                coalesce(nullif(ao->>'publico',''), 'corretor'),
                coalesce(nullif(ao->>'prioridade','')::smallint, 3::smallint),
                v_titulo, nullif(v_detalhe,''), v_negocio_id, v_cor,
                case when v_negocio_id is null then '/crm' else '/negocio/'||v_negocio_id end)$new$
  );
  v_novo := replace(
    v_novo,
    $old$'Aviso enviado ao corretor: '||left(v_titulo,80)$old$,
    $new$'Aviso enviado para '||coalesce(nullif(ao->>'publico',''),'corretor')||': '||left(v_titulo,80)$new$
  );
  if v_novo=v_def then raise exception 'ancora de notificacao nao encontrada'; end if;
  execute v_novo;
end
$patch$;

-- 5) Miruna e Adelmo ganham dois blocos visiveis e independentes: aviso ao
-- corretor e aviso a gestao. Se o bloco nao estiver no desenho, nao acontece.
do $publish$
declare
  r record;
  v_mapa jsonb;
  v_blocks jsonb;
  v_wires jsonb;
  v_idx integer;
  v_versao integer;
  v_versao_id bigint;
  v_esperada bigint;
begin
  for r in
    select * from public.automacoes where id in (65,66) order by id for update
  loop
    v_esperada := case r.id when 65 then 95 else 94 end;
    if r.versao_publicada_id is distinct from v_esperada then
      raise exception 'automacao % mudou: versao publicada atual %',r.id,r.versao_publicada_id;
    end if;
    v_mapa := r.mapa;
    if exists(
      select 1 from jsonb_array_elements(v_mapa#>'{automation,blocks}') e
       where e->>'id' in ('b18','b19')
    ) then
      raise exception 'automacao % ja possui b18/b19',r.id;
    end if;

    select ord::integer-1 into v_idx
      from jsonb_array_elements(v_mapa#>'{automation,blocks}') with ordinality e(value,ord)
     where value->>'id'='b14';
    if v_idx is null then raise exception 'automacao % sem b14',r.id; end if;
    v_mapa := jsonb_set(
      v_mapa,array['automation','blocks',v_idx::text,'options','nextBlockId'],
      to_jsonb('b18'::text)
    );

    v_blocks := v_mapa#>'{automation,blocks}';
    v_blocks := v_blocks || jsonb_build_array(
      jsonb_build_object(
        'id','b18','type','action',
        'options',jsonb_build_object(
          'actions',jsonb_build_array(jsonb_build_object(
            'name','send-notification-action','group','',
            'options',jsonb_build_object(
              'tipo','primeira_abordagem_pendente','publico','corretor',
              'prioridade',1,'titulo','Novo lead distribuido',
              'detalhe','Abra o CRM para acompanhar o novo atendimento.'
            )
          )),
          'nextBlockId','b19','errorNextBlockId',''
        ),
        'presentation',jsonb_build_object('x',1510,'y',30),
        'sourceBlockId',gen_random_uuid()::text
      ),
      jsonb_build_object(
        'id','b19','type','action',
        'options',jsonb_build_object(
          'actions',jsonb_build_array(jsonb_build_object(
            'name','send-notification-action','group','',
            'options',jsonb_build_object(
              'tipo','primeira_abordagem_pendente','publico','gestao',
              'prioridade',1,'titulo','Novo lead na distribuicao',
              'detalhe','A Central distribuiu um novo lead. Abra o CRM para acompanhar.'
            )
          )),
          'nextBlockId','b17','errorNextBlockId',''
        ),
        'presentation',jsonb_build_object('x',1510,'y',170),
        'sourceBlockId',gen_random_uuid()::text
      )
    );
    v_mapa := jsonb_set(v_mapa,'{automation,blocks}',v_blocks);

    v_mapa := jsonb_set(v_mapa,'{editor,blocks,b18}',jsonb_build_object(
      'x',1510,'y',30,'id','b18','fam','acao','sub','',
      'note','Aviso explicito ao corretor','extra','{}'::jsonb,
      'parts','[]'::jsonb,'ramos','[]'::jsonb,'noteOpen',false
    ),true);
    v_mapa := jsonb_set(v_mapa,'{editor,blocks,b19}',jsonb_build_object(
      'x',1510,'y',170,'id','b19','fam','acao','sub','',
      'note','Aviso explicito a gestao','extra','{}'::jsonb,
      'parts','[]'::jsonb,'ramos','[]'::jsonb,'noteOpen',false
    ),true);
    v_wires := coalesce((select jsonb_agg(w)
      from jsonb_array_elements(v_mapa#>'{editor,wires}') w
      where not (w->>'from'='b14' and w->>'to'='b17')),'[]'::jsonb);
    v_wires := v_wires || jsonb_build_array(
      jsonb_build_object('from','b14','to','b18','port','out'),
      jsonb_build_object('from','b18','to','b19','port','out'),
      jsonb_build_object('from','b19','to','b17','port','out')
    );
    v_mapa := jsonb_set(v_mapa,'{editor,wires}',v_wires);
    v_mapa := jsonb_set(
      v_mapa,'{editor,uid}',
      to_jsonb(coalesce((v_mapa#>>'{editor,uid}')::integer,0)+2)
    );

    select coalesce(max(versao),0)+1 into v_versao
      from public.automacao_versoes where automacao_id=r.id;
    insert into public.automacao_versoes(
      automacao_id,versao,nome,mapa,observacao,criado_por
    ) values(
      r.id,v_versao,r.nome,v_mapa,
      'Avisos explicitos ao corretor e a gestao; transporte confirmado pela D-API',
      'codex'
    ) returning id into v_versao_id;

    update public.automacoes
       set mapa=v_mapa,mapa_rascunho=v_mapa,
           versao_publicada_id=v_versao_id,
           atualizada_em=now(),publicado_em=now(),status='publicado',ativa=true
     where id=r.id;
  end loop;
end
$publish$;

comment on function private.motor_reconciliar_mensagens_aceitas(integer) is
  'Transporte da Central: confirma partes somente quando o provider_message_id existe no historico da instancia D-API exata.';
comment on function private.motor_reprocessar_mensagens_recusadas(integer) is
  'Transporte da Central: repete apenas recusas deterministicas e transitorias; nunca repete resultado incerto.';
