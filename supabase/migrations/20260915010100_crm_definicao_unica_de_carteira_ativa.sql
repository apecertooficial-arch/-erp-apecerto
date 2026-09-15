-- Onda 3.2 — definicao unica de "negocio em aberto".
--
-- O PROBLEMA, com numeros de 15/09/2026:
--   negocios com status 'aberto' .......................... 14.159
--   desses, SEM corretor .................................. 11.045
--   desses, realmente no Funil 2.0 (f2_lead nao descartado) . 1.092
--
-- O Inicio dizia "14.148 negocios abertos, 13.909 parados (98%)". E verdade
-- aritmetica e inutil como gestao: 11 mil daqueles nunca foram trabalhados --
-- sao a base importada do Aquario. Um indicador que nunca muda nao gera acao, e
-- o gestor comercial nao reconhecia o numero (ele fala em ~600 em andamento).
--
-- A DECISAO (do Romulo, 14/09/2026): o Funil 2.0 (f2_*) e o CRM oficial.
-- Entao carteira ativa passa a ser: negocio aberto QUE ESTA no Funil 2.0 e nao
-- foi descartado. Quem nao entrou no funil e base importada, nao carteira.
--
-- Esta view e a fonte unica. Inicio, CRM e Central passam a ler daqui.
-- Nada e apagado: a base importada continua contavel e passa a ser exibida em
-- campo proprio, para ninguem achar que sumiu.

create or replace view public.crm_carteira_ativa
with (security_invoker = true) as
select
  n.id,
  n.lead_id,
  n.corretor_id,
  n.empreendimento_id,
  n.unidade_id,
  n.valor,
  n.criado_em,
  n.ultima_movimentacao,
  f.id            as f2_lead_id,
  f.etapa         as f2_etapa,
  f.momento_codigo as f2_momento,
  f.proxima_acao_em,
  f.ultima_interacao_em,
  f.temperatura
from public.negocios n
join public.f2_lead f
  on f.origem_negocio_id = n.id
 and f.descartado_em is null
where n.status = 'aberto';

comment on view public.crm_carteira_ativa is
  'Fonte unica de "negocio em aberto" (Onda 3.2). Negocio aberto que esta no Funil 2.0 e nao foi descartado. Quem nao esta aqui e base importada, nao carteira.';

grant select on public.crm_carteira_ativa to authenticated, service_role;
