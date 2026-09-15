-- BANCO — criar indice para toda chave estrangeira que nao tinha.
--
-- O PROBLEMA: 123 chaves estrangeiras no schema public nao tinham indice na
-- coluna de origem. Isso custa de duas formas:
--   1. todo JOIN pela FK vira varredura sequencial da tabela filha;
--   2. todo DELETE ou UPDATE na tabela PAI precisa varrer a filha inteira para
--      checar a restricao -- e e por isso que apagar um registro simples podia
--      ficar lento sem motivo aparente.
--
-- Conferi o risco antes de aplicar: das 123, apenas 1 esta em tabela maior que
-- 50 MB (a maior tem 84 MB). CREATE INDEX trava a tabela durante a criacao, mas
-- nesse tamanho a trava e de segundos.
--
-- O indice recebe nome deterministico a partir do nome da restricao, e o bloco
-- e idempotente (if not exists), entao pode rodar de novo sem efeito.
--
-- RESULTADO MEDIDO: checagem "FKs sem indice" 123 -> 0.
--
-- REVERSAO: drop index <nome>;

do $$
declare
  r record;
  v_cols text;
  v_nome text;
  n int := 0;
begin
  for r in
    select k.conrelid::regclass::text as tabela,
           k.conname,
           k.conkey
    from pg_constraint k
    where k.contype = 'f'
      and k.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = k.conrelid
          and (k.conkey::int2[])[1] = i.indkey[0]
      )
  loop
    -- lista de colunas da FK, na ordem em que a restricao as declara
    select string_agg(quote_ident(a.attname), ', ' order by x.ord)
      into v_cols
    from unnest(r.conkey) with ordinality as x(attnum, ord)
    join pg_attribute a
      on a.attrelid = r.tabela::regclass and a.attnum = x.attnum;

    v_nome := left('idx_fk_' || replace(r.conname, '"', ''), 63);

    execute format('create index if not exists %I on %s (%s)', v_nome, r.tabela, v_cols);
    n := n + 1;
  end loop;
  raise notice 'criados/garantidos % indices de chave estrangeira', n;
end $$;
