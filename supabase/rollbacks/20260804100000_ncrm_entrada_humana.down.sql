-- ROLLBACK versionado. Remove o guarda do motor e os objetos novos.
-- Nenhum registro é apagado: atendimentos, eventos e fila permanecem.

-- 1) Remove APENAS o guarda do CRM Nova Era de motor_envia_abordagem, preservando
--    o restante da função exatamente como está (inclusive melhorias posteriores).
DO $rb$
DECLARE v_def text; v_ini int; v_fim int; v_bloco text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'motor_envia_abordagem';
  IF v_def IS NULL OR position('ncrm_bloqueia_abordagem_automatica' in v_def) = 0 THEN
    RAISE NOTICE 'guarda ausente; nada a remover'; RETURN;
  END IF;
  v_ini := position('  -- CRM NOVA ERA: primeira abordagem humana.' in v_def);
  v_fim := position('  select failover_envio, failover_transfere_lead into _cfg_failover' in v_def);
  IF v_ini = 0 OR v_fim = 0 OR v_fim <= v_ini THEN
    RAISE EXCEPTION 'nao foi possivel delimitar o guarda com seguranca — remova manualmente';
  END IF;
  v_bloco := substr(v_def, v_ini, v_fim - v_ini);
  v_def := replace(v_def, v_bloco, '');
  EXECUTE v_def;
  RAISE NOTICE 'guarda removido de motor_envia_abordagem';
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

DROP TABLE IF EXISTS public.ncrm_entrada_config_audit;
DROP TABLE IF EXISTS public.ncrm_entrada_config;

-- NOTA: a reconciliação da Fase 6.1 deve ser reaplicada a partir de
-- supabase/migrations/20260802100000_ncrm_ingest_lifecycle.sql (parte 2), que não
-- depende de nenhum objeto criado por esta migration.
