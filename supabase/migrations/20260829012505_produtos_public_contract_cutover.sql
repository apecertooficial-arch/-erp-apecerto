set lock_timeout = '5s';
set statement_timeout = '60s';

revoke all privileges on table public.empreendimentos, public.unidades, public.midias from anon, public;

do $$
declare
  v_table text;
  v_columns text;
begin
  foreach v_table in array array['empreendimentos','unidades','midias'] loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into v_columns
    from information_schema.columns
    where table_schema = 'public' and table_name = v_table;
    if v_columns is null then raise exception 'PUBLIC_ACL_PRECHECK: tabela %.% ausente.', 'public', v_table; end if;
    execute format('revoke select (%s) on table public.%I from anon, public', v_columns, v_table);
  end loop;
end $$;

grant select (id,dormitorios,bairro,cidade,status,entrega,area_util,suites,banheiros,vagas,preco,condominio_valor,destaque,ordem,finalidade,iptu,uf,publicado,rascunho,aprovacao,endereco_publico)
  on table public.empreendimentos to anon;
grant select (id,empreendimento_id,publicado,disponivel,aprovacao,valor_promo,valor_tabela,area_m2,tipologia,vagas)
  on table public.unidades to anon;
grant select (id,empreendimento_id,unidade_id,tipo,is_capa,ordem,created_at,categoria,alt_text)
  on table public.midias to anon;

revoke all privileges on table public.vw_produtos_publicos from anon, public;
grant select on table public.site_produtos, public.site_produtos_catalogo to anon;

do $$
begin
  if has_column_privilege('anon', 'public.empreendimentos', 'endereco', 'select')
     or has_column_privilege('anon', 'public.empreendimentos', 'latitude', 'select')
     or has_column_privilege('anon', 'public.empreendimentos', 'longitude', 'select')
     or has_column_privilege('anon', 'public.unidades', 'numero', 'select')
     or has_column_privilege('anon', 'public.midias', 'storage_path', 'select')
     or has_table_privilege('anon', 'public.vw_produtos_publicos', 'select') then
    raise exception 'PUBLIC_ACL_POSTCHECK: contrato legado ou coluna sensível ainda alcançável.';
  end if;
  if not has_column_privilege('anon', 'public.empreendimentos', 'endereco_publico', 'select')
     or not has_table_privilege('anon', 'public.site_produtos', 'select')
     or not has_table_privilege('anon', 'public.site_produtos_catalogo', 'select') then
    raise exception 'PUBLIC_ACL_POSTCHECK: contrato público seguro indisponível.';
  end if;
end $$;
