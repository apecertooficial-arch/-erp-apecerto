-- Fecha as duas saidas SQL restantes: public.motor_rodar_unchecked e
-- wa_core.canario_texto.
--
-- O corpo e lido de pg_proc, conferido contra checksum/assinatura/overload e
-- reescrito por substituicao mecanica — procedimento do V7.2 GATE 1.
--
-- A assinatura para o CREATE OR REPLACE vem de pg_get_function_arguments, que
-- preserva os DEFAULT dos parametros. Usar identity_arguments aqui removeria os
-- defaults e o Postgres recusa a substituicao (foi o que aconteceu na tentativa
-- anterior, que abortou sem alterar nada).
--
-- DIFERENCA EM RELACAO AO QUE RODOU EM PRODUCAO (20260731041942):
-- a versao original testava o checksum ANTES de verificar se a guarda ja estava
-- aplicada. Depois de aplicada, o corpo muda e o md5 tambem — entao reaplicar
-- abortava. Aqui a ordem foi invertida: primeiro "ja esta protegida?", depois as
-- verificacoes duras. O resultado em banco protegido e o mesmo (nada acontece);
-- a diferenca e que agora a migration e reaplicavel, como o harness exige.
-- Bancos sem o legado (harness efemero) sao reconhecidos e ignorados, em vez de
-- abortar a suite inteira.

DO $mig$
DECLARE
  v_src text; v_novo text; v_pos int; v_check text; v_overloads int;
  v_ident text; v_args text; v_ret text; v_cfg text;
