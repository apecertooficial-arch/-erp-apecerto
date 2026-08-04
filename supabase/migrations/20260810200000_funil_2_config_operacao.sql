BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.f2_operacao_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  horario_inicio time NOT NULL DEFAULT '09:30',
  horario_fim time NOT NULL DEFAULT '18:30',
  presenca_ttl_min integer NOT NULL DEFAULT 15 CHECK (presenca_ttl_min BETWEEN 5 AND 120),
  primeira_abordagem_min integer NOT NULL DEFAULT 5 CHECK (primeira_abordagem_min BETWEEN 1 AND 30),
  feedback_visita_min integer NOT NULL DEFAULT 120 CHECK (feedback_visita_min BETWEEN 30 AND 1440),
  notificacao_urgente_min integer NOT NULL DEFAULT 120 CHECK (notificacao_urgente_min BETWEEN 15 AND 1440),
  peso_primeira_abordagem integer NOT NULL DEFAULT 30 CHECK (peso_primeira_abordagem BETWEEN 0 AND 100),
  peso_acoes_prazo integer NOT NULL DEFAULT 30 CHECK (peso_acoes_prazo BETWEEN 0 AND 100),
  peso_feedback_visita integer NOT NULL DEFAULT 20 CHECK (peso_feedback_visita BETWEEN 0 AND 100),
  peso_presenca_dapi integer NOT NULL DEFAULT 10 CHECK (peso_presenca_dapi BETWEEN 0 AND 100),
  peso_coerencia_sara integer NOT NULL DEFAULT 10 CHECK (peso_coerencia_sara BETWEEN 0 AND 100),
  suspensao_nivel_1_h integer NOT NULL DEFAULT 24 CHECK (suspensao_nivel_1_h BETWEEN 1 AND 720),
  suspensao_nivel_2_h integer NOT NULL DEFAULT 48 CHECK (suspensao_nivel_2_h BETWEEN 1 AND 720),
  suspensao_nivel_3_h integer NOT NULL DEFAULT 72 CHECK (suspensao_nivel_3_h BETWEEN 1 AND 720),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid NULL,
  CHECK (horario_fim > horario_inicio),
  CHECK (peso_primeira_abordagem + peso_acoes_prazo + peso_feedback_visita + peso_presenca_dapi + peso_coerencia_sara = 100),
  CHECK (suspensao_nivel_1_h < suspensao_nivel_2_h AND suspensao_nivel_2_h < suspensao_nivel_3_h)
);

INSERT INTO public.f2_operacao_config(id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.f2_operacao_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.f2_operacao_config FROM PUBLIC,anon;
GRANT SELECT ON public.f2_operacao_config TO authenticated;
DROP POLICY IF EXISTS f2_operacao_admin_select ON public.f2_operacao_config;
CREATE POLICY f2_operacao_admin_select ON public.f2_operacao_config
  FOR SELECT TO authenticated USING (public.f2_admin());

CREATE OR REPLACE FUNCTION public.f2_configurar_operacao(
  p_horario_inicio time,p_horario_fim time,p_presenca_ttl_min integer,
  p_primeira_abordagem_min integer,p_feedback_visita_min integer,p_notificacao_urgente_min integer,
  p_peso_primeira_abordagem integer,p_peso_acoes_prazo integer,p_peso_feedback_visita integer,
  p_peso_presenca_dapi integer,p_peso_coerencia_sara integer,
  p_suspensao_nivel_1_h integer,p_suspensao_nivel_2_h integer,p_suspensao_nivel_3_h integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_uid uuid := (SELECT auth.uid()); v_antes jsonb; v_depois jsonb;
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  IF p_horario_inicio IS NULL OR p_horario_fim IS NULL
    OR p_presenca_ttl_min IS NULL OR p_primeira_abordagem_min IS NULL
    OR p_feedback_visita_min IS NULL OR p_notificacao_urgente_min IS NULL
    OR p_peso_primeira_abordagem IS NULL OR p_peso_acoes_prazo IS NULL
    OR p_peso_feedback_visita IS NULL OR p_peso_presenca_dapi IS NULL OR p_peso_coerencia_sara IS NULL
    OR p_suspensao_nivel_1_h IS NULL OR p_suspensao_nivel_2_h IS NULL OR p_suspensao_nivel_3_h IS NULL
    OR p_horario_fim<=p_horario_inicio
    OR p_presenca_ttl_min NOT BETWEEN 5 AND 120
    OR p_primeira_abordagem_min NOT BETWEEN 1 AND 30
    OR p_feedback_visita_min NOT BETWEEN 30 AND 1440
    OR p_notificacao_urgente_min NOT BETWEEN 15 AND 1440
    OR p_peso_primeira_abordagem NOT BETWEEN 0 AND 100
    OR p_peso_acoes_prazo NOT BETWEEN 0 AND 100
    OR p_peso_feedback_visita NOT BETWEEN 0 AND 100
    OR p_peso_presenca_dapi NOT BETWEEN 0 AND 100
    OR p_peso_coerencia_sara NOT BETWEEN 0 AND 100
    OR p_peso_primeira_abordagem+p_peso_acoes_prazo+p_peso_feedback_visita+p_peso_presenca_dapi+p_peso_coerencia_sara<>100
    OR p_suspensao_nivel_1_h NOT BETWEEN 1 AND 720
    OR p_suspensao_nivel_2_h NOT BETWEEN 1 AND 720
    OR p_suspensao_nivel_3_h NOT BETWEEN 1 AND 720
    OR NOT (p_suspensao_nivel_1_h<p_suspensao_nivel_2_h AND p_suspensao_nivel_2_h<p_suspensao_nivel_3_h) THEN
    RETURN jsonb_build_object('ok',false,'erro','configuracao_invalida');
  END IF;
  SELECT to_jsonb(c) INTO v_antes FROM public.f2_operacao_config c WHERE id=true FOR UPDATE;
  UPDATE public.f2_operacao_config SET
    horario_inicio=p_horario_inicio,horario_fim=p_horario_fim,presenca_ttl_min=p_presenca_ttl_min,
    primeira_abordagem_min=p_primeira_abordagem_min,feedback_visita_min=p_feedback_visita_min,
    notificacao_urgente_min=p_notificacao_urgente_min,peso_primeira_abordagem=p_peso_primeira_abordagem,
    peso_acoes_prazo=p_peso_acoes_prazo,peso_feedback_visita=p_peso_feedback_visita,
    peso_presenca_dapi=p_peso_presenca_dapi,peso_coerencia_sara=p_peso_coerencia_sara,
    suspensao_nivel_1_h=p_suspensao_nivel_1_h,suspensao_nivel_2_h=p_suspensao_nivel_2_h,
    suspensao_nivel_3_h=p_suspensao_nivel_3_h,atualizado_em=now(),atualizado_por=v_uid
  WHERE id=true;
  SELECT to_jsonb(c) INTO v_depois FROM public.f2_operacao_config c WHERE id=true;
  INSERT INTO public.f2_config_audit(tipo,chave,acao,antes,depois,criado_por)
  VALUES('operacao','principal','configurar',v_antes,v_depois,v_uid);
  RETURN jsonb_build_object('ok',true,'config',v_depois);
END;$fn$;

REVOKE ALL ON FUNCTION public.f2_configurar_operacao(time,time,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_configurar_operacao(time,time,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer) TO authenticated;

COMMIT;
