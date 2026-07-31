-- ============================================================================
-- VERIFICAÇÃO PÓS-MIGRATION — Sara Fase 1 (item 1)
--
-- Rodar no SQL Editor DEPOIS de aplicar 20260808100000_ncrm_sara_fase1_placar.
-- Não escreve nada. Falha alto (RAISE EXCEPTION) no primeiro desvio.
--
-- Escrito para REPROVAR a versão insegura: se alguém trocar can_manage_all()
-- por um check frouxo, der GRANT amplo em ncrm_sara_analise, tirar o escopo de
-- carteira da policy ou destravar o assist sem placar, isto quebra.
-- ============================================================================

DO $verificacao$
DECLARE
  v_n int; v_txt text; v_bool boolean;
BEGIN

  -- 1. RLS continua LIGADA. Sem isso, a policy é decoração.
  SELECT relrowsecurity INTO v_bool FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='ncrm_sara_analise';
  IF v_bool IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHA 1: RLS desligada em ncrm_sara_analise — qualquer corretor leria a carteira inteira.';
  END IF;

  -- 2. Existe a policy de leitura, é só de SELECT, é escopada por carteira e
  --    esconde sugestão rejeitada.
  SELECT qual::text INTO v_txt FROM pg_policies
   WHERE schemaname='public' AND tablename='ncrm_sara_analise'
     AND policyname='ncrm_sara_analise_leitura_carteira';
  IF v_txt IS NULL THEN
    RAISE EXCEPTION 'FALHA 2a: policy de leitura ausente — o Meu Dia volta a não mostrar a orientação da Sara.';
  END IF;
  IF v_txt NOT LIKE '%pode_ver_negocio%' THEN
    RAISE EXCEPTION 'FALHA 2b: policy sem escopo de carteira (pode_ver_negocio). Isso é IDOR: corretor lê lead alheio.';
  END IF;
  IF v_txt NOT LIKE '%rejeitada%' THEN
    RAISE EXCEPTION 'FALHA 2c: policy não filtra decisao rejeitada — sugestão reprovada voltaria ao celular do corretor.';
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='ncrm_sara_analise' AND cmd <> 'SELECT';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALHA 2d: existe policy de escrita em ncrm_sara_analise. A análise só pode ser gravada pelo runner (service_role).';
  END IF;

  -- 3. authenticated NÃO tem escrita em tabela alguma da Sara.
  SELECT count(*) INTO v_n FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name LIKE 'ncrm_sara%'
     AND grantee='authenticated' AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALHA 3: authenticated tem % grant(s) de escrita em tabelas da Sara — corretor poderia fabricar análise.', v_n;
  END IF;

  -- 4. O SELECT é POR COLUNA e não vaza metadado interno.
  SELECT count(*) INTO v_n FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ncrm_sara_analise'
     AND grantee='authenticated' AND privilege_type='SELECT';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALHA 4a: grant de SELECT na TABELA inteira. Tem de ser por coluna — versao_prompt e versao_modelo não vão para o navegador.';
  END IF;

  SELECT count(*) INTO v_n FROM information_schema.column_privileges
   WHERE table_schema='public' AND table_name='ncrm_sara_analise'
     AND grantee='authenticated' AND privilege_type='SELECT'
     AND column_name IN ('versao_prompt','versao_modelo','context_hash','run_id','ator','origem','modo');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALHA 4b: % coluna(s) interna(s) concedida(s) a authenticated. Prompt e modelo são IP.', v_n;
  END IF;

  -- Conjunto EXATO: nem a menos (a orientação some do Meu Dia) nem a mais
  -- (com `id` concedido o corretor enumera as próprias análises e alimenta o
  -- placar sozinho, furando a separação das duas telas).
  SELECT count(*) INTO v_n FROM information_schema.column_privileges
   WHERE table_schema='public' AND table_name='ncrm_sara_analise'
     AND grantee='authenticated' AND privilege_type='SELECT'
     AND column_name IN ('negocio_id','proxima_acao_sugerida','justificativa','analisado_em');
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'FALHA 4c: faltam colunas que /api/ncrm/fila-operacional consome (esperado 4, achei %).', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM information_schema.column_privileges
   WHERE table_schema='public' AND table_name='ncrm_sara_analise'
     AND grantee='authenticated' AND privilege_type='SELECT'
     AND column_name NOT IN ('negocio_id','proxima_acao_sugerida','justificativa','analisado_em');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALHA 4d: % coluna(s) concedida(s) além das 4 necessárias.', v_n;
  END IF;

  -- 5. anon não enxerga nada.
  SELECT count(*) INTO v_n FROM information_schema.column_privileges
   WHERE table_schema='public' AND table_name LIKE 'ncrm_sara%' AND grantee='anon';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALHA 5: anon tem privilégio em tabela da Sara.';
  END IF;

  -- 6. As três RPCs novas existem, são SECURITY DEFINER e fechadas para anon.
  FOR v_txt IN SELECT x FROM unnest(ARRAY['ncrm_sara_revisao_fila','ncrm_sara_decidir_lote','ncrm_sara_placar']) x LOOP
    SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_txt AND p.prosecdef;
    IF v_n = 0 THEN
      RAISE EXCEPTION 'FALHA 6a: RPC % ausente ou sem SECURITY DEFINER.', v_txt;
    END IF;
    SELECT bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) INTO v_bool
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_txt;
    IF v_bool THEN
      RAISE EXCEPTION 'FALHA 6b: anon pode executar %.', v_txt;
    END IF;
  END LOOP;

  -- 7. As RPCs de admin exigem can_manage_all no CORPO, não só no grant.
  --    decidir_lote entra aqui: sem essa trava o corretor aprovaria em massa as
  --    sugestões da própria carteira e envenenaria o placar da Fase 2.
  FOR v_txt IN SELECT x FROM unnest(ARRAY['ncrm_sara_revisao_fila','ncrm_sara_placar','ncrm_sara_decidir_lote']) x LOOP
    SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_txt
       AND pg_get_functiondef(p.oid) LIKE '%can_manage_all%';
    IF v_n = 0 THEN
      RAISE EXCEPTION 'FALHA 7: % não checa can_manage_all() internamente. Grant não é autorização.', v_txt;
    END IF;
  END LOOP;

  -- 7b. O lote isola cada item em subtransação: exceção num id não pode
  --     derrubar as decisões já gravadas no mesmo lote.
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='ncrm_sara_decidir_lote'
     AND pg_get_functiondef(p.oid) LIKE '%EXCEPTION WHEN OTHERS%';
  IF v_n = 0 THEN
    RAISE EXCEPTION 'FALHA 7b: ncrm_sara_decidir_lote sem subtransação por item — um id ruim faria rollback do lote inteiro.';
  END IF;

  -- 8. O lote delega para a RPC unitária: nada de regra de permissão duplicada.
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='ncrm_sara_decidir_lote'
     AND pg_get_functiondef(p.oid) LIKE '%ncrm_sara_decidir_analise%';
  IF v_n = 0 THEN
    RAISE EXCEPTION 'FALHA 8: ncrm_sara_decidir_lote reimplementou a decisão em vez de delegar. Regra duplicada diverge.';
  END IF;

  -- 9. CONTRATO DA FASE 1: nada foi aplicado a lead nenhum.
  SELECT count(*) INTO v_n FROM public.ncrm_sara_acao WHERE aplicado;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALHA 9: % ação(ões) aplicada(s) pela Sara. Na Fase 1 aprovar sugestão NÃO move lead.', v_n;
  END IF;

  -- 10. Sara continua fora de assist/execute.
  SELECT modo INTO v_txt FROM public.ncrm_sara_config WHERE id;
  IF v_txt IN ('assist','execute') THEN
    RAISE EXCEPTION 'FALHA 10: modo da Sara = %. Só depois do placar bater 85%% em 50 decisões.', v_txt;
  END IF;

  RAISE NOTICE 'OK — verificações passaram. Fase 1 aplicada sem mover nenhum lead.';
END $verificacao$;

-- ---------------------------------------------------------------------------
-- Fotografia para colar no registro da sessão.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.ncrm_sara_analise)                        AS analises,
  (SELECT count(*) FROM public.ncrm_sara_analise WHERE decisao='pendente') AS pendentes,
  (SELECT count(*) FROM public.ncrm_sara_analise WHERE decisao='aprovada') AS aprovadas,
  (SELECT count(*) FROM public.ncrm_sara_analise WHERE decisao='rejeitada')AS rejeitadas,
  (SELECT count(*) FROM public.ncrm_sara_acao WHERE aplicado)            AS acoes_aplicadas,
  (SELECT modo FROM public.ncrm_sara_config WHERE id)                    AS modo_sara,
  (SELECT operacao FROM public.ncrm_sara_assist_config WHERE id)         AS assist_operacao;
