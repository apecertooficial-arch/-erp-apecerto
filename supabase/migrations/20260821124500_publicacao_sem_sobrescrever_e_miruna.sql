-- Evita que uma aba antiga do construtor apague uma versao publicada por outra
-- sessao. Reaplica a estrutura determinista da Miruna sobre a publicacao mais
-- recente, preservando a distribuicao e tags explicitas que o usuario acabou
-- de configurar.

begin;

create or replace function public.automacao_publicar(
  p_automacao_id bigint,
  p_nome text,
  p_mapa jsonb,
  p_expected_version_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_validacao jsonb;
  v_versao integer;
  v_versao_id bigint;
  v_atual_id bigint;
  v_token text;
  v_token_enforced boolean;
begin
  if not public.can_manage_all() then
    raise exception using errcode='42501',message='AUTOMATION_FORBIDDEN';
  end if;

  select versao_publicada_id into v_atual_id
    from public.automacoes where id=p_automacao_id for update;
  if not found then
    raise exception using errcode='P0001',message='AUTOMATION_NOT_FOUND';
  end if;
  if v_atual_id is distinct from p_expected_version_id then
    raise exception using errcode='40001',
      message='AUTOMATION_STALE_VERSION: outra sessao publicou esta automacao; recarregue antes de publicar';
  end if;

  v_validacao:=public.automacao_validar_mapa(p_mapa);
  if coalesce((v_validacao->>'ok')::boolean,false) is not true then
    raise exception using errcode='22023',
      message='AUTOMATION_INVALID: '||(v_validacao->'erros')::text;
  end if;

  select coalesce(max(versao),0)+1 into v_versao
    from public.automacao_versoes where automacao_id=p_automacao_id;
  insert into public.automacao_versoes(
    automacao_id,versao,nome,mapa,observacao,criado_por
  ) values (
    p_automacao_id,v_versao,nullif(btrim(p_nome),''),p_mapa,
    'Publicacao atomica pelo construtor',auth.uid()::text
  ) returning id into v_versao_id;

  update public.automacoes
     set nome=coalesce(nullif(btrim(p_nome),''),nome),mapa=p_mapa,
         mapa_rascunho=p_mapa,versao_publicada_id=v_versao_id,
         status='publicado',publicado_em=now(),atualizada_em=now()
   where id=p_automacao_id;
  select webhook_token,webhook_token_enforced into v_token,v_token_enforced
    from public.automacoes where id=p_automacao_id;
  return jsonb_build_object(
    'ok',true,'versao',v_versao,'versao_id',v_versao_id,
    'webhook_token',v_token,'webhook_token_enforced',v_token_enforced
  );
end
$function$;

revoke all on function public.automacao_publicar(bigint,text,jsonb,bigint)
  from public,anon,authenticated;
grant execute on function public.automacao_publicar(bigint,text,jsonb,bigint)
  to authenticated;

-- Clientes antigos nao informam em qual versao abriram o editor e, portanto,
-- nao podem publicar com seguranca.
create or replace function public.automacao_publicar(
  p_automacao_id bigint,
  p_nome text,
  p_mapa jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception using errcode='40001',
    message='AUTOMATION_STALE_VERSION: atualize a Central antes de publicar';
end
$function$;

revoke all on function public.automacao_publicar(bigint,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.automacao_publicar(bigint,text,jsonb)
  to authenticated;

do $merge_miruna$
declare
  v_current jsonb;
  v_desired jsonb;
  v_current_dist jsonb;
  v_current_tags jsonb:='[]'::jsonb;
  v_actions jsonb;
  v_blocks jsonb;
  v_valid jsonb;
  v_version integer;
  v_version_id bigint;
  v_name text;
begin
  select nome,mapa into v_name,v_current
    from public.automacoes where id=66 for update;
  if v_current is null then raise exception 'Entrada Miruna ausente'; end if;

  select mapa into v_desired
    from public.automacao_versoes
   where automacao_id=66
     and observacao='Entrada materializa; Campos mapeia JSON; Tags explicitas'
   order by id desc limit 1;
  if v_desired is null then raise exception 'Versao determinista da Miruna ausente'; end if;

  select b into v_current_dist
    from jsonb_array_elements(v_current->'automation'->'blocks') b
   where b->>'type'='distribution-simple' limit 1;
  if v_current_dist is null then raise exception 'Distribuicao atual da Miruna ausente'; end if;

  select coalesce(jsonb_agg(a),'[]'::jsonb) into v_current_tags
    from jsonb_array_elements(v_current->'automation'->'blocks') b
    cross join lateral jsonb_array_elements(coalesce(b#>'{options,actions}','[]'::jsonb)) a
   where b->>'type'='action'
     and a->>'name' in ('add-tag-action','create-tags-action','remove-tag-action')
     and nullif(btrim(a#>>'{options,tag}'),'') is not null;

  select b#>'{options,actions}' into v_actions
    from jsonb_array_elements(v_desired->'automation'->'blocks') b
   where b->>'id'='b-tags-entrada-66';
  for v_current_dist in select value from jsonb_array_elements(v_current_tags)
  loop
    if not exists(
      select 1 from jsonb_array_elements(v_actions) a
       where lower(btrim(a#>>'{options,tag}'))=
             lower(btrim(v_current_dist#>>'{options,tag}'))
    ) then
      v_actions:=v_actions||jsonb_build_array(
        jsonb_set(v_current_dist,'{options,tag}',to_jsonb(btrim(v_current_dist#>>'{options,tag}')),true)
      );
    end if;
  end loop;

  select b into v_current_dist
    from jsonb_array_elements(v_current->'automation'->'blocks') b
   where b->>'type'='distribution-simple' limit 1;
  select jsonb_agg(
    case
      when b->>'type'='distribution-simple' then
        jsonb_set(b,'{options}',v_current_dist->'options',true)
      when b->>'id'='b-tags-entrada-66' then
        jsonb_set(b,'{options,actions}',v_actions,true)
      else b
    end order by ord
  ) into v_blocks
  from jsonb_array_elements(v_desired->'automation'->'blocks')
    with ordinality x(b,ord);
  v_desired:=jsonb_set(v_desired,'{automation,blocks}',v_blocks,true);
  v_valid:=public.automacao_validar_mapa(v_desired);
  if coalesce((v_valid->>'ok')::boolean,false) is not true then
    raise exception 'Miruna mesclada invalida: %',v_valid->'erros';
  end if;

  select coalesce(max(versao),0)+1 into v_version
    from public.automacao_versoes where automacao_id=66;
  insert into public.automacao_versoes(
    automacao_id,versao,nome,mapa,observacao,criado_por
  ) values (
    66,v_version,v_name,v_desired,
    'Mescla segura: campos/tags deterministas + configuracao mais recente',
    'migration'
  ) returning id into v_version_id;
  update public.automacoes
     set mapa=v_desired,mapa_rascunho=v_desired,
         versao_publicada_id=v_version_id,status='publicado',
         publicado_em=now(),atualizada_em=now()
   where id=66;
end
$merge_miruna$;

do $verify$
declare
  v_map jsonb;
begin
  select mapa into v_map from public.automacoes where id=66;
  if coalesce((public.automacao_validar_mapa(v_map)->>'ok')::boolean,false) is not true then
    raise exception 'Miruna invalida';
  end if;
  if not exists(
    select 1 from jsonb_array_elements(v_map->'automation'->'blocks') b
     where b->>'id'='b-tags-entrada-66'
  ) then raise exception 'Tags deterministas da Miruna ausentes'; end if;
  if not exists(
    select 1 from jsonb_array_elements(v_map->'automation'->'blocks') b
    cross join lateral jsonb_array_elements(coalesce(b#>'{options,fieldOperations}','[]'::jsonb)) op
    where op->>'name'='store-json-payload-field-operation'
  ) then raise exception 'JSON completo da Miruna ausente'; end if;
end
$verify$;

commit;
