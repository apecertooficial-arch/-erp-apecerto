-- Um unico modulo Enviar abordagem escolhe uma das abordagens publicadas,
-- alterna igualmente na ordem configurada e preserva a escolha em retry.
-- O modulo continua sem distribuir ou trocar o dono do lead.

create table if not exists private.motor_abordagem_estado(
  automacao_id bigint not null,
  bloco_id text not null,
  posicao bigint not null default 0 check(posicao>=0),
  atualizado_em timestamptz not null default now(),
  primary key(automacao_id,bloco_id)
);

create table if not exists private.motor_abordagem_escolhas(
  execution_id text not null,
  automacao_id bigint not null,
  bloco_id text not null,
  abordagem_id bigint not null,
  posicao bigint not null check(posicao>=0),
  escolhido_em timestamptz not null default now(),
  primary key(execution_id,automacao_id,bloco_id)
);

create index if not exists motor_abordagem_escolhas_escolhido_em_idx
  on private.motor_abordagem_escolhas(escolhido_em);

alter table private.motor_abordagem_estado enable row level security;
alter table private.motor_abordagem_escolhas enable row level security;
revoke all on table private.motor_abordagem_estado
  from public,anon,authenticated,service_role;
revoke all on table private.motor_abordagem_escolhas
  from public,anon,authenticated,service_role;

create or replace function private.motor_escolher_abordagem(
  p_execution_id text,p_automacao_id bigint,p_bloco_id text,p_abordagem_ids jsonb
) returns bigint
language plpgsql
security invoker
set search_path='pg_catalog','private'
as $function$
declare
  v_abordagem_id bigint;
  v_posicao bigint;
  v_quantidade integer;
begin
  select e.abordagem_id into v_abordagem_id
    from private.motor_abordagem_escolhas e
   where e.execution_id=p_execution_id
     and e.automacao_id=p_automacao_id
     and e.bloco_id=p_bloco_id;
  if found then return v_abordagem_id; end if;

  v_quantidade:=jsonb_array_length(p_abordagem_ids);
  insert into private.motor_abordagem_estado(
    automacao_id,bloco_id,posicao,atualizado_em
  ) values (p_automacao_id,p_bloco_id,1,now())
  on conflict (automacao_id,bloco_id) do update
    set posicao=private.motor_abordagem_estado.posicao+1,
        atualizado_em=now()
  returning posicao-1 into v_posicao;

  select value::bigint into strict v_abordagem_id
    from jsonb_array_elements_text(p_abordagem_ids) with ordinality x(value,ord)
   where ord=((v_posicao%v_quantidade)+1);

  insert into private.motor_abordagem_escolhas(
    execution_id,automacao_id,bloco_id,abordagem_id,posicao
  ) values (
    p_execution_id,p_automacao_id,p_bloco_id,v_abordagem_id,v_posicao
  )
  on conflict (execution_id,automacao_id,bloco_id) do nothing;

  select e.abordagem_id into strict v_abordagem_id
    from private.motor_abordagem_escolhas e
   where e.execution_id=p_execution_id
     and e.automacao_id=p_automacao_id
     and e.bloco_id=p_bloco_id;
  return v_abordagem_id;
end
$function$;

revoke all on function private.motor_escolher_abordagem(text,bigint,text,jsonb)
  from public,anon,authenticated,service_role;

