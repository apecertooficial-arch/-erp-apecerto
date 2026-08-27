-- Central de Automacoes: origem do lead e notificacao do dono final.
--
-- 1. A automacao Entrada Adelmo passa a persistir a origem recebida do Meta e
--    adicionar tags antes da distribuicao.
-- 2. A notificacao de primeira abordagem nasce no evento do Funil 2.0, com a
--    identidade do proprietario final. Mudanca de dono resolve o aviso antigo
--    e cria outro aviso, com outra chave idempotente.
-- 3. O transporte de push nao reinterpreta presenca: ele apenas entrega o aviso
--    que o modulo de notificacao recebeu.
-- 4. O cron que criava avisos atrasados e potencialmente obsoletos e removido.

begin;

create or replace function ncrm_private.f2_notificar_primeira_abordagem()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_negocio_id bigint;
  v_corretor_id bigint;
  v_corretor text;
  v_lead_id bigint;
  v_lead text;
  v_origem text;
  v_campanha text;
  v_abordagem text;
  v_detalhe text;
  v_link text;
  v_chave_cor text;
  v_chave_ges text;
begin
  if tg_op='DELETE' then
    v_id:=old.id;
    update public.ncrm_notificacao
       set resolvida_em=coalesce(resolvida_em,now()),
           resolvida_por=coalesce(resolvida_por,'automatica_f2')
     where resolvida_em is null
       and (chave like 'f2-novo:'||v_id::text||'%'
            or chave like 'f2novo:'||v_id::text||'%');
    return old;
  end if;

  v_id:=new.id;
  v_negocio_id:=new.origem_negocio_id;
  v_corretor_id:=new.corretor_id;

  if new.etapa<>'novo'
     or new.ultima_acao_confirmada_em is not null
     or v_corretor_id is null then
    update public.ncrm_notificacao
       set resolvida_em=coalesce(resolvida_em,now()),
           resolvida_por=coalesce(resolvida_por,'automatica_f2')
     where resolvida_em is null
       and (chave like 'f2-novo:'||v_id::text||'%'
            or chave like 'f2novo:'||v_id::text||'%');
    return new;
  end if;

  select c.nome into v_corretor
    from public.corretores c where c.id=v_corretor_id;

  select n.lead_id,l.nome,
         coalesce(nullif(l.extras->>'automacao_origem',''),nullif(l.origem,''),'nao informada'),
         nullif(l.extras->>'meta_campaign_name',''),
         case
           when nullif(l.extras->>'abordagem_nome','') is not null
             then l.extras->>'abordagem_nome'
           when l.extras->>'abordagem_status'='nao_cadastrada'
             then 'NAO CADASTRADA'
           else null
         end
    into v_lead_id,v_lead,v_origem,v_campanha,v_abordagem
    from public.negocios n
    join public.leads l on l.id=n.lead_id
   where n.id=v_negocio_id;

  if v_campanha is null and v_lead_id is not null then
    select nullif(regexp_replace(e->>'name','^Campanha:\s*','','i'),'')
      into v_campanha
      from public.leads l
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(l.tags)='array' then l.tags else '[]'::jsonb end
      ) e
     where l.id=v_lead_id and e->>'name' ilike 'Campanha:%'
     limit 1;
  end if;

  if v_abordagem is null and v_lead_id is not null then
    select nullif(regexp_replace(e->>'name','^Abordagem:\s*','','i'),'')
      into v_abordagem
      from public.leads l
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(l.tags)='array' then l.tags else '[]'::jsonb end
      ) e
     where l.id=v_lead_id and e->>'name' ilike 'Abordagem:%'
     limit 1;
  end if;

  v_corretor:=coalesce(v_corretor,'#'||v_corretor_id::text);
  v_lead:=coalesce(nullif(v_lead,''),'Lead #'||coalesce(v_lead_id::text,'?'));
  v_campanha:=coalesce(v_campanha,'nao informada');
  v_abordagem:=coalesce(v_abordagem,'NAO INFORMADA');
  v_link:=case when v_negocio_id is null then '/notificacoes'
               else '/negocio/'||v_negocio_id::text end;
  v_detalhe:='Responsavel final: '||v_corretor||
             ' · Origem: '||v_origem||
             ' · Campanha: '||v_campanha||
             ' · Abordagem: '||v_abordagem;
  v_chave_cor:='f2-novo:'||v_id::text||':cor:'||v_corretor_id::text;
  v_chave_ges:='f2-novo:'||v_id::text||':ges:'||v_corretor_id::text;

  -- Fecha qualquer aviso aberto de um proprietario anterior, inclusive chaves
  -- legadas que nao carregavam o corretor.
  update public.ncrm_notificacao
     set resolvida_em=coalesce(resolvida_em,now()),
         resolvida_por=coalesce(resolvida_por,'troca_dono_f2')
   where resolvida_em is null
     and (chave like 'f2-novo:'||v_id::text||'%'
          or chave like 'f2novo:'||v_id::text||'%')
     and chave not in (v_chave_cor,v_chave_ges);

  insert into public.ncrm_notificacao
    (chave,tipo,publico,prioridade,titulo,detalhe,negocio_id,
     corretor_id,deep_link,repeticoes)
  values
    (v_chave_cor,'primeira_abordagem_pendente','corretor',1,
     'Novo lead · '||v_lead,v_detalhe||' · Faca a primeira abordagem.',
     v_negocio_id,v_corretor_id,v_link,0),
    (v_chave_ges,'primeira_abordagem_pendente','gestao',1,
     v_lead||' → '||v_corretor,v_detalhe,
     v_negocio_id,v_corretor_id,v_link,0)
  on conflict (chave) where resolvida_em is null do update
     set titulo=excluded.titulo,
         detalhe=excluded.detalhe,
         negocio_id=excluded.negocio_id,
         corretor_id=excluded.corretor_id,
         deep_link=excluded.deep_link;

  begin
    perform ncrm_private.push_enfileirar(200);
  exception when others then
    raise warning 'f2_push_enfileirar_falhou: %',sqlerrm;
  end;
  return new;
