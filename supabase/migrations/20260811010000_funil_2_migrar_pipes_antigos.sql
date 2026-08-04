-- Funil 2.0 — promoção do laboratório para carteira real.
--
-- Escopo autorizado: somente negócios abertos dos pipes antigos Atendimento
-- (2), Visitas (3) e Fechamento (4). O Aquário é explicitamente excluído.
-- Os registros de origem permanecem intactos: esta migration cria apenas
-- cópias f2_* idempotentes e remove a antiga trava física de duas cópias.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
DECLARE
  v_aquario bigint := public.aquario_stage_id();
  v_pipes integer;
  v_fontes integer;
BEGIN
  IF v_aquario IS NULL THEN
    RAISE EXCEPTION 'f2_migracao_abortada:aquario_sem_stage_canonico';
  END IF;

  SELECT count(*) INTO v_pipes
  FROM public.pipelines
  WHERE id IN (2,3,4);
  IF v_pipes <> 3 THEN
    RAISE EXCEPTION 'f2_migracao_abortada:pipes_antigos_nao_encontrados';
  END IF;

  SELECT count(*) INTO v_fontes
  FROM public.negocios n
  WHERE n.status='aberto'
    AND n.pipeline_id IN (2,3,4)
    AND n.stage_id IS DISTINCT FROM v_aquario;
  IF v_fontes = 0 THEN
    RAISE EXCEPTION 'f2_migracao_abortada:nenhuma_fonte_elegivel';
  END IF;
END;
$preflight$;

-- A trava era correta no laboratório, mas é incompatível com a carteira real.
DROP TRIGGER IF EXISTS f2_lead_limite_dois ON public.f2_lead;

ALTER TABLE public.f2_config_audit
  DROP CONSTRAINT IF EXISTS f2_config_audit_tipo_check;
ALTER TABLE public.f2_config_audit
  ADD CONSTRAINT f2_config_audit_tipo_check
  CHECK (tipo IN ('etapa','momento','visita','negociacao','pesca','migracao'));

-- A única cópia de laboratório originada do Aquário é retirada do Funil 2.0.
-- Antes disso, seu conteúdo integral é preservado na auditoria. O negócio e o
-- lead originais nunca são alterados nem apagados.
INSERT INTO public.f2_config_audit(tipo,chave,acao,antes,depois)
SELECT 'migracao',f.id::text,'retirar_copia_aquario',to_jsonb(f),
       jsonb_build_object('origem_preservada',true,'motivo','aquario_fora_do_escopo')
FROM public.f2_lead f
JOIN public.negocios n ON n.id=f.origem_negocio_id
WHERE n.stage_id=public.aquario_stage_id()
  AND NOT EXISTS (
    SELECT 1 FROM public.f2_config_audit a
    WHERE a.tipo='migracao' AND a.chave=f.id::text AND a.acao='retirar_copia_aquario'
  );

DELETE FROM public.f2_lead f
USING public.negocios n
WHERE n.id=f.origem_negocio_id
  AND n.stage_id=public.aquario_stage_id();

