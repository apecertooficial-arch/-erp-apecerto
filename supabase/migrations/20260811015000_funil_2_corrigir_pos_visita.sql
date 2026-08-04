-- Funil 2.0 — corrige a classificação importada de Pós-visita.
--
-- A migração inicial deixou o estado antigo da Nova Era prevalecer sobre a
-- etapa do pipe. Isso colocou centenas de negócios sem visita em Pós-visita.
-- Esta correção usa evidência operacional: visita realizada ou etapa antiga
-- explicitamente posterior à visita. Origens e módulos legados ficam intactos.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.f2_evento DROP CONSTRAINT IF EXISTS f2_evento_tipo_check;
ALTER TABLE public.f2_evento ADD CONSTRAINT f2_evento_tipo_check
  CHECK (tipo IN ('importacao','momento_alterado','acao_confirmada','sara_reavaliou','correcao_classificacao'));

CREATE TEMP TABLE f2_pos_visita_corrigir ON COMMIT DROP AS
SELECT
  f.id,
  to_jsonb(f) AS antes,
  CASE
    WHEN n.pipeline_id=2 AND n.stage_id=20 THEN 'PRIMEIRA_ABORDAGEM'
    WHEN n.pipeline_id=2 AND n.stage_id IN (24,26,31,32,33,34,35) THEN 'CADENCIA_SEM_RESPOSTA'
    WHEN (n.pipeline_id=2 AND n.stage_id=28)
      OR (n.pipeline_id IN (3,4) AND n.stage_id IN (42,43,45,50,51,53)) THEN 'TENTANDO_AGENDAMENTO'
    WHEN n.pipeline_id=2 AND n.stage_id=29 THEN 'PROCURANDO_PRODUTO'
    ELSE 'CONVERSANDO_QUALIFICANDO'
  END AS momento_codigo,
  CASE
    WHEN n.pipeline_id=2 AND n.stage_id=32 THEN 1
    WHEN n.pipeline_id=2 AND n.stage_id=33 THEN 2
    WHEN n.pipeline_id=2 AND n.stage_id=34 THEN 3
    WHEN n.pipeline_id=2 AND n.stage_id=35 THEN 4
    ELSE 0
  END::smallint AS cadencia_passo
FROM public.f2_lead f
JOIN public.negocios n ON n.id=f.origem_negocio_id
WHERE f.etapa='pos_visita'
  -- Estas etapas antigas são evidência explícita de visita/avanço posterior.
  AND NOT (n.pipeline_id IN (3,4) AND n.stage_id IN (47,49,52,54))
  AND NOT EXISTS (
    SELECT 1 FROM public.f2_visita fv
    WHERE fv.funil_lead_id=f.id AND fv.status='realizada'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE v.negocio_id=n.id AND lower(COALESCE(v.status,'')) ~ 'realiz'
  );

INSERT INTO public.f2_config_audit(tipo,chave,acao,antes,depois)
SELECT 'migracao',c.id::text,'corrigir_pos_visita_sem_evidencia',c.antes,
       jsonb_build_object('momento_codigo',c.momento_codigo,'motivo','sem_visita_realizada')
FROM f2_pos_visita_corrigir c
WHERE NOT EXISTS (
  SELECT 1 FROM public.f2_config_audit a
  WHERE a.tipo='migracao' AND a.chave=c.id::text
    AND a.acao='corrigir_pos_visita_sem_evidencia'
);

UPDATE public.f2_lead f
SET etapa=m.etapa,
    momento_codigo=m.codigo,
    acao_codigo=m.acao_codigo,
    acao_rotulo=m.acao_rotulo,
    cadencia_passo=c.cadencia_passo,
    proxima_acao_em=LEAST(f.proxima_acao_em,now()+make_interval(mins=>m.prazo_minutos)),
    ultima_reavaliacao_resumo='Classificação importada corrigida: não há evidência de visita realizada. Aguarda leitura da Sara.',
    atualizado_em=now(),
    versao=f.versao+1
FROM f2_pos_visita_corrigir c
JOIN public.f2_momento_config m ON m.codigo=c.momento_codigo
WHERE f.id=c.id;

INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload)
SELECT c.id,'correcao_classificacao','Pós-visita corrigido',
       'O card voltou ao momento compatível com o pipe porque não existe visita realizada.',
       jsonb_build_object('antes','ACOMPANHAMENTO_POS_VISITA','depois',c.momento_codigo,'origens_preservadas',true)
FROM f2_pos_visita_corrigir c
WHERE NOT EXISTS (
  SELECT 1 FROM public.f2_evento e
  WHERE e.funil_lead_id=c.id AND e.titulo='Pós-visita corrigido'
);

-- O inverso também precisa ser verdadeiro: visita realmente realizada deve
-- gerar a obrigação de coletar feedback, mesmo que a importação tenha usado
-- um estado antigo incompatível.
CREATE TEMP TABLE f2_visita_realizada_promover ON COMMIT DROP AS
SELECT f.id,to_jsonb(f) AS antes
FROM public.f2_lead f
WHERE f.momento_codigo<>'COLETAR_FEEDBACK'
  AND EXISTS (
    SELECT 1 FROM public.f2_visita fv
    WHERE fv.funil_lead_id=f.id AND fv.status='realizada'
  );

INSERT INTO public.f2_config_audit(tipo,chave,acao,antes,depois)
SELECT 'migracao',p.id::text,'promover_visita_realizada',p.antes,
       jsonb_build_object('momento_codigo','COLETAR_FEEDBACK','motivo','visita_realizada')
FROM f2_visita_realizada_promover p
WHERE NOT EXISTS (
  SELECT 1 FROM public.f2_config_audit a
  WHERE a.tipo='migracao' AND a.chave=p.id::text AND a.acao='promover_visita_realizada'
);

UPDATE public.f2_lead f
SET etapa=m.etapa,
    momento_codigo=m.codigo,
    acao_codigo=m.acao_codigo,
    acao_rotulo=m.acao_rotulo,
    cadencia_passo=0,
    proxima_acao_em=LEAST(f.proxima_acao_em,now()+make_interval(mins=>m.prazo_minutos)),
    ultima_reavaliacao_resumo='Visita realizada confirmada; feedback obrigatório.',
    atualizado_em=now(),
    versao=f.versao+1
FROM f2_visita_realizada_promover p
JOIN public.f2_momento_config m ON m.codigo='COLETAR_FEEDBACK'
WHERE f.id=p.id;

INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload)
SELECT p.id,'correcao_classificacao','Visita realizada reconhecida',
       'O card foi levado para Coletar feedback por existir visita realizada.',
       jsonb_build_object('depois','COLETAR_FEEDBACK','origens_preservadas',true)
FROM f2_visita_realizada_promover p
WHERE NOT EXISTS (
  SELECT 1 FROM public.f2_evento e
  WHERE e.funil_lead_id=p.id AND e.titulo='Visita realizada reconhecida'
);

DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.f2_lead f
    JOIN public.negocios n ON n.id=f.origem_negocio_id
    WHERE f.etapa='pos_visita'
      AND NOT (n.pipeline_id IN (3,4) AND n.stage_id IN (47,49,52,54))
      AND NOT EXISTS (SELECT 1 FROM public.f2_visita v WHERE v.funil_lead_id=f.id AND v.status='realizada')
  ) THEN
    RAISE EXCEPTION 'f2_pos_visita_correcao_incompleta';
  END IF;
END;
$verify$;

COMMIT;