-- Altera somente a escolha do modelo; todo o contrato auditado de envio,
-- instancia exata do dono, idempotencia por parte e ausencia de failover fica intacto.
do $patch_sender$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_envia_abordagem'
     and pg_get_function_identity_arguments(p.oid)=
       'p_auto bigint, p_nome text, p_bloco text, p_lead jsonb, p_lead_id bigint, p_corretor_id bigint, p_produto_id bigint, p_abordagem_ids jsonb';
  if v_def is null then raise exception 'motor_envia_abordagem ausente'; end if;
  if md5(v_def)<>'a356c50612a8b53839fc99d68e254c13' then
    raise exception 'motor_envia_abordagem mudou; patch abortado';
  end if;

  v_new:=replace(v_def,
    $old$  v_ab_id bigint; v_ab_nome text; v_msgs jsonb; v_count integer;$old$,
    $new$  v_ab_id bigint; v_ab_nome text; v_ab_grupo text; v_msgs jsonb;$new$);
  v_new:=replace(v_new,
    $old$  select count(*),min((value#>>'{}')::bigint) into v_count,v_ab_id
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
   where id=v_ab_id and coalesce(ativo,true);$old$,
    $new$  if jsonb_typeof(coalesce(p_abordagem_ids,'null'::jsonb))<>'array' then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: lista de abordagens invalida');
    return;
  end if;
  if jsonb_array_length(p_abordagem_ids)=0
     or exists(
       select 1 from jsonb_array_elements_text(p_abordagem_ids) x(value)
        where value!~'^[1-9][0-9]*$'
     )
     or exists(
       select 1 from jsonb_array_elements_text(p_abordagem_ids) x(value)
       group by value having count(*)>1
     ) then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: selecione uma ou mais abordagens validas, sem repeticao');
    return;
  end if;
  v_ab_id:=private.motor_escolher_abordagem(v_exec,p_auto,p_bloco,p_abordagem_ids);
  select nome,grupo,mensagens into v_ab_nome,v_ab_grupo,v_msgs from public.abordagens
   where id=v_ab_id and coalesce(ativo,true);$new$);
  v_new:=replace(v_new,
    $old$  if not found then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: abordagem publicada nao esta ativa');
    return;
  end if;

  select c.nome into v_cor_nome from public.corretores c$old$,
    $new$  if not found then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'mensagem','erro',p_lead->>'nome',v_tel,
      'Envio recusado: abordagem escolhida nao esta ativa');
    return;
  end if;
  update public.leads
     set extras=coalesce(extras,'{}'::jsonb)||jsonb_build_object(
       'abordagem_id',v_ab_id,'abordagem_nome',v_ab_nome,
       'abordagem_grupo',coalesce(v_ab_grupo,''),
       'abordagem_escolhida_em',now()
     )
   where id=p_lead_id;

  select c.nome into v_cor_nome from public.corretores c$new$);
  if v_new=v_def
     or position('private.motor_escolher_abordagem' in v_new)=0
     or position('v_count<>1' in v_new)>0 then
    raise exception 'motor_envia_abordagem nao recebeu a alternancia';
  end if;
  execute v_new;
end
$patch_sender$;

-- O banco repete a validacao estrutural da interface sem consultar cadastros.
do $patch_validator$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='automacao_validar_mapa'
     and pg_get_function_identity_arguments(p.oid)='p_mapa jsonb';
  if v_def is null then raise exception 'automacao_validar_mapa ausente'; end if;
  v_new:=replace(v_def,
    $old$    elsif v_tipo='send-approach' then
      if jsonb_array_length(coalesce(b#>'{options,abordagemIds}','[]'::jsonb))<>1 then
        v_erros:=v_erros||jsonb_build_array('APPROACH_REQUIRED:'||(b->>'id'));
      end if;
$old$,
    $new$    elsif v_tipo='send-approach' then
      if jsonb_array_length(coalesce(b#>'{options,abordagemIds}','[]'::jsonb))<1 then
        v_erros:=v_erros||jsonb_build_array('APPROACH_REQUIRED:'||(b->>'id'));
      end if;
      if exists(
        select 1
          from jsonb_array_elements_text(coalesce(b#>'{options,abordagemIds}','[]'::jsonb)) x(value)
         group by value having count(*)>1
      ) then
        v_erros:=v_erros||jsonb_build_array('APPROACH_DUPLICATED:'||(b->>'id'));
      end if;
$new$);
  if v_new=v_def or position('APPROACH_DUPLICATED:' in v_new)=0 then
    raise exception 'automacao_validar_mapa mudou; patch de abordagens abortado';
  end if;
  execute v_new;
end
$patch_validator$;

-- Simplifica a Miruna: acao final -> um unico Enviar abordagem.
-- IDs de automacao e abordagem sao resolvidos por chaves de negocio.
do $publish_miruna$
declare
  v_auto public.automacoes%rowtype;
  v_map jsonb; v_blocks jsonb; v_editor_blocks jsonb; v_wires jsonb;
  v_abordagem_ids jsonb; v_valid jsonb;
  v_version integer; v_version_id bigint;
begin
  if coalesce((select ativo from public.motor_flags where nome='abordagem_automatica'),false) then
    raise exception 'ABORDAGEM_AUTOMATICA_DEVE_ESTAR_DESLIGADA';
  end if;
  select coalesce(jsonb_agg(id order by ordem,id),'[]'::jsonb)
    into v_abordagem_ids
    from public.abordagens
   where ativo is true and grupo='Miruna 603';
  if jsonb_array_length(v_abordagem_ids)<1 then
    raise exception 'MIRUNA_APPROACHES_INCOMPLETE';
  end if;

  select * into strict v_auto from public.automacoes
   where nome='Entrada Miruna' for update;
  if md5(v_auto.mapa::text)<>'57b58a087d4a7125a68a3f4815c1b295' then
    raise exception 'AUTOMATION_STALE_VERSION: Entrada Miruna mudou antes da publicacao';
  end if;
  select coalesce(jsonb_agg(
    case when b->>'id'='b14'
      then jsonb_set(b,'{options,nextBlockId}',to_jsonb('b17'::text),true)
      else b end order by ord
  ),'[]'::jsonb) into v_blocks
    from jsonb_array_elements(v_auto.mapa#>'{automation,blocks}') with ordinality x(b,ord)
   where b->>'id' in ('b1','b4','b11','b14','b16');
  v_blocks:=v_blocks||jsonb_build_array(jsonb_build_object(
    'id','b17','type','send-approach',
    'options',jsonb_build_object(
      'produtoId',0,'abordagemGrupo','Miruna 603',
      'abordagemIds',v_abordagem_ids,'selectionMode','round-robin',
      'nextBlockId','','errorNextBlockId',''
    ),
    'presentation',jsonb_build_object('x',1660,'y',100),
    'sourceBlockId',gen_random_uuid()
  ));
  v_map:=jsonb_set(v_auto.mapa,'{automation,blocks}',v_blocks,true);

  v_editor_blocks:=coalesce(v_map#>'{editor,blocks}','{}'::jsonb)
    - 'b17' - 'b19' - 'b20' - 'b22' - 'b23' - 'b25' - 'b26';
  v_editor_blocks:=v_editor_blocks||jsonb_build_object(
    'b17',jsonb_build_object(
      'id','b17','fam','mensagem','sub','','x',1660,'y',100,
      'note','Alterna igualmente as abordagens ativas selecionadas do grupo Miruna 603 e envia pela instancia do corretor dono.',
      'extra',jsonb_build_object(),'parts',jsonb_build_array(),
      'ramos',jsonb_build_array(),'noteOpen',false
    )
  );
  v_map:=jsonb_set(v_map,'{editor,blocks}',v_editor_blocks,true);
  select coalesce(jsonb_agg(w order by ord),'[]'::jsonb) into v_wires
    from jsonb_array_elements(coalesce(v_map#>'{editor,wires}','[]'::jsonb)) with ordinality x(w,ord)
   where coalesce(w->>'from','') not in ('b14','b17','b19','b20','b22','b23','b25','b26')
     and coalesce(w->>'to','') not in ('b17','b19','b20','b22','b23','b25','b26');
  v_wires:=v_wires||jsonb_build_array(
    jsonb_build_object('from','b14','port','out','to','b17')
  );
  v_map:=jsonb_set(v_map,'{editor,wires}',v_wires,true);

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
    'Um unico bloco Enviar abordagem com alternancia igual no grupo Miruna 603',
    'migration:20260822011000'
  ) returning id into v_version_id;
  update public.automacoes
     set mapa=v_map,mapa_rascunho=v_map,versao_publicada_id=v_version_id,
         status='publicado',publicado_em=now(),atualizada_em=now()
   where id=v_auto.id;
end
$publish_miruna$;
