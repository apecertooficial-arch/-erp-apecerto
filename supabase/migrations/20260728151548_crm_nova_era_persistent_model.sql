-- CRM Nova Era — modelo persistente (implementação da arquitetura aprovada Fase 2.2).
-- Fontes normativas: docs/crm-nova-era/14-20. NÃO cria conversão proposta->venda.
-- NÃO altera nenhum objeto legado (só cria objetos ncrm_*). Não cria trigger em tabela legada.
-- Tipos reais confirmados por descoberta read-only na produção:
--   negocios.id/lead_id/corretor_id = bigint · visitas.id/vendas.id/usuarios.id/empreendimentos.id/unidades.id = uuid.
-- Helpers públicos existentes (DEFINER/STABLE, owner postgres, search_path=public):
--   current_broker_id()->bigint · manages_broker(bigint)->bool · can_manage_all()->bool · has_perm(text,text)->bool.
-- RLS legada: habilitada, FORCE=off, owner postgres => helper DEFINER owned by postgres não reentra na RLS delas.

-- ============================================================================
-- 0. SCHEMA PRIVADO (não exposto à Data API) + grants de schema (correção 2.1)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS ncrm_private;
REVOKE ALL ON SCHEMA ncrm_private FROM PUBLIC;            -- remove CREATE e USAGE de todos
GRANT USAGE ON SCHEMA ncrm_private TO authenticated;      -- estritamente p/ a policy chamar pode_ver_negocio

-- ============================================================================
-- 1. CONFIG VERSIONADA + PASSOS (imutável após publicar)
-- ============================================================================
CREATE TABLE public.ncrm_workflow_config (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  versao                    integer NOT NULL UNIQUE,
  status                    text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicada','encerrada')),
  vigencia_inicio           timestamptz NULL,
  vigencia_fim              timestamptz NULL,
  timezone                  text NOT NULL DEFAULT 'America/Sao_Paulo',
  janela_inicio             time NOT NULL DEFAULT time '09:30',
  janela_fim                time NOT NULL DEFAULT time '18:00',
  espera_apos_automacao_min integer NOT NULL DEFAULT 120 CHECK (espera_apos_automacao_min >= 0),
  max_tentativas            integer NOT NULL DEFAULT 4 CHECK (max_tentativas BETWEEN 1 AND 20),
  fds_operacional           boolean NOT NULL DEFAULT true,
  criado_em                 timestamptz NOT NULL DEFAULT now(),
  criado_por                uuid NULL REFERENCES public.usuarios(id),
  publicado_em              timestamptz NULL,
  CHECK (janela_fim > janela_inicio),
  CHECK (vigencia_fim IS NULL OR (vigencia_inicio IS NOT NULL AND vigencia_fim > vigencia_inicio)),
  CHECK (status <> 'publicada' OR vigencia_inicio IS NOT NULL),
  CONSTRAINT ck_publicada_sem_fim  CHECK (status <> 'publicada' OR vigencia_fim IS NULL),
  CONSTRAINT ck_encerrada_com_fim  CHECK (status <> 'encerrada' OR vigencia_fim IS NOT NULL)
);
COMMENT ON TABLE public.ncrm_workflow_config IS 'CRM Nova Era: cadência versionada; imutável após publicar (trigger).';
CREATE UNIQUE INDEX ux_ncrm_config_publicada_ativa
  ON public.ncrm_workflow_config ((true)) WHERE status = 'publicada' AND vigencia_fim IS NULL;

CREATE TABLE public.ncrm_workflow_passo (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  config_id        bigint  NOT NULL REFERENCES public.ncrm_workflow_config(id) ON DELETE RESTRICT,
  ordem            integer NOT NULL CHECK (ordem >= 1),
  canal_sugerido   text    NOT NULL CHECK (canal_sugerido IN ('ligacao','whatsapp','email','presencial')),
  intervalo_min    integer NOT NULL CHECK (intervalo_min >= 0),
  rotulo           text    NOT NULL,
  texto_orientacao text    NULL,
  CONSTRAINT ux_ncrm_passo UNIQUE (config_id, ordem)
);

-- ============================================================================
-- 2. PROPOSTA COMERCIAL (≠ venda). venda_id sem FK nesta entrega (conversão fora do escopo).
-- ============================================================================
CREATE TABLE public.ncrm_proposta (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id        bigint NOT NULL REFERENCES public.negocios(id),
  lead_id           bigint NOT NULL REFERENCES public.leads(id),
  corretor_id       bigint NULL REFERENCES public.corretores(id),
  empreendimento_id uuid NULL REFERENCES public.empreendimentos(id),
  unidade_id        uuid NULL REFERENCES public.unidades(id),
  valor             numeric(14,2) NOT NULL CHECK (valor > 0),
  data_proposta     timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'registrada'
    CHECK (status IN ('registrada','em_negociacao','aceita','recusada','expirada','cancelada','convertida')),
  motivo_encerramento text NULL,
  observacao        text NULL,
  idempotency_key   text NOT NULL,
  venda_id          uuid NULL,
  criada_por        uuid NOT NULL REFERENCES public.usuarios(id),
  criada_em         timestamptz NOT NULL DEFAULT now(),
  atualizada_em     timestamptz NOT NULL DEFAULT now(),
  aceita_em         timestamptz NULL,
  encerrada_em      timestamptz NULL,
  convertida_em     timestamptz NULL,
  versao            integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  CHECK (status <> 'aceita'     OR aceita_em IS NOT NULL),
  CHECK (status NOT IN ('recusada','expirada','cancelada') OR (encerrada_em IS NOT NULL AND motivo_encerramento IS NOT NULL)),
  CHECK (status <> 'convertida' OR (venda_id IS NOT NULL AND convertida_em IS NOT NULL)),
  CHECK (venda_id IS NULL OR status = 'convertida')
);
COMMENT ON TABLE public.ncrm_proposta IS 'Proposta ≠ venda. Registrar NÃO cria venda nem marca negocio ganho. venda_id só na conversão (fora desta entrega).';
CREATE UNIQUE INDEX ux_ncrm_proposta_idem ON public.ncrm_proposta (idempotency_key);
CREATE INDEX ix_ncrm_proposta_negocio ON public.ncrm_proposta (negocio_id, criada_em DESC);
CREATE UNIQUE INDEX ux_ncrm_proposta_viva ON public.ncrm_proposta (negocio_id)
  WHERE status IN ('registrada','em_negociacao','aceita');

