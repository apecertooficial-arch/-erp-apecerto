-- ROLLBACK versionado. Remove o guarda do motor e os objetos novos.
-- Nenhum registro é apagado: atendimentos, eventos e fila permanecem.

-- 1) Restaura motor_envia_abordagem com a definição EXATA salva antes da troca.
--    Nada de reconstrução aproximada: usamos o texto original preservado.
DO $rb$
DECLARE v_def text; v_owner text;
BEGIN
  SELECT definicao, owner_antes INTO v_def, v_owner
    FROM public.ncrm_funcao_legada_backup
   WHERE funcao = 'motor_envia_abordagem'
   ORDER BY criado_em DESC LIMIT 1;
  IF v_def IS NULL THEN
    RAISE NOTICE 'sem backup da definicao anterior; motor_envia_abordagem NAO foi tocada';
  ELSE
    EXECUTE v_def;
    IF (SELECT md5(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='motor_envia_abordagem')
       <> (SELECT checksum FROM public.ncrm_funcao_legada_backup
            WHERE funcao='motor_envia_abordagem' ORDER BY criado_em DESC LIMIT 1)
    THEN RAISE EXCEPTION 'restauracao nao bateu com o checksum original'; END IF;
    RAISE NOTICE 'motor_envia_abordagem restaurada e conferida pelo checksum';
  END IF;
END $rb$;

-- 2) Reconciliação volta a ignorar a saída humana (comportamento da Fase 6.1).
--    Recriada sem o trecho de saida_humana e sem a chamada de entrada por distribuição.
DROP FUNCTION IF EXISTS ncrm_private.entrada_por_distribuicao(int);
DROP FUNCTION IF EXISTS public.ncrm_registrar_primeira_humana(bigint,text,timestamptz);
DROP FUNCTION IF EXISTS public.ncrm_entrada_config_set(jsonb,text);
DROP FUNCTION IF EXISTS public.ncrm_entrada_config_get();
DROP FUNCTION IF EXISTS public.ncrm_bloqueia_abordagem_automatica(bigint);
DROP FUNCTION IF EXISTS ncrm_private.negocio_elegivel_nova_era(bigint);

-- Itens de saída humana já registrados voltam a 'ignorado' para caber no CHECK anterior.
UPDATE public.ncrm_ingest_checkpoint SET tipo = 'ignorado' WHERE tipo = 'saida_humana';
ALTER TABLE public.ncrm_ingest_checkpoint DROP CONSTRAINT IF EXISTS ncrm_ingest_checkpoint_tipo_check;
ALTER TABLE public.ncrm_ingest_checkpoint ADD CONSTRAINT ncrm_ingest_checkpoint_tipo_check
  CHECK (tipo IN ('msg_automatica','resposta_inbound','ignorado'));

DROP FUNCTION IF EXISTS public.ncrm_abordagem_humana_definir(bigint,boolean,text);
DROP FUNCTION IF EXISTS public.ncrm_abordagem_humana_listar();
DROP TABLE IF EXISTS public.ncrm_abordagem_humana_audit;
DROP TABLE IF EXISTS public.ncrm_abordagem_humana;
DROP TABLE IF EXISTS public.ncrm_funcao_legada_backup;
DROP TABLE IF EXISTS public.ncrm_entrada_config_audit;
DROP TABLE IF EXISTS public.ncrm_entrada_config;

-- NOTA: a reconciliação da Fase 6.1 deve ser reaplicada a partir de
-- supabase/migrations/20260802100000_ncrm_ingest_lifecycle.sql (parte 2), que não
-- depende de nenhum objeto criado por esta migration.
