-- Wrapper para a Edge Function consultar a autoridade do piloto.
-- ncrm_private nao e exposto na API REST; este wrapper em public e o unico
-- caminho, e so service_role executa.
--
-- Decisao estruturada em vez de booleano: quem chama precisa saber se foi
-- "pode seguir", "corretor no piloto humano" ou "nao consegui determinar".
-- Um booleano fail-open esconderia justamente o terceiro caso.

CREATE OR REPLACE FUNCTION public.ncrm_pode_enviar_pelo_erp(
  p_corretor_id bigint DEFAULT NULL,
  p_negocio_id  bigint DEFAULT NULL,
  p_lead_id     bigint DEFAULT NULL,
  p_telefone    text   DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_corretor bigint := p_corretor_id;
  v_escopo   text;
  v_tel      text;
BEGIN
  -- Resolve o corretor pelo caminho disponivel, inclusive pelo telefone do lead
  -- (que e como o emissor descobre a instancia quando nao recebe mais nada).
  IF v_corretor IS NULL AND p_negocio_id IS NOT NULL THEN
    SELECT n.corretor_id INTO v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  END IF;
  IF v_corretor IS NULL AND p_lead_id IS NOT NULL THEN
    SELECT n.corretor_id INTO v_corretor FROM public.negocios n
     WHERE n.lead_id = p_lead_id AND n.status = 'aberto' ORDER BY n.criado_em DESC LIMIT 1;
  END IF;
  IF v_corretor IS NULL AND p_telefone IS NOT NULL THEN
    v_tel := regexp_replace(p_telefone, '\D', '', 'g');
    IF length(v_tel) >= 8 THEN
      SELECT l.corretor_id INTO v_corretor FROM public.leads l
       WHERE l.telefone LIKE '%' || right(v_tel, 8) LIMIT 1;
    END IF;
  END IF;

  SELECT c.escopo INTO v_escopo FROM public.ncrm_entrada_config c WHERE c.id;

  -- Piloto dormente: o legado segue exatamente como sempre foi.
  IF v_escopo IS DISTINCT FROM 'liberados' THEN
    RETURN jsonb_build_object('decisao','permitir','motivo','piloto_fora_de_escopo');
  END IF;

  -- Escopo ligado e nao sabemos de quem e o atendimento: nao arriscamos enviar
  -- por um corretor que pode estar no piloto. Aqui o silencio custa menos.
  IF v_corretor IS NULL THEN
    RETURN jsonb_build_object('decisao','bloquear_inconsistencia','motivo','corretor_indeterminado_com_escopo_ligado');
  END IF;

  IF EXISTS (SELECT 1 FROM public.ncrm_abordagem_humana ah
              WHERE ah.corretor_id = v_corretor AND ah.ativo) THEN
    RETURN jsonb_build_object('decisao','bloquear_humano','motivo','corretor_em_abordagem_humana','corretor_id',v_corretor);
  END IF;

  RETURN jsonb_build_object('decisao','permitir','motivo','corretor_fora_do_piloto','corretor_id',v_corretor);

EXCEPTION WHEN OTHERS THEN
  -- Erro ao decidir. Se o piloto esta dormente, o legado nao pode parar por
  -- isso. Se esta ligado, preferimos nao enviar a enviar por engano.
  BEGIN
    SELECT c.escopo INTO v_escopo FROM public.ncrm_entrada_config c WHERE c.id;
  EXCEPTION WHEN OTHERS THEN v_escopo := NULL; END;
  IF v_escopo IS DISTINCT FROM 'liberados' THEN
    RETURN jsonb_build_object('decisao','permitir','motivo','erro_com_piloto_dormente');
  END IF;
  RETURN jsonb_build_object('decisao','bloquear_inconsistencia','motivo','erro_ao_decidir_com_escopo_ligado');
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_pode_enviar_pelo_erp(bigint,bigint,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_pode_enviar_pelo_erp(bigint,bigint,bigint,text) TO service_role;