-- ============================================================================
-- 3. SNAPSHOT (sem corretor_id/lead_id) + invariantes bidirecionais (doc 16)
-- ============================================================================
CREATE TABLE public.ncrm_estado (
  negocio_id           bigint PRIMARY KEY REFERENCES public.negocios(id),
  workflow_config_id   bigint NOT NULL REFERENCES public.ncrm_workflow_config(id) ON DELETE RESTRICT,
  etapa                text NOT NULL DEFAULT 'novo'
    CHECK (etapa IN ('novo','tentando_contato','em_atendimento','em_acompanhamento')),
  msg_automatica_em    timestamptz NULL,
  aguardando_automacao boolean NOT NULL DEFAULT false,
  respondeu            boolean NOT NULL DEFAULT false,
  primeira_resposta_em timestamptz NULL,
  resposta_pendente    boolean NOT NULL DEFAULT false,
  tentativas_feitas    integer NOT NULL DEFAULT 0 CHECK (tentativas_feitas >= 0),
  proxima_acao_tipo    text NULL CHECK (proxima_acao_tipo IN (
    'tentativa_cadencia','retornar_contato','entender_necessidade','enviar_opcoes','confirmar_recebimento',
    'ligar_retorno','solicitar_documentacao','agendar_visita','preparar_proposta','corrigir_cadastro','avaliar_descarte','outro')),
  proxima_acao_titulo  text NULL,
  proxima_acao_em      timestamptz NULL,
  ultima_interacao_em  timestamptz NULL,
  temperatura          text NULL CHECK (temperatura IN ('frio','morno','quente','negociando')),
  saida                text NULL CHECK (saida IN ('pipeline_visitas','esteira_vendas','descartado','nutricao')),
  saida_em             timestamptz NULL,
  visita_id            uuid NULL REFERENCES public.visitas(id),
  proposta_id          uuid NULL REFERENCES public.ncrm_proposta(id),
  descarte_motivo      text NULL CHECK (descarte_motivo IS NULL OR descarte_motivo IN (
    'sem_interesse','sem_perfil_financeiro','numero_invalido','ja_comprou_concorrente','duplicado','outro')),
  descarte_detalhe     text NULL,
  versao               integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  ultima_decisao_humana_em timestamptz NULL,
  origem_ultima        text NOT NULL DEFAULT 'sistema' CHECK (origem_ultima IN ('usuario','automacao','sara','sistema','migracao')),
  atualizado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_por       uuid NULL REFERENCES public.usuarios(id),
  CONSTRAINT ck_ativo_tem_proxima  CHECK (saida IS NOT NULL OR (proxima_acao_tipo IS NOT NULL AND proxima_acao_titulo IS NOT NULL AND proxima_acao_em IS NOT NULL)),
  CONSTRAINT ck_saida_sem_proxima  CHECK (saida IS NULL     OR (proxima_acao_tipo IS NULL     AND proxima_acao_titulo IS NULL     AND proxima_acao_em IS NULL)),
  CONSTRAINT ck_saida_impl_data    CHECK (saida IS NULL OR saida_em IS NOT NULL),
  CONSTRAINT ck_data_impl_saida    CHECK (saida_em IS NULL OR saida IS NOT NULL),
  CONSTRAINT ck_visita_impl_saida  CHECK (visita_id IS NULL OR saida = 'pipeline_visitas'),
  CONSTRAINT ck_saida_impl_visita  CHECK (saida <> 'pipeline_visitas' OR visita_id IS NOT NULL),
  CONSTRAINT ck_prop_impl_saida    CHECK (proposta_id IS NULL OR saida = 'esteira_vendas'),
  CONSTRAINT ck_saida_impl_prop    CHECK (saida <> 'esteira_vendas' OR proposta_id IS NOT NULL),
  CONSTRAINT ck_motivo_impl_saida  CHECK (descarte_motivo IS NULL OR saida = 'descartado'),
  CONSTRAINT ck_saida_impl_motivo  CHECK (saida <> 'descartado' OR descarte_motivo IS NOT NULL),
  CONSTRAINT ck_descarte_outro     CHECK (descarte_motivo <> 'outro' OR (descarte_detalhe IS NOT NULL AND btrim(descarte_detalhe) <> '')),
  CONSTRAINT ck_resp_impl_data     CHECK (NOT respondeu OR primeira_resposta_em IS NOT NULL),
  CONSTRAINT ck_data_impl_resp     CHECK (primeira_resposta_em IS NULL OR respondeu),
  CONSTRAINT ck_pend_impl_resp     CHECK (NOT resposta_pendente OR respondeu),
  CONSTRAINT ck_auto_impl_msg      CHECK (NOT aguardando_automacao OR msg_automatica_em IS NOT NULL),
  CONSTRAINT ck_auto_nao_respondeu CHECK (NOT (aguardando_automacao AND respondeu))
);
COMMENT ON TABLE public.ncrm_estado IS 'Snapshot 1:1 negocios. NÃO guarda corretor_id/lead_id (posse lida ao vivo em negocios). Escrita só via RPC (versao=optimistic lock).';
CREATE INDEX ix_ncrm_estado_quadro ON public.ncrm_estado (etapa, proxima_acao_em, negocio_id) WHERE saida IS NULL;
CREATE INDEX ix_ncrm_estado_prazo  ON public.ncrm_estado (proxima_acao_em, negocio_id) WHERE saida IS NULL;
CREATE INDEX ix_ncrm_estado_resp   ON public.ncrm_estado (ultima_interacao_em DESC, negocio_id) WHERE resposta_pendente AND saida IS NULL;
CREATE INDEX ix_ncrm_estado_saida  ON public.ncrm_estado (saida, saida_em, negocio_id) WHERE saida IS NOT NULL;

