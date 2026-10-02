-- CRM-PIPE-010 — separa a operação nova sem apagar nem reclassificar histórico.
-- O corte usa o instante único da transação. Campanha/origem não participa do
-- filtro: entram todos os leads criados nas 240 horas anteriores à execução.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $migration$
declare
  v_agora timestamptz := statement_timestamp();
  v_desde timestamptz := statement_timestamp() - interval '10 days';
  v_pipeline_origem_id bigint;
  v_pipeline_destino_id bigint;
  v_leads_previstos bigint;
  v_negocios_previstos bigint;
  v_leads_movidos bigint;
  v_negocios_movidos bigint;
  v_etapas_criadas bigint;
  v_inconsistencias bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('crm-pipe-010-leads-recentes', 0));

  if exists (
    select 1 from public.pipelines
    where nome = 'Leads recentes — últimos 10 dias'
  ) then
    raise exception 'CRM_PIPE_010_DESTINO_EXISTENTE: o funil de destino já existe';
  end if;

  select id into strict v_pipeline_origem_id
  from public.pipelines
  where nome = 'Funil 2.0';

  select count(*) into v_leads_previstos
  from public.leads
  where criado_em >= v_desde
    and criado_em <= v_agora;

  select count(*) into v_negocios_previstos
  from public.negocios n
  join public.leads l on l.id = n.lead_id
  where l.criado_em >= v_desde
    and l.criado_em <= v_agora;

  if v_leads_previstos = 0 then
    raise exception 'CRM_PIPE_010_SEM_LEADS: nenhum lead encontrado no corte de 10 dias';
  end if;

  if exists (
    select 1
    from public.negocios n
    join public.leads l on l.id = n.lead_id
    left join public.pipeline_stages etapa_origem on etapa_origem.id = n.stage_id
    left join public.pipeline_stages etapa_modelo
      on etapa_modelo.pipeline_id = v_pipeline_origem_id
     and etapa_modelo.chave is not distinct from etapa_origem.chave
     and etapa_modelo.nome = etapa_origem.nome
    where l.criado_em >= v_desde
      and l.criado_em <= v_agora
      and (n.stage_id is null or etapa_modelo.id is null)
  ) then
    raise exception 'CRM_PIPE_010_ETAPA_SEM_MAPA: existe negócio recente sem etapa equivalente no Funil 2.0';
  end if;

  insert into public.pipelines (nome, grupo, ordem)
  values (
    'Leads recentes — últimos 10 dias',
    'Operação',
    (select coalesce(max(ordem), 0) + 1 from public.pipelines)
  )
  returning id into v_pipeline_destino_id;

  insert into public.pipeline_stages (
    pipeline_id, nome, ordem, cor, tipo, datacrazy_stage_nome,
    chave, rotulo, grupo, sla_situacao, alarme, icone, visivel_operacao
  )
  select
    v_pipeline_destino_id, nome, ordem, cor, tipo, datacrazy_stage_nome,
    chave, rotulo, grupo, sla_situacao, alarme, icone, visivel_operacao
  from public.pipeline_stages
  where pipeline_id = v_pipeline_origem_id
  order by ordem, id;

  get diagnostics v_etapas_criadas = row_count;
  if v_etapas_criadas = 0 then
    raise exception 'CRM_PIPE_010_SEM_ETAPAS: o Funil 2.0 não possui etapas para clonar';
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
    and l.criado_em <= v_agora;

  get diagnostics v_negocios_movidos = row_count;

  update public.leads
  set pipeline_id = v_pipeline_destino_id
  where criado_em >= v_desde
    and criado_em <= v_agora;

  get diagnostics v_leads_movidos = row_count;

  select count(*) into v_inconsistencias
  from public.leads l
  left join public.negocios n on n.lead_id = l.id
  left join public.pipeline_stages s on s.id = n.stage_id
  where l.criado_em >= v_desde
    and l.criado_em <= v_agora
    and (
      l.pipeline_id is distinct from v_pipeline_destino_id
      or (
        n.id is not null
        and (
          n.pipeline_id is distinct from v_pipeline_destino_id
          or s.pipeline_id is distinct from v_pipeline_destino_id
        )
      )
    );

  if v_leads_movidos <> v_leads_previstos
     or v_negocios_movidos <> v_negocios_previstos
     or v_inconsistencias <> 0 then
    raise exception
      'CRM_PIPE_010_CONTAGEM_DIVERGENTE: leads %/%, negócios %/%, inconsistências %',
      v_leads_movidos, v_leads_previstos,
      v_negocios_movidos, v_negocios_previstos,
      v_inconsistencias;
  end if;

  insert into public.erp_auditoria (
    usuario_nome, acao, modulo, entidade, entidade_id, antes, depois, detalhe
  ) values (
    'Operação administrativa autorizada',
    'migrar_leads_recentes_pipeline',
    'crm',
    'pipeline',
    v_pipeline_destino_id::text,
    jsonb_build_object(
      'pipeline_modelo_id', v_pipeline_origem_id,
      'desde', v_desde,
      'ate', v_agora,
      'filtro_campanha', false
    ),
    jsonb_build_object(
      'pipeline_destino_id', v_pipeline_destino_id,
      'leads_movidos', v_leads_movidos,
      'negocios_movidos', v_negocios_movidos,
      'etapas_criadas', v_etapas_criadas
    ),
    'Todos os leads criados nos 10 dias anteriores à execução foram movidos para um funil novo, sem filtro de campanha; responsáveis, dados e histórico foram preservados.'
  );
end
$migration$;
