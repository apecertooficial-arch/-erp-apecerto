-- INICIO / painel "Produtos com mais leads".
--
-- O DEFEITO: o painel esta HARDCODED vazio em HomeWorkspace.tsx. O texto
-- "Nenhum lead vinculado a produto ainda. Quando os corretores associarem leads
-- a empreendimentos no CRM, o ranking aparece aqui." e literal no JSX -- nao ha
-- nenhuma chamada de dados. Ele nunca mostraria ranking, nem com o banco cheio.
-- E, como a mensagem culpa os corretores por nao associarem, ninguem desconfia.
--
-- E EXISTE DADO. O vinculo lead<->produto nao esta so em lead_produtos (3
-- registros); esta principalmente nas VISITAS, que ninguem estava lendo:
--   visitas com empreendimento ..... 209 registros, 18 produtos distintos
--   lead_produtos ..................   3 registros,  1 produto
--   negocios.empreendimento_id .....   3 registros,  2 produtos
-- Visita e o sinal de interesse mais forte que existe: o cliente foi ate o
-- imovel. Ignorar isso e jogar fora a melhor evidencia da base.
--
-- Esta RPC consolida as tres fontes e conta LEAD DISTINTO por produto, para o
-- mesmo lead nao inflar o ranking ao visitar duas vezes.
--
-- Devolve tambem 'visitas' e 'vendas' por produto, para o painel poder mostrar
-- interesse e conversao lado a lado.
--
-- RESULTADO REAL em 15/09/2026: 154 leads distintos em 19 produtos.
--   EDIFICIO ISABELE ... 52 leads, 59 visitas, 0 vendas
--   AP Moema ........... 35 leads, 36 visitas, 2 vendas
--   Moema Studium ...... 35 leads, 41 visitas, 1 venda
--   Claris ............. 22 leads, 31 visitas, 3 vendas
--
-- PENDENTE NO FRONT: HomeWorkspace.tsx precisa trocar o bloco fixo por uma
-- chamada a /api/dashboard?section=produtos_leads. Enquanto isso nao acontece,
-- a RPC ja e consultavel e o dado deixa de estar invisivel.

create or replace function public.admin_dashboard_produtos_leads()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with sinais as (
    -- 1. visita marcada/realizada: o cliente foi ate o imovel
    select v.empreendimento_id, v.lead_id
    from visitas v
    where v.empreendimento_id is not null and v.lead_id is not null

    union
    -- 2. vinculo explicito feito no CRM
    select lp.empreendimento_id, lp.lead_id
    from lead_produtos lp
    where lp.empreendimento_id is not null and lp.lead_id is not null

    union
    -- 3. negocio aberto/ganho ja apontando para o produto
    select n.empreendimento_id, n.lead_id
    from negocios n
    where n.empreendimento_id is not null and n.lead_id is not null
  ),
  ranking as (
    select
      s.empreendimento_id,
      count(distinct s.lead_id) as leads
    from sinais s
    group by s.empreendimento_id
  )
  select jsonb_build_object(
    'total_leads_vinculados', (select count(distinct lead_id) from sinais),
    'produtos_com_sinal',     (select count(*) from ranking),
    'ranking', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'k',       e.nome,
        'id',      r.empreendimento_id,
        'leads',   r.leads,
        'visitas', (select count(*) from visitas v where v.empreendimento_id = r.empreendimento_id),
        'vendas',  (select count(*) from vendas vd where vd.empreendimento_id = r.empreendimento_id and vd.data_conclusao is not null)
      ) order by r.leads desc, e.nome), '[]'::jsonb)
      from ranking r
      join empreendimentos e on e.id = r.empreendimento_id
    )
  );
$function$;

revoke execute on function public.admin_dashboard_produtos_leads() from public, anon;
grant execute on function public.admin_dashboard_produtos_leads() to authenticated, service_role;

comment on function public.admin_dashboard_produtos_leads() is
  'Alimenta o painel "Produtos com mais leads" do Inicio, que estava hardcoded vazio. Consolida visitas + lead_produtos + negocios e conta lead distinto por produto.';