-- ============================================================================
-- 4. EVENTO IMUTÁVEL
-- ============================================================================
CREATE TABLE public.ncrm_evento (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id            bigint NOT NULL REFERENCES public.negocios(id),
  lead_id               bigint NOT NULL REFERENCES public.leads(id),
  corretor_id_no_evento bigint NULL REFERENCES public.corretores(id),
  workflow_config_id    bigint NOT NULL REFERENCES public.ncrm_workflow_config(id) ON DELETE RESTRICT,
  tipo                  text NOT NULL CHECK (tipo IN (
    'mensagem_automatica','tentativa','resposta_cliente','acao_comercial','reagendamento','mudanca_etapa',
    'transferencia','visita_agendada','proposta_registrada','proposta_transicao','proposta_convertida',
    'descarte','nutricao','reativacao','classificacao_sara','correcao_manual')),
  numero_tentativa      integer NULL CHECK (numero_tentativa IS NULL OR numero_tentativa >= 1),
  canal                 text NULL CHECK (canal IS NULL OR canal IN ('ligacao','whatsapp','email','presencial')),
  resultado             text NULL,
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem                text NOT NULL CHECK (origem IN ('usuario','automacao','sara','sistema','migracao')),
  executado_por         uuid NULL REFERENCES public.usuarios(id),
  idempotency_key       text NULL,
  estado_versao_antes   integer NULL,
  estado_versao_apos    integer NULL,
  criado_em             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_payload_obj  CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT ck_payload_size CHECK (pg_column_size(payload) <= 8192),
  CHECK (tipo <> 'tentativa'      OR (numero_tentativa IS NOT NULL AND canal IS NOT NULL AND resultado IS NOT NULL)),
  CHECK (tipo <> 'acao_comercial' OR resultado IS NOT NULL),
  CHECK (origem <> 'usuario'      OR executado_por IS NOT NULL),
  CHECK ((estado_versao_antes IS NULL AND estado_versao_apos IS NULL) OR (estado_versao_apos = estado_versao_antes + 1))
);
CREATE INDEX ix_ncrm_evento_negocio ON public.ncrm_evento (negocio_id, id);
CREATE INDEX ix_ncrm_evento_ind     ON public.ncrm_evento (criado_em, tipo, negocio_id);
CREATE UNIQUE INDEX ux_ncrm_evento_idem ON public.ncrm_evento (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- 5. TRIGGERS DE IMUTABILIDADE (somente em objetos ncrm_*)
-- ============================================================================
CREATE FUNCTION ncrm_private.evento_imutavel() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  RAISE EXCEPTION 'public.ncrm_evento é append-only (%). Use correcao_manual.', TG_OP USING ERRCODE = 'raise_exception';
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.evento_imutavel() FROM PUBLIC;
CREATE TRIGGER trg_ncrm_evento_imutavel BEFORE UPDATE OR DELETE ON public.ncrm_evento
  FOR EACH ROW EXECUTE FUNCTION ncrm_private.evento_imutavel();

-- Transições: rascunho->publicada (set publicado_em) e publicada->encerrada (exige vigencia_fim);
-- publicada->rascunho e encerrada->qualquer são proibidas; regras imutáveis após publicar.
CREATE FUNCTION ncrm_private.config_imutavel() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'rascunho' THEN RAISE EXCEPTION 'config_nao_rascunho_nao_apaga'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'encerrada' THEN
    RAISE EXCEPTION 'config_encerrada_imutavel';
  ELSIF OLD.status = 'publicada' THEN
    IF NEW.versao IS DISTINCT FROM OLD.versao OR NEW.janela_inicio IS DISTINCT FROM OLD.janela_inicio
       OR NEW.janela_fim IS DISTINCT FROM OLD.janela_fim OR NEW.timezone IS DISTINCT FROM OLD.timezone
       OR NEW.espera_apos_automacao_min IS DISTINCT FROM OLD.espera_apos_automacao_min
       OR NEW.max_tentativas IS DISTINCT FROM OLD.max_tentativas OR NEW.fds_operacional IS DISTINCT FROM OLD.fds_operacional
       OR NEW.vigencia_inicio IS DISTINCT FROM OLD.vigencia_inicio OR NEW.publicado_em IS DISTINCT FROM OLD.publicado_em THEN
      RAISE EXCEPTION 'config_publicada_regras_imutaveis';
    END IF;
    IF NEW.status NOT IN ('publicada','encerrada') THEN RAISE EXCEPTION 'config_transicao_invalida'; END IF;  -- bloqueia ->rascunho
    -- publicada não pode receber vigencia_fim sem mudar, na MESMA operação, para encerrada.
    IF NEW.status = 'publicada' AND NEW.vigencia_fim IS NOT NULL THEN RAISE EXCEPTION 'config_publicada_nao_recebe_vigencia_fim'; END IF;
    IF NEW.status = 'encerrada' THEN
      IF NEW.vigencia_fim IS NULL THEN RAISE EXCEPTION 'config_encerramento_exige_vigencia_fim'; END IF;
      IF NEW.vigencia_fim <= NEW.vigencia_inicio THEN RAISE EXCEPTION 'config_vigencia_fim_incoerente'; END IF;
    END IF;
  ELSE -- OLD.status = 'rascunho'
    IF NEW.status NOT IN ('rascunho','publicada') THEN RAISE EXCEPTION 'config_transicao_invalida'; END IF;
    IF NEW.status = 'publicada' THEN
      IF NEW.vigencia_inicio IS NULL THEN RAISE EXCEPTION 'config_publicacao_exige_vigencia_inicio'; END IF;
      NEW.publicado_em := COALESCE(NEW.publicado_em, now());
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.config_imutavel() FROM PUBLIC;
CREATE TRIGGER trg_ncrm_config_imutavel BEFORE UPDATE OR DELETE ON public.ncrm_workflow_config
  FOR EACH ROW EXECUTE FUNCTION ncrm_private.config_imutavel();

-- Passos só podem ser inseridos/alterados/apagados quando a config-mãe está em rascunho.
CREATE FUNCTION ncrm_private.passo_imutavel() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE v_status_old text; v_status_new text;
BEGIN
  -- INSERT valida NEW; DELETE valida OLD; UPDATE valida AMBAS (origem e destino do passo).
  -- Fecha a brecha de "mover" um passo de config publicada/encerrada para uma config em rascunho.
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT status INTO v_status_old FROM public.ncrm_workflow_config WHERE id = OLD.config_id;
    IF v_status_old IS DISTINCT FROM 'rascunho' THEN RAISE EXCEPTION 'passos_imutaveis_config_nao_rascunho'; END IF;
  END IF;
  IF TG_OP IN ('UPDATE','INSERT') THEN
    SELECT status INTO v_status_new FROM public.ncrm_workflow_config WHERE id = NEW.config_id;
    IF v_status_new IS DISTINCT FROM 'rascunho' THEN RAISE EXCEPTION 'passos_imutaveis_config_nao_rascunho'; END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.passo_imutavel() FROM PUBLIC;
CREATE TRIGGER trg_ncrm_passo_imutavel BEFORE INSERT OR UPDATE OR DELETE ON public.ncrm_workflow_passo
  FOR EACH ROW EXECUTE FUNCTION ncrm_private.passo_imutavel();

-- ============================================================================
-- 6. HELPERS DE POSSE (RLS lê a posse ATUAL em negocios) — correções 1-3
-- ============================================================================
CREATE FUNCTION ncrm_private.negocio_corretor(p_negocio_id bigint)
  RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT n.corretor_id FROM public.negocios n WHERE n.id = p_negocio_id
$fn$;
REVOKE ALL ON FUNCTION ncrm_private.negocio_corretor(bigint) FROM PUBLIC;

-- FAIL-CLOSED: só concede quando o resultado é explicitamente TRUE (COALESCE em todas as partes).
CREATE FUNCTION ncrm_private.pode_ver_negocio(p_negocio_id bigint)
  RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_corretor bigint;
BEGIN
  IF COALESCE(public.can_manage_all(), false) THEN RETURN true; END IF;
  v_corretor := ncrm_private.negocio_corretor(p_negocio_id);
  IF v_corretor IS NULL THEN RETURN false; END IF;
  RETURN COALESCE(v_corretor = public.current_broker_id(), false)
      OR COALESCE(public.manages_broker(v_corretor), false);
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.pode_ver_negocio(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ncrm_private.pode_ver_negocio(bigint) TO authenticated;

CREATE FUNCTION ncrm_private.pode_operar_negocio(p_negocio_id bigint)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT COALESCE(ncrm_private.pode_ver_negocio(p_negocio_id), false)
     AND COALESCE(public.has_perm('crm','editar'), false)
$fn$;
REVOKE ALL ON FUNCTION ncrm_private.pode_operar_negocio(bigint) FROM PUBLIC;

CREATE FUNCTION ncrm_private.assert_idem(p_idem text) RETURNS void
  LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $fn$
BEGIN
  IF p_idem IS NULL OR btrim(p_idem) = '' THEN
    RAISE EXCEPTION 'idempotency_key_obrigatoria' USING ERRCODE = 'raise_exception';
  END IF;
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.assert_idem(text) FROM PUBLIC;

CREATE FUNCTION ncrm_private.clamp_janela(p_ts timestamptz, p_config_id bigint)
  RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = '' AS $fn$
DECLARE c public.ncrm_workflow_config%ROWTYPE; v_local timestamp; v_min int; v_ini int; v_fim int;
BEGIN
  SELECT * INTO c FROM public.ncrm_workflow_config WHERE id = p_config_id;
  v_local := p_ts AT TIME ZONE c.timezone;
  v_min := extract(hour FROM v_local)::int*60 + extract(minute FROM v_local)::int;
  v_ini := extract(hour FROM c.janela_inicio)::int*60 + extract(minute FROM c.janela_inicio)::int;
  v_fim := extract(hour FROM c.janela_fim)::int*60 + extract(minute FROM c.janela_fim)::int;
  IF v_min BETWEEN v_ini AND v_fim THEN RETURN p_ts; END IF;
  IF v_min > v_fim THEN v_local := (date_trunc('day', v_local) + interval '1 day'); ELSE v_local := date_trunc('day', v_local); END IF;
  v_local := v_local + make_interval(mins => v_ini);
  RETURN v_local AT TIME ZONE c.timezone;
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.clamp_janela(timestamptz,bigint) FROM PUBLIC;

-- ============================================================================
-- 7. RPCs (public, DEFINER, search_path=''). Derivam ids/origem do banco; nunca do cliente.
--    Ordem canônica (doc 15): trava -> checa versão -> valida -> UPDATE estado -> INSERT evento (por último).
--    Idempotência: pré-check + UNIQUE; unique_violation no bloco EXCEPTION reverte o UPDATE anterior.
-- ============================================================================

-- 7.0 Automação de entrada (service_role): cria o snapshot se não existir.
CREATE FUNCTION public.ncrm_registrar_msg_automatica(p_negocio_id bigint, p_message_id text, p_enviado_em timestamptz)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_lead bigint; v_corretor bigint; v_cfg bigint; v_idem text; v_prox timestamptz; v_espera int; v_msg text;
BEGIN
  v_msg := btrim(COALESCE(p_message_id,''));
  IF v_msg = '' THEN RETURN jsonb_build_object('ok',false,'erro','message_id_obrigatorio'); END IF;  -- rejeita NULL/vazio/espaços
  IF p_enviado_em IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','enviado_em_obrigatorio'); END IF;  -- timestamp controlado
  v_idem := 'auto:' || v_msg;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = v_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT id, espera_apos_automacao_min INTO v_cfg, v_espera FROM public.ncrm_workflow_config WHERE status='publicada' AND vigencia_fim IS NULL;
  IF v_cfg IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','sem_config_publicada'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = p_negocio_id) THEN
    RETURN jsonb_build_object('ok',false,'erro','estado_ja_existe'); END IF;
  v_prox := ncrm_private.clamp_janela(p_enviado_em + make_interval(mins => v_espera), v_cfg);
  INSERT INTO public.ncrm_estado (negocio_id, workflow_config_id, etapa, msg_automatica_em, aguardando_automacao,
     proxima_acao_tipo, proxima_acao_titulo, proxima_acao_em, origem_ultima, versao)
  VALUES (p_negocio_id, v_cfg, 'novo', p_enviado_em, true,
     'tentativa_cadencia', 'Primeira intervenção humana', v_prox, 'automacao', 1);
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo,
     payload, origem, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'mensagem_automatica',
     jsonb_build_object('message_id', v_msg), 'automacao', v_idem, 0, 1);
  RETURN jsonb_build_object('ok',true,'versao',1);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = v_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_registrar_msg_automatica(bigint,text,timestamptz) FROM PUBLIC, anon, authenticated;  -- service_role-only (não valida pode_operar)
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_msg_automatica(bigint,text,timestamptz) TO service_role;

-- 7.1 Registrar tentativa (cadência CALCULADA PELO BANCO).
--   Sem resposta: o cliente NÃO decide a próxima ação. O banco deriva de ncrm_workflow_passo
--   (ordem N+1), intervalo_min, timezone/janela e clamp_janela. Última tentativa -> avaliar_descarte.
--   Toda tentativa humana incrementa tentativas_feitas (qualquer resultado). numero_tentativa = novo valor.
--   Resposta (respondeu/pediu_retorno): encerra a cadência e exige próxima ação COMERCIAL do humano.
CREATE FUNCTION public.ncrm_registrar_tentativa(
    p_negocio_id bigint, p_versao int, p_canal text, p_resultado text, p_obs text,
    p_proxima_tipo text, p_proxima_titulo text, p_proxima_em timestamptz, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint;
        v_respondeu boolean; v_prim timestamptz; v_pend boolean; v_etapa text; v_tent int;
        v_saida text; v_resp_atual boolean; v_max int; v_cfg_versao int; v_num int;
        v_ordem_exec int; v_prox_ordem int; v_prox_intervalo int;
        v_prox_tipo text; v_prox_titulo text; v_prox_canal text; v_prox_em timestamptz;
        v_passo_prox public.ncrm_workflow_passo%ROWTYPE; v_tem_prox boolean;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;  -- fail-closed
  IF p_canal NOT IN ('ligacao','whatsapp','email','presencial') THEN RETURN jsonb_build_object('ok',false,'erro','canal_invalido'); END IF;
  IF p_resultado NOT IN ('nao_respondeu','respondeu','telefone_invalido','pediu_retorno','sem_interesse','contato_inadequado') THEN
    RETURN jsonb_build_object('ok',false,'erro','resultado_invalido'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;

  SELECT e.versao, e.workflow_config_id, e.tentativas_feitas, e.saida, e.respondeu, c.max_tentativas, c.versao
    INTO v_antes, v_cfg, v_tent, v_saida, v_resp_atual, v_max, v_cfg_versao
    FROM public.ncrm_estado e JOIN public.ncrm_workflow_config c ON c.id = e.workflow_config_id
    WHERE e.negocio_id = p_negocio_id FOR UPDATE OF e;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','estado_em_saida'); END IF;
  IF v_resp_atual THEN RETURN jsonb_build_object('ok',false,'erro','cadencia_encerrada'); END IF;   -- já respondeu antes
  IF v_tent >= v_max THEN RETURN jsonb_build_object('ok',false,'erro','cadencia_esgotada'); END IF; -- nenhuma nova tentativa após esgotar

  v_respondeu := (p_resultado IN ('respondeu','pediu_retorno'));
  v_num := v_tent + 1;                 -- número desta tentativa humana (== novo tentativas_feitas)
  v_ordem_exec := v_num;               -- passo executado nesta tentativa (ordem == número)

  IF v_respondeu THEN
    -- Encerra cadência; a próxima ação COMERCIAL vem do humano (não do banco). Campos do cliente exigidos e validados.
    IF p_proxima_tipo IS NULL OR p_proxima_titulo IS NULL OR p_proxima_em IS NULL THEN
      RETURN jsonb_build_object('ok',false,'erro','proxima_acao_obrigatoria'); END IF;
    IF p_proxima_tipo = 'tentativa_cadencia' THEN RETURN jsonb_build_object('ok',false,'erro','proxima_acao_fora_do_fluxo'); END IF;
    IF p_proxima_em < now() THEN RETURN jsonb_build_object('ok',false,'erro','proxima_acao_em_no_passado'); END IF;
    v_prox_tipo := p_proxima_tipo; v_prox_titulo := p_proxima_titulo; v_prox_em := p_proxima_em; v_prox_canal := NULL;
    v_prox_ordem := NULL; v_prox_intervalo := NULL; v_tem_prox := false;
  ELSE
    -- Sem resposta: BANCO calcula. Ignora integralmente os campos de próxima ação enviados pelo cliente.
    v_prox_ordem := v_ordem_exec + 1;  -- próximo passo da cadência
    SELECT * INTO v_passo_prox FROM public.ncrm_workflow_passo WHERE config_id = v_cfg AND ordem = v_prox_ordem;
    v_tem_prox := FOUND AND (v_num < v_max);   -- existe próximo passo E ainda há tentativas permitidas
    IF v_tem_prox THEN
      v_prox_tipo   := 'tentativa_cadencia';
      v_prox_titulo := v_passo_prox.rotulo;
      v_prox_canal  := v_passo_prox.canal_sugerido;
      v_prox_intervalo := v_passo_prox.intervalo_min;
      v_prox_em     := ncrm_private.clamp_janela(now() + make_interval(mins => v_prox_intervalo), v_cfg);
    ELSE
      -- Última tentativa: não cria 5ª tarefa impossível; entrega decisão ao corretor.
      v_prox_tipo   := 'avaliar_descarte';
      v_prox_titulo := 'Avaliar descarte ou nutrição';
      v_prox_canal  := NULL;
      v_prox_ordem  := NULL; v_prox_intervalo := NULL;
      v_prox_em     := ncrm_private.clamp_janela(now(), v_cfg);
    END IF;
  END IF;

  v_prim := CASE WHEN v_respondeu THEN now() ELSE NULL END;
  v_pend := (p_resultado = 'respondeu');
  v_etapa := CASE WHEN NOT v_respondeu THEN 'tentando_contato'
                  WHEN v_prox_tipo IN ('enviar_opcoes','solicitar_documentacao','ligar_retorno','retornar_contato','agendar_visita','preparar_proposta')
                    THEN 'em_acompanhamento' ELSE 'em_atendimento' END;

  UPDATE public.ncrm_estado SET
    tentativas_feitas = tentativas_feitas + 1,     -- SEMPRE incrementa (qualquer resultado humano)
    respondeu = respondeu OR v_respondeu,
    primeira_resposta_em = COALESCE(primeira_resposta_em, v_prim),
    resposta_pendente = v_pend, aguardando_automacao = false,
    proxima_acao_tipo = v_prox_tipo, proxima_acao_titulo = v_prox_titulo, proxima_acao_em = v_prox_em,
    ultima_interacao_em = now(), etapa = v_etapa,
    versao = v_antes + 1, atualizado_em = now(), atualizado_por = v_uid,
    origem_ultima = 'usuario', ultima_decisao_humana_em = now()
  WHERE negocio_id = p_negocio_id AND versao = v_antes;

  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo,
     numero_tentativa, canal, resultado, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'tentativa',
     v_num, p_canal, p_resultado,
     jsonb_build_object(
       'obs', p_obs,
       'passo_executado', v_ordem_exec,
       'canal_executado', p_canal,
       'proximo_passo', v_prox_ordem,
       'proxima_acao_tipo', v_prox_tipo,
       'canal_sugerido_seguinte', v_prox_canal,
       'prazo_calculado', v_prox_em,
       'config_id', v_cfg,
       'config_versao', v_cfg_versao,
       'estado_versao', v_antes + 1),
     'usuario', v_uid, p_idem, v_antes, v_antes + 1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes + 1, 'proxima_acao_tipo', v_prox_tipo, 'proxima_acao_em', v_prox_em);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_registrar_tentativa(bigint,int,text,text,text,text,text,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_tentativa(bigint,int,text,text,text,text,text,timestamptz,text) TO authenticated;

-- 7.2 Saída visita (consome visita existente; NÃO insere em visitas).
CREATE FUNCTION public.ncrm_saida_visita(p_negocio_id bigint, p_versao int, p_visita_id uuid, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_saida text;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_visita_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.visitas v WHERE v.id = p_visita_id AND v.negocio_id = p_negocio_id) THEN
    RETURN jsonb_build_object('ok',false,'erro','visita_invalida'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT versao, workflow_config_id, saida INTO v_antes, v_cfg, v_saida FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','ja_em_saida'); END IF;
  UPDATE public.ncrm_estado SET saida='pipeline_visitas', saida_em=now(), visita_id=p_visita_id,
     proxima_acao_tipo=NULL, proxima_acao_titulo=NULL, proxima_acao_em=NULL, resposta_pendente=false,
     versao=v_antes+1, atualizado_em=now(), atualizado_por=v_uid, origem_ultima='usuario', ultima_decisao_humana_em=now()
  WHERE negocio_id=p_negocio_id AND versao=v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'visita_agendada', jsonb_build_object('visita_id', p_visita_id), 'usuario', v_uid, p_idem, v_antes, v_antes+1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes+1);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_saida_visita(bigint,int,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_saida_visita(bigint,int,uuid,text) TO authenticated;

-- 7.3 Saída proposta (cria ncrm_proposta; NÃO cria venda; NÃO marca ganho).
CREATE FUNCTION public.ncrm_saida_proposta(p_negocio_id bigint, p_versao int, p_empreendimento_id uuid, p_unidade_id uuid,
    p_valor numeric, p_data timestamptz, p_obs text, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_prop uuid; v_saida text;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN RETURN jsonb_build_object('ok',false,'erro','valor_invalido'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT versao, workflow_config_id, saida INTO v_antes, v_cfg, v_saida FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','ja_em_saida'); END IF;
  SELECT id INTO v_prop FROM public.ncrm_proposta WHERE negocio_id=p_negocio_id AND status IN ('registrada','em_negociacao','aceita');
  IF v_prop IS NULL THEN
    INSERT INTO public.ncrm_proposta (negocio_id, lead_id, corretor_id, empreendimento_id, unidade_id, valor, data_proposta, status, observacao, idempotency_key, criada_por)
    VALUES (p_negocio_id, v_lead, v_corretor, p_empreendimento_id, p_unidade_id, p_valor, p_data, 'registrada', p_obs, p_idem || ':prop', v_uid)
    RETURNING id INTO v_prop;
  END IF;
  UPDATE public.ncrm_estado SET saida='esteira_vendas', saida_em=now(), proposta_id=v_prop,
     proxima_acao_tipo=NULL, proxima_acao_titulo=NULL, proxima_acao_em=NULL, resposta_pendente=false,
     versao=v_antes+1, atualizado_em=now(), atualizado_por=v_uid, origem_ultima='usuario', ultima_decisao_humana_em=now()
  WHERE negocio_id=p_negocio_id AND versao=v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'proposta_registrada', jsonb_build_object('proposta_id', v_prop, 'valor', p_valor), 'usuario', v_uid, p_idem, v_antes, v_antes+1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes+1, 'proposta_id', v_prop);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_saida_proposta(bigint,int,uuid,uuid,numeric,timestamptz,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_saida_proposta(bigint,int,uuid,uuid,numeric,timestamptz,text,text) TO authenticated;

-- 7.4 Transição de proposta (NÃO reativa o lead). Mantém saida='esteira_vendas'.
CREATE FUNCTION public.ncrm_proposta_transicao(p_proposta_id uuid, p_versao_prop int, p_novo_status text, p_motivo text, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); r public.ncrm_proposta%ROWTYPE; v_cfg bigint; v_ok boolean;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT * INTO r FROM public.ncrm_proposta WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','proposta_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(r.negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_versao_prop <> r.versao THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF p_novo_status NOT IN ('em_negociacao','aceita','recusada','expirada','cancelada') THEN
    RETURN jsonb_build_object('ok',false,'erro','status_invalido'); END IF;
  v_ok := (r.status='registrada' AND p_novo_status IN ('em_negociacao','aceita','recusada','expirada','cancelada'))
       OR (r.status='em_negociacao' AND p_novo_status IN ('aceita','recusada','expirada','cancelada'))
       OR (r.status='aceita' AND p_novo_status IN ('cancelada'));
  IF NOT v_ok THEN RETURN jsonb_build_object('ok',false,'erro','transicao_invalida'); END IF;
  IF p_novo_status IN ('recusada','expirada','cancelada') AND (p_motivo IS NULL OR btrim(p_motivo)='') THEN
    RETURN jsonb_build_object('ok',false,'erro','motivo_obrigatorio'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  UPDATE public.ncrm_proposta SET status=p_novo_status,
     aceita_em = CASE WHEN p_novo_status='aceita' THEN now() ELSE aceita_em END,
     encerrada_em = CASE WHEN p_novo_status IN ('recusada','expirada','cancelada') THEN now() ELSE encerrada_em END,
     motivo_encerramento = CASE WHEN p_novo_status IN ('recusada','expirada','cancelada') THEN p_motivo ELSE motivo_encerramento END,
     atualizada_em = now(), versao = versao + 1
  WHERE id = p_proposta_id AND versao = p_versao_prop;
  SELECT workflow_config_id INTO v_cfg FROM public.ncrm_estado WHERE negocio_id = r.negocio_id;
  IF v_cfg IS NULL THEN SELECT id INTO v_cfg FROM public.ncrm_workflow_config WHERE status='publicada' AND vigencia_fim IS NULL LIMIT 1; END IF;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key)
  VALUES (r.negocio_id, r.lead_id, r.corretor_id, v_cfg, 'proposta_transicao',
     jsonb_build_object('proposta_id', p_proposta_id, 'de', r.status, 'para', p_novo_status, 'motivo', p_motivo), 'usuario', v_uid, p_idem);
  RETURN jsonb_build_object('ok',true,'status', p_novo_status);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_proposta_transicao(uuid,int,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_proposta_transicao(uuid,int,text,text,text) TO authenticated;

-- 7.5 Reativação APÓS proposta encerrada (ação humana explícita e separada).
CREATE FUNCTION public.ncrm_reativar_apos_proposta(
    p_negocio_id bigint, p_versao int, p_motivo text, p_etapa text,
    p_proxima_tipo text, p_proxima_titulo text, p_proxima_em timestamptz, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_prop uuid; v_prop_status text;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_proxima_tipo IS NULL OR p_proxima_titulo IS NULL OR p_proxima_em IS NULL THEN
    RETURN jsonb_build_object('ok',false,'erro','proxima_acao_obrigatoria'); END IF;
  IF p_proxima_em < now() THEN RETURN jsonb_build_object('ok',false,'erro','proxima_acao_em_no_passado'); END IF;  -- data controlada
  IF p_etapa NOT IN ('novo','tentando_contato','em_atendimento','em_acompanhamento') THEN
    RETURN jsonb_build_object('ok',false,'erro','etapa_invalida'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT versao, workflow_config_id, proposta_id INTO v_antes, v_cfg, v_prop
    FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_prop IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','sem_proposta_vinculada'); END IF;
  SELECT status INTO v_prop_status FROM public.ncrm_proposta WHERE id = v_prop;
  IF v_prop_status NOT IN ('recusada','expirada','cancelada') THEN
    RETURN jsonb_build_object('ok',false,'erro','proposta_nao_terminal'); END IF;
  UPDATE public.ncrm_estado SET saida=NULL, saida_em=NULL, proposta_id=NULL,
     etapa=p_etapa, proxima_acao_tipo=p_proxima_tipo, proxima_acao_titulo=p_proxima_titulo, proxima_acao_em=p_proxima_em,
     versao=v_antes+1, atualizado_em=now(), atualizado_por=v_uid, origem_ultima='usuario', ultima_decisao_humana_em=now()
  WHERE negocio_id=p_negocio_id AND versao=v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'reativacao',
     jsonb_build_object('proposta_id', v_prop, 'motivo', p_motivo, 'origem_saida', 'esteira_vendas'), 'usuario', v_uid, p_idem, v_antes, v_antes+1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes+1);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_reativar_apos_proposta(bigint,int,text,text,text,text,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_reativar_apos_proposta(bigint,int,text,text,text,text,timestamptz,text) TO authenticated;

-- 7.6 Sara: sugestão com precedência humana (claim em app_metadata; nunca user_metadata).
CREATE FUNCTION public.ncrm_sara_classificar(p_negocio_id bigint, p_base_versao int, p_sugestao jsonb, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_lead bigint; v_corretor bigint; v_atual int; v_cfg bigint; v_role text; v_motivo text;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  v_role := (auth.jwt() -> 'app_metadata' ->> 'app_role');
  IF v_role IS DISTINCT FROM 'sara' THEN RETURN jsonb_build_object('ok',false,'erro','nao_autorizado_sara'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  -- SUGGESTION-ONLY: Sara NUNCA altera ncrm_estado, nunca incrementa versão, sempre aplicado=false.
  -- (a aplicação de uma sugestão será feita por uma RPC humana auditável, em migration futura.)
  SELECT versao, workflow_config_id INTO v_atual, v_cfg FROM public.ncrm_estado WHERE negocio_id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  v_motivo := CASE WHEN v_atual <> p_base_versao THEN 'precedencia_humana' ELSE 'aguardando_aprovacao_humana' END;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, idempotency_key)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'classificacao_sara',
     jsonb_build_object('aplicado', false, 'motivo', v_motivo, 'sugestao', p_sugestao,
                        'base_versao', p_base_versao, 'versao_atual', v_atual), 'sara', p_idem);
  RETURN jsonb_build_object('ok',true,'aplicado',false,'motivo',v_motivo);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_classificar(bigint,int,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_classificar(bigint,int,jsonb,text) TO authenticated;

-- 7.7 Resposta do cliente (service_role / ingestão WhatsApp). Encerra a cadência de prospecção.
CREATE FUNCTION public.ncrm_registrar_resposta_cliente(p_negocio_id bigint, p_message_id text, p_em timestamptz)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_idem text; v_msg text; v_saida text;
BEGIN
  v_msg := btrim(COALESCE(p_message_id,''));
  IF v_msg = '' THEN RETURN jsonb_build_object('ok',false,'erro','message_id_obrigatorio'); END IF;
  IF p_em IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','em_obrigatorio'); END IF;  -- timestamp controlado
  v_idem := 'wa:' || v_msg;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = v_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT versao, workflow_config_id, saida INTO v_antes, v_cfg, v_saida FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','estado_em_saida'); END IF;
  UPDATE public.ncrm_estado SET
    respondeu = true,
    primeira_resposta_em = COALESCE(primeira_resposta_em, p_em),
    resposta_pendente = true,
    aguardando_automacao = false,
    etapa = 'em_atendimento',
    -- próxima ação comercial PADRÃO (mantém a invariante de estado ativo); o corretor refina depois
    proxima_acao_tipo = 'entender_necessidade', proxima_acao_titulo = 'Entender necessidade do cliente', proxima_acao_em = p_em,
    ultima_interacao_em = p_em,
    versao = v_antes + 1, atualizado_em = now(), origem_ultima = 'automacao'
  WHERE negocio_id = p_negocio_id AND versao = v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, resultado, payload, origem, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'resposta_cliente', 'respondeu', jsonb_build_object('message_id', v_msg), 'automacao', v_idem, v_antes, v_antes + 1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes + 1);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = v_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_registrar_resposta_cliente(bigint,text,timestamptz) FROM PUBLIC, anon, authenticated;  -- service_role-only (não valida pode_operar)
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_resposta_cliente(bigint,text,timestamptz) TO service_role;

-- 7.8 Concluir ação comercial (authenticated). Cliente já respondeu; exige a próxima ação.
CREATE FUNCTION public.ncrm_concluir_acao(p_negocio_id bigint, p_versao int, p_resultado text, p_obs text,
    p_proxima_tipo text, p_proxima_titulo text, p_proxima_em timestamptz, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_saida text; v_resp boolean; v_etapa text;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_resultado IS NULL OR btrim(p_resultado) = '' THEN RETURN jsonb_build_object('ok',false,'erro','resultado_obrigatorio'); END IF;
  IF p_proxima_tipo IS NULL OR p_proxima_titulo IS NULL OR p_proxima_em IS NULL OR p_proxima_tipo = 'tentativa_cadencia' THEN
    RETURN jsonb_build_object('ok',false,'erro','proxima_acao_obrigatoria'); END IF;   -- exige próxima ação comercial
  IF p_proxima_em < now() THEN RETURN jsonb_build_object('ok',false,'erro','proxima_acao_em_no_passado'); END IF;  -- data controlada
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT versao, workflow_config_id, saida, respondeu INTO v_antes, v_cfg, v_saida, v_resp FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','estado_em_saida'); END IF;
  IF NOT v_resp THEN RETURN jsonb_build_object('ok',false,'erro','lead_nao_respondeu'); END IF;
  v_etapa := CASE WHEN p_proxima_tipo IN ('enviar_opcoes','solicitar_documentacao','ligar_retorno','retornar_contato','agendar_visita','preparar_proposta')
                  THEN 'em_acompanhamento' ELSE 'em_atendimento' END;
  UPDATE public.ncrm_estado SET
    resposta_pendente = false, aguardando_automacao = false,
    proxima_acao_tipo = p_proxima_tipo, proxima_acao_titulo = p_proxima_titulo, proxima_acao_em = p_proxima_em,
    ultima_interacao_em = now(), etapa = v_etapa,
    versao = v_antes + 1, atualizado_em = now(), atualizado_por = v_uid, origem_ultima = 'usuario', ultima_decisao_humana_em = now()
  WHERE negocio_id = p_negocio_id AND versao = v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, resultado, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'acao_comercial', p_resultado, jsonb_build_object('obs', p_obs), 'usuario', v_uid, p_idem, v_antes, v_antes + 1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes + 1);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_concluir_acao(bigint,int,text,text,text,text,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_concluir_acao(bigint,int,text,text,text,text,timestamptz,text) TO authenticated;

-- 7.9 Saída: descarte estruturado.
CREATE FUNCTION public.ncrm_saida_descarte(p_negocio_id bigint, p_versao int, p_motivo text, p_detalhe text, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_saida text;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_motivo NOT IN ('sem_interesse','sem_perfil_financeiro','numero_invalido','ja_comprou_concorrente','duplicado','outro') THEN
    RETURN jsonb_build_object('ok',false,'erro','motivo_invalido'); END IF;
  IF p_motivo = 'outro' AND (p_detalhe IS NULL OR btrim(p_detalhe) = '') THEN
    RETURN jsonb_build_object('ok',false,'erro','detalhe_obrigatorio'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT versao, workflow_config_id, saida INTO v_antes, v_cfg, v_saida FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','ja_em_saida'); END IF;
  UPDATE public.ncrm_estado SET saida='descartado', saida_em=now(), descarte_motivo=p_motivo, descarte_detalhe=p_detalhe,
     proxima_acao_tipo=NULL, proxima_acao_titulo=NULL, proxima_acao_em=NULL, resposta_pendente=false,
     versao=v_antes+1, atualizado_em=now(), atualizado_por=v_uid, origem_ultima='usuario', ultima_decisao_humana_em=now()
  WHERE negocio_id=p_negocio_id AND versao=v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'descarte', jsonb_build_object('motivo', p_motivo, 'detalhe', p_detalhe), 'usuario', v_uid, p_idem, v_antes, v_antes+1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes+1);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_saida_descarte(bigint,int,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_saida_descarte(bigint,int,text,text,text) TO authenticated;

-- 7.10 Saída: nutrição/arquivamento formal.
CREATE FUNCTION public.ncrm_saida_nutricao(p_negocio_id bigint, p_versao int, p_motivo text, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_saida text;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT versao, workflow_config_id, saida INTO v_antes, v_cfg, v_saida FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','ja_em_saida'); END IF;
  UPDATE public.ncrm_estado SET saida='nutricao', saida_em=now(),
     proxima_acao_tipo=NULL, proxima_acao_titulo=NULL, proxima_acao_em=NULL, resposta_pendente=false,
     versao=v_antes+1, atualizado_em=now(), atualizado_por=v_uid, origem_ultima='usuario', ultima_decisao_humana_em=now()
  WHERE negocio_id=p_negocio_id AND versao=v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'nutricao', jsonb_build_object('motivo', p_motivo), 'usuario', v_uid, p_idem, v_antes, v_antes+1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes+1);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_saida_nutricao(bigint,int,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_saida_nutricao(bigint,int,text,text) TO authenticated;

-- 7.11 Reativação genérica (somente de descartado/nutricao). Exige motivo, etapa e próxima ação completa.
CREATE FUNCTION public.ncrm_reativar(p_negocio_id bigint, p_versao int, p_motivo text, p_etapa text,
    p_proxima_tipo text, p_proxima_titulo text, p_proxima_em timestamptz, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_saida text;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN RETURN jsonb_build_object('ok',false,'erro','motivo_obrigatorio'); END IF;
  IF p_etapa NOT IN ('novo','tentando_contato','em_atendimento','em_acompanhamento') THEN RETURN jsonb_build_object('ok',false,'erro','etapa_invalida'); END IF;
  IF p_proxima_tipo IS NULL OR p_proxima_titulo IS NULL OR p_proxima_em IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','proxima_acao_obrigatoria'); END IF;
  IF p_proxima_em < now() THEN RETURN jsonb_build_object('ok',false,'erro','proxima_acao_em_no_passado'); END IF;  -- data controlada
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT versao, workflow_config_id, saida INTO v_antes, v_cfg, v_saida FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_saida NOT IN ('descartado','nutricao') THEN RETURN jsonb_build_object('ok',false,'erro','saida_nao_reativavel'); END IF;
  UPDATE public.ncrm_estado SET saida=NULL, saida_em=NULL, descarte_motivo=NULL, descarte_detalhe=NULL, proposta_id=NULL,
     etapa=p_etapa, proxima_acao_tipo=p_proxima_tipo, proxima_acao_titulo=p_proxima_titulo, proxima_acao_em=p_proxima_em,
     versao=v_antes+1, atualizado_em=now(), atualizado_por=v_uid, origem_ultima='usuario', ultima_decisao_humana_em=now()
  WHERE negocio_id=p_negocio_id AND versao=v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'reativacao', jsonb_build_object('motivo', p_motivo, 'origem_saida', v_saida), 'usuario', v_uid, p_idem, v_antes, v_antes+1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes+1);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_reativar(bigint,int,text,text,text,text,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_reativar(bigint,int,text,text,text,text,timestamptz,text) TO authenticated;

-- ============================================================================
-- 7.12 Índices de cobertura das FKs ncrm_* (hardening; nomes determinísticos; só tabelas ncrm_*)
-- ============================================================================
CREATE INDEX IF NOT EXISTS ix_ncrm_config_criado_por       ON public.ncrm_workflow_config (criado_por);
CREATE INDEX IF NOT EXISTS ix_ncrm_proposta_lead           ON public.ncrm_proposta (lead_id);
CREATE INDEX IF NOT EXISTS ix_ncrm_proposta_corretor       ON public.ncrm_proposta (corretor_id);
CREATE INDEX IF NOT EXISTS ix_ncrm_proposta_empreendimento ON public.ncrm_proposta (empreendimento_id);
CREATE INDEX IF NOT EXISTS ix_ncrm_proposta_unidade        ON public.ncrm_proposta (unidade_id);
CREATE INDEX IF NOT EXISTS ix_ncrm_proposta_criada_por     ON public.ncrm_proposta (criada_por);
CREATE INDEX IF NOT EXISTS ix_ncrm_estado_config           ON public.ncrm_estado (workflow_config_id);
CREATE INDEX IF NOT EXISTS ix_ncrm_estado_visita           ON public.ncrm_estado (visita_id);
CREATE INDEX IF NOT EXISTS ix_ncrm_estado_proposta         ON public.ncrm_estado (proposta_id);
CREATE INDEX IF NOT EXISTS ix_ncrm_estado_atualizado_por   ON public.ncrm_estado (atualizado_por);
CREATE INDEX IF NOT EXISTS ix_ncrm_evento_lead             ON public.ncrm_evento (lead_id);
CREATE INDEX IF NOT EXISTS ix_ncrm_evento_corretor         ON public.ncrm_evento (corretor_id_no_evento);
CREATE INDEX IF NOT EXISTS ix_ncrm_evento_config           ON public.ncrm_evento (workflow_config_id);
CREATE INDEX IF NOT EXISTS ix_ncrm_evento_executado_por    ON public.ncrm_evento (executado_por);

-- ============================================================================
-- 8. GRANTS de tabela + RLS + policies (SELECT-only; escrita só por RPC)
-- ============================================================================
REVOKE ALL ON public.ncrm_workflow_config, public.ncrm_workflow_passo,
              public.ncrm_proposta, public.ncrm_estado, public.ncrm_evento FROM PUBLIC;
GRANT SELECT ON public.ncrm_workflow_config, public.ncrm_workflow_passo TO authenticated;
GRANT SELECT ON public.ncrm_proposta, public.ncrm_estado, public.ncrm_evento TO authenticated;

ALTER TABLE public.ncrm_workflow_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncrm_workflow_passo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncrm_proposta        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncrm_estado          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncrm_evento          ENABLE ROW LEVEL SECURITY;

CREATE POLICY ncrm_config_sel ON public.ncrm_workflow_config FOR SELECT TO authenticated USING (true);
CREATE POLICY ncrm_passo_sel  ON public.ncrm_workflow_passo  FOR SELECT TO authenticated USING (true);
CREATE POLICY ncrm_estado_sel   ON public.ncrm_estado   FOR SELECT TO authenticated USING (ncrm_private.pode_ver_negocio(negocio_id));
CREATE POLICY ncrm_evento_sel   ON public.ncrm_evento   FOR SELECT TO authenticated USING (ncrm_private.pode_ver_negocio(negocio_id));
CREATE POLICY ncrm_proposta_sel ON public.ncrm_proposta FOR SELECT TO authenticated USING (ncrm_private.pode_ver_negocio(negocio_id));

-- ============================================================================
-- 9. SEED da config v1 (dados ncrm_*, não legado) — valores provisórios da Fase 1.2
-- ============================================================================
-- 1) cria em RASCUNHO, 2) insere passos (permitido só em rascunho), 3) PUBLICA (trigger seta publicado_em).
INSERT INTO public.ncrm_workflow_config (versao, status, espera_apos_automacao_min, max_tentativas)
VALUES (1, 'rascunho', 120, 4);
INSERT INTO public.ncrm_workflow_passo (config_id, ordem, canal_sugerido, intervalo_min, rotulo)
SELECT c.id, v.ordem, v.canal, v.intervalo, v.rotulo
FROM public.ncrm_workflow_config c,
     (VALUES (1,'ligacao',120,'Primeira intervenção humana'),
             (2,'whatsapp',180,'Segunda tentativa'),
             (3,'ligacao',1440,'Terceira tentativa'),
             (4,'whatsapp',2880,'Tentativa final')) AS v(ordem,canal,intervalo,rotulo)
WHERE c.versao = 1;
UPDATE public.ncrm_workflow_config SET status='publicada', vigencia_inicio=now() WHERE versao = 1;