WITH fontes AS (
  SELECT
    n.id AS negocio_id,n.pipeline_id,n.stage_id,n.criado_em AS negocio_criado_em,
    n.corretor_id,n.lead_id,
    l.nome,l.telefone,
    c.nome AS corretor_nome,
    e.etapa AS ncrm_etapa,e.momento_codigo AS ncrm_momento,
    e.proxima_acao_em,e.ultima_interacao_em,e.primeira_saida_humana_em,
    e.tentativas_feitas,
    CASE
      WHEN e.momento_codigo='BUSCANDO_PRODUTO' THEN 'PROCURANDO_PRODUTO'
      WHEN e.momento_codigo='FEEDBACK_POS_VISITA' THEN 'COLETAR_FEEDBACK'
      WHEN e.momento_codigo='DECISAO_POS_VISITA' THEN 'ACOMPANHAMENTO_POS_VISITA'
      ELSE e.momento_codigo
    END AS momento_ncrm_mapeado,
    CASE
      WHEN n.pipeline_id=2 AND n.stage_id=20 THEN 'PRIMEIRA_ABORDAGEM'
      WHEN n.pipeline_id=2 AND n.stage_id IN (24,26,31,32,33,34,35) THEN 'CADENCIA_SEM_RESPOSTA'
      WHEN n.pipeline_id=2 AND n.stage_id=28 THEN 'TENTANDO_AGENDAMENTO'
      WHEN n.pipeline_id=2 AND n.stage_id=29 THEN 'PROCURANDO_PRODUTO'
      WHEN n.pipeline_id=3 AND n.stage_id IN (42) THEN 'REMARCAR_VISITA'
      WHEN n.pipeline_id=4 AND n.stage_id IN (43,45,50) THEN 'REMARCAR_VISITA'
      WHEN n.pipeline_id=3 AND n.stage_id IN (54) THEN 'COLETAR_FEEDBACK'
      WHEN n.pipeline_id=4 AND n.stage_id IN (47) THEN 'COLETAR_FEEDBACK'
      WHEN n.pipeline_id IN (3,4) AND n.stage_id IN (49,52,44,46) THEN 'ACOMPANHAMENTO_POS_VISITA'
      WHEN n.pipeline_id IN (3,4) AND n.stage_id IN (51,53) THEN 'TENTANDO_AGENDAMENTO'
      ELSE 'CONVERSANDO_QUALIFICANDO'
    END AS momento_fallback
  FROM public.negocios n
  JOIN public.leads l ON l.id=n.lead_id
  LEFT JOIN public.corretores c ON c.id=n.corretor_id
  LEFT JOIN public.ncrm_estado e ON e.negocio_id=n.id
  WHERE n.status='aberto'
    AND n.pipeline_id IN (2,3,4)
    AND n.stage_id IS DISTINCT FROM public.aquario_stage_id()
), resolvidas AS (
  SELECT f.*,
    CASE WHEN cfg_ncrm.codigo IS NOT NULL THEN cfg_ncrm.codigo ELSE f.momento_fallback END AS momento_codigo
  FROM fontes f
  LEFT JOIN public.f2_momento_config cfg_ncrm ON cfg_ncrm.codigo=f.momento_ncrm_mapeado
), completas AS (
  SELECT r.*,m.etapa,m.acao_codigo,m.acao_rotulo,m.prazo_minutos,
         sa.analisado_em AS sara_em,
         COALESCE(NULLIF(sa.justificativa,''),NULLIF(sa.proxima_acao_sugerida,'')) AS sara_resumo
  FROM resolvidas r
  JOIN public.f2_momento_config m ON m.codigo=r.momento_codigo
  LEFT JOIN LATERAL (
    SELECT a.analisado_em,a.justificativa,a.proxima_acao_sugerida
    FROM public.ncrm_sara_analise a
    WHERE a.negocio_id=r.negocio_id
    ORDER BY a.analisado_em DESC,a.id DESC
    LIMIT 1
  ) sa ON true
)
INSERT INTO public.f2_lead(
  origem_negocio_id,nome,telefone,corretor_id,corretor_nome,
  etapa,momento_codigo,acao_codigo,acao_rotulo,proxima_acao_em,
  cadencia_passo,ultima_interacao_em,ultima_acao_confirmada_em,
  ultima_acao_fonte,ultima_reavaliacao_sara_em,ultima_reavaliacao_resumo,
  corte_conversa_em
)
SELECT
  c.negocio_id,c.nome,c.telefone,c.corretor_id,c.corretor_nome,
  c.etapa,c.momento_codigo,c.acao_codigo,c.acao_rotulo,
  COALESCE(c.proxima_acao_em,now()+make_interval(mins=>COALESCE(c.prazo_minutos,1440))),
  CASE WHEN c.momento_codigo='CADENCIA_SEM_RESPOSTA'
       THEN LEAST(5,GREATEST(0,COALESCE(c.tentativas_feitas,0))) ELSE 0 END,
  c.ultima_interacao_em,c.primeira_saida_humana_em,
  CASE WHEN c.primeira_saida_humana_em IS NULL THEN NULL ELSE 'importacao' END,
  c.sara_em,
  COALESCE(c.sara_resumo,'Importado do pipe antigo; aguarda a próxima leitura da Sara.'),
  COALESCE(c.negocio_criado_em,'2000-01-01 00:00:00+00'::timestamptz)
FROM completas c
ON CONFLICT (origem_negocio_id) DO UPDATE SET
  nome=EXCLUDED.nome,
  telefone=EXCLUDED.telefone,
  corretor_id=EXCLUDED.corretor_id,
  corretor_nome=EXCLUDED.corretor_nome,
  corte_conversa_em=LEAST(public.f2_lead.corte_conversa_em,EXCLUDED.corte_conversa_em),
  atualizado_em=now();

INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload)
SELECT f.id,'importacao','Migrado dos pipes antigos',
       'Cópia operacional criada no Funil 2.0; o negócio original permanece intacto.',
       jsonb_build_object('origem_negocio_id',f.origem_negocio_id,'aquario_incluido',false)