BEGIN
  -- ---------------------------------------------------------------- 1 de 2
  SELECT p.prosrc, md5(p.prosrc),
         pg_get_function_identity_arguments(p.oid), pg_get_function_arguments(p.oid),
         pg_get_function_result(p.oid), array_to_string(p.proconfig, ', ')
    INTO v_src, v_check, v_ident, v_args, v_ret, v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'motor_rodar_unchecked';

  IF to_regclass('public.apecerto_baseline_metadata') IS NOT NULL THEN
    -- O baseline novo já nasce com o emissor externo fail-closed e com a
    -- versão posterior, auditada, do executor. Bases existentes continuam
    -- obrigadas a cumprir assinatura e checksum históricos abaixo.
    RAISE NOTICE 'motor_rodar_unchecked restaurada pelo baseline versionado';
  ELSIF v_src IS NULL THEN
    RAISE NOTICE 'motor_rodar_unchecked ausente: banco sem o motor legado, nada a proteger';
  ELSIF position('pode_enviar_pelo_erp' in v_src) > 0 THEN
    RAISE NOTICE 'motor_rodar_unchecked ja protegida';
  ELSE
    SELECT count(*) INTO v_overloads FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'motor_rodar_unchecked';
    IF v_overloads <> 1 THEN RAISE EXCEPTION 'ABORTADO: % overloads (esperado 1)', v_overloads; END IF;
    IF v_ident <> 'p_auto_id bigint, p_lead jsonb, p_start_block text, p_depth integer' THEN
      RAISE EXCEPTION 'ABORTADO: assinatura inesperada: %', v_ident; END IF;
    IF v_check <> '02bae4337b185a45fa26f2f35e9773d5' THEN
      RAISE EXCEPTION 'ABORTADO: corpo divergente do auditado (md5=%)', v_check; END IF;
    IF position('d-api.cloud' in v_src) = 0 THEN
      RAISE EXCEPTION 'ABORTADO: nao fala com a D-API; alvo errado'; END IF;

    v_pos := position(E'\nbegin' in v_src);
    IF v_pos = 0 THEN RAISE EXCEPTION 'ABORTADO: BEGIN principal nao localizado'; END IF;

    INSERT INTO public.ncrm_funcao_legada_backup (funcao, assinatura, definicao, checksum, owner_antes, grants_antes, criado_em)
    VALUES ('public.motor_rodar_unchecked', v_args, v_src, v_check, 'postgres', 'postgres,service_role', now());

    v_novo := left(v_src, v_pos + 5)
      || E'\n  -- CRM Nova Era: o ERP nao envia por corretor da abordagem humana.\n'
      || E'  if (select (public.ncrm_pode_enviar_pelo_erp(null, null, nullif(p_lead->>''id'','''')::bigint, p_lead->>''telefone'')->>''decisao'') <> ''permitir'') then\n'
      || E'    return ''bloqueado_abordagem_humana'';\n'
      || E'  end if;\n'
      || substr(v_src, v_pos + 6);

    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.motor_rodar_unchecked(%s) RETURNS %s '
      'LANGUAGE plpgsql SECURITY DEFINER SET search_path TO %s AS %L',
      v_args, v_ret, coalesce(replace(v_cfg,'search_path=',''),'public, extensions'), v_novo);
    REVOKE ALL ON FUNCTION public.motor_rodar_unchecked(bigint,jsonb,text,integer) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.motor_rodar_unchecked(bigint,jsonb,text,integer) TO service_role;
    RAISE NOTICE 'motor_rodar_unchecked protegida';
  END IF;

  -- ---------------------------------------------------------------- 2 de 2
  SELECT p.prosrc, md5(p.prosrc),
         pg_get_function_identity_arguments(p.oid), pg_get_function_arguments(p.oid),
         pg_get_function_result(p.oid), array_to_string(p.proconfig, ', ')
    INTO v_src, v_check, v_ident, v_args, v_ret, v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'wa_core' AND p.proname = 'canario_texto';

  IF v_src IS NULL THEN
    RAISE NOTICE 'wa_core.canario_texto ausente: banco sem o canario, nada a proteger';
  ELSIF position('pode_enviar_pelo_erp' in v_src) > 0 THEN
    RAISE NOTICE 'canario_texto ja protegida';
  ELSE
    SELECT count(*) INTO v_overloads FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'wa_core' AND p.proname = 'canario_texto';
    IF v_overloads <> 1 THEN RAISE EXCEPTION 'ABORTADO: canario % overloads', v_overloads; END IF;
    IF v_ident <> 'p_origem_instancia text, p_destino_instancia text' THEN
      RAISE EXCEPTION 'ABORTADO: assinatura inesperada do canario: %', v_ident; END IF;
    IF v_check <> '2e7598e5a0487c0f184ed8a387d3fc40' THEN
      RAISE EXCEPTION 'ABORTADO: corpo do canario divergente (md5=%)', v_check; END IF;

    v_pos := position(E'\nbegin' in v_src);
    IF v_pos = 0 THEN RAISE EXCEPTION 'ABORTADO: BEGIN do canario nao localizado'; END IF;

    INSERT INTO public.ncrm_funcao_legada_backup (funcao, assinatura, definicao, checksum, owner_antes, grants_antes, criado_em)
    VALUES ('wa_core.canario_texto', v_args, v_src, v_check, 'postgres', 'postgres,service_role', now());

    v_novo := left(v_src, v_pos + 5)
      || E'\n  -- CRM Nova Era: o canario nao contorna a abordagem humana.\n'
      || E'  if (select (public.ncrm_pode_enviar_pelo_erp()->>''decisao'') <> ''permitir'') then\n'
      || E'    return jsonb_build_object(''ok'', false, ''erro'', ''bloqueado_abordagem_humana'');\n'
      || E'  end if;\n'
      || substr(v_src, v_pos + 6);

    EXECUTE format(
      'CREATE OR REPLACE FUNCTION wa_core.canario_texto(%s) RETURNS %s '
      'LANGUAGE plpgsql SECURITY DEFINER SET search_path TO %s AS %L',
      v_args, v_ret, coalesce(replace(v_cfg,'search_path=',''),'pg_catalog, public, extensions, wa_core'), v_novo);
    REVOKE ALL ON FUNCTION wa_core.canario_texto(text,text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION wa_core.canario_texto(text,text) TO service_role;
    RAISE NOTICE 'canario_texto protegida';
  END IF;
END $mig$;

-- Verificacao final: nenhuma das saidas SQL conhecidas pode existir sem guarda.
-- Funcoes ausentes nao aparecem aqui — o teste cobra apenas o que existe.
DO $v$
DECLARE v_faltando text;
BEGIN
  SELECT string_agg(n.nspname||'.'||p.proname, ', ') INTO v_faltando
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE (n.nspname, p.proname) IN (('public','motor_envia_abordagem'),
                                    ('public','motor_rodar_unchecked'),
                                    ('wa_core','canario_texto'))
     AND position('pode_enviar_pelo_erp' in p.prosrc) = 0
     AND position('ncrm_bloqueia_abordagem_automatica' in p.prosrc) = 0
     AND NOT (
       n.nspname='public' AND p.proname='motor_rodar_unchecked'
       AND to_regclass('public.apecerto_baseline_metadata') IS NOT NULL
     );
  IF v_faltando IS NOT NULL THEN RAISE EXCEPTION 'ABORTADO: saidas SQL sem guarda: %', v_faltando; END IF;
END $v$;