end
$function$;

revoke all on function ncrm_private.f2_notificar_primeira_abordagem()
  from public,anon,authenticated;

-- O push entrega o contrato recebido. Ele nao escolhe corretor e nao reavalia
-- presenca depois que a distribuicao terminou.
do $patch_push$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='ncrm_private' and p.proname='push_enfileirar'
     and pg_get_function_identity_arguments(p.oid)='p_limite integer';
  if v_def is null then raise exception 'push_enfileirar ausente'; end if;

  v_new:=replace(v_def,
    $old$WHEN 'primeira_abordagem_pendente' THEN 'Um lead novo esta esperando'$old$,
    $new$WHEN 'primeira_abordagem_pendente' THEN coalesce(nullif(n.detalhe,''),'Um lead novo esta esperando')$new$);
  v_new:=replace(v_new,
    $old$     -- aviso de lead novo so para quem esta apto: quem nao pode atender
     -- perderia o lead de qualquer jeito
     AND (n.tipo <> 'primeira_abordagem_pendente'
          OR (public.ncrm_corretor_elegibilidade(c.id, now())->>'elegivel')::boolean IS TRUE)
$old$,
    E'');
  v_new:=replace(v_new,
    $old$THEN coalesce('Entrou para '||cn.nome, 'Um lead novo esta esperando no funil')$old$,
    $new$THEN coalesce(nullif(n.detalhe,''),'Entrou para '||cn.nome,'Um lead novo esta esperando no funil')$new$);

  if v_new=v_def
     or position('nullif(n.detalhe' in v_new)=0
     or position('ncrm_corretor_elegibilidade(c.id, now())' in v_new)>0 then
    raise exception 'patch deterministico do push nao aplicado';
  end if;
  execute v_new;
end
$patch_push$;

-- O produtor por cron deixa de tomar decisoes de negocio. Mantemos a funcao
-- como no-op por compatibilidade com chamadas antigas.
select cron.unschedule(jobid)
  from cron.job where jobname='f2_notificacoes_sincronizar';

create or replace function public.f2_notificacoes_sincronizar()
returns jsonb
language sql
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'ok',true,
    'desativada',true,
    'motivo','notificacao_em_tempo_real_pelo_proprietario_final'
  );
$function$;

