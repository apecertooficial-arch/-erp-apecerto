-- A migração assistida para o CRM Nova Era foi concluída e nunca recebeu dados.
-- Mantemos o diagnóstico ncrm_saude, mas desacoplado das tabelas aposentadas.
DO $migration$
DECLARE
  v_definition text;
  v_old text := '''duplicidades_impedidas'', (SELECT count(*) FROM public.ncrm_migracao_item WHERE NOT ativo)';
  v_new text := '''duplicidades_impedidas'', 0';
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'ncrm_saude'
     AND pg_get_function_identity_arguments(p.oid) = '';

  IF v_definition IS NULL OR position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'ncrm_saude não contém a dependência de migração esperada';
  END IF;

  EXECUTE replace(v_definition, v_old, v_new);
END
$migration$;

DROP FUNCTION public.ncrm_migracao_aprovar(bigint, text, text, text, timestamptz, text);
DROP FUNCTION public.ncrm_migracao_contexto(bigint[]);
DROP FUNCTION public.ncrm_migracao_preview(jsonb);
DROP FUNCTION public.ncrm_migracao_registrar_analise(jsonb);
DROP FUNCTION public.ncrm_migracao_rollback(bigint);

DROP TABLE public.ncrm_migracao_item;
DROP TABLE public.ncrm_migracao_analise;
