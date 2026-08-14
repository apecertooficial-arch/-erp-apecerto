-- INSTANCIA POR LEAD, VINDA DO HISTORICO REAL DA CONVERSA (ago/2026)
--
-- Antes o selo ao lado do nome do lead vinha de uma consulta por CORRETOR:
-- pegava a instancia dele com heartbeat mais recente e carimbava a mesma em
-- todos os leads. Corretor com dois numeros via sempre o mesmo selo, entao o
-- selo nao respondia a unica pergunta que ele faz -- "por qual numero eu falo
-- com ESTE cliente?" -- e o risco era responder pelo numero errado, abrindo
-- uma segunda conversa e perdendo o fio da primeira.
--
-- Medido na producao antes da mudanca: o Fabiano tem 56 leads divididos entre
-- dois numeros (46 em "Fabiano Andrade" e 10 em "Fabiano 02") e a tela mostrava
-- um so para todos. Elizangela, Claudia, Edrisia e Tica tambem.
--
-- Aqui a instancia passa a ser a da ULTIMA MENSAGEM da conversa daquele lead,
-- em qualquer direcao. E a conversa viva: se o cliente escreveu para o numero
-- A, e por A que ele tem que ser respondido, independente de qual numero o
-- corretor usou por ultimo em outro atendimento.
--
-- POR QUE EM SQL E NAO NA ROTA: exige a ultima mensagem de cada conversa, e
-- wa_mensagens tem 130 mil linhas. Com o indice idx_wa_msg_conversa_criado o
-- `distinct on` resolve em ~20ms; em JavaScript exigiria trazer a tabela.
--
-- SECURITY INVOKER de proposito (o padrao): le exatamente as mesmas tabelas
-- que app/api/funil2/conversa/route.ts ja le com o token do usuario, entao as
-- policies de RLS continuam valendo iguais. Nao ha ganho de visibilidade.
--
-- O caminho ate o contato e o mesmo daquela rota, incluindo os vinculos
-- manuais de f2_historico_vinculo -- se divergir, a lista e a conversa
-- passariam a discordar sobre o mesmo lead.

create or replace function public.f2_instancia_por_lead()
returns table (
  funil_lead_id uuid,
  instancia_id uuid,
  rotulo text,
  telefone text,
  status text,
  ultima_mensagem_em timestamptz
)
language sql
stable
as $$
  with contato_do_lead as (
    select l.id as funil_lead_id, c.id as contato_id
    from public.f2_lead l
    join public.negocios n on n.id = l.origem_negocio_id
    join public.wa_contatos c on c.lead_id = n.lead_id
    where l.descartado_em is null
    union
    select v.funil_lead_id, v.contato_id
    from public.f2_historico_vinculo v
  )
  select distinct on (cl.funil_lead_id)
    cl.funil_lead_id,
    m.instancia_id,
    i.rotulo,
    i.telefone,
    i.status,
    m.criado_em
  from contato_do_lead cl
  join public.wa_conversas cv on cv.contato_id = cl.contato_id
  join public.wa_mensagens m on m.conversa_id = cv.id
  left join public.wa_instancias i on i.id = m.instancia_id
  where m.instancia_id is not null
  order by cl.funil_lead_id, m.criado_em desc;
$$;

comment on function public.f2_instancia_por_lead() is
  'Instancia (numero de WhatsApp) da ultima mensagem da conversa de cada lead do Funil 2.0. Responde "por qual numero eu falo com ESTE cliente".';

grant execute on function public.f2_instancia_por_lead() to authenticated;