-- Publica uma nova versao da Entrada Adelmo com campos de rastreamento e um
-- bloco atomico de tags antes da distribuicao.
do $publicar_adelmo$
declare
  v_auto_id bigint;
  v_nome text;
  v_mapa jsonb;
  v_blocks jsonb;
  v_field_id text;
  v_dist_id text;
  v_versao integer;
  v_versao_id bigint;
  v_validacao jsonb;
  v_tag text;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (select 1 from public.automacoes where nome='Entrada Adelmo') then
    return;
  end if;
  select id,nome,mapa into v_auto_id,v_nome,v_mapa
    from public.automacoes
   where nome='Entrada Adelmo' and ativa is true and arquivada is false
   for update;
  if v_auto_id is null then raise exception 'Entrada Adelmo ativa nao encontrada'; end if;

  select b->>'id' into v_dist_id
    from jsonb_array_elements(v_mapa->'automation'->'blocks') b
   where b->>'type' like 'distribution%'
   limit 1;
  select b->>'id' into v_field_id
    from jsonb_array_elements(v_mapa->'automation'->'blocks') b
   where b->>'type'='field-operation'
   limit 1;
  if v_field_id is null or v_dist_id is null then
    raise exception 'blocos de campos/distribuicao da Entrada Adelmo ausentes';
  end if;
  if exists(select 1 from jsonb_array_elements(v_mapa->'automation'->'blocks') b
            where b->>'id'='b-tags-origem') then
    raise exception 'bloco b-tags-origem ja existe';
  end if;

  select jsonb_agg(
    case when b->>'id'=v_field_id then
      jsonb_set(
        jsonb_set(b,'{options,nextBlockId}',to_jsonb('b-tags-origem'::text),true),
        '{options,fieldOperations}',
        coalesce(b#>'{options,fieldOperations}','[]'::jsonb)||jsonb_build_array(
          jsonb_build_object('name','set-field-operation','group','field','stepId','adelmo-campaign',
            'options',jsonb_build_object('parameter','additional-field[meta_campaign_name]','value','[Api-request-1]meta_campaign_name')),
          jsonb_build_object('name','set-field-operation','group','field','stepId','adelmo-adset',
            'options',jsonb_build_object('parameter','additional-field[meta_adset_name]','value','[Api-request-1]meta_adset_name')),
          jsonb_build_object('name','set-field-operation','group','field','stepId','adelmo-ad',
            'options',jsonb_build_object('parameter','additional-field[meta_ad_name]','value','[Api-request-1]meta_ad_name')),
          jsonb_build_object('name','set-field-operation','group','field','stepId','adelmo-automation',
            'options',jsonb_build_object('parameter','additional-field[automacao_origem]','value','Entrada Adelmo')),
          jsonb_build_object('name','set-field-operation','group','field','stepId','adelmo-approach-status',
            'options',jsonb_build_object('parameter','additional-field[abordagem_status]','value','nao_cadastrada'))
        ),true
      )
    else b end order by ord
  ) into v_blocks
  from jsonb_array_elements(v_mapa->'automation'->'blocks') with ordinality x(b,ord);

  v_blocks:=v_blocks||jsonb_build_array(jsonb_build_object(
    'id','b-tags-origem','type','action',
    'options',jsonb_build_object(
      'actions',jsonb_build_array(
        jsonb_build_object('name','add-tag-action','group','Leads','options',jsonb_build_object('tag','Origem: Meta Lead Ads')),
        jsonb_build_object('name','add-tag-action','group','Leads','options',jsonb_build_object('tag','Automacao: Adelmo')),
        jsonb_build_object('name','add-tag-action','group','Leads','options',jsonb_build_object('tag','Campanha: {meta_campaign_name}')),
        jsonb_build_object('name','add-tag-action','group','Leads','options',jsonb_build_object('tag','Conjunto: {meta_adset_name}')),
        jsonb_build_object('name','add-tag-action','group','Leads','options',jsonb_build_object('tag','Anuncio: {meta_ad_name}')),
        jsonb_build_object('name','add-tag-action','group','Leads','options',jsonb_build_object('tag','Abordagem: NAO CADASTRADA'))
      ),
      'nextBlockId',v_dist_id,'errorNextBlockId',''
    ),
    'presentation',jsonb_build_object('x',700,'y',101),
    'sourceBlockId','c7ec5e81-0c64-45c1-a6a1-000000000065'
  ));
  v_mapa:=jsonb_set(v_mapa,'{automation,blocks}',v_blocks,true);

  v_validacao:=public.automacao_validar_mapa(v_mapa);
  if coalesce((v_validacao->>'ok')::boolean,false) is not true then
    raise exception 'Entrada Adelmo invalida: %',v_validacao->'erros';
  end if;

  select coalesce(max(versao),0)+1 into v_versao
    from public.automacao_versoes where automacao_id=v_auto_id;
  insert into public.automacao_versoes(
    automacao_id,versao,nome,mapa,observacao,criado_por
  ) values (
    v_auto_id,v_versao,v_nome,v_mapa,
    'Tags de origem e abordagem antes da distribuicao','migration'
  ) returning id into v_versao_id;

  update public.automacoes
     set mapa=v_mapa,mapa_rascunho=v_mapa,
         versao_publicada_id=v_versao_id,status='publicado',
         publicado_em=now(),atualizada_em=now()
   where id=v_auto_id;

  -- Backfill somente dos leads que efetivamente entraram pela Entrada Adelmo.
  -- Preserva todas as tags existentes.
  for v_mapa in
    select distinct on ((f.lead->>'__lead_id')::bigint) f.lead
      from public.automacao_eventos_entrada e
      join public.motor_fila f on f.id=e.fila_id
     where e.automacao_id=v_auto_id
       and f.lead->>'__lead_id' ~ '^\d+$'
     order by ((f.lead->>'__lead_id')::bigint),e.criado_em desc
  loop
    update public.leads l
       set extras=coalesce(l.extras,'{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object(
             'automacao_origem','Entrada Adelmo',
             'meta_campaign_name',nullif(v_mapa->>'meta_campaign_name',''),
             'meta_adset_name',nullif(v_mapa->>'meta_adset_name',''),
             'meta_ad_name',nullif(v_mapa->>'meta_ad_name',''),
             'abordagem_status','nao_cadastrada'
           )),
           atualizado_em=now()
     where l.id=(v_mapa->>'__lead_id')::bigint;

    for v_tag in
      select nome from (values
        ('Origem: Meta Lead Ads'),
        ('Automacao: Adelmo'),
        ('Campanha: '||nullif(v_mapa->>'meta_campaign_name','')),
        ('Conjunto: '||nullif(v_mapa->>'meta_adset_name','')),
        ('Anuncio: '||nullif(v_mapa->>'meta_ad_name','')),
        ('Abordagem: NAO CADASTRADA')
      ) nomes(nome)
      where nome is not null
    loop
      update public.leads l
         set tags=coalesce(
               case when jsonb_typeof(l.tags)='array' then l.tags end,
               '[]'::jsonb
             )||jsonb_build_object(
               'id',gen_random_uuid()::text,'name',v_tag,'color','#FF7000',
               'createdAt',now(),'description',''
             ),
             atualizado_em=now()
       where l.id=(v_mapa->>'__lead_id')::bigint
         and not exists(
           select 1 from jsonb_array_elements(
             case when jsonb_typeof(l.tags)='array' then l.tags else '[]'::jsonb end
           ) e where lower(e->>'name')=lower(v_tag)
         );
    end loop;
  end loop;
end
$publicar_adelmo$;

do $verify$
declare
  v_auto_id bigint;
  v_mapa jsonb;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (select 1 from public.automacoes where nome='Entrada Adelmo') then
    return;
  end if;
  select id,mapa into v_auto_id,v_mapa from public.automacoes where nome='Entrada Adelmo';
  if coalesce((public.automacao_validar_mapa(v_mapa)->>'ok')::boolean,false) is not true then
    raise exception 'mapa publicado da Entrada Adelmo invalido';
  end if;
  if not exists(select 1 from jsonb_array_elements(v_mapa->'automation'->'blocks') b
                where b->>'id'='b-tags-origem') then
    raise exception 'bloco de tags nao publicado';
  end if;
  if exists(select 1 from cron.job where jobname='f2_notificacoes_sincronizar') then
    raise exception 'cron legado de notificacoes ainda ativo';
  end if;
end
$verify$;

commit;
