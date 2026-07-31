-- Restaura os corpos originais a partir de ncrm_funcao_legada_backup.
--
-- ATENCAO: restaurar devolve as duas funcoes ao estado em que enviavam sem
-- consultar a autoridade do piloto. So faz sentido se a abordagem humana estiver
-- desligada. Por isso o rollback recusa rodar com o escopo ligado.
DO $rb$
DECLARE v_escopo text; v_def text; v_args text;
BEGIN
  SELECT c.escopo INTO v_escopo FROM public.ncrm_entrada_config c WHERE c.id;
  IF v_escopo = 'liberados' THEN
    RAISE EXCEPTION 'ABORTADO: escopo do piloto ligado; nao removemos a guarda de envio';
  END IF;

  SELECT definicao, assinatura INTO v_def, v_args FROM public.ncrm_funcao_legada_backup
   WHERE funcao = 'public.motor_rodar_unchecked' ORDER BY criado_em DESC LIMIT 1;
  IF v_def IS NOT NULL THEN
    EXECUTE format('CREATE OR REPLACE FUNCTION public.motor_rodar_unchecked(%s) RETURNS text '
                   'LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS %L', v_args, v_def);
  END IF;

  SELECT definicao, assinatura INTO v_def, v_args FROM public.ncrm_funcao_legada_backup
   WHERE funcao = 'wa_core.canario_texto' ORDER BY criado_em DESC LIMIT 1;
  IF v_def IS NOT NULL THEN
    EXECUTE format('CREATE OR REPLACE FUNCTION wa_core.canario_texto(%s) RETURNS jsonb '
                   'LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public, extensions, wa_core AS %L', v_args, v_def);
  END IF;
END $rb$;
