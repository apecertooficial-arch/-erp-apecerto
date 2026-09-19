-- DRAFT NÃO APLICADO — advisor function_search_path_mutable.
--
-- Evidência remota em 2026-09-19:
--   public.hoje_operacao() é SQL, STABLE, SECURITY INVOKER e só calcula a data
--   da operação em America/Sao_Paulo. Não lê tabelas nem precisa de schema de
--   aplicação. A correção fixa o namespace em pg_catalog e preserva corpo,
--   assinatura e grants existentes.
--
-- Ensaiar primeiro em Postgres isolado; não aplicar por `db push`, pois o
-- histórico remoto de migrations continua divergente.

begin;

alter function public.hoje_operacao()
  set search_path = pg_catalog;

do $assert$
declare
  v_config text[];
begin
  select p.proconfig into v_config
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'hoje_operacao'
     and pg_get_function_identity_arguments(p.oid) = '';

  if v_config is null
     or not ('search_path=pg_catalog' = any(v_config)) then
    raise exception 'search_path de hoje_operacao não foi fixado';
  end if;
end;
$assert$;

commit;

-- Rollback específico, se o ensaio provar incompatibilidade:
-- alter function public.hoje_operacao() reset search_path;
