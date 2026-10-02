-- A tela do CRM precisa saber por qual instância ocorreu a conversa mais
-- recente. A versão anterior juntava todas as mensagens antes de escolher uma,
-- lendo centenas de milhares de linhas em cada abertura. Esta versão escolhe
-- primeiro a última mensagem de cada conversa pelos índices existentes e só
-- depois compara as poucas candidatas de cada lead.
create or replace function public.f2_instancia_por_lead()
returns table(
  funil_lead_id uuid,
  instancia_id uuid,
  rotulo text,
  telefone text,
  status text,
  ultima_mensagem_em timestamptz
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with contato_do_lead as (
    select l.id as funil_lead_id, contato.id as contato_id
    from public.f2_lead l
    join public.negocios n on n.id = l.origem_negocio_id
    join public.wa_contatos contato on contato.lead_id = n.lead_id
    where l.descartado_em is null
    union
    select vinculo.funil_lead_id, vinculo.contato_id
    from public.f2_historico_vinculo vinculo
  ), candidatas as (
    select contato.funil_lead_id, recente.instancia_id, recente.criado_em
    from contato_do_lead contato
    join lateral (
      select mensagem.instancia_id, mensagem.criado_em
      from public.wa_conversas conversa
      join lateral (
        select m.instancia_id, m.criado_em
        from public.wa_mensagens m
        where m.conversa_id = conversa.id
          and m.instancia_id is not null
        order by m.criado_em desc
        limit 1
      ) mensagem on true
      where conversa.contato_id = contato.contato_id
      order by mensagem.criado_em desc
      limit 1
    ) recente on true
  )
  select distinct on (c.funil_lead_id)
    c.funil_lead_id,
    c.instancia_id,
    instancia.rotulo,
    instancia.telefone,
    instancia.status,
    c.criado_em
  from candidatas c
  left join public.wa_instancias instancia on instancia.id = c.instancia_id
  order by c.funil_lead_id, c.criado_em desc;
$function$;

comment on function public.f2_instancia_por_lead() is
  'Resolve a instância da última mensagem real de cada lead sem varrer o histórico completo a cada carga do CRM.';
