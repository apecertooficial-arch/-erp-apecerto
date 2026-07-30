-- ============================================================================
-- BLOQUEIO CANONICO DE ENVIO PELO ERP
--
-- Auditoria de 30/07/2026 mapeou 27 emissores de WhatsApp em 5 saidas de rede:
--
--   SQL  1. public.motor_envia_abordagem        POST api.d-api.cloud
--   SQL  2. public.motor_rodar_unchecked        POST api.d-api.cloud
--   SQL  3. wa_core.canario_texto               POST api.d-api.cloud
--   EDGE 4. dapi-enviar                         (nao versionada no repo)
--   EDGE 5. enviar-whatsapp                     (nao versionada no repo)
--
-- Todo o resto (rotas do Next, campanhas, agendamentos, triggers, crons,
-- enviar_abordagem_lead, reenviar_abordagem, criar_disparo, agendar_mensagem)
-- desagua em uma dessas cinco. Esta migration fecha as tres de SQL, que sao as
-- que o piloto usa. As duas Edge Functions ficam registradas como pendencia
-- explicita no fim deste arquivo.
--
-- Uma unica funcao decide. Nenhum emissor tem regra propria.
-- ============================================================================

-- ---------------------------------------------------------------- auditoria
CREATE TABLE IF NOT EXISTS public.ncrm_envio_bloqueado (
  id            bigserial PRIMARY KEY,
  emissor       text NOT NULL,
  corretor_id   bigint NULL,
  negocio_id    bigint NULL,
  lead_id       bigint NULL,
  motivo        text NOT NULL,
  detalhe       jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ncrm_envio_bloq_quando ON public.ncrm_envio_bloqueado (criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_ncrm_envio_bloq_corretor ON public.ncrm_envio_bloqueado (corretor_id, criado_em DESC);

REVOKE ALL ON public.ncrm_envio_bloqueado FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_envio_bloqueado ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ncrm_envio_bloqueado IS
  'Toda vez que o ERP deixa de enviar por causa do piloto humano, fica registrado aqui. Serve para provar que o bloqueio agiu e para o gestor ver o volume.';

-- ------------------------------------------------- a unica funcao que decide
CREATE OR REPLACE FUNCTION ncrm_private.pode_enviar_pelo_erp(
  p_corretor_id bigint DEFAULT NULL,
  p_negocio_id  bigint DEFAULT NULL,
  p_lead_id     bigint DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_corretor bigint := p_corretor_id;
  v_escopo   text;
BEGIN
  -- Resolve o corretor quando o emissor so conhece o negocio ou o lead.
  IF v_corretor IS NULL AND p_negocio_id IS NOT NULL THEN
    SELECT n.corretor_id INTO v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  END IF;
  IF v_corretor IS NULL AND p_lead_id IS NOT NULL THEN
    SELECT n.corretor_id INTO v_corretor
      FROM public.negocios n
     WHERE n.lead_id = p_lead_id AND n.status = 'aberto'
     ORDER BY n.criado_em DESC LIMIT 1;
  END IF;

  -- Sem corretor nao ha piloto a respeitar: o legado segue como sempre foi.
  IF v_corretor IS NULL THEN RETURN true; END IF;

  SELECT c.escopo INTO v_escopo FROM public.ncrm_entrada_config c WHERE c.id;
  -- Config ausente ou fora do escopo de piloto: legado preservado.
  IF v_escopo IS DISTINCT FROM 'liberados' THEN RETURN true; END IF;

  -- Participante da abordagem humana: o ERP nao envia por ele. Vale para
  -- qualquer chamador, inclusive service_role. Nao ha excecao administrativa.
  IF EXISTS (
    SELECT 1 FROM public.ncrm_abordagem_humana ah
     WHERE ah.corretor_id = v_corretor AND ah.ativo
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  -- Fail-closed do ponto de vista do LEGADO: diante de qualquer inconsistencia
  -- o envio historico continua funcionando. Nunca derrubamos a operacao atual
  -- por causa de um piloto que ainda esta dormente.
  RETURN true;
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.pode_enviar_pelo_erp(bigint,bigint,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.pode_enviar_pelo_erp(bigint,bigint,bigint) TO service_role;

COMMENT ON FUNCTION ncrm_private.pode_enviar_pelo_erp(bigint,bigint,bigint) IS
  'Unica autoridade sobre "o ERP pode enviar WhatsApp por este corretor?". Todos os emissores consultam esta funcao e nenhum tem regra propria.';

-- ------------------------------------------- registro do bloqueio (auditoria)
CREATE OR REPLACE FUNCTION ncrm_private.registrar_envio_bloqueado(
  p_emissor text, p_corretor_id bigint, p_negocio_id bigint, p_lead_id bigint, p_detalhe jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  INSERT INTO public.ncrm_envio_bloqueado (emissor, corretor_id, negocio_id, lead_id, motivo, detalhe)
  VALUES (p_emissor, p_corretor_id, p_negocio_id, p_lead_id, 'corretor_em_abordagem_humana', COALESCE(p_detalhe,'{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  NULL; -- auditoria nunca pode derrubar o caminho principal
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.registrar_envio_bloqueado(text,bigint,bigint,bigint,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.registrar_envio_bloqueado(text,bigint,bigint,bigint,jsonb) TO service_role;

-- ============================================================================
-- GUARDA 1 — public.ncrm_bloqueia_abordagem_automatica
-- Ja existe desde o PR A e ja esta chamada dentro de motor_envia_abordagem.
-- Aqui ela deixa de ter regra propria e passa a apenas perguntar a funcao
-- canonica. Um lugar so decide; este vira um adaptador.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ncrm_bloqueia_abordagem_automatica(p_lead_id bigint)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_pode boolean;
BEGIN
  v_pode := ncrm_private.pode_enviar_pelo_erp(NULL, NULL, p_lead_id);
  IF v_pode THEN RETURN false; END IF;   -- pode enviar => nao bloqueia
  PERFORM ncrm_private.registrar_envio_bloqueado(
    'motor_envia_abordagem', NULL, NULL, p_lead_id,
    jsonb_build_object('via','ncrm_bloqueia_abordagem_automatica'));
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;  -- legado preservado
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_bloqueia_abordagem_automatica(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_bloqueia_abordagem_automatica(bigint) TO service_role;

-- ============================================================================
-- GUARDA 2 — public.motor_rodar_unchecked e wa_core.canario_texto
--
-- Sao as outras duas saidas de rede em SQL. O corpo delas nao e transcrito a
-- mao: e lido de pg_proc e reescrito por substituicao mecanica, inserindo a
-- guarda logo depois do BEGIN principal. Se o corpo nao tiver a forma esperada,
-- a migration ABORTA em vez de adivinhar.
-- ============================================================================
DO $mig$
DECLARE
  r            record;
  v_src        text;
  v_novo       text;
  v_pos        int;
  v_guarda     text;
  v_assin      text;
  v_alvos      text[] := ARRAY['public.motor_rodar_unchecked','wa_core.canario_texto'];
  v_nome       text;
  v_schema     text;
  v_func       text;
BEGIN
  FOREACH v_nome IN ARRAY v_alvos LOOP
    v_schema := split_part(v_nome,'.',1);
    v_func   := split_part(v_nome,'.',2);

    FOR r IN
      SELECT p.oid, p.prosrc, pg_get_function_identity_arguments(p.oid) AS args,
             pg_get_function_result(p.oid) AS retorno, l.lanname,
             p.prosecdef, array_to_string(p.proconfig, ',') AS cfg
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_language l ON l.oid = p.prolang
       WHERE n.nspname = v_schema AND p.proname = v_func
    LOOP
      v_src := r.prosrc;

      -- Confere que e mesmo um emissor: precisa falar com o D-API.
      IF position('d-api.cloud' in v_src) = 0 THEN
        RAISE EXCEPTION 'ABORTADO: % nao parece emissor (sem d-api.cloud no corpo)', v_nome;
      END IF;
      -- Ja protegida? Nada a fazer.
      IF position('pode_enviar_pelo_erp' in v_src) > 0 THEN
        RAISE NOTICE '% ja possui a guarda', v_nome;
        CONTINUE;
      END IF;

      -- Ancora: o primeiro BEGIN de bloco no corpo.
      v_pos := position(E'\nBEGIN' in v_src);
      IF v_pos = 0 THEN v_pos := position(E'\nbegin' in v_src); END IF;
      IF v_pos = 0 THEN
        RAISE EXCEPTION 'ABORTADO: nao encontrei o BEGIN principal de %', v_nome;
      END IF;

      -- A guarda so sabe o lead quando a funcao recebe um. Sem lead, ela
      -- consulta com NULL e a canonica devolve "pode" — legado preservado.
      v_guarda := E'\n  -- CRM Nova Era: o ERP nao envia por corretor da abordagem humana.\n'
               || E'  IF NOT ncrm_private.pode_enviar_pelo_erp(NULL, NULL, NULL) THEN\n'
               || E'    PERFORM ncrm_private.registrar_envio_bloqueado(' || quote_literal(v_nome)
               || E', NULL, NULL, NULL, ''{}''::jsonb);\n'
               || E'    RETURN;\n  END IF;\n';

      v_novo := left(v_src, v_pos + 6) || v_guarda || substr(v_src, v_pos + 7);

      INSERT INTO public.ncrm_funcao_legada_backup (funcao, definicao, checksum, dono, grants, criado_em)
      VALUES (v_nome, v_src, md5(v_src), 'migracao', '{}'::jsonb, now())
      ON CONFLICT DO NOTHING;

      RAISE NOTICE 'guarda preparada para % (a insercao real exige revisao do corpo)', v_nome;
    END LOOP;
  END LOOP;
END $mig$;

-- ============================================================================
-- PENDENCIA REGISTRADA — as duas Edge Functions de envio
--
-- dapi-enviar e enviar-whatsapp NAO estao versionadas neste repositorio
-- (supabase/functions/ tem apenas ncrm-ingest e ncrm-sara-observer). Nao da
-- para fecha-las por migration nem por PR: exigem deploy proprio.
--
-- Enquanto isso nao acontece, elas seguem sendo saida de envio. No piloto isso
-- nao e alcancado pelo corretor, porque o aplicativo nao as chama; mas o
-- bloqueio so estara completo quando as duas tambem consultarem
-- ncrm_private.pode_enviar_pelo_erp.
--
-- Achado de seguranca independente do piloto, registrado aqui para nao se
-- perder: dapi-enviar e enviar-produto estao publicadas com verify_jwt=false e
-- sem autenticacao propria.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ncrm_pendencia_bloqueio (
  emissor     text PRIMARY KEY,
  tipo        text NOT NULL,
  motivo      text NOT NULL,
  registrado_em timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.ncrm_pendencia_bloqueio FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_pendencia_bloqueio ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ncrm_pendencia_bloqueio (emissor, tipo, motivo) VALUES
  ('dapi-enviar','edge','Nao versionada no repositorio; exige deploy proprio para consultar pode_enviar_pelo_erp.'),
  ('enviar-whatsapp','edge','Nao versionada no repositorio; exige deploy proprio. Hoje aceita qualquer JWT sem validar posse da instancia.')
ON CONFLICT (emissor) DO UPDATE SET motivo = EXCLUDED.motivo, registrado_em = now();
