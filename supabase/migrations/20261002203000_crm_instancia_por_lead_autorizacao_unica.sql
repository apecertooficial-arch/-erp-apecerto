-- A RPC anterior respeitava o RLS, mas isso fazia as funções de autorização
-- serem recalculadas para cada lead e para cada junção da conversa. Em produção
-- a consulta atingia o statement_timeout antes de devolver qualquer instância.
--
-- Esta versão preserva a mesma fronteira de acesso, calculando o perfil do
-- chamador uma única vez e filtrando os leads permitidos antes de consultar
-- contatos, conversas e mensagens.
create or replace function public.f2_instancia_por_lead()
returns table(
  funil_lead_id uuid,
  instancia_id uuid,
  rotulo text,
  telefone text,
  status text,
  ultima_mensagem_em timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_corretor_id bigint;
begin
  if v_uid is null then
    return;
  end if;

  v_admin := public.f2_admin() is true;
  if not v_admin then
    v_corretor_id := public.f2_corretor_atual();
    if v_corretor_id is null then
      return;
    end if;
  end if;

  return query
  with leads_permitidos as materialized (
    select l.id, l.origem_negocio_id
    from public.f2_lead l
    where l.descartado_em is null
      and (v_admin or l.corretor_id = v_corretor_id)
  ), contato_do_lead as (
    select permitido.id as funil_lead_id, contato.id as contato_id
    from leads_permitidos permitido
    join public.negocios negocio on negocio.id = permitido.origem_negocio_id
    join public.wa_contatos contato on contato.lead_id = negocio.lead_id
    union
    select vinculo.funil_lead_id, vinculo.contato_id
    from public.f2_historico_vinculo vinculo
    join leads_permitidos permitido on permitido.id = vinculo.funil_lead_id
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
end;
$function$;

revoke all on function public.f2_instancia_por_lead() from public, anon;
grant execute on function public.f2_instancia_por_lead() to authenticated, service_role;

comment on function public.f2_instancia_por_lead() is
  'Resolve a última instância somente dos leads visíveis ao chamador, avaliando a autorização uma vez por execução.';
