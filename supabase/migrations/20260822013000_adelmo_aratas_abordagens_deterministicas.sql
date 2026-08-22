-- Entrada Adelmo: publica um unico modulo de envio para o grupo Aratas.
-- A escolha entre as abordagens e feita pelo contrato round-robin idempotente
-- do modulo send-approach. Esta migracao nao liga o envio automatico.

begin;

do $publish_adelmo_aratas$
declare
  v_auto public.automacoes%rowtype;
  v_map jsonb;
  v_blocks jsonb;
  v_editor_blocks jsonb;
  v_wires jsonb;
  v_abordagem_ids jsonb;
  v_valid jsonb;
  v_version integer;
  v_version_id bigint;
begin
  if coalesce((select ativo from public.motor_flags where nome='abordagem_automatica'),false) then
    raise exception 'ABORDAGEM_AUTOMATICA_DEVE_ESTAR_DESLIGADA';
  end if;

  select coalesce(jsonb_agg(id order by ordem,id),'[]'::jsonb)
    into v_abordagem_ids
    from public.abordagens
   where ativo is true and grupo='Aratãs · AP0348';
  if v_abordagem_ids <> '[27,28,29]'::jsonb then
    raise exception 'ARATAS_APPROACHES_DIVERGED: %',v_abordagem_ids;
  end if;

  select * into strict v_auto
    from public.automacoes
   where nome='Entrada Adelmo'
   for update;
  if md5(v_auto.mapa::text)<>'be4b28bb8e8b27a4792c8701f13e1509' then
    raise exception 'AUTOMATION_STALE_VERSION: Entrada Adelmo mudou antes da publicacao';
  end if;

  select coalesce(jsonb_agg(
    case when b->>'id'='b14'
      then jsonb_set(b,'{options,nextBlockId}',to_jsonb('b17'::text),true)
      else b end order by ord
  ),'[]'::jsonb)
    into v_blocks
    from jsonb_array_elements(v_auto.mapa#>'{automation,blocks}') with ordinality x(b,ord)
   where b->>'id'<>'b17';

  v_blocks:=v_blocks||jsonb_build_array(jsonb_build_object(
    'id','b17','type','send-approach',
    'options',jsonb_build_object(
      'produtoId',0,
      'abordagemGrupo','Aratãs · AP0348',
      'abordagemIds',v_abordagem_ids,
      'selectionMode','round-robin',
      'nextBlockId','',
      'errorNextBlockId',''
    ),
    'presentation',jsonb_build_object('x',1660,'y',100),
    'sourceBlockId',gen_random_uuid()
  ));
  v_map:=jsonb_set(v_auto.mapa,'{automation,blocks}',v_blocks,true);

  v_editor_blocks:=coalesce(v_map#>'{editor,blocks}','{}'::jsonb)-'b17';
  v_editor_blocks:=v_editor_blocks||jsonb_build_object(
    'b17',jsonb_build_object(
      'id','b17','fam','mensagem','sub','','x',1660,'y',100,
      'note','Alterna igualmente as abordagens ativas selecionadas do grupo Aratãs · AP0348 e envia pela instancia do corretor dono.',
      'extra',jsonb_build_object(),'parts',jsonb_build_array(),
      'ramos',jsonb_build_array(),'noteOpen',false
    )
  );
  v_map:=jsonb_set(v_map,'{editor,blocks}',v_editor_blocks,true);

  select coalesce(jsonb_agg(w order by ord),'[]'::jsonb)
    into v_wires
    from jsonb_array_elements(coalesce(v_map#>'{editor,wires}','[]'::jsonb)) with ordinality x(w,ord)
   where coalesce(w->>'from','')<>'b14'
     and coalesce(w->>'from','')<>'b17'
     and coalesce(w->>'to','')<>'b17';
  v_wires:=v_wires||jsonb_build_array(
    jsonb_build_object('from','b14','port','out','to','b17')
  );
  v_map:=jsonb_set(v_map,'{editor,wires}',v_wires,true);

  v_valid:=public.automacao_validar_mapa(v_map);
  if coalesce((v_valid->>'ok')::boolean,false) is not true then
    raise exception 'AUTOMATION_INVALID: Entrada Adelmo: %',v_valid->'erros';
  end if;

  select coalesce(max(versao),0)+1 into v_version
    from public.automacao_versoes where automacao_id=v_auto.id;
  insert into public.automacao_versoes(
    automacao_id,versao,nome,mapa,observacao,criado_por
  ) values (
    v_auto.id,v_version,v_auto.nome,v_map,
    'Um unico bloco Enviar abordagem com alternancia igual no grupo Aratãs · AP0348',
    'migration:20260822013000'
  ) returning id into v_version_id;

  update public.automacoes
     set mapa=v_map,
         mapa_rascunho=v_map,
         versao_publicada_id=v_version_id,
         status='publicado',
         publicado_em=now(),
         atualizada_em=now()
   where id=v_auto.id;
end
$publish_adelmo_aratas$;

do $verify$
declare
  v_map jsonb;
  v_block jsonb;
begin
  select mapa into strict v_map
    from public.automacoes where nome='Entrada Adelmo';
  select b into strict v_block
    from jsonb_array_elements(v_map#>'{automation,blocks}') b
   where b->>'id'='b17' and b->>'type'='send-approach';
  if v_block#>>'{options,abordagemGrupo}'<>'Aratãs · AP0348'
     or v_block#>'{options,abordagemIds}'<>'[27,28,29]'::jsonb
     or v_block#>>'{options,selectionMode}'<>'round-robin'
     or not exists(
       select 1 from jsonb_array_elements(v_map#>'{automation,blocks}') b
        where b->>'id'='b14' and b#>>'{options,nextBlockId}'='b17'
     )
     or coalesce((public.automacao_validar_mapa(v_map)->>'ok')::boolean,false) is not true then
    raise exception 'POSTCONDITION_FAILED: Entrada Adelmo / Aratas';
  end if;
end
$verify$;

commit;
