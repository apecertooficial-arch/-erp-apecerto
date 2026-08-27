-- Publica o envio deterministico da Miruna e corrige o contrato de presenca
-- da distribuicao do Adelmo. O envio global deve permanecer desligado durante
-- esta publicacao; a liberacao operacional acontece somente depois dos testes.

do $migration$
declare
  v_auto public.automacoes%rowtype;
  v_map jsonb;
  v_blocks jsonb;
  v_valid jsonb;
  v_version integer;
  v_version_id bigint;
  v_a1 bigint;
  v_a2 bigint;
  v_a3 bigint;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (
       select 1 from public.automacoes where nome in ('Entrada Miruna','Entrada Adelmo')
     ) then
    return;
  end if;

  if coalesce((select ativo from public.motor_flags where nome='abordagem_automatica'),false) then
    raise exception 'ABORDAGEM_AUTOMATICA_DEVE_ESTAR_DESLIGADA';
  end if;

  select * into strict v_auto
    from public.automacoes
   where nome='Entrada Miruna'
   for update;

  if md5(v_auto.mapa::text)<>'29bdee26e637f7f997edeaa035d67d85' then
    raise exception 'AUTOMATION_STALE_VERSION: Entrada Miruna mudou antes da publicacao';
  end if;

  select
    max(id) filter (where nome='Miruna 603 | 01'),
    max(id) filter (where nome='Miruna 603 | 02'),
    max(id) filter (where nome='Miruna 603 | 03')
    into v_a1,v_a2,v_a3
    from public.abordagens
   where ativo is true
     and nome in ('Miruna 603 | 01','Miruna 603 | 02','Miruna 603 | 03');

  if v_a1 is null or v_a2 is null or v_a3 is null then
    raise exception 'MIRUNA_APPROACHES_INCOMPLETE';
  end if;

  select jsonb_agg(
    case
      when b->>'id'='b4' then jsonb_set(
        b,'{options,fieldOperations}',
        coalesce((
          select jsonb_agg(op order by op_ord)
            from jsonb_array_elements(b#>'{options,fieldOperations}')
                 with ordinality x(op,op_ord)
           where op->>'stepId'<>'approach'
        ),'[]'::jsonb)
      )
      when b->>'id'='b14' then
        jsonb_set(b,'{options,nextBlockId}',to_jsonb('b17'::text))
      else b
    end order by ord
  ) into v_blocks
  from jsonb_array_elements(v_auto.mapa->'automation'->'blocks')
       with ordinality t(b,ord);

  v_map:=jsonb_set(
    v_auto.mapa,'{automation,blocks}',
    v_blocks||jsonb_build_array(
      jsonb_build_object(
        'id','b17','type','randomizer',
        'options',jsonb_build_object('randomizers',jsonb_build_array(
          jsonb_build_object('id','r18','name','Miruna 603 | 01','perc',34,'nextBlockId','b19'),
          jsonb_build_object('id','r21','name','Miruna 603 | 02','perc',33,'nextBlockId','b22'),
          jsonb_build_object('id','r24','name','Miruna 603 | 03','perc',33,'nextBlockId','b25')
        )),
        'presentation',jsonb_build_object('x',1660,'y',100),
        'sourceBlockId',gen_random_uuid()
      ),
      jsonb_build_object(
        'id','b19','type','field-operation',
        'options',jsonb_build_object(
          'fieldOperations',jsonb_build_array(jsonb_build_object(
            'name','set-field-operation','group','field','stepId','approach-name',
            'options',jsonb_build_object(
              'value','Miruna 603 | 01',
              'parameter','additional-field[abordagem_nome]'
            )
          )),
          'nextBlockId','b20','errorNextBlockId',''
        ),
        'presentation',jsonb_build_object('x',2040,'y',-300),
        'sourceBlockId',gen_random_uuid()
      ),
      jsonb_build_object(
        'id','b20','type','send-approach',
        'options',jsonb_build_object(
          'produtoId',0,'abordagemIds',jsonb_build_array(v_a1),
          'nextBlockId','','errorNextBlockId',''
        ),
        'presentation',jsonb_build_object('x',2440,'y',-300),
        'sourceBlockId',gen_random_uuid()
      ),
      jsonb_build_object(
        'id','b22','type','field-operation',
        'options',jsonb_build_object(
          'fieldOperations',jsonb_build_array(jsonb_build_object(
            'name','set-field-operation','group','field','stepId','approach-name',
            'options',jsonb_build_object(
              'value','Miruna 603 | 02',
              'parameter','additional-field[abordagem_nome]'
            )
          )),
          'nextBlockId','b23','errorNextBlockId',''
        ),
        'presentation',jsonb_build_object('x',2040,'y',100),
        'sourceBlockId',gen_random_uuid()
      ),
      jsonb_build_object(
        'id','b23','type','send-approach',
        'options',jsonb_build_object(
          'produtoId',0,'abordagemIds',jsonb_build_array(v_a2),
          'nextBlockId','','errorNextBlockId',''
        ),
        'presentation',jsonb_build_object('x',2440,'y',100),
        'sourceBlockId',gen_random_uuid()
      ),
      jsonb_build_object(
        'id','b25','type','field-operation',
        'options',jsonb_build_object(
          'fieldOperations',jsonb_build_array(jsonb_build_object(
            'name','set-field-operation','group','field','stepId','approach-name',
            'options',jsonb_build_object(
              'value','Miruna 603 | 03',
              'parameter','additional-field[abordagem_nome]'
            )
          )),
          'nextBlockId','b26','errorNextBlockId',''
        ),
        'presentation',jsonb_build_object('x',2040,'y',500),
        'sourceBlockId',gen_random_uuid()
      ),
      jsonb_build_object(
        'id','b26','type','send-approach',
        'options',jsonb_build_object(
          'produtoId',0,'abordagemIds',jsonb_build_array(v_a3),
          'nextBlockId','','errorNextBlockId',''
        ),
        'presentation',jsonb_build_object('x',2440,'y',500),
        'sourceBlockId',gen_random_uuid()
      )
    ),true
  );

  v_map:=jsonb_set(
    v_map,'{editor,blocks}',
    coalesce(v_auto.mapa#>'{editor,blocks}','{}'::jsonb)||jsonb_build_object(
      'b17',jsonb_build_object(
        'id','b17','fam','randomizador','sub','','x',1660,'y',100,
        'note','Escolhe uma das tres abordagens. O retry da mesma execucao conserva o mesmo ramo.',
        'extra',jsonb_build_object(),'parts',jsonb_build_array(),
        'ramos',jsonb_build_array(
          jsonb_build_object('id','r18','name','Miruna 603 | 01','perc',34),
          jsonb_build_object('id','r21','name','Miruna 603 | 02','perc',33),
          jsonb_build_object('id','r24','name','Miruna 603 | 03','perc',33)
        ),'noteOpen',false
      ),
      'b19',jsonb_build_object('id','b19','fam','mapeamento','sub','','x',2040,'y',-300,'note','Registra a abordagem exata escolhida.','extra',jsonb_build_object(),'parts',jsonb_build_array(),'ramos',jsonb_build_array(),'noteOpen',false),
      'b20',jsonb_build_object('id','b20','fam','mensagem','sub','','x',2440,'y',-300,'note','Envia somente Miruna 603 | 01 pela instancia do corretor dono.','extra',jsonb_build_object(),'parts',jsonb_build_array(),'ramos',jsonb_build_array(),'noteOpen',false),
      'b22',jsonb_build_object('id','b22','fam','mapeamento','sub','','x',2040,'y',100,'note','Registra a abordagem exata escolhida.','extra',jsonb_build_object(),'parts',jsonb_build_array(),'ramos',jsonb_build_array(),'noteOpen',false),
      'b23',jsonb_build_object('id','b23','fam','mensagem','sub','','x',2440,'y',100,'note','Envia somente Miruna 603 | 02 pela instancia do corretor dono.','extra',jsonb_build_object(),'parts',jsonb_build_array(),'ramos',jsonb_build_array(),'noteOpen',false),
      'b25',jsonb_build_object('id','b25','fam','mapeamento','sub','','x',2040,'y',500,'note','Registra a abordagem exata escolhida.','extra',jsonb_build_object(),'parts',jsonb_build_array(),'ramos',jsonb_build_array(),'noteOpen',false),
      'b26',jsonb_build_object('id','b26','fam','mensagem','sub','','x',2440,'y',500,'note','Envia somente Miruna 603 | 03 pela instancia do corretor dono.','extra',jsonb_build_object(),'parts',jsonb_build_array(),'ramos',jsonb_build_array(),'noteOpen',false)
    ),true
  );

  v_map:=jsonb_set(
    v_map,'{editor,wires}',
    coalesce(v_auto.mapa#>'{editor,wires}','[]'::jsonb)||jsonb_build_array(
      jsonb_build_object('from','b14','port','out','to','b17'),
      jsonb_build_object('from','b17','port','r18','to','b19'),
      jsonb_build_object('from','b19','port','out','to','b20'),
      jsonb_build_object('from','b17','port','r21','to','b22'),
      jsonb_build_object('from','b22','port','out','to','b23'),
      jsonb_build_object('from','b17','port','r24','to','b25'),
      jsonb_build_object('from','b25','port','out','to','b26')
    ),true
  );
  v_map:=jsonb_set(v_map,'{editor,uid}','27'::jsonb,true);

  v_valid:=public.automacao_validar_mapa(v_map);
  if coalesce((v_valid->>'ok')::boolean,false) is not true then
    raise exception 'AUTOMATION_INVALID: Entrada Miruna: %',v_valid->'erros';
  end if;

  select coalesce(max(versao),0)+1 into v_version
    from public.automacao_versoes where automacao_id=v_auto.id;
  insert into public.automacao_versoes(
    automacao_id,versao,nome,mapa,observacao,criado_por
  ) values (
    v_auto.id,v_version,v_auto.nome,v_map,
    'Randomizador deterministico com tres abordagens Miruna exatas',
    'migration:20260821235500'
  ) returning id into v_version_id;
  update public.automacoes
     set mapa=v_map,mapa_rascunho=v_map,versao_publicada_id=v_version_id,
         status='publicado',publicado_em=now(),atualizada_em=now()
   where id=v_auto.id;

  select * into strict v_auto
    from public.automacoes
   where nome='Entrada Adelmo'
   for update;

  if md5(v_auto.mapa::text)<>'e79245e52d30f3580ec94467322696c4' then
    raise exception 'AUTOMATION_STALE_VERSION: Entrada Adelmo mudou antes da publicacao';
  end if;

  select jsonb_agg(
    case when b->>'id'='b11'
      then jsonb_set(b,'{options,distribuicao,onlineOnly}','true'::jsonb,true)
      else b
    end order by ord
  ) into v_blocks
  from jsonb_array_elements(v_auto.mapa->'automation'->'blocks')
       with ordinality t(b,ord);
  v_map:=jsonb_set(v_auto.mapa,'{automation,blocks}',v_blocks,true);

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
    'Distribuicao exige elegibilidade operacional; fim de semana ignora apenas presenca fisica',
    'migration:20260821235500'
  ) returning id into v_version_id;
  update public.automacoes
     set mapa=v_map,mapa_rascunho=v_map,versao_publicada_id=v_version_id,
         status='publicado',publicado_em=now(),atualizada_em=now()
   where id=v_auto.id;
end
$migration$;
