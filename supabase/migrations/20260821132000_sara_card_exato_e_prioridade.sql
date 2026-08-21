-- Central de Automacoes: sensores carregam o card exato ate o modulo da Sara.
-- O relogio apenas acorda mapas publicados; a unica escrita de negocio continua
-- no bloco explicito apply-ai-analysis-action.

begin;

create or replace function public.motor_evento_disparar(
  p_trigger text,
  p_lead jsonb,
  p_momento text default null
) returns integer
language plpgsql
security definer
set search_path=''
as $fn$
declare
  a record;
  n integer:=0;
  v_tel text;
  v_card uuid;
begin
  v_tel:=right(regexp_replace(coalesce(p_lead->>'telefone',''),'\D','','g'),11);
  begin
    v_card:=nullif(p_lead->>'__funil_lead_id','')::uuid;
  exception when others then
    raise exception using errcode='P0001',message='AUTOMATION_EVENT_CONTEXT_INVALID: funil_lead_id';
  end;

  for a in
    select au.id,nullif(t->'options'->>'momento','') momento_cfg
      from public.automacoes au,
           lateral jsonb_array_elements(public.automacao_mapa_executavel(au.id,null)->'automation'->'blocks') b,
           lateral jsonb_array_elements(coalesce(b->'options'->'triggers','[]'::jsonb)) t
     where t->>'name'=p_trigger
       and au.ativa is true
       and au.status='publicado'
       and coalesce(au.arquivada,false) is false
  loop
    if a.momento_cfg is not null and a.momento_cfg<>coalesce(p_momento,'') then
      continue;
    end if;

    if exists(
      select 1 from public.motor_fila f
       where f.automacao_id=a.id and f.status in ('pendente','processando')
         and (
           (v_card is not null and f.lead->>'__funil_lead_id'=v_card::text)
           or (v_card is null and right(regexp_replace(coalesce(f.lead->>'telefone',''),'\D','','g'),11)=v_tel)
         )
    ) then continue; end if;

    -- Eventos antigos sem card ainda usam a trava curta por telefone. Quando o
    -- sensor informa o card, dois cards distintos nunca se anulam por telefone.
    if v_card is null and v_tel<>'' and exists(
      select 1 from public.motor_execucoes me
       where me.automacao_id=a.id and me.evento='entrada'
         and right(regexp_replace(coalesce(me.lead_telefone,''),'\D','','g'),11)=v_tel
         and me.criado_em>now()-interval '60 seconds'
    ) then continue; end if;

    perform public.motor_enfileirar(a.id,p_lead);
    n:=n+1;
  end loop;
  return n;
end
$fn$;

