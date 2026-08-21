-- O modulo Enviar abordagem faz somente envio pela instancia do dono atual.
-- Nao escolhe outro corretor, nao transfere posse e nao sorteia abordagem.

create table if not exists public.motor_mensagem_partes(
  id bigint generated always as identity primary key,
  execution_id text not null,
  automacao_id bigint not null,
  bloco_id text not null,
  parte integer not null check(parte>0),
  abordagem_id bigint not null,
  status text not null check(status in ('enviada')),
  enviada_em timestamptz not null default now(),
  unique(execution_id,automacao_id,bloco_id,parte)
);

alter table public.motor_mensagem_partes enable row level security;
revoke all on table public.motor_mensagem_partes from public,anon,authenticated;
grant select,insert,update on table public.motor_mensagem_partes to service_role;
grant usage,select on sequence public.motor_mensagem_partes_id_seq to service_role;

create or replace function public.motor_envia_abordagem(
  p_auto bigint,p_nome text,p_bloco text,p_lead jsonb,p_lead_id bigint,
  p_corretor_id bigint,p_produto_id bigint,p_abordagem_ids jsonb
) returns void
language plpgsql
security definer
set search_path='pg_catalog','public','extensions'
as $fn$
declare
  v_exec text; v_tel text; v_destino text; v_cor_nome text; v_prod_nome text;
  v_ab_id bigint; v_ab_nome text; v_msgs jsonb; v_count integer;
  v_inst text; v_inst_nome text; v_key text; v_parte integer:=0;
  v_msg jsonb; v_tipo text; v_texto text; v_url text; v_caption text;
  v_body jsonb; v_resp record; v_rotulo text; v_delay numeric;
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

  select count(*),min((value#>>'{}')::bigint) into v_count,v_ab_id
    from jsonb_array_elements(coalesce(p_abordagem_ids,'[]'::jsonb));
  if v_count<>1 then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: selecione exatamente uma abordagem no bloco');
    return;
  end if;
  select nome,mensagens into v_ab_nome,v_msgs from public.abordagens
   where id=v_ab_id and coalesce(ativo,true);
  if not found then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: abordagem publicada nao esta ativa');
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
  select i.instancia_dapi,i.nome,ic.apikey into v_inst,v_inst_nome,v_key
    from public.instancias i
    join public.instancias_credenciais ic on ic.instancia_id=i.id
   where i.corretor_id=p_corretor_id and coalesce(i.ativa,true)
     and coalesce(i.conectada,false) and i.status_dapi='connected'
     and nullif(i.instancia_dapi,'') is not null and nullif(ic.apikey,'') is not null
   order by i.id limit 1;
  if v_inst is null then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio nao realizado: a instancia do dono '||v_cor_nome||' esta indisponivel; nenhum failover foi feito');
    return;
  end if;

  if p_produto_id is not null then
    select nome into v_prod_nome from public.produtos where id=p_produto_id;
  end if;
  v_prod_nome:=coalesce(v_prod_nome,nullif(p_lead->>'empreendimento_nome',''),
    nullif(p_lead->>'produto',''));
  v_destino:=public.motor_fone_br(v_tel);

  for v_msg in select value from jsonb_array_elements(coalesce(v_msgs,'[]'::jsonb))
  loop
    if v_msg->>'name'='delay' then
      v_delay:=least(greatest(coalesce(nullif(v_msg#>>'{options,valor}','')::numeric,0),0),90);
      perform pg_sleep(v_delay);
      continue;
    end if;
    if v_msg->>'name' not in ('send-text-message','send-image-message','send-video-message') then
      continue;
    end if;
    v_parte:=v_parte+1;
    if exists(select 1 from public.motor_mensagem_partes
      where execution_id=v_exec and automacao_id=p_auto and bloco_id=p_bloco
        and parte=v_parte and status='enviada') then
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (p_auto,p_nome,p_bloco,'mensagem','ok',p_lead->>'nome',v_tel,
        'Parte '||v_parte||' ja enviada nesta execucao; idempotencia preservada');
      continue;
    end if;

    v_tipo:=case v_msg->>'name' when 'send-text-message' then 'text'
      when 'send-image-message' then 'image' else 'video' end;
    v_rotulo:=case v_tipo when 'text' then 'texto' when 'image' then 'imagem' else 'video' end;
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
    if (v_tipo='text' and v_texto='') or (v_tipo<>'text' and v_url='') then
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
        'Parte '||v_parte||' invalida: conteudo obrigatorio ausente');
      return;
    end if;
    v_body:=case when v_tipo='text'
      then jsonb_build_object('sessionId',v_inst,'to',v_destino,'text',v_texto)
      else jsonb_strip_nulls(jsonb_build_object('sessionId',v_inst,'to',v_destino,
        v_tipo,v_url,'caption',nullif(v_caption,''))) end;
    begin
      perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS',
        case when v_tipo='text' then '15000' else '45000' end);
      select status,left(content,1200) content into v_resp from extensions.http((
        'POST','https://api.d-api.cloud/api/v1/messages/send/'||v_tipo,
        array[extensions.http_header('Authorization',v_key)],
        'application/json',v_body::text
      )::extensions.http_request);
    exception when others then
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
        'Parte '||v_parte||' falhou na instancia do dono: '||left(sqlerrm,100));
      return;
    end;
    if v_resp.status not between 200 and 299 then
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
        'Parte '||v_parte||' falhou na instancia do dono [HTTP '||v_resp.status||']');
      return;
    end if;

    insert into public.motor_mensagem_partes(
      execution_id,automacao_id,bloco_id,parte,abordagem_id,status
    ) values (v_exec,p_auto,p_bloco,v_parte,v_ab_id,'enviada')
    on conflict (execution_id,automacao_id,bloco_id,parte) do nothing;
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','ok',p_lead->>'nome',v_tel,
      'Abordagem "'||v_ab_nome||'" · parte '||v_parte||' ('||v_rotulo||
      ') enviada pela instancia do dono '||v_cor_nome);
    perform public.wa_registrar_saida(v_inst,v_destino,p_lead_id,v_rotulo,
      coalesce(nullif(v_texto,''),v_caption),nullif(v_url,''));
  end loop;
end
$fn$;

revoke all on function public.motor_envia_abordagem(
  bigint,text,text,jsonb,bigint,bigint,bigint,jsonb
) from public,anon,authenticated;
grant execute on function public.motor_envia_abordagem(
  bigint,text,text,jsonb,bigint,bigint,bigint,jsonb
) to service_role;

do $patch$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_rodar_unchecked';
  v_new:=replace(v_def,
    $old$      select exists(
        select 1 from motor_execucoes me
         where me.automacao_id=p_auto_id and me.bloco_id=cur
           and me.evento='mensagem' and me.status='ok'
           and me.criado_em>=_send_started
      ) into _send_ok;$old$,
    $new$      select
        exists(
          select 1 from motor_execucoes me
           where me.automacao_id=p_auto_id and me.bloco_id=cur
             and me.evento='mensagem' and me.status='ok'
             and me.criado_em>=_send_started
        ) and not exists(
          select 1 from motor_execucoes me
           where me.automacao_id=p_auto_id and me.bloco_id=cur
             and me.evento='mensagem' and me.status='erro'
             and me.criado_em>=_send_started
        ) into _send_ok;$new$);
  v_new:=replace(v_new,
    $old$        if cur is null then return trace||'-- interrompida --'; end if;
        continue;
      end if;

      trace:=trace||E'>> Abordagem enviada\n';$old$,
    $new$        if cur is null then
          raise exception using errcode='P0001',
            message='AUTOMATION_RETRY: MESSAGE_SEND_FAILED';
        end if;
        continue;
      end if;

      trace:=trace||E'>> Abordagem enviada\n';$new$);
  if v_new=v_def or position('MESSAGE_SEND_FAILED' in v_new)=0
     or position('and not exists(' in v_new)=0 then
    raise exception 'patch do envio deterministico nao encontrou ancoras';
  end if;
  execute v_new;
end
$patch$;
