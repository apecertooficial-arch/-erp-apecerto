-- Rollback seguro: restaura a expressão da view e preserva a coluna gerada.
do $$
declare v_view text;
begin
  select pg_get_viewdef('public.site_produtos'::regclass, true) into v_view;
  if v_view !~ 'e\.endereco_publico' then raise exception 'ROLLBACK_PRECHECK: view inesperada.'; end if;
  v_view := regexp_replace(v_view, 'e\.endereco_publico', 'public.site_logradouro_publico(e.endereco)', 'g');
  execute 'create or replace view public.site_produtos with (security_invoker=true) as ' || v_view;
end $$;
