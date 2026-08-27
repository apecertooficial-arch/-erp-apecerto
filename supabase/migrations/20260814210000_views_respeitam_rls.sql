-- Remove o bypass implícito de RLS das views públicas sinalizadas pelo
-- Security Advisor. Cada view passa a executar com as permissões do chamador.

-- O primeiro histórico versionado começou depois da criação destas views no
-- banco vivo. Em instalações reconstruídas pelo baseline, materializa contratos
-- equivalentes sem tocar nas definições de bases existentes.
do $baseline_views$
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null then
    if to_regclass('public.vw_sla_leads') is null then
      execute $sql$create view public.vw_sla_leads as
        select l.id lead_id, l.nome cliente, l.telefone, n.id negocio_id,
          n.corretor_id, c.nome corretor, n.stage_id,
          ps.nome etapa, ps.chave etapa_chave, ps.alarme etapa_alarme,
          ps.grupo, n.ultima_movimentacao estagio_desde,
          s.cliente_ultima, s.env_ultima humano_ultima, s.ultima_interacao,
          s.qtd_recebidas, s.qtd_enviadas,
          false::boolean aguardando_humano, false::boolean alarme_ativo,
          null::text cor_ativa, null::integer max_tentativas,
          null::numeric min_aguardando, null::numeric min_ativo,
          null::integer min_ativo_int, null::numeric min_no_estagio,
          null::numeric min_sem_interacao, null::numeric min_tarefa_atraso,
          null::timestamptz prox_venc, null::text sla_situacao,
          null::integer tentativa
        from public.leads l
        left join public.negocios n on n.lead_id=l.id
        left join public.corretores c on c.id=n.corretor_id
        left join public.pipeline_stages ps on ps.id=n.stage_id
        left join public.sla_msg_cache s on s.lead_id=l.id$sql$;
    end if;
    if to_regclass('public.f2_cards_sem_historico') is null then
      execute $sql$create view public.f2_cards_sem_historico as
        select null::text cliente, null::text corretor, null::boolean ja_tentou,
          null::bigint lead_id, null::text momento_codigo,
          null::bigint msgs_no_banco, null::text telefone where false$sql$;
    end if;
    if to_regclass('public.vw_ranking_vgv') is null then
      execute $sql$create view public.vw_ranking_vgv as
        select vc.corretor_id, max(vc.corretor_nome) corretor,
          count(distinct vc.venda_id)::bigint vendas,
          coalesce(sum(v.vgv * vc.fracao),0)::numeric vgv
        from public.venda_corretores vc join public.vendas v on v.id=vc.venda_id
        group by vc.corretor_id$sql$;
    end if;
    if to_regclass('public.leads_duplicados') is null then
      execute $sql$create view public.leads_duplicados as
        select regexp_replace(telefone,'\\D','','g') telefone_normalizado,
          array_agg(id order by id) lead_ids,
          array_agg(distinct corretor_id) corretores,
          count(*)::bigint qtd, min(criado_em) primeiro, max(criado_em) ultimo,
          count(distinct corretor_id)>1 donos_diferentes
        from public.leads where telefone is not null
        group by regexp_replace(telefone,'\\D','','g') having count(*)>1$sql$;
    end if;
    if to_regclass('public.f2_sara_pontos_cegos') is null then
      execute $sql$create view public.f2_sara_pontos_cegos as
        select null::text alertas, null::uuid card_id, null::text cliente,
          null::text corretor, null::timestamptz criado_em,
          null::bigint mensagens, null::text momento_codigo where false$sql$;
    end if;
    if to_regclass('public.site_produtos') is null then
      execute $sql$create view public.site_produtos as
        select e.id, e.nome, e.slug, e.titulo, e.slogan, e.descricao,
          e.bairro, e.endereco, e.cidade, e.status, e.entrega,
          e.finalidade, e.area_util, e.dormitorios, e.suites, e.banheiros,
          e.preco, e.condominio_valor, e.iptu, e.latitude, e.longitude,
          e.lazer, e.diferenciais, e.destaque, e.ordem, e.published_at,
          null::text capa_path, '[]'::jsonb fotos, null::numeric preco_min,
          null::numeric preco_max, null::text[] tipologias,
          0::bigint unidades_disponiveis
        from public.empreendimentos e
        where e.publicado and not e.rascunho and e.aprovacao='aprovado'$sql$;
    end if;
  end if;
end
$baseline_views$;

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