FROM public.f2_lead f
JOIN public.negocios n ON n.id=f.origem_negocio_id
WHERE n.status='aberto' AND n.pipeline_id IN (2,3,4)
  AND n.stage_id IS DISTINCT FROM public.aquario_stage_id()
  AND NOT EXISTS (
    SELECT 1 FROM public.f2_evento e
    WHERE e.funil_lead_id=f.id AND e.titulo='Migrado dos pipes antigos'
  );

-- Visitas reais ligadas aos negócios migrados passam a alimentar o Pipe de
-- Visitas do Funil 2.0, sem alterar a agenda original.
ALTER TABLE public.f2_visita ADD COLUMN IF NOT EXISTS origem_visita_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS f2_visita_origem_visita_uk
  ON public.f2_visita(origem_visita_id) WHERE origem_visita_id IS NOT NULL;

INSERT INTO public.f2_visita(
  funil_lead_id,inicio_em,imovel,status,observacao,origem_visita_id,criado_em,atualizado_em
)
SELECT
  f.id,
  COALESCE(
    (v.data::timestamp+COALESCE(v.hora_inicio,time '09:00')) AT TIME ZONE 'America/Sao_Paulo',
    v.criado_em,now()
  ),
  left(COALESCE(NULLIF(btrim(v.produto),''),NULLIF(btrim(v.local),''),'Imóvel a confirmar'),120),
  CASE
    WHEN lower(COALESCE(v.status,'')) ~ 'realiz' THEN 'realizada'
    WHEN lower(COALESCE(v.status,'')) ~ 'cancel' THEN 'cancelada'
    WHEN lower(COALESCE(v.status,'')) ~ 'não.compare|nao.compare|falt' THEN 'nao_compareceu'
    WHEN lower(COALESCE(v.status,'')) ~ 'confirm' THEN 'confirmada'
    ELSE 'agendada'
  END,
  left(NULLIF(concat_ws(' · ',NULLIF(v.observacoes,''),NULLIF(v.resultado,''),NULLIF(v.motivo_cancelamento,'')),''),500),
  v.id,v.criado_em,COALESCE(v.atualizado_em,v.criado_em,now())
FROM public.visitas v
JOIN public.negocios n ON n.id=v.negocio_id
JOIN public.f2_lead f ON f.origem_negocio_id=n.id
WHERE n.status='aberto' AND n.pipeline_id IN (2,3,4)
  AND n.stage_id IS DISTINCT FROM public.aquario_stage_id()
ON CONFLICT (origem_visita_id) WHERE origem_visita_id IS NOT NULL DO NOTHING;

-- Negócios do antigo pipe de Fechamento aparecem na Esteira, mantendo a
-- referência ao negócio original para garantir idempotência.
ALTER TABLE public.f2_negociacao ADD COLUMN IF NOT EXISTS origem_negocio_id bigint;
CREATE UNIQUE INDEX IF NOT EXISTS f2_negociacao_origem_negocio_uk
  ON public.f2_negociacao(origem_negocio_id) WHERE origem_negocio_id IS NOT NULL;

INSERT INTO public.f2_negociacao(
  funil_lead_id,titulo,etapa,valor,observacao,origem_negocio_id,criado_em,atualizado_em
)
SELECT
  f.id,
  left('Negociação · '||l.nome,120),
  CASE
    WHEN n.stage_id=52 THEN 'venda'
    WHEN n.stage_id=43 THEN 'perdida'
    WHEN n.stage_id=46 THEN 'proposta'
    WHEN n.stage_id IN (47,51) THEN 'qualificacao'
    ELSE 'documentacao'
  END,
  n.valor,
  left('Importado do pipe Fechamento · etapa anterior: '||COALESCE(s.nome,'não informada'),500),
  n.id,n.criado_em,COALESCE(n.ultima_movimentacao,n.criado_em,now())
FROM public.negocios n
JOIN public.leads l ON l.id=n.lead_id
JOIN public.f2_lead f ON f.origem_negocio_id=n.id
LEFT JOIN public.pipeline_stages s ON s.id=n.stage_id
WHERE n.status='aberto' AND n.pipeline_id=4
ON CONFLICT (origem_negocio_id) WHERE origem_negocio_id IS NOT NULL DO NOTHING;

