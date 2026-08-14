-- Remove o bypass implícito de RLS das views públicas sinalizadas pelo
-- Security Advisor. Cada view passa a executar com as permissões do chamador.

-- Bases internas que antes só funcionavam porque a view pertencia a postgres.
create policy sla_msg_cache_select_scoped
  on public.sla_msg_cache
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      where l.id = sla_msg_cache.lead_id
        and (
          public.can_manage_all()
          or l.corretor_id = (select public.current_broker_id())
        )
    )
  );

create policy wa_backfill_log_select_admin
  on public.wa_backfill_log
  for select
  to authenticated
  using (public.f2_admin());

-- O catálogo externo continua público, mas somente pelas mesmas condições
-- explícitas usadas por site_produtos. Nada em rascunho ou não aprovado vaza.
create policy empreendimentos_select_publicados
  on public.empreendimentos
  for select
  to anon
  using (publicado and not rascunho and aprovacao = 'aprovado');

create policy midias_select_produto_publicado
  on public.midias
  for select
  to anon
  using (
    exists (
      select 1
      from public.empreendimentos e
      where e.id = midias.empreendimento_id
        and e.publicado
        and not e.rascunho
        and e.aprovacao = 'aprovado'
    )
  );

create policy unidades_select_produto_publicado
  on public.unidades
  for select
  to anon
  using (
    disponivel
    and exists (
      select 1
      from public.empreendimentos e
      where e.id = unidades.empreendimento_id
        and e.publicado
        and not e.rascunho
        and e.aprovacao = 'aprovado'
    )
  );

alter view public.vw_sla_leads set (security_invoker = true);
alter view public.f2_cards_sem_historico set (security_invoker = true);
alter view public.vw_ranking_vgv set (security_invoker = true);
alter view public.leads_duplicados set (security_invoker = true);
alter view public.telefones_sem_whatsapp set (security_invoker = true);
alter view public.f2_carga_resumo set (security_invoker = true);
alter view public.f2_sara_pontos_cegos set (security_invoker = true);
alter view public.site_produtos set (security_invoker = true);

-- Views de leitura não precisam anunciar INSERT/UPDATE/DELETE/TRUNCATE.
revoke all on public.vw_sla_leads from anon, authenticated;
revoke all on public.f2_cards_sem_historico from anon, authenticated;
revoke all on public.vw_ranking_vgv from anon, authenticated;
revoke all on public.leads_duplicados from anon, authenticated;
revoke all on public.telefones_sem_whatsapp from anon, authenticated;
revoke all on public.f2_carga_resumo from anon, authenticated;
revoke all on public.f2_sara_pontos_cegos from anon, authenticated;
revoke all on public.site_produtos from anon, authenticated;

grant select on public.vw_sla_leads to authenticated;
grant select on public.f2_cards_sem_historico to authenticated;
grant select on public.vw_ranking_vgv to authenticated;
grant select on public.leads_duplicados to authenticated;
grant select on public.telefones_sem_whatsapp to authenticated;
grant select on public.f2_carga_resumo to authenticated;
grant select on public.f2_sara_pontos_cegos to authenticated;
grant select on public.site_produtos to anon, authenticated;
