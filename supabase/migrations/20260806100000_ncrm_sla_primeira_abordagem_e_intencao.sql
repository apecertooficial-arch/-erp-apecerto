-- =============================================================================
-- NUCLEO DO ATENDIMENTO MANUAL: intencao, outbound real e SLA
--
-- Tres fatos distintos, que ate agora se confundiam:
--   1. o lead foi distribuido            -> comeca o relogio
--   2. o corretor abriu o WhatsApp       -> INTENCAO, nao contato
--   3. a mensagem voltou pela D-API      -> CONTATO de verdade, para o relogio
--
-- So o terceiro satisfaz o SLA. Abrir o aplicativo nunca conta como atendimento.
-- =============================================================================

-- --------------------------------------------------------------- SLA no card
ALTER TABLE public.ncrm_estado
  ADD COLUMN IF NOT EXISTS distribuido_em              timestamptz NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_aberto_em          timestamptz NULL,
  ADD COLUMN IF NOT EXISTS primeira_saida_humana_em    timestamptz NULL,
  ADD COLUMN IF NOT EXISTS primeira_saida_message_id   text NULL,
  ADD COLUMN IF NOT EXISTS sla_minutos                 integer NULL,
  ADD COLUMN IF NOT EXISTS sla_dentro_5min             boolean NULL,
  ADD COLUMN IF NOT EXISTS sla_evidencia               text NULL;

COMMENT ON COLUMN public.ncrm_estado.whatsapp_aberto_em IS
  'Quando o corretor tocou em Chamar no WhatsApp. E intencao: nao satisfaz o SLA.';
COMMENT ON COLUMN public.ncrm_estado.primeira_saida_humana_em IS
  'Quando a mensagem do corretor voltou confirmada pela D-API. E isto que para o relogio.';
COMMENT ON COLUMN public.ncrm_estado.sla_evidencia IS
  'De onde veio a confirmacao: dapi_webhook_outbound. Nunca clique.';

-- Backfill: para cards existentes, a distribuicao e a criacao do negocio.
UPDATE public.ncrm_estado e
   SET distribuido_em = n.criado_em
  FROM public.negocios n
 WHERE n.id = e.negocio_id AND e.distribuido_em IS NULL;

-- ------------------------------------------------------- intencao de abertura
CREATE TABLE IF NOT EXISTS public.ncrm_whatsapp_intencao (
  id           bigserial PRIMARY KEY,
  negocio_id   bigint NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  corretor_id  bigint NULL,
  usuario_id   uuid NULL,
  aberto_em    timestamptz NOT NULL DEFAULT now(),
  origem       text NOT NULL DEFAULT 'pwa',
  confirmada_em timestamptz NULL,
  expirada_em  timestamptz NULL,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ncrm_intencao_negocio ON public.ncrm_whatsapp_intencao (negocio_id, aberto_em DESC);
CREATE INDEX IF NOT EXISTS ix_ncrm_intencao_pendente ON public.ncrm_whatsapp_intencao (aberto_em)
  WHERE confirmada_em IS NULL AND expirada_em IS NULL;

REVOKE ALL ON public.ncrm_whatsapp_intencao FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_whatsapp_intencao ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ncrm_whatsapp_intencao IS
  'Registro de que o corretor abriu o WhatsApp. Intencao auditavel, nunca prova de envio.';

-- RPC do aplicativo: registra a intencao. Nao move etapa, nao encerra SLA.
CREATE OR REPLACE FUNCTION public.ncrm_registrar_whatsapp_aberto(
  p_negocio_id bigint, p_origem text DEFAULT 'pwa'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid; v_corretor bigint; v_dono bigint; v_id bigint;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;

  SELECT n.corretor_id INTO v_dono FROM public.negocios n WHERE n.id = p_negocio_id;
  IF v_dono IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;

  -- So o dono do atendimento ou quem o gerencia registra intencao nele.
  IF NOT COALESCE(ncrm_private.pode_operar_negocio(p_negocio_id), false) THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;

  SELECT c.id INTO v_corretor FROM public.corretores c WHERE c.usuario_id = v_uid;

  -- Idempotencia por janela: reabrir o WhatsApp em 2 minutos e a mesma intencao.
  SELECT i.id INTO v_id FROM public.ncrm_whatsapp_intencao i
   WHERE i.negocio_id = p_negocio_id AND i.confirmada_em IS NULL AND i.expirada_em IS NULL
     AND i.aberto_em > now() - interval '2 minutes'
   ORDER BY i.aberto_em DESC LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.ncrm_whatsapp_intencao (negocio_id, corretor_id, usuario_id, origem)
    VALUES (p_negocio_id, COALESCE(v_corretor, v_dono), v_uid, COALESCE(p_origem,'pwa'))
    RETURNING id INTO v_id;
  END IF;

  -- Marca no card apenas para a tela dizer "aguardando confirmacao do WhatsApp".
  UPDATE public.ncrm_estado SET whatsapp_aberto_em = COALESCE(whatsapp_aberto_em, now())
   WHERE negocio_id = p_negocio_id AND primeira_saida_humana_em IS NULL;

  RETURN jsonb_build_object('ok',true,'intencao_id',v_id,'observacao','intencao registrada; o contato so conta quando a mensagem voltar pela D-API');
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_registrar_whatsapp_aberto(bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_whatsapp_aberto(bigint,text) TO authenticated, service_role;

-- ------------------------------------------- expiracao de intencao abandonada
CREATE OR REPLACE FUNCTION ncrm_private.expirar_intencoes_abandonadas(p_minutos int DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_n int;
BEGIN
  UPDATE public.ncrm_whatsapp_intencao
     SET expirada_em = now()
   WHERE confirmada_em IS NULL AND expirada_em IS NULL
     AND aberto_em < now() - make_interval(mins => GREATEST(p_minutos, 5));
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- O card volta a dizer "chame agora": abrir o app nao virou conversa.
  UPDATE public.ncrm_estado e SET whatsapp_aberto_em = NULL
   WHERE e.primeira_saida_humana_em IS NULL
     AND e.whatsapp_aberto_em IS NOT NULL
     AND e.whatsapp_aberto_em < now() - make_interval(mins => GREATEST(p_minutos, 5));
  RETURN v_n;
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.expirar_intencoes_abandonadas(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.expirar_intencoes_abandonadas(int) TO service_role;