-- Pescar continua disponível para o Aquário, mas passa a adicionar um lead
-- Novo sem apagar nem substituir qualquer carteira já migrada.
CREATE OR REPLACE FUNCTION public.f2_pescar_negocio(
  p_negocio_id bigint,
  p_substituir_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_novo uuid;
  v_corte timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  IF p_substituir_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'erro','substituicao_desativada');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('f2_pescar_negocio'));
  IF NOT EXISTS(
    SELECT 1 FROM public.negocios n JOIN public.leads l ON l.id=n.lead_id
    WHERE n.id=p_negocio_id AND n.stage_id=public.aquario_stage_id()
      AND n.status='aberto' AND n.corretor_id IS NULL AND l.corretor_id IS NULL
  ) THEN
    RETURN jsonb_build_object('ok',false,'erro','lead_nao_disponivel_no_aquario');
  END IF;
  IF EXISTS(SELECT 1 FROM public.f2_lead WHERE origem_negocio_id=p_negocio_id) THEN
    RETURN jsonb_build_object('ok',false,'erro','ja_esta_no_funil');
  END IF;

  INSERT INTO public.f2_lead(
    origem_negocio_id,nome,telefone,corretor_id,corretor_nome,
    etapa,momento_codigo,acao_codigo,acao_rotulo,proxima_acao_em,
    cadencia_passo,ultima_reavaliacao_resumo,corte_conversa_em,atualizado_por
  )
  SELECT n.id,l.nome,l.telefone,NULL,NULL,
    'novo','PRIMEIRA_ABORDAGEM','PRIMEIRA_ABORDAGEM','Fazer a primeira abordagem',
    v_corte+interval '5 minutes',0,
    'Lead pescado; aguarda a primeira leitura da Sara.',v_corte,v_uid
  FROM public.negocios n JOIN public.leads l ON l.id=n.lead_id
  WHERE n.id=p_negocio_id
  RETURNING id INTO v_novo;

  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(v_novo,'momento_alterado','Lead pescado do Aquário',
    'Entrou como Novo, sem histórico anterior e com primeira abordagem em cinco minutos.',
    jsonb_build_object('etapa','novo','momento','PRIMEIRA_ABORDAGEM','corte_conversa_em',v_corte),v_uid);
  INSERT INTO public.f2_config_audit(tipo,chave,acao,depois,criado_por)
  VALUES('pesca',p_negocio_id::text,'pescar_lead_aquario',
    jsonb_build_object('novo_id',v_novo,'substituiu',false),v_uid);
  RETURN jsonb_build_object('ok',true,'id',v_novo,'etapa','novo','momento','PRIMEIRA_ABORDAGEM');
END;
$fn$;
REVOKE ALL ON FUNCTION public.f2_pescar_negocio(bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_pescar_negocio(bigint,uuid) TO authenticated,service_role;

INSERT INTO public.f2_config_audit(tipo,chave,acao,depois)
VALUES('migracao','pipes_antigos_2_3_4','migrar_carteira',jsonb_build_object(
  'origens_preservadas',true,
  'aquario_incluido',false,
  'leads',(SELECT count(*) FROM public.f2_lead f JOIN public.negocios n ON n.id=f.origem_negocio_id WHERE n.pipeline_id IN (2,3,4) AND n.status='aberto' AND n.stage_id IS DISTINCT FROM public.aquario_stage_id()),
  'visitas',(SELECT count(*) FROM public.f2_visita WHERE origem_visita_id IS NOT NULL),
  'negociacoes',(SELECT count(*) FROM public.f2_negociacao WHERE origem_negocio_id IS NOT NULL)
));

DO $verify$
DECLARE v_fontes integer; v_copias integer;
BEGIN
  SELECT count(*) INTO v_fontes FROM public.negocios n
  WHERE n.status='aberto' AND n.pipeline_id IN (2,3,4)
    AND n.stage_id IS DISTINCT FROM public.aquario_stage_id();
  SELECT count(*) INTO v_copias FROM public.f2_lead f
  JOIN public.negocios n ON n.id=f.origem_negocio_id
  WHERE n.status='aberto' AND n.pipeline_id IN (2,3,4)
    AND n.stage_id IS DISTINCT FROM public.aquario_stage_id();
  IF v_copias<>v_fontes THEN
    RAISE EXCEPTION 'f2_migracao_incompleta:fontes=%,copias=%',v_fontes,v_copias;
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.f2_lead f JOIN public.negocios n ON n.id=f.origem_negocio_id
    WHERE n.stage_id=public.aquario_stage_id()
  ) THEN
    RAISE EXCEPTION 'f2_migracao_invalida:aquario_incluido';
  END IF;
END;
$verify$;

COMMENT ON TABLE public.f2_lead IS
  'Carteira operacional do Funil 2.0. Os negócios de origem permanecem preservados.';

COMMIT;
