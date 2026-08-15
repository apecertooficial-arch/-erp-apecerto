-- Funções que retornam trigger são infraestrutura interna do Postgres. Elas
-- continuam sendo executadas pelos gatilhos, mas não devem aparecer como RPC
-- chamável pela Data API.
do $migration$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
  end loop;
end
$migration$;
