-- Mescla a tag manual Adelmo com o contrato determinista que foi publicado
-- imediatamente antes, preservando a distribuicao atual. Nao reprocessa leads.

begin;

do $merge_adelmo$
declare
  v_current jsonb;
  v_desired jsonb;
  v_current_dist jsonb;
  v_item jsonb;
  v_current_tags jsonb:='[]'::jsonb;
  v_actions jsonb;
  v_blocks jsonb;
  v_valid jsonb;
  v_version integer;
  v_version_id bigint;
  v_name text;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (select 1 from public.automacoes where id=65) then
    return;
  end if;
  select nome,mapa into v_name,v_current
    from public.automacoes where id=65 for update;
  if v_current is null then raise exception 'Entrada Adelmo ausente'; end if;

  select mapa into v_desired
    from public.automacao_versoes
   where automacao_id=65
     and observacao='Entrada materializa; Campos mapeia JSON; Tags explicitas'
   order by id desc limit 1;
  if v_desired is null then raise exception 'Versao determinista do Adelmo ausente'; end if;

  select b into v_current_dist
    from jsonb_array_elements(v_current->'automation'->'blocks') b
   where b->>'type'='distribution-simple' limit 1;
  if v_current_dist is null then raise exception 'Distribuicao atual do Adelmo ausente'; end if;

  select coalesce(jsonb_agg(a),'[]'::jsonb) into v_current_tags
    from jsonb_array_elements(v_current->'automation'->'blocks') b
    cross join lateral jsonb_array_elements(coalesce(b#>'{options,actions}','[]'::jsonb)) a
   where b->>'type'='action'
     and a->>'name' in ('add-tag-action','create-tags-action','remove-tag-action')
     and nullif(btrim(a#>>'{options,tag}'),'') is not null;

  select b#>'{options,actions}' into v_actions
    from jsonb_array_elements(v_desired->'automation'->'blocks') b
   where b->>'id'='b-tags-entrada-65';
  for v_item in select value from jsonb_array_elements(v_current_tags)
  loop
    if not exists(
      select 1 from jsonb_array_elements(v_actions) a
       where lower(btrim(a#>>'{options,tag}'))=lower(btrim(v_item#>>'{options,tag}'))
    ) then
      v_actions:=v_actions||jsonb_build_array(
        jsonb_set(v_item,'{options,tag}',to_jsonb(btrim(v_item#>>'{options,tag}')),true)
      );
    end if;
  end loop;

  select jsonb_agg(
    case
      when b->>'type'='distribution-simple' then
        jsonb_set(b,'{options}',v_current_dist->'options',true)
      when b->>'id'='b-tags-entrada-65' then
        jsonb_set(b,'{options,actions}',v_actions,true)
      else b
    end order by ord
  ) into v_blocks
  from jsonb_array_elements(v_desired->'automation'->'blocks')
    with ordinality x(b,ord);
  v_desired:=jsonb_set(v_desired,'{automation,blocks}',v_blocks,true);
  v_valid:=public.automacao_validar_mapa(v_desired);
  if coalesce((v_valid->>'ok')::boolean,false) is not true then
    raise exception 'Adelmo mesclado invalido: %',v_valid->'erros';
  end if;

  select coalesce(max(versao),0)+1 into v_version
    from public.automacao_versoes where automacao_id=65;
  insert into public.automacao_versoes(
    automacao_id,versao,nome,mapa,observacao,criado_por
  ) values (
    65,v_version,v_name,v_desired,
    'Mescla segura: campos/tags deterministas + tag Adelmo mais recente',
    'migration'
  ) returning id into v_version_id;
  update public.automacoes
     set mapa=v_desired,mapa_rascunho=v_desired,
         versao_publicada_id=v_version_id,status='publicado',
         publicado_em=now(),atualizada_em=now()
   where id=65;

end
$merge_adelmo$;

do $verify$
declare
  v_map jsonb;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (select 1 from public.automacoes where id=65) then
    return;
  end if;
  select mapa into v_map from public.automacoes where id=65;
  if coalesce((public.automacao_validar_mapa(v_map)->>'ok')::boolean,false) is not true then
    raise exception 'Adelmo invalido';
  end if;
  if not exists(
    select 1 from jsonb_array_elements(v_map->'automation'->'blocks') b
    cross join lateral jsonb_array_elements(coalesce(b#>'{options,actions}','[]'::jsonb)) a
    where b->>'id'='b-tags-entrada-65' and btrim(a#>>'{options,tag}')='Adelmo 2100'
  ) then raise exception 'Tag manual Adelmo 2100 nao foi preservada'; end if;
end
$verify$;

commit;
