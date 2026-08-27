-- Central de Automacoes: toda mudanca observavel da conversa acorda o mapa
-- publicado. A Sara continua sendo um modulo puro; a Acao seguinte decide se
-- aplica a saida. Resultados seguros sao terminais e nao viram falsos erros.

begin;

alter table public.f2_sara_analise
  add column if not exists ultima_consulta_em timestamptz;

update public.f2_sara_analise
   set ultima_consulta_em=coalesce(ultima_consulta_em,analisado_em,now())
 where ultima_consulta_em is null;

alter table public.f2_sara_analise
  alter column ultima_consulta_em set default now(),
  alter column ultima_consulta_em set not null;

create index if not exists f2_sara_analise_lead_consulta_idx
  on public.f2_sara_analise(funil_lead_id,ultima_consulta_em desc);

create or replace function public.f2_sara_registrar_sugestao(
  p_funil_lead_id uuid,
  p_versao integer,
  p_context_hash text,
  p_origem text,
  p_status text,
  p_momento_codigo text,
  p_resumo text,
  p_evidencias jsonb,
  p_confianca numeric,
  p_mensagens integer,
  p_prazo_sugerido timestamptz,
  p_qualidade_nota numeric,
  p_qualidade_resumo text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_lead public.f2_lead%rowtype;
  v_m public.f2_momento_config%rowtype;
  v_status text;
  v_id bigint;
  v_min numeric;
begin
  if p_context_hash !~ '^[a-f0-9]{64}$'
     or p_origem not in ('ia','deterministica')
     or p_status not in ('sugestao','sem_historico')
     or jsonb_typeof(coalesce(p_evidencias,'[]'::jsonb))<>'array'
     or coalesce(char_length(btrim(p_resumo)),0) not between 3 and 800
     or coalesce(p_mensagens,0) not between 0 and 250
     or (p_qualidade_nota is not null and p_qualidade_nota not between 0 and 10)
     or (p_qualidade_nota is not null and
         coalesce(char_length(btrim(p_qualidade_resumo)),0) not between 3 and 500) then
    return jsonb_build_object('ok',false,'erro','contrato_invalido');
  end if;

  select * into v_lead from public.f2_lead
   where id=p_funil_lead_id for update;
  if not found then return jsonb_build_object('ok',false,'erro','lead_inexistente'); end if;

  select * into v_m from public.f2_momento_config
   where codigo=p_momento_codigo and ativo;
  if p_status='sugestao' and not found then
    return jsonb_build_object('ok',false,'erro','momento_invalido');
  end if;

  update public.f2_sara_analise a
     set ultima_consulta_em=now()
   where a.funil_lead_id=p_funil_lead_id and a.context_hash=p_context_hash
   returning a.id,a.status into v_id,v_status;
  if v_id is not null then
    return jsonb_build_object('ok',true,'ja_processado',true,
      'analise_id',v_id,'status',v_status);
  end if;

  select coalesce(confianca_minima,0.65) into v_min
    from public.f2_sara_config where id;
  v_min:=coalesce(v_min,0.65);
  v_status:=case when p_status='sem_historico' then 'sem_historico'
                 when v_lead.versao<>p_versao then 'obsoleta'
                 when p_confianca is null or p_confianca<v_min then 'revisao_humana'
                 when p_origem='ia' and p_momento_codigo<>'CADENCIA_SEM_RESPOSTA'
                      and jsonb_array_length(coalesce(p_evidencias,'[]'::jsonb))=0
                   then 'revisao_humana'
                 else 'sugerida' end;

  if v_status='sugerida' and p_momento_codigo='CADENCIA_SEM_RESPOSTA'
     and exists(
       select 1 from public.wa_mensagens wm
       join public.wa_conversas cv on cv.id=wm.conversa_id
       left join public.wa_contatos c on c.id=cv.contato_id
       left join public.negocios n on n.id=v_lead.origem_negocio_id
       left join public.f2_historico_vinculo hv
         on hv.funil_lead_id=v_lead.id and hv.contato_id=cv.contato_id
       where wm.direcao='recebida'
         and (c.lead_id=n.lead_id or hv.funil_lead_id is not null)
     ) then
    v_status:='revisao_humana';
  end if;

  insert into public.f2_sara_analise(
    funil_lead_id,origem_negocio_id,context_hash,origem,status,
    momento_anterior,momento_sugerido,etapa_sugerida,acao_sugerida,
    acao_rotulo_sugerida,prazo_sugerido,resumo,evidencias,confianca,
    mensagens_consideradas,versao_base,qualidade_nota,qualidade_resumo,
    ultima_consulta_em
  ) values (
    p_funil_lead_id,v_lead.origem_negocio_id,p_context_hash,p_origem,v_status,
    v_lead.momento_codigo,v_m.codigo,v_m.etapa,v_m.acao_codigo,
    v_m.acao_rotulo,p_prazo_sugerido,left(btrim(p_resumo),800),
    coalesce(p_evidencias,'[]'::jsonb),p_confianca,coalesce(p_mensagens,0),
    p_versao,p_qualidade_nota,left(btrim(p_qualidade_resumo),500),now()
  ) returning id into v_id;

  return jsonb_build_object('ok',true,'analise_id',v_id,'status',v_status,
    'momento_codigo',v_m.codigo,'etapa',v_m.etapa,'acao_codigo',v_m.acao_codigo,
    'acao_rotulo',v_m.acao_rotulo,'prazo_sugerido',p_prazo_sugerido,
    'qualidade_nota',p_qualidade_nota,'versao_base',p_versao);
exception when unique_violation then
  update public.f2_sara_analise a set ultima_consulta_em=now()
   where a.funil_lead_id=p_funil_lead_id and a.context_hash=p_context_hash
   returning a.id,a.status into v_id,v_status;
  return jsonb_build_object('ok',true,'ja_processado',true,
    'analise_id',v_id,'status',v_status);
end
$fn$;

revoke all on function public.f2_sara_registrar_sugestao(
  uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz,numeric,text
) from public,anon,authenticated;
grant execute on function public.f2_sara_registrar_sugestao(
  uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz,numeric,text
) to service_role;

create or replace function public.f2_sara_aplicar_analise(
  p_analise_id bigint,
  p_aplicar_momento boolean default true,
  p_aplicar_etapa boolean default true,
  p_aplicar_acao boolean default true,
  p_aplicar_qualidade boolean default true
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_a public.f2_sara_analise%rowtype;
  v_f public.f2_lead%rowtype;
  v_m public.f2_momento_config%rowtype;
  v_prazo timestamptz;
  v_status_final text;
begin
  if not coalesce(p_aplicar_momento,false)
     and not coalesce(p_aplicar_etapa,false)
     and not coalesce(p_aplicar_acao,false)
     and not coalesce(p_aplicar_qualidade,false) then
    return jsonb_build_object('ok',false,'erro','nenhum_campo_selecionado');
  end if;

  select * into v_a from public.f2_sara_analise
   where id=p_analise_id for update;
  if not found then return jsonb_build_object('ok',false,'erro','analise_inexistente'); end if;
  if v_a.status in ('aplicada','mantida') then
    return jsonb_build_object('ok',true,'aplicado',true,'idempotente',true,
      'analise_id',v_a.id,'status',v_a.status);
  end if;
  if v_a.status in ('revisao_humana','sem_historico','obsoleta') then
    return jsonb_build_object('ok',true,'aplicado',false,'terminal',true,
      'analise_id',v_a.id,'status',v_a.status);
  end if;
  if v_a.status<>'sugerida' then
    return jsonb_build_object('ok',false,'erro','analise_nao_aplicavel','status',v_a.status);
  end if;

  select * into v_f from public.f2_lead where id=v_a.funil_lead_id for update;
  if not found then return jsonb_build_object('ok',false,'erro','lead_inexistente'); end if;
  if v_f.versao<>v_a.versao_base then
    update public.f2_sara_analise set status='obsoleta' where id=v_a.id;
    return jsonb_build_object('ok',true,'aplicado',false,'terminal',true,
      'analise_id',v_a.id,'status','obsoleta');
  end if;

  select * into v_m from public.f2_momento_config
   where codigo=v_a.momento_sugerido and ativo;
  if not found then return jsonb_build_object('ok',false,'erro','momento_invalido'); end if;
  v_prazo:=case
    when v_m.codigo='RETORNO_PROGRAMADO' and v_a.prazo_sugerido>now()
      and v_a.prazo_sugerido<=now()+interval '30 days' then v_a.prazo_sugerido
    else now()+make_interval(mins=>coalesce(v_m.prazo_minutos,1440)) end;
  v_status_final:=case when v_f.momento_codigo=v_m.codigo then 'mantida' else 'aplicada' end;

  update public.f2_lead set
    momento_codigo=case when p_aplicar_momento then v_m.codigo else momento_codigo end,
    etapa=case when p_aplicar_etapa then v_m.etapa else etapa end,
    acao_codigo=case when p_aplicar_acao then v_m.acao_codigo else acao_codigo end,
    acao_rotulo=case when p_aplicar_acao then v_m.acao_rotulo else acao_rotulo end,
    proxima_acao_em=case when p_aplicar_acao then v_prazo else proxima_acao_em end,
    qualidade_atendimento_nota=case
      when p_aplicar_qualidade and v_a.qualidade_nota is not null
        then v_a.qualidade_nota else qualidade_atendimento_nota end,
    qualidade_atendimento_resumo=case
      when p_aplicar_qualidade and v_a.qualidade_nota is not null
        then v_a.qualidade_resumo else qualidade_atendimento_resumo end,
    qualidade_atendimento_em=case
      when p_aplicar_qualidade and v_a.qualidade_nota is not null
        then now() else qualidade_atendimento_em end,
    ultima_reavaliacao_sara_em=now(),
    ultima_reavaliacao_resumo=v_a.resumo,
    versao=versao+1,atualizado_em=now(),atualizado_por=null
  where id=v_f.id;

  update public.f2_sara_analise
     set status=v_status_final,aplicada_em=now()
   where id=v_a.id;

  insert into public.f2_evento(
    funil_lead_id,tipo,titulo,detalhe,payload,criado_por
  ) values (
    v_f.id,'sara_reavaliou','Central aplicou a analise da Sara',
    left(v_a.resumo,500),
    jsonb_build_object('analise_id',v_a.id,'momento_anterior',v_f.momento_codigo,
      'momento_novo',case when p_aplicar_momento then v_m.codigo else v_f.momento_codigo end,
      'etapa_aplicada',p_aplicar_etapa,'acao_aplicada',p_aplicar_acao,
      'qualidade_aplicada',p_aplicar_qualidade and v_a.qualidade_nota is not null),
    null
  );
  return jsonb_build_object('ok',true,'aplicado',true,'analise_id',v_a.id,
    'status',v_status_final,
    'momento_codigo',case when p_aplicar_momento then v_m.codigo else v_f.momento_codigo end,
    'versao',v_f.versao+1);
end
$fn$;

revoke all on function public.f2_sara_aplicar_analise(bigint,boolean,boolean,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.f2_sara_aplicar_analise(bigint,boolean,boolean,boolean,boolean)
  to service_role;

create or replace function public.motor_agente(
  p_auto bigint,p_nome text,p_bloco text,p_lead jsonb,p_lead_id bigint,
  p_agente_id bigint,p_funcao text
) returns jsonb
language plpgsql
security definer
set search_path='public','extensions'
as $fn$
declare
  v_ag record; v_card uuid; v_tel text; v_http_status integer; v_http_body text;
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
  select f.id into v_card from public.f2_lead f
  join public.negocios n on n.id=f.origem_negocio_id
  where n.lead_id=p_lead_id and f.descartado_em is null
  order by f.criado_em desc limit 1;
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
    ) values (p_auto,p_nome,p_bloco,'agente','erro',p_lead->>'nome',v_tel,
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
    ) values (p_auto,p_nome,p_bloco,'agente','erro',p_lead->>'nome',v_tel,
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
  ) values (p_auto,p_nome,p_bloco,'agente','ok',p_lead->>'nome',v_tel,
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

-- O bloco Acao distingue aplicacao de terminal seguro sem transformar o ultimo
-- em erro operacional.
do $patch_actions$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_acoes';
  v_new:=replace(v_def,
    $old$        case when coalesce((_ai_apply->>'ok')::boolean,false)
          then 'Analise da IA aplicada explicitamente #'||coalesce(p_lead->>'__last_ai_analysis_id','?')
          else 'Analise da IA nao aplicada: '||coalesce(_ai_apply->>'erro','erro') end$old$,
    $new$        case when coalesce((_ai_apply->>'ok')::boolean,false)
          then case when coalesce((_ai_apply->>'aplicado')::boolean,false)
            then 'Analise da IA aplicada explicitamente #'||coalesce(p_lead->>'__last_ai_analysis_id','?')
            else 'Analise da IA concluida sem alteracao #'||coalesce(p_lead->>'__last_ai_analysis_id','?')||
                 ' ['||coalesce(_ai_apply->>'status','terminal_seguro')||']' end
          else 'Analise da IA nao aplicada: '||coalesce(_ai_apply->>'erro','erro') end$new$);
  if v_new=v_def or position('Analise da IA concluida sem alteracao' in v_new)=0 then
    raise exception 'motor_acoes sem ancora do bloco explicito de IA';
  end if;
  execute v_new;
end
$patch_actions$;

-- O validador do banco e o construtor reconhecem o mesmo novo evento.
do $patch_validator$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='automacao_validar_mapa';
  v_new:=replace(v_def,
    $old$    'lead-mensagem-recebida-trigger','momento-prazo-vencido-trigger',$old$,
    $new$    'lead-mensagem-recebida-trigger','lead-mensagem-enviada-trigger',
    'momento-prazo-vencido-trigger',$new$);
  if v_new=v_def or position('lead-mensagem-enviada-trigger' in v_new)=0 then
    raise exception 'automacao_validar_mapa sem ancora de gatilhos';
  end if;
  execute v_new;
end
$patch_validator$;

-- Inicializa os marcos no estado corrente: nada historico e reenviado. O
-- backlog existente sera recuperado gradualmente pela automacao de checagem.
insert into public.motor_evento_visto(evento,funil_lead_id,marca)
select 'mensagem_recebida',f.id,s.cliente_ultima
  from public.f2_lead f
  join public.negocios n on n.id=f.origem_negocio_id
  join public.sla_msg_cache s on s.lead_id=n.lead_id
 where f.descartado_em is null and s.cliente_ultima is not null
on conflict(evento,funil_lead_id) do update
  set marca=greatest(public.motor_evento_visto.marca,excluded.marca),atualizado_em=now();

insert into public.motor_evento_visto(evento,funil_lead_id,marca)
select 'mensagem_enviada',f.id,s.env_ultima
  from public.f2_lead f
  join public.negocios n on n.id=f.origem_negocio_id
  join public.sla_msg_cache s on s.lead_id=n.lead_id
 where f.descartado_em is null and s.env_ultima is not null
on conflict(evento,funil_lead_id) do update
  set marca=greatest(public.motor_evento_visto.marca,excluded.marca),atualizado_em=now();

delete from public.motor_evento_visto where evento='mensagem';

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
      r.gatilho,jsonb_build_object('nome',coalesce(r.nome,'Lead'),
        'telefone',coalesce(r.telefone,''),'email',coalesce(r.email,'')),
      r.momento_codigo);
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
      left join lateral (
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
      jsonb_build_object('nome',r.nome,'telefone',coalesce(r.tel,''),
        'email',coalesce(r.email,'')),r.momento_codigo);
  end loop;
  return jsonb_build_object('ok',true,'disparos_na_central',v_n);
end
$fn$;

revoke all on function public.sara_checagem_diaria(integer)
  from public,anon,authenticated;
grant execute on function public.sara_checagem_diaria(integer) to service_role;

create or replace function public.motor_relogio_central()
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
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
    perform public.sla_msg_cache_refresh();
    v_resultado:=v_resultado||jsonb_build_object('cache_mensagens','atualizado');
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('cache_mensagens_erro',sqlstate||': '||sqlerrm);
  end;
  begin
    v_resultado:=v_resultado||jsonb_build_object('mensagem',public.motor_evento_mensagem(300));
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('mensagem_erro',sqlstate||': '||sqlerrm);
  end;
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
  begin
    insert into public.motor_relogio_estado(chave,ultima_execucao) values('retomar',now())
    on conflict(chave) do update set ultima_execucao=excluded.ultima_execucao
      where public.motor_relogio_estado.ultima_execucao<=now()-interval '5 minutes';
    if found then
      v_resultado:=v_resultado||jsonb_build_object('retomar',public.motor_evento_retomar(100));
    end if;
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('retomar_erro',sqlstate||': '||sqlerrm);
  end;
  begin
    insert into public.motor_relogio_estado(chave,ultima_execucao) values('checagem_diaria',now())
    on conflict(chave) do update set ultima_execucao=excluded.ultima_execucao
      where public.motor_relogio_estado.ultima_execucao<=now()-interval '1 minute';
    if found then
      v_resultado:=v_resultado||jsonb_build_object('checagem_diaria',public.sara_checagem_diaria(12));
    end if;
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('checagem_diaria_erro',sqlstate||': '||sqlerrm);
  end;
  return jsonb_build_object('ok',true,'fontes',v_resultado);
end
$fn$;

revoke all on function public.motor_relogio_central()
  from public,anon,authenticated;
grant execute on function public.motor_relogio_central() to service_role;

-- Um unico relogio tecnico atualiza o cache e acorda os mapas publicados.
do $cron$
declare r record;
begin
  for r in select jobid from cron.job where jobname='sla_msg_cache_refresh'
  loop perform cron.unschedule(r.jobid); end loop;
end
$cron$;

-- Remove a regra adormecida que antecipava blocos RESP fora do mapa.
drop trigger if exists trg_resp_antecipar on public.wa_mensagens;

-- O catalogo que o prompt exige precisa ser exatamente o catalogo aceito.
update public.f2_momento_config set ativo=true
 where codigo in ('PROCURANDO_PRODUTO','PRODUTO_ENVIADO','RETORNO_PROGRAMADO',
                  'COLETAR_FEEDBACK','REMARCAR_VISITA','ACOMPANHAMENTO_POS_VISITA');

-- Modelo mais capaz para classificacao estruturada em alto volume.
update public.agentes_ia
   set modelo='gpt-5.4-mini',status='publicado',atualizado_em=now()
 where id=19 and slug='leitor-momento' and ativo;

-- A abordagem automatica permanece desligada. O fluxo antigo da Sara fica
-- arquivado para nao poder ser reativado por acidente.
update public.automacoes set ativa=false,atualizada_em=now() where id=57;
update public.automacoes set ativa=false,arquivada=true,atualizada_em=now() where id=60;

-- O contrato publicado exige um unico inicio por automacao. O fluxo recebido
-- permanece no ID 49; o fluxo irmao de mensagem enviada repete somente o mapa
-- visivel Sara -> Aplicar analise.
do $publish$
declare v_map jsonb; v_validation jsonb; v_auto_id bigint; v_version integer;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (select 1 from public.automacoes where id=49) then
    return;
  end if;
  select mapa into v_map from public.automacoes where id=49 for update;
  if v_map is null then raise exception 'automacao 49 inexistente'; end if;

  v_map:=replace(v_map::text,'lead-mensagem-recebida-trigger',
    'lead-mensagem-enviada-trigger')::jsonb;
  v_map:=jsonb_set(v_map,'{automation,name}',
    to_jsonb('IA - corretor enviou mensagem, atualiza o Funil 2.0'::text),true);
  v_map:=jsonb_set(v_map,'{editor,blocks}','{}'::jsonb,true);
  v_map:=jsonb_set(v_map,'{editor,wires}','[]'::jsonb,true);
  v_validation:=public.automacao_validar_mapa(v_map);
  if coalesce((v_validation->>'ok')::boolean,false) is not true then
    raise exception 'mapa de mensagem enviada invalido: %',v_validation;
  end if;

  select id into v_auto_id from public.automacoes
   where nome='IA - corretor enviou mensagem, atualiza o Funil 2.0'
     and not coalesce(arquivada,false) limit 1 for update;
  if v_auto_id is null then
    insert into public.automacoes(
      nome,ativa,mapa,mapa_rascunho,grupo,status,arquivada
    ) values (
      'IA - corretor enviou mensagem, atualiza o Funil 2.0',true,
      v_map,v_map,'Funil 2.0','rascunho',false
    ) returning id into v_auto_id;
  end if;
  if not exists(
    select 1 from public.automacao_versoes av
     where av.automacao_id=v_auto_id
       and exists(
         select 1 from jsonb_array_elements(av.mapa->'automation'->'blocks') x,
           lateral jsonb_array_elements(coalesce(x#>'{options,triggers}','[]'::jsonb)) t
          where t->>'name'='lead-mensagem-enviada-trigger'
       )
  ) then
    select coalesce(max(versao),0)+1 into v_version
      from public.automacao_versoes where automacao_id=v_auto_id;
    insert into public.automacao_versoes(
      automacao_id,versao,nome,mapa,observacao,criado_por
    ) values (v_auto_id,v_version,
      'IA - corretor enviou mensagem, atualiza o Funil 2.0',v_map,
      'Mensagem enviada acorda Sara; aplicacao permanece em bloco explicito',
      'construtor');
  end if;
end
$publish$;

commit;
