set lock_timeout = '5s';
set statement_timeout = '60s';

do $$
declare
  v_volatility "char";
  v_search_path text;
begin
  select p.provolatile, coalesce(array_to_string(p.proconfig, ','), '')
    into v_volatility, v_search_path
  from pg_proc p
  where p.oid = 'public.site_logradouro_publico(text)'::regprocedure;
  if v_volatility <> 'i' or v_search_path !~ 'search_path=' then
    raise exception 'PUBLIC_CONTRACT_PRECHECK: site_logradouro_publico deve ser IMMUTABLE e usar search_path vazio.';
  end if;
end $$;

alter table public.empreendimentos
  add column if not exists endereco_publico text
  generated always as (public.site_logradouro_publico(endereco)) stored;

do $$
declare
  v_type text;
  v_generated "char";
  v_expression text;
  v_view text;
  v_hits integer;
begin
  select format_type(a.atttypid, a.atttypmod), a.attgenerated,
         pg_get_expr(d.adbin, d.adrelid)
    into v_type, v_generated, v_expression
  from pg_attribute a
  join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attrelid = 'public.empreendimentos'::regclass
    and a.attname = 'endereco_publico' and not a.attisdropped;
  if v_type <> 'text' or v_generated <> 's'
     or regexp_replace(regexp_replace(v_expression, '\s+', '', 'g'), '^public\.', '') <> 'site_logradouro_publico(endereco)' then
    raise exception 'PUBLIC_CONTRACT_PRECHECK: endereco_publico existente não corresponde à expressão segura.';
  end if;

  select pg_get_viewdef('public.site_produtos'::regclass, true) into v_view;
  select count(*) into v_hits
  from regexp_matches(v_view, '(public\.)?site_logradouro_publico\(e\.endereco\)', 'g');
  if v_hits <> 1 then
    raise exception 'PUBLIC_CONTRACT_PRECHECK: definição inesperada de site_produtos (% ocorrências).', v_hits;
  end if;
  v_view := regexp_replace(v_view, '(public\.)?site_logradouro_publico\(e\.endereco\)', 'e.endereco_publico', 'g');
  execute 'create or replace view public.site_produtos with (security_invoker=true) as ' || v_view;
  if not exists (
    select 1 from pg_class where oid = 'public.site_produtos'::regclass
      and coalesce(reloptions, array[]::text[]) @> array['security_invoker=true']
  ) then
    raise exception 'PUBLIC_CONTRACT_POSTCHECK: site_produtos perdeu security_invoker.';
  end if;
end $$;

comment on column public.empreendimentos.endereco_publico is
  'Logradouro público derivado de forma fail-closed; não é fonte comercial nem endereço operacional.';
