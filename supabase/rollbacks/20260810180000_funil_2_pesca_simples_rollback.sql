BEGIN;

CREATE OR REPLACE FUNCTION public.f2_pescar_negocio(
  p_negocio_id bigint,
  p_substituir_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_uid uuid:=(SELECT auth.uid()); v_novo uuid;
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF EXISTS(SELECT 1 FROM public.f2_lead WHERE origem_negocio_id=p_negocio_id) THEN RETURN jsonb_build_object('ok',false,'erro','ja_esta_no_funil'); END IF;
  IF (SELECT count(*) FROM public.f2_lead)>=2 AND p_substituir_id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','escolha_copia_para_substituir'); END IF;
  IF p_substituir_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.f2_lead WHERE id=p_substituir_id) THEN RETURN jsonb_build_object('ok',false,'erro','copia_invalida'); END IF;
    DELETE FROM public.f2_lead WHERE id=p_substituir_id;
  END IF;
  v_novo:=public.f2_importar_negocio(p_negocio_id);
  INSERT INTO public.f2_config_audit(tipo,chave,acao,depois,criado_por) VALUES('pesca',p_negocio_id::text,'substituir_copia',jsonb_build_object('novo_id',v_novo,'substituido',p_substituir_id),v_uid);
  RETURN jsonb_build_object('ok',true,'id',v_novo);
EXCEPTION WHEN OTHERS THEN RAISE;
END;$fn$;

REVOKE ALL ON FUNCTION public.f2_pescar_negocio(bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_pescar_negocio(bigint,uuid) TO authenticated,service_role;

COMMIT;
