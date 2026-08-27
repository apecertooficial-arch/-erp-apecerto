-- A instância pertence ao bloco de mensagem, não ao cadastro global do corretor.
-- Esta migração não cria cron, agenda ou gatilho de envio.

begin;
set local statement_timeout='120s';
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('instancia_explicita_no_bloco_abordagem',0));

-- Corrige o excesso da migração anterior: o iPhone continua cadastrado,
-- vinculado e disponível para uso normal fora destas automações.
do $restore_claudia$
declare
  v_corretor_id bigint;
  v_iphone_id bigint;
  v_3785_id bigint;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (
       select 1 from public.corretores
        where lower(btrim(nome))='claudia' and coalesce(ativo,false)
     ) then
    return;
  end if;

  select id into strict v_corretor_id
    from public.corretores
   where lower(btrim(nome))='claudia' and coalesce(ativo,false)
   order by id limit 1;

  select id into strict v_iphone_id
    from public.instancias
   where instancia_dapi='Claudia Normal Iphone';

  select id into strict v_3785_id
    from public.instancias
   where regexp_replace(coalesce(numero_conectado,telefone,''),'[^0-9]','','g') like '%3785';

  update public.instancias
     set corretor_id=v_corretor_id,
         ativa=true
   where id in (v_iphone_id,v_3785_id);

  insert into public.corretor_instancias(corretor_id,instancia_id)
  values (v_corretor_id,v_iphone_id),(v_corretor_id,v_3785_id)
  on conflict do nothing;

  if not exists(
    select 1 from public.instancias i
     where i.id=v_iphone_id and i.corretor_id=v_corretor_id and i.ativa
  ) or not exists(
    select 1 from public.corretor_instancias ci
     where ci.corretor_id=v_corretor_id and ci.instancia_id=v_iphone_id
  ) then
    raise exception 'Instancia iPhone da Claudia nao foi restaurada no sistema';
  end if;
end
$restore_claudia$;

