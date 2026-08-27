-- Central deterministica: a regra de negocio vive nos mapas publicados.
-- O relogio apenas transporta fila; nao escolhe corretor, tag, abordagem ou
-- classificacao. A mesma inscricao de campanha continua idempotente.

begin;
set local statement_timeout='120s';
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtext('central_deterministica_campanhas_sara'));

-- Pausa apenas o bloqueio por feedback de visita. Presenca fisica, D-API,
-- suspensao e as regras especiais de fim de semana continuam independentes.
update public.ncrm_operacao_config
   set exigir_feedback_visita=false,
       atualizado_em=now()
 where id;

-- Existe uma unica decisao canonica sobre poder enviar a abordagem. Para as
-- entradas 65/66, conversa anterior nao bloqueia uma captacao nova, desde que
-- a execucao seja a versao publicada e o card novo seja automatico/elegivel.
do $patch_sender$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(
    'public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'b339db3d3f7a23b54d6938db2d6f27d9' then
    raise exception 'motor_envia_abordagem mudou: %',md5(v_def);
  end if;
  v_new:=replace(v_def,
    $old$  v_body jsonb; v_primeira_id bigint; v_total integer:=0; v_resultado jsonb;$old$,
    $new$  v_body jsonb; v_primeira_id bigint; v_total integer:=0; v_resultado jsonb;
  v_preflight jsonb;$new$);
  v_new:=replace(v_new,
    $old$  if public.ncrm_bloqueia_abordagem_automatica(p_lead_id) then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Abordagem bloqueada pela trava de primeira abordagem/cliente existente');
    return;
  end if;$old$,
    $new$  v_preflight:=public.motor_abordagem_preflight_execucao(
    p_auto,p_lead_id,v_tel,v_exec
  );
  if coalesce((v_preflight->>'ok')::boolean,false) is not true then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Abordagem bloqueada pelo preflight canonico: '||
      coalesce(v_preflight->>'motivo','motivo_nao_informado'));
    return;
  end if;$new$);
  if v_new=v_def
     or position('motor_abordagem_preflight_execucao' in v_new)=0
     or position('ncrm_bloqueia_abordagem_automatica' in v_new)>0 then
    raise exception 'patch do preflight canonico nao encontrou as ancoras';
  end if;
  execute v_new;
end
$patch_sender$;

