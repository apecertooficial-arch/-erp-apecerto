-- Permite que o responsável pelo atendimento corrija a temperatura sugerida
-- pela Sara sem abrir UPDATE direto na tabela. A alteração é concorrente,
-- auditável e usa a mesma autorização oficial das demais ações do Funil 2.

CREATE OR REPLACE FUNCTION public.f2_atualizar_temperatura(
  p_id uuid,
  p_versao integer,
  p_temperatura text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_atual public.f2_lead%ROWTYPE;
  v_rotulo text;
BEGIN
  IF v_uid IS NULL OR public.f2_pode_operar_lead(p_id) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  IF p_temperatura IS NOT NULL
     AND p_temperatura NOT IN ('frio', 'morno', 'quente', 'negociando') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'temperatura_invalida');
  END IF;

  SELECT * INTO v_atual
  FROM public.f2_lead
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'lead_nao_encontrado');
  END IF;

  IF v_atual.versao <> p_versao THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'versao_conflito');
  END IF;

  IF v_atual.temperatura IS NOT DISTINCT FROM p_temperatura THEN
    RETURN jsonb_build_object(
      'ok', true,
      'versao', v_atual.versao,
      'temperatura', p_temperatura,
      'sem_alteracao', true
    );
  END IF;

  v_rotulo := CASE p_temperatura
    WHEN 'quente' THEN 'Quente'
    WHEN 'negociando' THEN 'Negociando'
    WHEN 'morno' THEN 'Morno'
    WHEN 'frio' THEN 'Frio'
    ELSE 'Aguardando leitura'
  END;

  UPDATE public.f2_lead
  SET temperatura = p_temperatura,
      versao = versao + 1,
      atualizado_em = now(),
      atualizado_por = v_uid
  WHERE id = p_id;

  INSERT INTO public.f2_evento(
    funil_lead_id,
    tipo,
    titulo,
    detalhe,
    payload,
    criado_por
  )
  VALUES (
    p_id,
    'correcao_classificacao',
    'Temperatura atualizada para ' || v_rotulo,
    'Ajuste manual registrado na ficha do atendimento.',
    jsonb_build_object(
      'temperatura_anterior', v_atual.temperatura,
      'temperatura_nova', p_temperatura,
      'origem', 'ajuste_manual'
    ),
    v_uid
  );

  RETURN jsonb_build_object(
    'ok', true,
    'versao', v_atual.versao + 1,
    'temperatura', p_temperatura,
    'sem_alteracao', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.f2_atualizar_temperatura(uuid, integer, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.f2_atualizar_temperatura(uuid, integer, text)
TO authenticated, service_role;
