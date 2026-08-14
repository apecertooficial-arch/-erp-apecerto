-- BUSCA DA CARTEIRA ANTIGA DENTRO DO FUNIL 2.0 (ago/2026)
--
-- O corretor so enxerga o Funil 2.0, e a busca de "Todos os Leads" so alcanca
-- os leads que ja viraram card la (334 hoje). Quando o cliente antigo volta a
-- responder, o lead dele NAO esta nessa lista -- entao o corretor sai do 2.0,
-- vai no CRM antigo procurar, e acaba marcando a visita la. E assim a operacao
-- racha em dois lugares.
--
-- Sao 1.515 leads nessa situacao: ja tem dono (foram distribuidos ou pescados
-- algum dia), 1.302 com conversa de WhatsApp, do mais antigo em jun/2025 ate
-- 05/08/2026 -- ou seja, ainda entram leads nesse buraco toda semana.
--
-- ESTES LEADS NAO VIRAM CARD. A funcao so os torna PROCURAVEIS dentro do 2.0.
-- Trazer um deles para o funil continua sendo uma acao explicita do corretor,
-- lead a lead, escolhendo etapa e momento. Criar card em massa encheria o Meu
-- Dia de todo mundo com cliente que ninguem vai atender hoje.
--
-- VISIBILIDADE: admin ve todos; corretor ve so a propria carteira. Nao ha lead
-- sem dono aqui por definicao, entao ninguem enxerga carteira de ninguem.
--
-- O AQUARIO NAO ENTRA: e reserva a ser trabalhada, nao carteira. O criterio e
-- "tem dono", que e justamente o que separa lead ja trabalhado de agua parada
-- -- e nao o selo de aquario, que o sistema esquecia de remover ao pescar (ver
-- a migracao seguinte).

create or replace function public.f2_carteira_antiga(p_busca text default null, p_limite int default 40)
returns table (
  lead_id bigint,
  negocio_id bigint,
  nome text,
  telefone text,
  corretor_id bigint,
  corretor_nome text,
  criado_em timestamptz,
  ultima_mensagem_em timestamptz,
  mensagens int
)
language sql
stable
security definer
set search_path to ''
as $$
  with permissao as (
    select public.f2_admin() as admin, public.f2_corretor_atual() as corretor
  ),
  termo as (
    -- busca por nome OU por telefone; no telefone so os digitos importam,
    -- porque o corretor digita com mascara e o banco guarda cru (ou vice-versa)
    select nullif(btrim(coalesce(p_busca, '')), '') as texto,
           nullif(regexp_replace(coalesce(p_busca, ''), '\D', '', 'g'), '') as digitos
  )
  select l.id, n.id, l.nome, l.telefone, l.corretor_id, c.nome,
         l.criado_em,
         (select max(m.criado_em) from public.wa_contatos wc
            join public.wa_conversas cv on cv.contato_id = wc.id
            join public.wa_mensagens m on m.conversa_id = cv.id
           where wc.lead_id = l.id),
         (select count(*)::int from public.wa_contatos wc
            join public.wa_conversas cv on cv.contato_id = wc.id
            join public.wa_mensagens m on m.conversa_id = cv.id
           where wc.lead_id = l.id)
    from public.leads l
    cross join permissao p
    cross join termo t
    left join public.corretores c on c.id = l.corretor_id
    left join lateral (
      select n2.id from public.negocios n2 where n2.lead_id = l.id order by n2.criado_em desc limit 1
    ) n on true
   where (select auth.uid()) is not null
     and l.corretor_id is not null
     and (p.admin or l.corretor_id = p.corretor)
     and not exists (
       select 1 from public.f2_lead f
        join public.negocios n3 on n3.id = f.origem_negocio_id
       where n3.lead_id = l.id
     )
     and (
       t.texto is null
       or l.nome ilike '%' || t.texto || '%'
       or (t.digitos is not null and regexp_replace(coalesce(l.telefone,''), '\D', '', 'g') like '%' || t.digitos || '%')
     )
   order by (select max(m.criado_em) from public.wa_contatos wc
               join public.wa_conversas cv on cv.contato_id = wc.id
               join public.wa_mensagens m on m.conversa_id = cv.id
              where wc.lead_id = l.id) desc nulls last,
            l.criado_em desc
   limit greatest(1, least(coalesce(p_limite, 40), 100));
$$;

comment on function public.f2_carteira_antiga(text, int) is
  'Leads ja trabalhados (com dono) que ainda nao tem card no Funil 2.0. So para BUSCA dentro do 2.0 -- nao cria card. Admin ve todos, corretor ve os seus.';

grant execute on function public.f2_carteira_antiga(text, int) to authenticated;
