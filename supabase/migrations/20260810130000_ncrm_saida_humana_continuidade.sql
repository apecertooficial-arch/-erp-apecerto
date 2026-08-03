-- CRM Nova Era 3.1.1 — continuidade da conversa humana confirmada pela D-API.
--
-- A primeira mensagem continua sendo a única que congela o SLA inicial.
-- As mensagens humanas seguintes passam a atualizar a conversa, a próxima ação
-- e a versão do atendimento, para que o Meu Dia e a Sara não fiquem obsoletos.
-- Esta migration não envia WhatsApp, não cria visita, proposta ou venda.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ncrm_saida_humana_continuidade_backup (
  assinatura text PRIMARY KEY,
  definicao text NOT NULL,
  md5 text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ncrm_saida_humana_continuidade_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ncrm_saida_humana_continuidade_backup FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ncrm_saida_humana_continuidade_backup TO service_role;

INSERT INTO public.ncrm_saida_humana_continuidade_backup(assinatura, definicao, md5)
SELECT x.assinatura, pg_get_functiondef(p.oid), md5(pg_get_functiondef(p.oid))
FROM unnest(ARRAY[
  'public.ncrm_registrar_primeira_humana(bigint,text,timestamptz)',
  'ncrm_private.reconciliar_mensagens(integer,integer,interval)'
]) x(assinatura)
JOIN pg_proc p ON p.oid=to_regprocedure(x.assinatura)
ON CONFLICT (assinatura) DO NOTHING;

-- O helper só é alcançado depois da validação positiva da mensagem D-API feita
-- pela RPC pública. Fica fora do PostgREST e executável apenas por service_role.
CREATE OR REPLACE FUNCTION ncrm_private.registrar_saida_humana_continuidade(
  p_negocio_id bigint,
  p_lead_id bigint,
  p_corretor_id bigint,
  p_workflow_config_id bigint,
  p_versao_antes integer,
  p_etapa text,
  p_message_id text,
  p_em timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_idem text := 'humana:' || p_message_id;
  v_momento text;
  v_respondeu boolean;
  v_tentativas integer;
  v_tentativas_novas integer;
  v_tipo text;
  v_titulo text;
  v_motivo text;
  v_prazo timestamptz;
  v_intervalo integer;
  v_preserva_prazo boolean;
BEGIN
  SELECT momento_codigo, respondeu, tentativas_feitas,
         proxima_acao_tipo, proxima_acao_titulo, proxima_acao_motivo,
         proxima_acao_em
    INTO v_momento, v_respondeu, v_tentativas,
         v_tipo, v_titulo, v_motivo, v_prazo
    FROM public.ncrm_estado
   WHERE negocio_id=p_negocio_id AND versao=p_versao_antes;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'erro','conflito_versao');
  END IF;

  v_preserva_prazo := coalesce(v_momento IN ('VISITA_AGENDADA','RETORNO_PROGRAMADO'),false);
  v_tentativas_novas := coalesce(v_tentativas,0);

  IF p_etapa='tentando_contato' AND coalesce(v_respondeu,false) IS NOT TRUE THEN
    v_tentativas_novas := least(greatest(coalesce(v_tentativas,0)+1,1),6);
    SELECT wp.intervalo_min, wp.rotulo
      INTO v_intervalo, v_titulo
      FROM public.ncrm_workflow_passo wp
     WHERE wp.config_id=p_workflow_config_id
       AND wp.ordem=least(v_tentativas_novas+1,6)
     LIMIT 1;
    v_tipo := CASE WHEN v_tentativas_novas>=6 THEN 'avaliar_descarte' ELSE 'tentativa_cadencia' END;
    v_titulo := CASE WHEN v_tentativas_novas>=6 THEN 'Avaliar encerramento da cadência'
                     ELSE coalesce(v_titulo,'Enviar a próxima mensagem da cadência') END;
    v_motivo := 'Produzir a primeira resposta seguindo a cadência oficial.';
    v_prazo := ncrm_private.ajustar_para_janela(
      p_em + make_interval(mins=>coalesce(v_intervalo,360))
    );
  ELSIF NOT v_preserva_prazo THEN
    SELECT a.proxima_acao_tipo, a.rotulo, a.objetivo,
           ncrm_private.ajustar_para_janela(p_em+make_interval(mins=>m.sla_min))
      INTO v_tipo, v_titulo, v_motivo, v_prazo
      FROM public.ncrm_momento_padrao m
      JOIN public.ncrm_acao_padrao a ON a.codigo=m.acao_codigo AND a.ativa
     WHERE m.codigo=coalesce(v_momento,
       CASE WHEN p_etapa='em_acompanhamento' THEN 'DECISAO_POS_VISITA'
            ELSE 'CONVERSANDO_QUALIFICANDO' END)
       AND m.ativo
     LIMIT 1;
  END IF;

  UPDATE public.ncrm_estado SET
    resposta_pendente=false,
    aguardando_automacao=false,
    tentativas_feitas=v_tentativas_novas,
    proxima_acao_tipo=coalesce(v_tipo,proxima_acao_tipo),
    proxima_acao_titulo=coalesce(v_titulo,proxima_acao_titulo),
    proxima_acao_motivo=coalesce(v_motivo,proxima_acao_motivo),
    proxima_acao_em=coalesce(v_prazo,proxima_acao_em),
    proxima_acao_origem='sistema',
    ultima_interacao_em=greatest(coalesce(ultima_interacao_em,p_em),p_em),
    ultima_decisao_humana_em=greatest(coalesce(ultima_decisao_humana_em,p_em),p_em),
    versao=p_versao_antes+1,
    atualizado_em=now(),
    atualizado_por=NULL,
    origem_ultima='usuario'
  WHERE negocio_id=p_negocio_id AND versao=p_versao_antes;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'erro','conflito_versao');
  END IF;

  INSERT INTO public.ncrm_evento(
    negocio_id,lead_id,corretor_id_no_evento,workflow_config_id,tipo,canal,
    resultado,payload,origem,executado_por,idempotency_key,
    estado_versao_antes,estado_versao_apos
  ) VALUES (
    p_negocio_id,p_lead_id,p_corretor_id,p_workflow_config_id,'acao_comercial','whatsapp',
    'saida_humana_confirmada',
    jsonb_build_object('message_id',p_message_id,
      'enviado_por','whatsapp_nativo_do_corretor',
      'confirmado_por','dapi_webhook','continuidade',true),
    'sistema',NULL,v_idem,p_versao_antes,p_versao_antes+1
  );

  RETURN jsonb_build_object('ok',true,'continuacao',true,
    'versao',p_versao_antes+1,'momento_codigo',v_momento,
    'proxima_acao',v_titulo,'prazo',v_prazo);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',true,'continuacao',true,'ja_processado',true);
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.registrar_saida_humana_continuidade(
  bigint,bigint,bigint,bigint,integer,text,text,timestamptz
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.registrar_saida_humana_continuidade(
  bigint,bigint,bigint,bigint,integer,text,text,timestamptz
) TO service_role;

-- Inserção mecânica e ancorada na função já auditada. A validação D-API e a
-- primeira abordagem permanecem intactas; só substituímos o retorno prematuro.
DO $do$
DECLARE v_oid oid:=to_regprocedure('public.ncrm_registrar_primeira_humana(bigint,text,timestamptz)');
        v_def text; v_md5 text; v_old text; v_new text;
BEGIN
  IF v_oid IS NULL THEN RAISE EXCEPTION 'ncrm_registrar_primeira_humana ausente'; END IF;
  v_def:=pg_get_functiondef(v_oid); v_md5:=md5(v_def);
  IF position('registrar_saida_humana_continuidade' in v_def)>0 THEN RETURN; END IF;
  IF v_md5<>'2c5d0da6069281c139e3f415c01c8cd8' THEN
    RAISE EXCEPTION 'checksum inesperado de ncrm_registrar_primeira_humana: %',v_md5;
  END IF;
  v_old:='IF v_etapa <> ''novo'' THEN RETURN jsonb_build_object(''ok'',false,''erro'',''primeira_abordagem_ja_registrada''); END IF;';
  v_new:='IF v_etapa <> ''novo'' THEN\n    RETURN ncrm_private.registrar_saida_humana_continuidade(\n      p_negocio_id,v_lead,v_corretor,v_cfg,v_antes,v_etapa,v_msg,p_em);\n  END IF;';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'ancora da continuidade ausente'; END IF;
  EXECUTE replace(v_def,v_old,v_new);
END $do$;

REVOKE ALL ON FUNCTION public.ncrm_registrar_primeira_humana(bigint,text,timestamptz)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_primeira_humana(bigint,text,timestamptz)
  TO service_role;

-- O checkpoint passa a distinguir a primeira abordagem da continuidade.
DO $do$
DECLARE v_oid oid:=to_regprocedure('ncrm_private.reconciliar_mensagens(integer,integer,interval)');
        v_def text; v_md5 text; v_old text; v_new text;
BEGIN
  IF v_oid IS NULL THEN RAISE EXCEPTION 'reconciliar_mensagens ausente'; END IF;
  v_def:=pg_get_functiondef(v_oid); v_md5:=md5(v_def);
  IF position('saida_humana_continuidade' in v_def)>0 THEN RETURN; END IF;
  IF v_md5<>'d73f5d1f28733d0da82e1247fc270d3d' THEN
    RAISE EXCEPTION 'checksum inesperado de reconciliar_mensagens: %',v_md5;
  END IF;
  v_old:='IF (v_res->>''ok'')::boolean THEN v_st := ''processado''; v_motivo := ''primeira_abordagem_humana''; v_final := now();';
  v_new:='IF (v_res->>''ok'')::boolean THEN v_st := ''processado'';\n          v_motivo := CASE WHEN coalesce((v_res->>''continuacao'')::boolean,false)\n            THEN ''saida_humana_continuidade'' ELSE ''primeira_abordagem_humana'' END;\n          v_final := now();';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'ancora do reconciliador ausente'; END IF;
  EXECUTE replace(v_def,v_old,v_new);
END $do$;

COMMIT;
