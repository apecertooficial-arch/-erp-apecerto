-- Onda 4.2 — fila de conversas esperando resposta.
--
-- Medido em 15/09/2026 sobre 7.954 conversas e 191.211 mensagens:
--   381  conversas em que o cliente escreveu e NINGUEM nunca respondeu
--    97  dessas nos ultimos 30 dias
--  1159  conversas cuja ultima mensagem e do cliente
--  1159  -- dessas, 366 sem dono nenhum e 52 chegaram nas ultimas 24h
--    74  esperando ha mais de 24 horas
--
-- Nenhuma tela do ERP destaca isso. O Chat ao Vivo lista conversas por recencia,
-- nao por quem esta esperando. Esta view e a fila que faltava: ordenada por tempo
-- de espera, com dono, para virar cobranca.
--
-- Cuidado de vocabulario: wa_mensagens.direcao usa 'recebida'/'enviada' (nao
-- 'in'/'out'), e o vinculo com o lead esta em wa_contatos.lead_id (nao em
-- wa_conversas). Errar qualquer um dos dois faz a consulta devolver zero e
-- parecer que esta tudo bem -- aconteceu comigo nas duas primeiras tentativas.

create or replace view public.chat_fila_sem_resposta
with (security_invoker = true) as
with conv as (
  select
    c.id as conversa_id,
    max(m.criado_em) filter (where m.direcao = 'recebida') as ultima_entrada,
    max(m.criado_em) filter (where m.direcao = 'enviada')  as ultima_saida,
    count(*) filter (where m.direcao = 'recebida') as entradas,
    count(*) filter (where m.direcao = 'enviada')  as saidas
  from public.wa_conversas c
  join public.wa_mensagens m on m.conversa_id = c.id
  group by c.id
)
select
  conv.conversa_id,
  c.contato_id,
  ct.lead_id,
  ct.nome        as contato,
  ct.telefone,
  co.nome        as corretor,
  conv.ultima_entrada,
  conv.ultima_saida,
  conv.entradas,
  conv.saidas,
  (conv.saidas = 0)                                        as nunca_respondida,
  round(extract(epoch from (now() - conv.ultima_entrada)) / 60)::bigint as minutos_esperando
from conv
join public.wa_conversas c    on c.id = conv.conversa_id
left join public.wa_contatos ct on ct.id = c.contato_id
left join public.leads l      on l.id = ct.lead_id
left join public.corretores co on co.id = l.corretor_id
where conv.entradas > 0
  and conv.ultima_entrada > coalesce(conv.ultima_saida, '-infinity'::timestamptz);

comment on view public.chat_fila_sem_resposta is
  'Onda 4.2: conversas em que a ultima mensagem e do cliente. Ordene por minutos_esperando. nunca_respondida = cliente falou e ninguem nunca respondeu.';

grant select on public.chat_fila_sem_resposta to authenticated, service_role;
