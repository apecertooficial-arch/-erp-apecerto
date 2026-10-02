-- CRM-PIPE-011 — amplia o mesmo recorte operacional de 10 para 18 dias.
-- Move somente o delta ainda fora do pipeline, sem filtrar campanha/origem e
-- sem alterar responsável, dados do lead ou histórico de atendimento.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $migration$
declare
  v_agora timestamptz := statement_timestamp();
  v_desde timestamptz := statement_timestamp() - interval '18 days';
  v_pipeline_destino_id bigint;
  v_leads_totais bigint;
  v_leads_previstos bigint;
  v_negocios_previstos bigint;
  v_leads_movidos bigint;
  v_negocios_movidos bigint;
  v_inconsistencias bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('crm-pipe-leads-recentes', 0));

  if exists (
    select 1 from public.pipelines
    where nome = 'Leads recentes — últimos 18 dias'
  ) then
    raise exception 'CRM_PIPE_011_JA_APLICADA: o pipeline já usa o corte de 18 dias';
  end if;

  select id into strict v_pipeline_destino_id
  from public.pipelines
  where nome = 'Leads recentes — últimos 10 dias';

  select count(*) into v_leads_totais
  from public.leads
  where criado_em >= v_desde
    and criado_em <= v_agora;

  select count(*) into v_leads_previstos
  from public.leads
  where criado_em >= v_desde
    and criado_em <= v_agora
    and pipeline_id is distinct from v_pipeline_destino_id;

  select count(*) into v_negocios_previstos
  from public.negocios n
  join public.leads l on l.id = n.lead_id
  where l.criado_em >= v_desde
    and l.criado_em <= v_agora
    and l.pipeline_id is distinct from v_pipeline_destino_id;

  if v_leads_previstos = 0 then
    raise exception 'CRM_PIPE_011_SEM_DELTA: todos os leads do corte já estão no pipeline';
  end if;

  if exists (
    select 1
    from public.leads l
    left join public.negocios n on n.lead_id = l.id
    where l.criado_em >= v_desde
      and l.criado_em <= v_agora
      and l.pipeline_id is distinct from v_pipeline_destino_id
    group by l.id
    having count(n.id) <> 1
  ) then
    raise exception 'CRM_PIPE_011_NEGOCIO_AMBIGUO: existe lead do delta sem exatamente um negócio';
  end if;

  if exists (
    select 1
    from public.negocios n
    join public.leads l on l.id = n.lead_id
    left join public.pipeline_stages etapa_origem on etapa_origem.id = n.stage_id
    left join public.pipeline_stages etapa_destino
      on etapa_destino.pipeline_id = v_pipeline_destino_id
     and etapa_destino.chave is not distinct from etapa_origem.chave
     and etapa_destino.nome = etapa_origem.nome
    where l.criado_em >= v_desde
      and l.criado_em <= v_agora
      and l.pipeline_id is distinct from v_pipeline_destino_id
      and (n.stage_id is null or etapa_destino.id is null)
  ) then
    raise exception 'CRM_PIPE_011_ETAPA_SEM_MAPA: existe negócio do delta sem etapa equivalente no destino';
  end if;

  update public.negocios n
  set pipeline_id = v_pipeline_destino_id,
      stage_id = etapa_destino.id
  from public.leads l,
       public.pipeline_stages etapa_origem,
       public.pipeline_stages etapa_destino
  where n.lead_id = l.id
    and etapa_origem.id = n.stage_id
    and etapa_destino.pipeline_id = v_pipeline_destino_id
    and etapa_destino.chave is not distinct from etapa_origem.chave
    and etapa_destino.nome = etapa_origem.nome
    and l.criado_em >= v_desde
    and l.criado_em <= v_agora
    and l.pipeline_id is distinct from v_pipeline_destino_id;

  get diagnostics v_negocios_movidos = row_count;

  update public.leads
  set pipeline_id = v_pipeline_destino_id
  where criado_em >= v_desde
    and criado_em <= v_agora
    and pipeline_id is distinct from v_pipeline_destino_id;

  get diagnostics v_leads_movidos = row_count;

  select count(*) into v_inconsistencias
  from public.leads l
  left join public.negocios n on n.lead_id = l.id
  left join public.pipeline_stages s on s.id = n.stage_id
  where l.criado_em >= v_desde
    and l.criado_em <= v_agora
    and (
      l.pipeline_id is distinct from v_pipeline_destino_id
      or n.pipeline_id is distinct from v_pipeline_destino_id
      or s.pipeline_id is distinct from v_pipeline_destino_id
    );

  if v_leads_movidos <> v_leads_previstos
     or v_negocios_movidos <> v_negocios_previstos
     or v_inconsistencias <> 0 then
    raise exception
      'CRM_PIPE_011_CONTAGEM_DIVERGENTE: leads %/%, negócios %/%, inconsistências %',
      v_leads_movidos, v_leads_previstos,
      v_negocios_movidos, v_negocios_previstos,
      v_inconsistencias;
  end if;

  update public.pipelines
  set nome = 'Leads recentes — últimos 18 dias'
  where id = v_pipeline_destino_id;

  insert into public.erp_auditoria (
    usuario_nome, acao, modulo, entidade, entidade_id, antes, depois, detalhe
  ) values (
    'Operação administrativa autorizada',
    'ampliar_pipeline_leads_recentes_18_dias',
    'crm',
    'pipeline',
    v_pipeline_destino_id::text,
    jsonb_build_object(
      'nome', 'Leads recentes — últimos 10 dias',
      'desde', v_desde,
      'ate', v_agora,
      'filtro_campanha', false,
      'leads_antes', v_leads_totais - v_leads_movidos
    ),
    jsonb_build_object(
      'nome', 'Leads recentes — últimos 18 dias',
      'leads_totais', v_leads_totais,
      'leads_adicionados', v_leads_movidos,
      'negocios_adicionados', v_negocios_movidos
    ),
    'O pipeline existente foi ampliado para todos os leads dos 18 dias anteriores à execução, sem filtro de campanha; responsáveis, etapas equivalentes, dados e histórico foram preservados.'
  );
end
$migration$;
