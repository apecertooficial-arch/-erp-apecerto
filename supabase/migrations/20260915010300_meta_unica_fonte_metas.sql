-- Onda 3.3 — meta unica. Acabar com "R$ 17 mi" e "R$ 3 mi" para o mesmo mes.
--
-- O PROBLEMA (15/09/2026):
--   metas ............. ultima meta da empresa e de AGOSTO (R$ 3 mi).
--                       Nao existe linha para setembro. Metas por corretor so
--                       para JULHO (R$ 1 mi cada).
--   metas_corretor .... R$ 3,5 + 4,0 + 4,5 + 3,0 + 2,0 mi = R$ 17 mi,
--                       SEM periodo nenhum, ultima atualizacao em 12/07/2026.
--
-- Resultado na tela: o Inicio mostra "meta do mes de setembro: R$ 17.000.000"
-- (vem de metas_corretor, que nao tem data) enquanto admin_dashboard_financeiro
-- le `metas` e devolve 0, porque setembro nao existe la.
--
-- O QUE FACO AQUI, e o que NAO faco:
-- NAO invento o valor da meta -- isso e decisao de negocio. Preservo exatamente
-- o que a tela ja vinha mostrando (os valores por corretor de metas_corretor),
-- carregando-os para o mes corrente dentro de `metas`, que tem periodo.
--
-- E resolvo a contradicao NA ESTRUTURA: a meta da empresa passa a ser a SOMA das
-- metas por corretor. Assim as duas nunca mais podem divergir.
--
-- metas_corretor deixa de ser tabela e vira VIEW sobre `metas`. A tabela antiga
-- fica preservada como metas_corretor_legado. Nenhum dado e perdido, e
-- /api/finance continua lendo "metas_corretor" sem precisar mudar.

-- 1. Carregar as metas por corretor para o mes corrente, se ainda nao existirem.
insert into public.metas (corretor_id, periodo_tipo, ano, periodo, meta_vgv, meta_vendas, criado_por)
select mc.corretor_id, 'mensal',
       extract(year from current_date)::int,
       extract(month from current_date)::int,
       mc.meta_vgv, 0,
       (select id from public.usuarios where role='admin' order by nome limit 1)
from public.metas_corretor mc
where not exists (
  select 1 from public.metas m
  where m.corretor_id = mc.corretor_id
    and m.periodo_tipo = 'mensal'
    and m.ano = extract(year from current_date)::int
    and m.periodo = extract(month from current_date)::int
);

-- 2. Meta da empresa do mes = soma das metas por corretor do mes.
insert into public.metas (corretor_id, periodo_tipo, ano, periodo, meta_vgv, meta_vendas, criado_por)
select null, 'mensal',
       extract(year from current_date)::int,
       extract(month from current_date)::int,
       coalesce(sum(m.meta_vgv),0), coalesce(sum(m.meta_vendas),0),
       (select id from public.usuarios where role='admin' order by nome limit 1)
from public.metas m
where m.corretor_id is not null
  and m.periodo_tipo='mensal'
  and m.ano = extract(year from current_date)::int
  and m.periodo = extract(month from current_date)::int
having not exists (
  select 1 from public.metas e
  where e.corretor_id is null and e.periodo_tipo='mensal'
    and e.ano = extract(year from current_date)::int
    and e.periodo = extract(month from current_date)::int
);

-- 3. metas_corretor deixa de ser uma segunda verdade.
alter table public.metas_corretor rename to metas_corretor_legado;

create or replace view public.metas_corretor
with (security_invoker = true) as
select
  m.corretor_id,
  c.nome,
  m.meta_vgv,
  coalesce(m.updated_at, m.created_at) as atualizado_em
from public.metas m
join public.corretores c on c.id = m.corretor_id
where m.periodo_tipo = 'mensal'
  and m.ano = extract(year from current_date)::int
  and m.periodo = extract(month from current_date)::int;

comment on view public.metas_corretor is
  'Onda 3.3: virou VIEW sobre `metas` (fonte unica, com periodo). A tabela original foi preservada como metas_corretor_legado. A meta da empresa e a soma destas.';

grant select on public.metas_corretor to authenticated, service_role;