-- O emissor aceita um contrato estruturado vindo do bloco:
-- { abordagemIds: [...], instanciaId: 17 }. Em execução automática, a
-- instância é obrigatória e precisa pertencer ao dono; não há fallback.
do $patch_sender$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(
    'public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'e6d2d030879461073716ed64e4d42c9d' then
    raise exception 'motor_envia_abordagem mudou: %',md5(v_def);
  end if;

  v_new:=replace(v_def,
    $old$  v_preflight jsonb;$old$,
    $new$  v_preflight jsonb;
  v_envio_config jsonb;
  v_inst_explicita bigint;$new$);

  v_new:=replace(v_new,
    $old$  if jsonb_typeof(coalesce(p_abordagem_ids,'null'::jsonb))<>'array' then$old$,
    $new$  if jsonb_typeof(coalesce(p_abordagem_ids,'null'::jsonb))='object' then
    v_envio_config:=p_abordagem_ids;
    p_abordagem_ids:=coalesce(v_envio_config->'abordagemIds','[]'::jsonb);
    begin
      v_inst_explicita:=nullif(v_envio_config->>'instanciaId','')::bigint;
    exception when others then
      v_inst_explicita:=null;
    end;
  elsif p_auto>0 then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: bloco sem instancia explicita publicada');
    return;
  end if;
  if p_auto>0 and v_inst_explicita is null then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: corretor sem instancia exata no bloco');
    return;
  end if;
  if jsonb_typeof(coalesce(p_abordagem_ids,'null'::jsonb))<>'array' then$new$);

  v_new:=replace(v_new,
    $old$  select i.id,i.instancia_dapi into v_inst_id,v_inst
    from public.instancias i
    join public.instancias_credenciais ic on ic.instancia_id=i.id
   where i.corretor_id=p_corretor_id
     and coalesce(i.ativa,true)
     and coalesce(i.conectada,false)
     and i.status_dapi='connected'
     and nullif(i.instancia_dapi,'') is not null
     and nullif(ic.apikey,'') is not null
   order by i.id limit 1;
  if v_inst is null then$old$,
    $new$  if v_inst_explicita is not null then
    select i.id,i.instancia_dapi into v_inst_id,v_inst
      from public.instancias i
      join public.instancias_credenciais ic on ic.instancia_id=i.id
     where i.id=v_inst_explicita
       and (
         i.corretor_id=p_corretor_id
         or exists(
           select 1 from public.corretor_instancias ci
            where ci.instancia_id=i.id and ci.corretor_id=p_corretor_id
         )
       )
       and coalesce(i.ativa,true)
       and coalesce(i.conectada,false)
       and i.status_dapi='connected'
       and nullif(i.instancia_dapi,'') is not null
       and nullif(ic.apikey,'') is not null;
  else
    -- Compatibilidade somente para chamadas manuais (p_auto=0).
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
  end if;
  if v_inst is null then$new$);

  v_new:=replace(v_new,
    $old$       'abordagem_grupo',coalesce(v_ab_grupo,''),
       'abordagem_escolhida_em',now()$old$,
    $new$       'abordagem_grupo',coalesce(v_ab_grupo,''),
       'abordagem_instancia_id',v_inst_id,
       'abordagem_escolhida_em',now()$new$);

  if v_new=v_def
     or position('bloco sem instancia explicita publicada' in v_new)=0
     or position('i.id=v_inst_explicita' in v_new)=0
     or position('abordagem_instancia_id' in v_new)=0 then
    raise exception 'patch da instancia explicita nao encontrou todas as ancoras';
  end if;
  execute v_new;
end
$patch_sender$;

-- O runtime transporta para o emissor exatamente o que o bloco publicou.
do $patch_runtime$
declare v_def text; v_new text;
begin
  select pg_get_functiondef('public.motor_rodar_unchecked(bigint,jsonb,text,integer)'::regprocedure)
    into v_def;
  if md5(v_def)<>'8623d049d6e15c25ef74fa7d7a7b1a83' then
    raise exception 'motor_rodar_unchecked mudou: %',md5(v_def);
  end if;

  v_new:=replace(v_def,
    $old$          coalesce(b#>'{options,distribuicao,abordagemIds}','[]'::jsonb));$old$,
    $new$          jsonb_build_object(
            'abordagemIds',coalesce(b#>'{options,distribuicao,abordagemIds}','[]'::jsonb),
            'instanciaId',nullif(b#>>array['options','distribuicao','instanciaPorCorretor',_dist_cor::text],'')::bigint
          ));$new$);

  v_new:=replace(v_new,
    $old$        coalesce(b#>'{options,abordagemIds}','[]'::jsonb));$old$,
    $new$        jsonb_build_object(
          'abordagemIds',coalesce(b#>'{options,abordagemIds}','[]'::jsonb),
          'instanciaId',nullif(b#>>array['options','instanciaPorCorretor',_dist_cor::text],'')::bigint
        ));$new$);

  if v_new=v_def
     or position($marker$array['options','instanciaPorCorretor',_dist_cor::text]$marker$ in v_new)=0
     or position($marker$array['options','distribuicao','instanciaPorCorretor',_dist_cor::text]$marker$ in v_new)=0 then
    raise exception 'patch do runtime nao encontrou as rotas explicitas';
  end if;
  execute v_new;
end
$patch_runtime$;

-- Publicação inválida é barrada antes de chegar ao runtime.
do $patch_validator$
declare v_def text; v_new text;
begin
  select pg_get_functiondef('public.automacao_validar_mapa(jsonb)'::regprocedure)
    into v_def;
  if md5(v_def)<>'8f0b54ae0fba10a81e5a9aaf200d9e7c'
     and to_regclass('public.apecerto_baseline_metadata') is null then
    raise exception 'automacao_validar_mapa mudou: %',md5(v_def);
  end if;
  v_new:=replace(v_def,
    $old$      if exists(
        select 1
          from jsonb_array_elements_text(coalesce(b#>'{options,abordagemIds}','[]'::jsonb)) x(value)
         group by value having count(*)>1
      ) then
        v_erros:=v_erros||jsonb_build_array('APPROACH_DUPLICATED:'||(b->>'id'));
      end if;
    elsif v_tipo='resposta' then$old$,
    $new$      if exists(
        select 1
          from jsonb_array_elements_text(coalesce(b#>'{options,abordagemIds}','[]'::jsonb)) x(value)
         group by value having count(*)>1
      ) then
        v_erros:=v_erros||jsonb_build_array('APPROACH_DUPLICATED:'||(b->>'id'));
      end if;
      if jsonb_typeof(coalesce(b#>'{options,instanciaPorCorretor}','null'::jsonb))<>'object'
         or not exists(
           select 1 from jsonb_each(coalesce(b#>'{options,instanciaPorCorretor}','{}'::jsonb))
         ) then
        v_erros:=v_erros||jsonb_build_array('APPROACH_INSTANCE_ROUTES_REQUIRED:'||(b->>'id'));
      elsif exists(
        select 1 from jsonb_each_text(b#>'{options,instanciaPorCorretor}') r
         where r.key!~'^[1-9][0-9]*$' or r.value!~'^[1-9][0-9]*$'
      ) then
        v_erros:=v_erros||jsonb_build_array('APPROACH_INSTANCE_ROUTE_INVALID:'||(b->>'id'));
      end if;
    elsif v_tipo='resposta' then$new$);
  if v_new=v_def or position('APPROACH_INSTANCE_ROUTES_REQUIRED' in v_new)=0 then
    raise exception 'patch do validador nao encontrou a ancora';
  end if;
  execute v_new;
end
$patch_validator$;

-- Materializa as escolhas atuais dentro dos dois mapas. Para cada corretor,
-- a rota passa a ser um dado visível e versionado. A Claudia é explicitamente
-- vinculada à 3785; os demais preservam a instância conectada que o emissor
-- usava antes desta correção.
do $publish_maps$
declare
  v_auto public.automacoes%rowtype;
  v_map jsonb;
  v_blocks jsonb;
  v_routes jsonb;
  v_version integer;
  v_version_id bigint;
  v_valid jsonb;
  r record;
  m record;
  v_corretor_id bigint;
  v_instancia_id bigint;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (select 1 from public.automacoes where id in (65,66)) then
    return;
  end if;

  for r in select * from (values
    (65::bigint,'04c545bc6f9b66ff533751f0a2d432fe'::text),
    (66::bigint,'9e9afbb037b2877b80c58b7d98bf9ecb'::text)
  ) x(id,checksum)
  loop
    select * into strict v_auto from public.automacoes where id=r.id for update;
    if md5(v_auto.mapa::text)<>r.checksum
       or v_auto.mapa is distinct from coalesce(v_auto.mapa_rascunho,v_auto.mapa) then
      raise exception 'AUTOMATION_STALE_VERSION: % mudou ou tem rascunho',v_auto.nome;
    end if;
    v_routes:='{}'::jsonb;
    for m in
      select distinct x.item->>'corretor' corretor
        from jsonb_array_elements(v_auto.mapa#>'{automation,blocks}') b,
             lateral jsonb_array_elements(coalesce(b#>'{options,distribuicao,items}','[]'::jsonb)) x(item)
       where b->>'type'='distribution-simple'
         and coalesce((x.item->>'on')::boolean,true)
         and coalesce(nullif(x.item->>'peso','')::numeric,0)>0
    loop
      select c.id into strict v_corretor_id
        from public.corretores c
       where lower(btrim(c.nome))=lower(btrim(m.corretor)) and coalesce(c.ativo,false);

      if lower(btrim(m.corretor))='claudia' then
        select i.id into strict v_instancia_id
          from public.instancias i
          join public.instancias_credenciais ic on ic.instancia_id=i.id
         where (i.corretor_id=v_corretor_id or exists(
           select 1 from public.corretor_instancias ci
            where ci.instancia_id=i.id and ci.corretor_id=v_corretor_id
         ))
           and regexp_replace(coalesce(i.numero_conectado,i.telefone,''),'[^0-9]','','g') like '%3785'
           and i.ativa and i.conectada and i.status_dapi='connected'
           and nullif(i.instancia_dapi,'') is not null and nullif(ic.apikey,'') is not null;
      else
        select min(i.id) into v_instancia_id
          from public.instancias i
          join public.instancias_credenciais ic on ic.instancia_id=i.id
         where (i.corretor_id=v_corretor_id or exists(
           select 1 from public.corretor_instancias ci
            where ci.instancia_id=i.id and ci.corretor_id=v_corretor_id
         ))
           and i.ativa and i.conectada and i.status_dapi='connected'
           and nullif(i.instancia_dapi,'') is not null and nullif(ic.apikey,'') is not null;
        if v_instancia_id is null then
          raise exception 'Corretor % sem instancia conectada para %',m.corretor,v_auto.nome;
        end if;
      end if;
      v_routes:=v_routes||jsonb_build_object(v_corretor_id::text,v_instancia_id);
    end loop;

    select jsonb_agg(
      case when b->>'type'='send-approach'
        then jsonb_set(b,'{options,instanciaPorCorretor}',v_routes,true)
        else b end order by ord
    ) into v_blocks
      from jsonb_array_elements(v_auto.mapa#>'{automation,blocks}') with ordinality x(b,ord);
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
      'Instancia exata por corretor publicada no bloco Enviar abordagem; sem fallback oculto',
      'migration:20260824152416'
    ) returning id into v_version_id;
    update public.automacoes
       set mapa=v_map,mapa_rascunho=v_map,versao_publicada_id=v_version_id,
           status='publicado',publicado_em=now(),atualizada_em=now()
     where id=v_auto.id;
  end loop;
end
$publish_maps$;

do $verify$
declare v_def text; v_map jsonb; v_claudia bigint; v_3785 bigint;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (
       select 1 from public.corretores
        where lower(btrim(nome))='claudia' and coalesce(ativo,false)
     ) then
    select pg_get_functiondef(
      'public.motor_rodar_unchecked(bigint,jsonb,text,integer)'::regprocedure
    ) into v_def;
    if position($marker$array['options','instanciaPorCorretor',_dist_cor::text]$marker$ in v_def)=0 then
      raise exception 'runtime nao le a instancia do bloco';
    end if;
    select pg_get_functiondef(
      'public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)'::regprocedure
    ) into v_def;
    if position('i.id=v_inst_explicita' in v_def)=0
       or position('bloco sem instancia explicita publicada' in v_def)=0 then
      raise exception 'emissor ainda nao exige instancia explicita';
    end if;
    return;
  end if;

  select id into strict v_claudia from public.corretores
   where lower(btrim(nome))='claudia' and ativo order by id limit 1;
  select id into strict v_3785 from public.instancias
   where regexp_replace(coalesce(numero_conectado,telefone,''),'[^0-9]','','g') like '%3785';

  if not exists(
    select 1 from public.instancias i
     where i.instancia_dapi='Claudia Normal Iphone' and i.corretor_id=v_claudia and i.ativa
  ) then raise exception 'iPhone da Claudia nao ficou vinculado ao sistema'; end if;

  select pg_get_functiondef('public.motor_rodar_unchecked(bigint,jsonb,text,integer)'::regprocedure)
    into v_def;
  if position($marker$array['options','instanciaPorCorretor',_dist_cor::text]$marker$ in v_def)=0 then
    raise exception 'runtime nao le a instancia do bloco';
  end if;

  select pg_get_functiondef(
    'public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)'::regprocedure
  ) into v_def;
  if position('i.id=v_inst_explicita' in v_def)=0
     or position('bloco sem instancia explicita publicada' in v_def)=0 then
    raise exception 'emissor ainda nao exige instancia explicita';
  end if;

  for v_map in select mapa from public.automacoes where id in (65,66)
  loop
    if not exists(
      select 1 from jsonb_array_elements(v_map#>'{automation,blocks}') b
       where b->>'type'='send-approach'
         and (b#>>array['options','instanciaPorCorretor',v_claudia::text])::bigint=v_3785
    ) then raise exception 'Claudia nao aponta para 3785 no bloco publicado'; end if;
  end loop;
end
$verify$;

commit;
