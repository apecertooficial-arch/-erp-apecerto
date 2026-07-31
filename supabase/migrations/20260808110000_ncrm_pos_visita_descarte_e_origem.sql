-- =====================================================================
-- CRM Nova Era — pós-visita, motivos de descarte e origem da próxima ação
-- ---------------------------------------------------------------------
-- Três coisas que a operação pedia e o banco ainda não sustentava:
--
--  1. RESULTADO DA VISITA. A tabela `visitas` só tinha status (agendada,
--     realizada, cancelada). "Realizada" não diz se o cliente gostou, sumiu
--     ou vai fazer proposta — e sem isso ninguém cobra o desfecho.
--
--  2. MOTIVOS DE DESCARTE. Eram seis, travados por CHECK e por whitelist na
--     RPC. Faltavam os que a operação mais usa: sem resposta, fora da região,
--     desistiu, não quer mais contato, produto incompatível.
--
--  3. ORIGEM E MOTIVO DA PRÓXIMA AÇÃO. "Ligar sexta" sem dizer por quê e sem
--     dizer quem sugeriu é uma tarefa órfã. Agora a ação carrega o motivo e
--     de onde veio (corretor, Sara ou cadência).
--
-- REGRA DO PÓS-VISITA (decisão comercial, 31/07):
--   fara_proposta   -> Esteira de Vendas
--   nao_gostou      -> descarte, com motivo
--   remarcar        -> continua no Pipe até a nova visita existir
--   os demais       -> voltam para o funil, em "em_acompanhamento",
--                      com próxima ação e prazo obrigatórios
-- Cliente sem próxima ação some do Meu Dia — e some do dia do corretor junto.
--
-- Aditiva e reversível. Nenhuma linha existente é reescrita.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Resultado da visita
-- ---------------------------------------------------------------------
ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS resultado text,
  ADD COLUMN IF NOT EXISTS resultado_em timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_por uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitas_resultado_check') THEN
    ALTER TABLE public.visitas ADD CONSTRAINT visitas_resultado_check CHECK (
      resultado IS NULL OR resultado IN (
        'interessado','quer_outra_opcao','precisa_conversar','nao_gostou',
        'nao_compareceu','remarcar','fara_proposta'
      )
    );
  END IF;
END $$;

COMMENT ON COLUMN public.visitas.resultado IS
  'Desfecho da visita. NULL = ainda não registrado (vira pendência na manhã seguinte, 9h).';

-- Índice para a cobrança: só interessa visita passada e sem desfecho.
CREATE INDEX IF NOT EXISTS visitas_sem_resultado_idx
  ON public.visitas (data) WHERE resultado IS NULL;

-- ---------------------------------------------------------------------
-- 2. Motivo e origem da próxima ação
-- ---------------------------------------------------------------------
ALTER TABLE public.ncrm_estado
  ADD COLUMN IF NOT EXISTS proxima_acao_motivo text,
  ADD COLUMN IF NOT EXISTS proxima_acao_origem text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ncrm_estado_proxima_acao_origem_check') THEN
    ALTER TABLE public.ncrm_estado ADD CONSTRAINT ncrm_estado_proxima_acao_origem_check CHECK (
      proxima_acao_origem IS NULL OR proxima_acao_origem IN ('corretor','sara','cadencia','visita','sistema')
    );
  END IF;
END $$;

COMMENT ON COLUMN public.ncrm_estado.proxima_acao_motivo IS
  'Por que esta ação existe, na língua do corretor. Ex.: "cliente perguntou valor e metragem".';
COMMENT ON COLUMN public.ncrm_estado.proxima_acao_origem IS
  'Quem sugeriu: corretor, sara, cadencia, visita ou sistema.';

-- ---------------------------------------------------------------------
-- 3. Descarte: dez motivos, não seis
-- ---------------------------------------------------------------------
ALTER TABLE public.ncrm_estado DROP CONSTRAINT IF EXISTS ncrm_estado_descarte_motivo_check;
ALTER TABLE public.ncrm_estado ADD CONSTRAINT ncrm_estado_descarte_motivo_check CHECK (
  descarte_motivo IS NULL OR descarte_motivo IN (
    'sem_interesse','sem_perfil_financeiro','numero_invalido','ja_comprou_concorrente','duplicado','outro',
    -- acrescentados: os que a operação já usava na observação, sem estrutura
    'sem_resposta','fora_da_regiao','desistiu','nao_quer_contato','produto_incompativel'
  )
);

CREATE OR REPLACE FUNCTION public.ncrm_saida_descarte(p_negocio_id bigint, p_versao int, p_motivo text, p_detalhe text, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_saida text;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  -- Whitelist ampliada. Continua fechada: motivo fora da lista é recusado.
  IF p_motivo NOT IN ('sem_interesse','sem_perfil_financeiro','numero_invalido','ja_comprou_concorrente','duplicado','outro',
                      'sem_resposta','fora_da_regiao','desistiu','nao_quer_contato','produto_incompativel') THEN
    RETURN jsonb_build_object('ok',false,'erro','motivo_invalido'); END IF;
  IF p_motivo = 'outro' AND (p_detalhe IS NULL OR btrim(p_detalhe) = '') THEN
    RETURN jsonb_build_object('ok',false,'erro','detalhe_obrigatorio'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT versao, workflow_config_id, saida INTO v_antes, v_cfg, v_saida FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','ja_em_saida'); END IF;
  UPDATE public.ncrm_estado SET saida='descartado', saida_em=now(), descarte_motivo=p_motivo, descarte_detalhe=p_detalhe,
     proxima_acao_tipo=NULL, proxima_acao_titulo=NULL, proxima_acao_em=NULL,
     proxima_acao_motivo=NULL, proxima_acao_origem=NULL, resposta_pendente=false,
     versao=v_antes+1, atualizado_em=now(), atualizado_por=v_uid, origem_ultima='usuario', ultima_decisao_humana_em=now()
  WHERE negocio_id=p_negocio_id AND versao=v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'descarte', jsonb_build_object('motivo', p_motivo, 'detalhe', p_detalhe), 'usuario', v_uid, p_idem, v_antes, v_antes+1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes+1);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_saida_descarte(bigint,int,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_saida_descarte(bigint,int,text,text,text) TO authenticated;

COMMIT;