revoke all on function public.motor_evento_disparar(text,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.motor_evento_disparar(text,jsonb,text) to service_role;

create or replace function public.motor_evento_mensagem(p_limite integer default 150)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $fn$
declare r record; v_leads int:=0; v_disparos int:=0;
begin
  if not exists(select 1 from motor_flags where nome='eventos' and ativo) then
    return jsonb_build_object('ok',true,'motivo','eventos desligados em motor_flags');
  end if;

  for r in
    select * from (
      select f.id card,f.momento_codigo,l.nome,l.telefone,l.email,
             'mensagem_recebida' evento,'lead-mensagem-recebida-trigger' gatilho,
             s.cliente_ultima marca
        from f2_lead f join negocios ng on ng.id=f.origem_negocio_id
        join leads l on l.id=ng.lead_id join sla_msg_cache s on s.lead_id=ng.lead_id
       where f.descartado_em is null and s.cliente_ultima is not null
         and s.cliente_ultima>coalesce((select v.marca from motor_evento_visto v
              where v.evento='mensagem_recebida' and v.funil_lead_id=f.id),'-infinity')
      union all
      select f.id,f.momento_codigo,l.nome,l.telefone,l.email,
             'mensagem_enviada','lead-mensagem-enviada-trigger',s.env_ultima
        from f2_lead f join negocios ng on ng.id=f.origem_negocio_id
        join leads l on l.id=ng.lead_id join sla_msg_cache s on s.lead_id=ng.lead_id
       where f.descartado_em is null and s.env_ultima is not null
         and s.env_ultima>coalesce((select v.marca from motor_evento_visto v
              where v.evento='mensagem_enviada' and v.funil_lead_id=f.id),'-infinity')
    ) novos
    order by marca
    limit greatest(1,least(coalesce(p_limite,150),500))
  loop
    v_disparos:=v_disparos+motor_evento_disparar(
      r.gatilho,jsonb_build_object(
        'nome',coalesce(r.nome,'Lead'),'telefone',coalesce(r.telefone,''),
        'email',coalesce(r.email,''),'__funil_lead_id',r.card,
        '__motor_priority',0,'__motor_evento',r.evento
      ),r.momento_codigo);
    insert into motor_evento_visto(evento,funil_lead_id,marca)
    values(r.evento,r.card,r.marca)
    on conflict(evento,funil_lead_id) do update
      set marca=excluded.marca,atualizado_em=now();
    v_leads:=v_leads+1;
  end loop;
  return jsonb_build_object('ok',true,'eventos_lidos',v_leads,
    'automacoes_disparadas',v_disparos);
end
$fn$;

revoke all on function public.motor_evento_mensagem(integer)
  from public,anon,authenticated;
grant execute on function public.motor_evento_mensagem(integer) to service_role;

create or replace function public.sara_checagem_diaria(p_limite integer default 12)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $fn$
declare v_n int:=0; r record;
begin
  for r in
    select f.id,f.momento_codigo,coalesce(l.nome,f.nome) nome,
           coalesce(l.telefone,f.telefone) tel,l.email,
           s.ultima_interacao,a.ultima_consulta_em
      from f2_lead f
      left join negocios ng on ng.id=f.origem_negocio_id
      left join leads l on l.id=ng.lead_id
      left join sla_msg_cache s on s.lead_id=ng.lead_id
      left join lateral(
        select sa.ultima_consulta_em from f2_sara_analise sa
         where sa.funil_lead_id=f.id order by sa.ultima_consulta_em desc limit 1
      ) a on true
     where f.descartado_em is null
       and (a.ultima_consulta_em is null
         or s.ultima_interacao>a.ultima_consulta_em
         or a.ultima_consulta_em<=now()-interval '24 hours')
     order by (s.ultima_interacao>a.ultima_consulta_em) desc nulls last,
              a.ultima_consulta_em nulls first,f.criado_em
     limit greatest(1,least(coalesce(p_limite,12),50))
  loop
    v_n:=v_n+motor_evento_disparar('checagem-diaria-trigger',
      jsonb_build_object(
        'nome',r.nome,'telefone',coalesce(r.tel,''),'email',coalesce(r.email,''),
        '__funil_lead_id',r.id,'__motor_priority',20,
        '__motor_evento','checagem_diaria'
      ),r.momento_codigo);
  end loop;
  return jsonb_build_object('ok',true,'disparos_na_central',v_n);
end
$fn$;

revoke all on function public.sara_checagem_diaria(integer)
  from public,anon,authenticated;
grant execute on function public.sara_checagem_diaria(integer) to service_role;

create or replace function public.motor_agente(
  p_auto bigint,p_nome text,p_bloco text,p_lead jsonb,p_lead_id bigint,
  p_agente_id bigint,p_funcao text
) returns jsonb
language plpgsql
security definer
set search_path='public','extensions'
as $fn$
declare
  v_ag record; v_card uuid; v_card_contexto uuid; v_tel text;
  v_http_status integer; v_http_body text;
  v_res jsonb; v_item jsonb; v_reg jsonb; v_status text; v_aplicavel boolean;
begin
  v_tel:=regexp_replace(coalesce(p_lead->>'telefone',''),'\D','','g');
  select id,nome,slug,coalesce(ativo,false) ativo into v_ag
    from public.agentes_ia where id=p_agente_id;
  if v_ag.id is null or not v_ag.ativo then
    return jsonb_build_object('ok',false,'erro',
      case when v_ag.id is null then 'agente_nao_encontrado' else 'agente_desligado' end);
  end if;
  if p_funcao not in ('analisar_atendimento','atualizar_momento') then
    return jsonb_build_object('ok',false,'erro','funcao_desconhecida');
  end if;

  begin
    v_card_contexto:=nullif(p_lead->>'__funil_lead_id','')::uuid;
  exception when others then
    return jsonb_build_object('ok',false,'erro','card_contexto_invalido');
  end;

  if v_card_contexto is not null then
    select f.id into v_card
      from public.f2_lead f
      left join public.negocios n on n.id=f.origem_negocio_id
      left join public.leads l on l.id=n.lead_id
     where f.id=v_card_contexto and f.descartado_em is null
       and (
         v_tel=''
         or right(regexp_replace(coalesce(l.telefone,f.telefone,''),'\D','','g'),8)=right(v_tel,8)
       );
    if v_card is null then
      return jsonb_build_object('ok',false,'erro','card_contexto_divergente');
    end if;
  else
    select f.id into v_card from public.f2_lead f
    join public.negocios n on n.id=f.origem_negocio_id
    where n.lead_id=p_lead_id and f.descartado_em is null
    order by f.criado_em desc limit 1;
  end if;
  if v_card is null then return jsonb_build_object('ok',false,'erro','lead_fora_do_funil'); end if;

  begin perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','28000');
  exception when others then null; end;
  begin
    select h.status,left(h.content,12000) into v_http_status,v_http_body
      from extensions.http((
        'POST','https://diaegvfveqezispcthwk.supabase.co/functions/v1/f2-sara-reclassificar',
        array[extensions.http_header('x-cron-secret',
          (select decrypted_secret from vault.decrypted_secrets
            where name='ncrm_sara_cron_secret'))],
        'application/json',jsonb_build_object(
          'funil_lead_id',v_card,'agente_slug',v_ag.slug
        )::text
      )::extensions.http_request) h;
  exception when others then
    v_http_status:=null; v_http_body:='falha_http';
  end;
  begin v_res:=v_http_body::jsonb; exception when others then v_res:=null; end;
  v_item:=v_res#>'{resultados,0}';
  if coalesce(v_http_status,0)<>200
     or coalesce((v_res->>'ok')::boolean,false) is not true
     or coalesce((v_res->>'somente_analise')::boolean,false) is not true
     or v_item->>'id'<>v_card::text or v_res->>'agente_slug'<>v_ag.slug then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values(p_auto,p_nome,p_bloco,'agente','erro',p_lead->>'nome',v_tel,
      'IA nao devolveu o contrato puro do card exato (HTTP '||
      coalesce(v_http_status::text,'-')||')');
    return jsonb_build_object('ok',false,'erro','ia_indisponivel','http',v_http_status);
  end if;

  v_reg:=public.f2_sara_registrar_sugestao(
    v_card,(v_item->>'versao_base')::integer,v_item->>'context_hash',
    v_item->>'origem',v_item->>'status',v_item->>'momento_codigo',
    v_item->>'resumo',coalesce(v_item->'evidencias','[]'::jsonb),
    nullif(v_item->>'confianca','')::numeric,
    coalesce(nullif(v_item->>'mensagens','')::integer,0),
    nullif(v_item->>'prazo_sugerido','')::timestamptz,
    nullif(v_item->>'qualidade_nota','')::numeric,v_item->>'qualidade_resumo'
  );
  if coalesce((v_reg->>'ok')::boolean,false) is not true then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values(p_auto,p_nome,p_bloco,'agente','erro',p_lead->>'nome',v_tel,
      'IA devolveu contrato invalido: '||coalesce(v_reg->>'erro','erro'));
    return jsonb_build_object('ok',false,'erro','analise_invalida','output',v_reg);
  end if;

  v_status:=v_reg->>'status';
  v_aplicavel:=v_status='sugerida';
  if v_status not in ('sugerida','aplicada','mantida','revisao_humana','sem_historico','obsoleta') then
    return jsonb_build_object('ok',false,'erro','status_analise_invalido','output',v_reg);
  end if;

  insert into public.motor_execucoes(
    automacao_id,automacao_nome,bloco_id,evento,status,
    lead_nome,lead_telefone,detalhe
  ) values(p_auto,p_nome,p_bloco,'agente','ok',p_lead->>'nome',v_tel,
    case when v_aplicavel
      then 'Agente "'||v_ag.nome||'" devolveu analise #'||(v_reg->>'analise_id')||
           '; nenhum campo do lead foi alterado'
      else 'Agente "'||v_ag.nome||'" encerrou com seguranca #'||(v_reg->>'analise_id')||
           ' ['||v_status||']; nenhum campo do lead foi alterado' end);
  return jsonb_build_object('ok',true,'card',v_card,'agente',v_ag.nome,
    'aplicavel',v_aplicavel,
    'output',v_item||jsonb_build_object('analise_id',(v_reg->>'analise_id')::bigint,
      'status',v_status,'aplicavel',v_aplicavel));
end
$fn$;

revoke all on function public.motor_agente(bigint,text,text,jsonb,bigint,bigint,text)
  from public,anon,authenticated;
grant execute on function public.motor_agente(bigint,text,text,jsonb,bigint,bigint,text)
  to service_role;

create or replace function public.motor_processar_fila()
returns integer
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r record; n integer:=0; claimed integer; v_ok boolean; v_erro text; v_delay integer;
begin
  for r in
    select id,automacao_id,automacao_versao_id,bloco_id,lead,tentativas
      from public.motor_fila
     where status='pendente' and due_at<=now()
     order by
       case when lead->>'__motor_priority' ~ '^[0-9]+$'
         then (lead->>'__motor_priority')::integer else 10 end,
       due_at,id
     limit 50 for update skip locked
  loop
    select a.ativa is true and a.status='publicado'
           and not coalesce(a.arquivada,false)
      into v_ok from public.automacoes a where a.id=r.automacao_id;
    if coalesce(v_ok,false) is not true then
      update public.motor_fila
         set status='cancelado',processado_em=now(),ultimo_erro='AUTOMATION_NOT_RUNNABLE'
       where id=r.id;
      continue;
    end if;

    update public.motor_fila
       set status='processando',tentativas=tentativas+1,ultimo_erro=null
     where id=r.id and status='pendente';
    get diagnostics claimed=row_count;
    if claimed=0 then continue; end if;

    begin
      perform public.motor_rodar(
        r.automacao_id,
        (r.lead-'__automacao_versao_id')||
          jsonb_build_object('__automacao_versao_id',r.automacao_versao_id),
        nullif(r.bloco_id,'START'),case when r.bloco_id='START' then 0 else 1 end
      );
      update public.motor_fila
         set status='ok',processado_em=now(),ultimo_erro=null where id=r.id;
    exception when others then
      v_erro:=left(sqlstate||': '||sqlerrm,1000);
      if sqlerrm like 'AUTOMATION_RETRY:%' and r.tentativas<5 then
        v_delay:=least(900,(30*power(2,least(r.tentativas,5)))::integer);
        update public.motor_fila
           set status='pendente',due_at=now()+make_interval(secs=>v_delay),
               processado_em=null,ultimo_erro=v_erro where id=r.id;
        insert into public.motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values(
          r.automacao_id,(select a.nome from public.automacoes a where a.id=r.automacao_id),
          r.bloco_id,'fila','alerta',r.lead->>'nome',r.lead->>'telefone',
          'Retry '||(r.tentativas+1)||'/5 em '||v_delay||'s: '||left(v_erro,180)
        );
      else
        update public.motor_fila
           set status='erro',processado_em=now(),ultimo_erro=v_erro where id=r.id;
        insert into public.motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values(
          r.automacao_id,(select a.nome from public.automacoes a where a.id=r.automacao_id),
          r.bloco_id,'fila','erro',r.lead->>'nome',r.lead->>'telefone',
          'Execucao encerrada sem presumir sucesso: '||left(v_erro,240)
        );
      end if;
    end;
    n:=n+1;
  end loop;
  return n;
end
$fn$;

revoke all on function public.motor_processar_fila()
  from public,anon,authenticated;
grant execute on function public.motor_processar_fila() to service_role;

commit;
