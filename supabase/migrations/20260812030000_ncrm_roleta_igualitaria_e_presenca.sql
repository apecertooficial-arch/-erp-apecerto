-- Roleta operacional igualitária para leads novos.
--
-- Regras:
--   * o bloco publicado da Automação 42 continua definindo QUEM participa;
--   * peso deixa de influenciar: todos os participantes ativos valem 1;
--   * apenas corretor elegível e com D-API saudável pode ser escolhido;
--   * a escolha é round-robin pela última atribuição, sem sorteio ponderado;
--   * a fila histórica dos 99 leads permanece pausada e não é consumida aqui;
--   * lead novo sem candidato apto fica pendente e é retentado a cada minuto.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS ncrm_private.ncrm_roleta_igual_estado (
  corretor_id bigint PRIMARY KEY REFERENCES public.corretores(id) ON DELETE CASCADE,
  ultimo_recebimento_em timestamptz,
  recebidos bigint NOT NULL DEFAULT 0 CHECK (recebidos >= 0),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ncrm_private.ncrm_distribuicao_novo_pendente (
  negocio_id bigint PRIMARY KEY REFERENCES public.negocios(id) ON DELETE CASCADE,
  lead_id bigint NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  ultimo_motivo text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  tentado_em timestamptz,
  distribuido_em timestamptz
);

REVOKE ALL ON ncrm_private.ncrm_roleta_igual_estado,
  ncrm_private.ncrm_distribuicao_novo_pendente FROM PUBLIC,anon,authenticated;
GRANT SELECT ON ncrm_private.ncrm_roleta_igual_estado,
  ncrm_private.ncrm_distribuicao_novo_pendente TO service_role;

-- A configuração também passa a dizer a verdade: todos têm peso 1. A lista,
-- os toggles e as demais opções da Automação 42 são preservados integralmente.
UPDATE public.automacoes a
SET mapa = jsonb_set(
      a.mapa,
      '{automation,blocks}',
      (
        SELECT jsonb_agg(
          CASE WHEN b.bloco->>'type' = 'distribution' THEN
            jsonb_set(
              b.bloco,
              '{options,distribuicao,items}',
              COALESCE((
                SELECT jsonb_agg(jsonb_set(i.item,'{peso}',to_jsonb(1),true) ORDER BY i.ord)
                FROM jsonb_array_elements(COALESCE(b.bloco->'options'->'distribuicao'->'items','[]'::jsonb))
                     WITH ORDINALITY i(item,ord)
              ),'[]'::jsonb),
              true
            )
          ELSE b.bloco END
          ORDER BY b.ord
        )
        FROM jsonb_array_elements(COALESCE(a.mapa->'automation'->'blocks','[]'::jsonb))
             WITH ORDINALITY b(bloco,ord)
      ),
      true
    ),
    atualizada_em = now()
WHERE a.id = 42
  AND a.mapa->'automation'->'blocks' IS NOT NULL;

CREATE OR REPLACE FUNCTION ncrm_private.ncrm_distribuir_negocio_igualitario(p_negocio_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_negocio public.negocios%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_items jsonb;
  v_automacao_nome text;
  v_corretor_id bigint;
  v_corretor_nome text;
  v_momento public.f2_momento_config%ROWTYPE;
  v_funil_lead_id uuid;
  v_motivos jsonb;
BEGIN
  -- Serializa a escolha: duas entradas simultâneas não recebem o mesmo
  -- "próximo" corretor por corrida de leitura.
  PERFORM pg_advisory_xact_lock(hashtextextended('ncrm_roleta_igualitaria_v1',0));

  SELECT * INTO v_negocio FROM public.negocios WHERE id=p_negocio_id FOR UPDATE;
  IF v_negocio.id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'distribuido',false,'motivo','negocio_inexistente');
  END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id=v_negocio.lead_id FOR UPDATE;
  IF v_negocio.corretor_id IS NOT NULL OR v_lead.corretor_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'distribuido',true,'motivo','ja_atribuido',
      'corretor_id',COALESCE(v_negocio.corretor_id,v_lead.corretor_id));
  END IF;

  IF v_negocio.stage_id = public.aquario_stage_id()
     OR COALESCE(v_lead.tags,'[]'::jsonb) @> '[{"name":"Aquário"}]'::jsonb THEN
    RETURN jsonb_build_object('ok',true,'distribuido',false,'motivo','aquario_excluido');
  END IF;

  -- A fila de migração dos pipes antigos tem interruptor próprio. Nunca pode
  -- ser drenada por esta rotina de lead novo.
  IF EXISTS (
    SELECT 1 FROM ncrm_private.f2_distribuicao_programada q
    WHERE q.negocio_id=v_negocio.id AND q.status='pendente'
  ) THEN
    RETURN jsonb_build_object('ok',true,'distribuido',false,'motivo','fila_historica_pausada');
  END IF;

  SELECT a.nome,b.bloco->'options'->'distribuicao'->'items'
    INTO v_automacao_nome,v_items
  FROM public.automacoes a
  CROSS JOIN LATERAL jsonb_array_elements(a.mapa->'automation'->'blocks') b(bloco)
  WHERE a.id=42 AND a.ativa IS TRUE AND a.status='publicado'
    AND b.bloco->>'type'='distribution'
  LIMIT 1;

  IF v_items IS NULL OR jsonb_array_length(v_items)=0 THEN
    INSERT INTO ncrm_private.ncrm_distribuicao_novo_pendente
      (negocio_id,lead_id,tentativas,ultimo_motivo,tentado_em)
    VALUES(v_negocio.id,v_lead.id,1,'automacao_42_sem_participantes',now())
    ON CONFLICT(negocio_id) DO UPDATE SET tentativas=ncrm_private.ncrm_distribuicao_novo_pendente.tentativas+1,
      ultimo_motivo=EXCLUDED.ultimo_motivo,tentado_em=now();
    RETURN jsonb_build_object('ok',true,'distribuido',false,'motivo','automacao_42_sem_participantes');
  END IF;

  WITH participantes AS (
    SELECT DISTINCT c.id,c.nome
    FROM jsonb_array_elements(v_items) i(item)
    JOIN public.corretores c
      ON public.nome_normalizado(c.nome)=public.nome_normalizado(i.item->>'corretor')
    WHERE COALESCE((i.item->>'on')::boolean,true)
      AND COALESCE(c.ativo,false)
  ), aptos AS (
    SELECT p.id,p.nome,e.ultimo_recebimento_em
    FROM participantes p
    LEFT JOIN ncrm_private.ncrm_roleta_igual_estado e ON e.corretor_id=p.id
    WHERE public.corretor_pode_receber(p.id)
      AND public.instancia_saudavel(p.id)
  )
  SELECT id,nome INTO v_corretor_id,v_corretor_nome
  FROM aptos
  ORDER BY ultimo_recebimento_em ASC NULLS FIRST,id
  LIMIT 1;

  IF v_corretor_id IS NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'corretor_id',c.id,'corretor',c.nome,
      'elegibilidade',public.ncrm_corretor_elegibilidade(c.id,now()),
      'dapi_saudavel',public.instancia_saudavel(c.id)
    ) ORDER BY c.nome),'[]'::jsonb)
    INTO v_motivos
    FROM jsonb_array_elements(v_items) i(item)
    JOIN public.corretores c
      ON public.nome_normalizado(c.nome)=public.nome_normalizado(i.item->>'corretor')
    WHERE COALESCE((i.item->>'on')::boolean,true) AND COALESCE(c.ativo,false);

    INSERT INTO ncrm_private.ncrm_distribuicao_novo_pendente
      (negocio_id,lead_id,tentativas,ultimo_motivo,tentado_em)
    VALUES(v_negocio.id,v_lead.id,1,'nenhum_corretor_apto',now())
    ON CONFLICT(negocio_id) DO UPDATE SET tentativas=ncrm_private.ncrm_distribuicao_novo_pendente.tentativas+1,
      ultimo_motivo=EXCLUDED.ultimo_motivo,tentado_em=now();
    RETURN jsonb_build_object('ok',true,'distribuido',false,'motivo','nenhum_corretor_apto','diagnostico',v_motivos);
  END IF;

  UPDATE public.leads SET corretor_id=v_corretor_id,atualizado_em=now()
   WHERE id=v_lead.id AND corretor_id IS NULL;
  UPDATE public.negocios SET corretor_id=v_corretor_id,ultima_movimentacao=now()
   WHERE id=v_negocio.id AND corretor_id IS NULL;

  INSERT INTO ncrm_private.ncrm_roleta_igual_estado
    (corretor_id,ultimo_recebimento_em,recebidos,atualizado_em)
  VALUES(v_corretor_id,now(),1,now())
  ON CONFLICT(corretor_id) DO UPDATE SET
    ultimo_recebimento_em=now(),recebidos=ncrm_private.ncrm_roleta_igual_estado.recebidos+1,atualizado_em=now();

  SELECT * INTO v_momento FROM public.f2_momento_config
   WHERE codigo='PRIMEIRA_ABORDAGEM' AND ativo;
  IF v_momento.codigo IS NOT NULL THEN
    INSERT INTO public.f2_lead(
      origem_negocio_id,nome,telefone,corretor_id,corretor_nome,etapa,momento_codigo,
      acao_codigo,acao_rotulo,proxima_acao_em,cadencia_passo,ultima_reavaliacao_resumo,
      corte_conversa_em,historico_completo
    ) VALUES (
      v_negocio.id,v_lead.nome,v_lead.telefone,v_corretor_id,v_corretor_nome,'novo',v_momento.codigo,
      v_momento.acao_codigo,v_momento.acao_rotulo,public.ncrm_primeira_abordagem_prazo(now()),0,
      'Lead novo distribuído pela roleta igualitária. A Sara avaliará a conversa após a interação confirmada.',
      now(),true
    ) ON CONFLICT(origem_negocio_id) DO NOTHING
    RETURNING id INTO v_funil_lead_id;

    IF v_funil_lead_id IS NOT NULL THEN
      INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload)
      VALUES(v_funil_lead_id,'importacao','Lead novo distribuído',
        'O card nasceu em Novo pela roleta igualitária, sem peso por corretor.',
        jsonb_build_object('lead_id',v_lead.id,'negocio_id',v_negocio.id,'corretor_id',v_corretor_id));
    END IF;
  END IF;

  DELETE FROM ncrm_private.ncrm_distribuicao_novo_pendente WHERE negocio_id=v_negocio.id;
  INSERT INTO public.motor_execucoes
    (automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
  VALUES(42,COALESCE(v_automacao_nome,'Distribuição igualitária'),'NCRM_IGUALITARIA_V1',
    'distribuicao','ok',v_lead.nome,v_lead.telefone,
    'Lead novo distribuído igualmente para '||v_corretor_nome);

  RETURN jsonb_build_object('ok',true,'distribuido',true,'motivo','atribuido',
    'corretor_id',v_corretor_id,'corretor',v_corretor_nome,'funil_lead_id',v_funil_lead_id);
END
$fn$;

REVOKE ALL ON FUNCTION ncrm_private.ncrm_distribuir_negocio_igualitario(bigint)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.ncrm_distribuir_negocio_igualitario(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.ncrm_distribuir_lead_novo(p_negocio_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE v_role text;
BEGIN
  IF (SELECT auth.role()) <> 'service_role' THEN
    SELECT u.role INTO v_role FROM public.usuarios u
     WHERE u.id=(SELECT auth.uid()) AND COALESCE(u.ativo,true);
    IF v_role IS NULL OR v_role NOT IN ('admin','diretor','gerente','executivo','gestor_comercial','gestor_equipe') THEN
      RAISE EXCEPTION 'sem_permissao_para_distribuir' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN ncrm_private.ncrm_distribuir_negocio_igualitario(p_negocio_id);
END
$fn$;
REVOKE ALL ON FUNCTION public.ncrm_distribuir_lead_novo(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ncrm_distribuir_lead_novo(bigint) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION ncrm_private.ncrm_distribuir_novos_pendentes(p_lote integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE r record; v_res jsonb; v_ok integer:=0; v_pendente integer:=0;
BEGIN
  IF p_lote<1 OR p_lote>100 THEN RAISE EXCEPTION 'lote_invalido'; END IF;
  FOR r IN
    SELECT q.negocio_id FROM ncrm_private.ncrm_distribuicao_novo_pendente q
    JOIN public.negocios n ON n.id=q.negocio_id AND n.corretor_id IS NULL
    ORDER BY q.criado_em,q.negocio_id FOR UPDATE OF q SKIP LOCKED LIMIT p_lote
  LOOP
    v_res:=ncrm_private.ncrm_distribuir_negocio_igualitario(r.negocio_id);
    IF COALESCE((v_res->>'distribuido')::boolean,false) THEN v_ok:=v_ok+1;
    ELSE v_pendente:=v_pendente+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'distribuidos',v_ok,'ainda_pendentes',v_pendente);
END
$fn$;
REVOKE ALL ON FUNCTION ncrm_private.ncrm_distribuir_novos_pendentes(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.ncrm_distribuir_novos_pendentes(integer) TO service_role;

DO $cron$
DECLARE v_job bigint;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname='ncrm-roleta-igualitaria-novos';
  IF v_job IS NULL THEN
    PERFORM cron.schedule('ncrm-roleta-igualitaria-novos','* * * * *',
      'select ncrm_private.ncrm_distribuir_novos_pendentes(20)');
  ELSE
    PERFORM cron.alter_job(v_job,schedule:='* * * * *',command:='select ncrm_private.ncrm_distribuir_novos_pendentes(20)',active:=true);
  END IF;
END
$cron$;

-- Recupera somente leads manuais recentes que nasceram sem responsável durante
-- o defeito desta manhã. A fila histórica (99) e o Aquário continuam fora.
-- A tentativa é segura: se ninguém estiver apto, o item apenas permanece na
-- fila de retry; nenhuma atribuição é forçada.
INSERT INTO ncrm_private.ncrm_distribuicao_novo_pendente
  (negocio_id,lead_id,tentativas,ultimo_motivo,tentado_em)
SELECT n.id,l.id,0,'recuperado_apos_correcao_da_roleta',NULL
FROM public.negocios n
JOIN public.leads l ON l.id=n.lead_id
WHERE n.corretor_id IS NULL
  AND l.corretor_id IS NULL
  AND n.status='aberto'
  AND n.criado_em>=now()-interval '3 hours'
  AND lower(COALESCE(l.origem,''))='manual'
  AND n.stage_id<>public.aquario_stage_id()
  AND NOT COALESCE(l.tags,'[]'::jsonb) @> '[{"name":"Aquário"}]'::jsonb
  AND NOT EXISTS(
    SELECT 1 FROM ncrm_private.f2_distribuicao_programada h
    WHERE h.negocio_id=n.id AND h.status='pendente'
  )
ON CONFLICT(negocio_id) DO NOTHING;

-- A presença operacional definida para a roleta precisa estar efetivamente
-- ativa. O componente global consulta esta configuração e abre o prompt.
UPDATE public.presenca_config
SET ativa=true,hora_inicio='09:30',hora_fim='18:30',intervalo_min=15,atualizado_em=now()
WHERE id=1;

DO $check$
DECLARE v_pesos integer; v_job_ativo boolean;
BEGIN
  IF to_regclass('public.apecerto_baseline_metadata') IS NOT NULL THEN RETURN; END IF;
  SELECT count(DISTINCT i.item->>'peso') INTO v_pesos
  FROM public.automacoes a
  CROSS JOIN LATERAL jsonb_array_elements(a.mapa->'automation'->'blocks') b(bloco)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b.bloco->'options'->'distribuicao'->'items','[]'::jsonb)) i(item)
  WHERE a.id=42 AND b.bloco->>'type'='distribution' AND COALESCE((i.item->>'on')::boolean,true);
  IF v_pesos<>1 OR EXISTS(
    SELECT 1 FROM public.automacoes a
    CROSS JOIN LATERAL jsonb_array_elements(a.mapa->'automation'->'blocks') b(bloco)
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b.bloco->'options'->'distribuicao'->'items','[]'::jsonb)) i(item)
    WHERE a.id=42 AND b.bloco->>'type'='distribution'
      AND COALESCE((i.item->>'on')::boolean,true) AND COALESCE((i.item->>'peso')::numeric,0)<>1
  ) THEN RAISE EXCEPTION 'roleta_ainda_ponderada'; END IF;
  SELECT active INTO v_job_ativo FROM cron.job WHERE jobname='ncrm-roleta-igualitaria-novos';
  IF v_job_ativo IS DISTINCT FROM true THEN RAISE EXCEPTION 'cron_roleta_novos_inativo'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.presenca_config WHERE id=1 AND ativa AND intervalo_min=15) THEN
    RAISE EXCEPTION 'presenca_15_min_inativa';
  END IF;
END
$check$;

COMMIT;