-- Publica os blocos atomicos: tags limpam somente produtos antigos conhecidos;
-- os tres fluxos de IA passam a chamar a Sara; a checagem diaria declara sua
-- frequencia e lote no proprio gatilho.
do $publish_maps$
declare
  r record; v_auto public.automacoes%rowtype; v_map jsonb; v_blocks jsonb;
  v_valid jsonb; v_version integer; v_version_id bigint; v_actions jsonb;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (select 1 from public.automacoes where id in (49,64,65,66,69)) then
    return;
  end if;

  for r in
    select * from (values
      (49::bigint,'09f5ea28ce303100c45620e2a71e76b6'::text),
      (64::bigint,'bcded0b0b0971722eaa72296091d3e8d'::text),
      (65::bigint,'e86c89473e7cee96c00cda9e56605f82'::text),
      (66::bigint,'a3c7f024b75c0631c602939c32afde46'::text),
      (69::bigint,'f622475809b9ad8966a1570c125d83e3'::text)
    ) x(id,checksum)
  loop
    select * into strict v_auto from public.automacoes where id=r.id for update;
    if md5(v_auto.mapa::text)<>r.checksum then
      raise exception 'AUTOMATION_STALE_VERSION: % mudou',v_auto.nome;
    end if;

    if r.id in (65,66) then
      v_actions:=jsonb_build_array(
        jsonb_build_object('name','remove-tag-action','group','Leads','options',jsonb_build_object('tag','Aquário')),
        jsonb_build_object('name','remove-tag-action','group','Leads','options',jsonb_build_object('tag','GRC | CARINAS')),
        jsonb_build_object('name','remove-tag-action','group','Leads','options',jsonb_build_object('tag','GRC | CARINAS ')),
        jsonb_build_object('name','remove-tag-action','group','Leads','options',jsonb_build_object('tag','COMPOSITE | NR')),
        jsonb_build_object('name','remove-tag-action','group','Leads','options',jsonb_build_object('tag','Disparo Jazz')),
        jsonb_build_object('name','remove-tag-action','group','Leads','options',jsonb_build_object('tag','Miruna 603')),
        jsonb_build_object('name','remove-tag-action','group','Leads','options',jsonb_build_object('tag','Produto: AP Moema')),
        jsonb_build_object('name','remove-tag-action','group','Leads','options',jsonb_build_object('tag','Produto: My One Campo Belo')),
        jsonb_build_object('name','remove-tag-action','group','Leads','options',jsonb_build_object(
          'tag',case when r.id=65 then 'MIRUNA' else 'Adelmo 2100' end)),
        jsonb_build_object('name','add-tag-action','group','Leads','options',jsonb_build_object(
          'tag',case when r.id=65 then 'Adelmo 2100' else 'MIRUNA' end))
      );
    end if;

    select jsonb_agg(
      case
        when r.id in (49,64,69) and b->>'type'='ai-agent' then
          jsonb_set(b,'{options,agenteId}','16'::jsonb,true)
        when r.id=64 and b->>'type'='trigger' then
          jsonb_set(b,'{options,triggers,0,options}',jsonb_build_object(
            'intervaloHoras',24,
            'atrasoInteracaoMinutos',10,
            'limitePorCiclo',12,
            'deduplicacao','card-dia-local',
            'timezone','America/Sao_Paulo',
            'somenteLeadsAutomaticos',true
          ),true)
        when r.id in (65,66) and b->>'id'='b16' then
          jsonb_set(b,'{options,actions}',v_actions,true)
        else b
      end order by ord
    ) into v_blocks
      from jsonb_array_elements(v_auto.mapa#>'{automation,blocks}')
           with ordinality x(b,ord);
    v_map:=jsonb_set(v_auto.mapa,'{automation,blocks}',v_blocks,true);
    v_valid:=public.automacao_validar_mapa(v_map);
    if coalesce((v_valid->>'ok')::boolean,false) is not true then
      raise exception 'AUTOMATION_INVALID: %: %',v_auto.nome,v_valid->'erros';
    end if;
    select coalesce(max(versao),0)+1 into v_version
      from public.automacao_versoes where automacao_id=v_auto.id;
    insert into public.automacao_versoes(
      automacao_id,versao,nome,mapa,observacao,criado_por
    ) values(
      v_auto.id,v_version,v_auto.nome,v_map,
      case
        when r.id in (65,66) then 'Produto atual substitui tags antigas no bloco explicito; abordagem aceita captacao nova com conversa anterior'
        when r.id=64 then 'Sara explicita; regra diaria e deduplicacao publicadas no gatilho'
        else 'Sara explicita no bloco de IA; aplicacao permanece em bloco separado'
      end,
      'migration:20260824143230'
    ) returning id into v_version_id;
    update public.automacoes
       set mapa=v_map,mapa_rascunho=v_map,versao_publicada_id=v_version_id,
           status='publicado',publicado_em=now(),atualizada_em=now()
     where id=v_auto.id;
  end loop;
end
$publish_maps$;

-- Repara somente os leads frescos das duas campanhas e somente as tags de
-- produto legado conhecidas. Tags operacionais (respondeu, sem resposta,
-- visita etc.) permanecem intactas.
with alvo as (
  select distinct l.id,l.extras->>'automacao_origem' origem
    from public.f2_lead f
    join public.negocios n on n.id=f.origem_negocio_id
    join public.leads l on l.id=n.lead_id
   where f.descartado_em is null
     and f.criado_em>='2026-08-20'::timestamptz
     and l.extras->>'automacao_origem' in ('Entrada Adelmo','Entrada Miruna')
), limpo as (
  select a.id,a.origem,coalesce(jsonb_agg(e.value order by e.ord)
    filter(where lower(btrim(coalesce(e.value->>'name',''))) not in (
      'aquário','grc | carinas','composite | nr','disparo jazz','miruna 603',
      'produto: ap moema','produto: my one campo belo'
    ) and not (
      (a.origem='Entrada Adelmo' and lower(btrim(e.value->>'name'))='miruna')
      or (a.origem='Entrada Miruna' and lower(btrim(e.value->>'name'))='adelmo 2100')
    )),'[]'::jsonb) tags
    from alvo a join public.leads l on l.id=a.id
    left join lateral jsonb_array_elements(
      case when jsonb_typeof(l.tags)='array' then l.tags else '[]'::jsonb end
    ) with ordinality e(value,ord) on true
   group by a.id,a.origem
)
update public.leads l set tags=limpo.tags
  from limpo where l.id=limpo.id;

with alvo as (
  select distinct l.id,l.extras->>'automacao_origem' origem
    from public.f2_lead f
    join public.negocios n on n.id=f.origem_negocio_id
    join public.leads l on l.id=n.lead_id
   where f.descartado_em is null
     and f.criado_em>='2026-08-20'::timestamptz
     and l.extras->>'automacao_origem' in ('Entrada Adelmo','Entrada Miruna')
)
update public.leads l
   set tags=(case when jsonb_typeof(l.tags)='array' then l.tags else '[]'::jsonb end)
     ||jsonb_build_object(
       'id',gen_random_uuid()::text,
       'name',case when a.origem='Entrada Adelmo' then 'Adelmo 2100' else 'MIRUNA' end,
       'color','#FF7000','createdAt',now(),'description',''
     )
  from alvo a
 where l.id=a.id
   and not exists(
     select 1 from jsonb_array_elements(
       case when jsonb_typeof(l.tags)='array' then l.tags else '[]'::jsonb end
     ) e
      where lower(btrim(e->>'name'))=lower(
        case when a.origem='Entrada Adelmo' then 'Adelmo 2100' else 'MIRUNA' end
      )
   );

-- A Sara real passa a ser o agente dos tres mapas. O modelo Sol e o esforco
-- baixo melhoram classificacao sem estourar a janela sincrona do motor.
insert into public.agente_versoes(
  agente_id,versao,snapshot,status,autor,notas,criado_em
)
select a.id,a.versao_atual,
       jsonb_build_object('modelo',a.modelo,'config',a.config,'status',a.status,
                          'system_prompt',a.system_prompt),
       'backup','migration:20260824143230',
       'Backup antes de publicar a Sara como avaliadora deterministica da Central',now()
  from public.agentes_ia a where a.id=16;

update public.agentes_ia
   set modelo='gpt-5.6-sol',
       status='publicado',
       config=coalesce(config,'{}'::jsonb)||jsonb_build_object(
         'max_tokens',1200,'temperatura',0,'reasoning_effort','low'
       ),
       versao_atual=versao_atual+1,
       atualizado_em=now()
 where id=16 and slug='sara';

-- A varredura le as regras do gatilho publicado e deduplica por card e data
-- local. Nenhum criterio de classificacao e executado aqui.
create or replace function public.sara_checagem_diaria(p_limite integer default null)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $fn$
declare
  v_n integer:=0; r record; v_auto_id bigint; v_opts jsonb;
  v_intervalo integer; v_atraso integer; v_lote integer; v_tz text;
  v_dia text;
begin
  select au.id,t->'options' into v_auto_id,v_opts
    from public.automacoes au
    cross join lateral jsonb_array_elements(au.mapa#>'{automation,blocks}') b
    cross join lateral jsonb_array_elements(coalesce(b#>'{options,triggers}','[]'::jsonb)) t
   where au.ativa is true and au.status='publicado'
     and coalesce(au.arquivada,false) is false
     and t->>'name'='checagem-diaria-trigger'
   order by au.id limit 1;
  if v_auto_id is null then
    return jsonb_build_object('ok',true,'disparos_na_central',0,'motivo','gatilho_nao_publicado');
  end if;
  v_intervalo:=greatest(1,least(coalesce(nullif(v_opts->>'intervaloHoras','')::integer,24),168));
  v_atraso:=greatest(0,least(coalesce(nullif(v_opts->>'atrasoInteracaoMinutos','')::integer,10),1440));
  v_lote:=greatest(1,least(coalesce(p_limite,nullif(v_opts->>'limitePorCiclo','')::integer,12),50));
  v_tz:=coalesce(nullif(v_opts->>'timezone',''),'America/Sao_Paulo');
  v_dia:=to_char(clock_timestamp() at time zone v_tz,'YYYY-MM-DD');

  for r in
    select f.id,f.momento_codigo,coalesce(l.nome,f.nome) nome,
           coalesce(l.telefone,f.telefone) tel,l.email,
           s.ultima_interacao,a.ultima_consulta_em
      from public.f2_lead f
      left join public.negocios ng on ng.id=f.origem_negocio_id
      left join public.leads l on l.id=ng.lead_id
      left join public.sla_msg_cache s on s.lead_id=ng.lead_id
      left join lateral(
        select sa.ultima_consulta_em from public.f2_sara_analise sa
         where sa.funil_lead_id=f.id order by sa.ultima_consulta_em desc limit 1
      ) a on true
     where public.f2_lead_automatico_elegivel(f.id)
       and (
         (a.ultima_consulta_em is null
           and coalesce(s.ultima_interacao,f.criado_em)<=now()-make_interval(mins=>v_atraso))
         or (s.ultima_interacao>a.ultima_consulta_em
           and s.ultima_interacao<=now()-make_interval(mins=>v_atraso))
         or a.ultima_consulta_em<=now()-make_interval(hours=>v_intervalo)
       )
       and not exists(
         select 1 from public.motor_fila mf
          where mf.automacao_id=v_auto_id
            and mf.lead->>'__funil_lead_id'=f.id::text
            and mf.lead->>'__sara_daily_key'=v_dia
       )
     order by (s.ultima_interacao>a.ultima_consulta_em) desc nulls last,
              a.ultima_consulta_em nulls first,f.criado_em
     limit v_lote
  loop
    v_n:=v_n+public.motor_evento_disparar('checagem-diaria-trigger',
      jsonb_build_object(
        'nome',r.nome,'telefone',coalesce(r.tel,''),'email',coalesce(r.email,''),
        '__funil_lead_id',r.id,'__motor_priority',20,
        '__motor_evento','checagem_diaria','__sara_daily_key',v_dia
      ),r.momento_codigo);
  end loop;
  return jsonb_build_object(
    'ok',true,'disparos_na_central',v_n,'automacao_id',v_auto_id,
    'regra',jsonb_build_object('intervalo_horas',v_intervalo,
      'atraso_interacao_minutos',v_atraso,'limite',v_lote,
      'deduplicacao','card-dia-local','dia_local',v_dia)
  );
end
$fn$;

revoke all on function public.sara_checagem_diaria(integer)
  from public,anon,authenticated;
grant execute on function public.sara_checagem_diaria(integer) to service_role;

do $verify$
declare v_map jsonb;
begin
  if (select exigir_feedback_visita from public.ncrm_operacao_config where id) then
    raise exception 'feedback de visita ainda ligado';
  end if;
  if position('motor_abordagem_preflight_execucao' in pg_get_functiondef(
    'public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)'::regprocedure
  ))=0 then raise exception 'preflight canonico ausente'; end if;
  if position('ncrm_bloqueia_abordagem_automatica' in pg_get_functiondef(
    'public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)'::regprocedure
  ))>0 then raise exception 'trava legada ainda presente no emissor'; end if;
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (select 1 from public.automacoes where id=64) then
    return;
  end if;
  select mapa into v_map from public.automacoes where id=64;
  if not exists(
    select 1 from jsonb_array_elements(v_map#>'{automation,blocks}') b
     where b->>'type'='ai-agent' and b#>>'{options,agenteId}'='16'
  ) then raise exception 'checagem diaria nao chama Sara'; end if;
  if not exists(
    select 1 from jsonb_array_elements(v_map#>'{automation,blocks}') b,
         lateral jsonb_array_elements(coalesce(b#>'{options,triggers}','[]'::jsonb)) t
     where t->>'name'='checagem-diaria-trigger'
       and t#>>'{options,deduplicacao}'='card-dia-local'
  ) then raise exception 'regra diaria nao esta publicada'; end if;
  if (select modelo from public.agentes_ia where id=16)<>'gpt-5.6-sol' then
    raise exception 'Sara nao foi atualizada';
  end if;
end
$verify$;

commit;
