-- ROLLBACK revisado da migration 20260728151548_crm_nova_era_persistent_model.
-- Remove SOMENTE objetos ncrm_* (namespace próprio). NÃO toca objetos legados, NÃO apaga
-- dados fora do namespace ncrm. Sem CASCADE (a ordem abaixo dispensa CASCADE: dependências
-- ncrm_* são derrubadas na ordem inversa da criação). Idempotente (IF EXISTS).

-- 1. Policies (dependem das tabelas)
DROP POLICY IF EXISTS ncrm_proposta_sel ON public.ncrm_proposta;
DROP POLICY IF EXISTS ncrm_evento_sel   ON public.ncrm_evento;
DROP POLICY IF EXISTS ncrm_estado_sel   ON public.ncrm_estado;
DROP POLICY IF EXISTS ncrm_passo_sel    ON public.ncrm_workflow_passo;
DROP POLICY IF EXISTS ncrm_config_sel   ON public.ncrm_workflow_config;

-- 2. RPCs públicas (assinaturas explícitas)
DROP FUNCTION IF EXISTS public.ncrm_sara_classificar(bigint,int,jsonb,text);
DROP FUNCTION IF EXISTS public.ncrm_reativar_apos_proposta(bigint,int,text,text,text,text,timestamptz,text);
DROP FUNCTION IF EXISTS public.ncrm_proposta_transicao(uuid,int,text,text,text);
DROP FUNCTION IF EXISTS public.ncrm_saida_proposta(bigint,int,uuid,uuid,numeric,timestamptz,text,text);
DROP FUNCTION IF EXISTS public.ncrm_saida_visita(bigint,int,uuid,text);
DROP FUNCTION IF EXISTS public.ncrm_registrar_tentativa(bigint,int,text,text,text,text,text,timestamptz,text);
DROP FUNCTION IF EXISTS public.ncrm_registrar_msg_automatica(bigint,text,timestamptz);

-- 3. Triggers em objetos ncrm_* + suas funções
DROP TRIGGER IF EXISTS trg_ncrm_passo_imutavel  ON public.ncrm_workflow_passo;
DROP TRIGGER IF EXISTS trg_ncrm_config_imutavel ON public.ncrm_workflow_config;
DROP TRIGGER IF EXISTS trg_ncrm_evento_imutavel ON public.ncrm_evento;

-- 4. Tabelas ncrm_* (ordem inversa das FKs internas: evento -> estado -> proposta -> passo -> config)
DROP TABLE IF EXISTS public.ncrm_evento;
DROP TABLE IF EXISTS public.ncrm_estado;
DROP TABLE IF EXISTS public.ncrm_proposta;
DROP TABLE IF EXISTS public.ncrm_workflow_passo;
DROP TABLE IF EXISTS public.ncrm_workflow_config;

-- 5. Funções internas de ncrm_private + o schema
DROP FUNCTION IF EXISTS ncrm_private.clamp_janela(timestamptz,bigint);
DROP FUNCTION IF EXISTS ncrm_private.assert_idem(text);
DROP FUNCTION IF EXISTS ncrm_private.pode_operar_negocio(bigint);
DROP FUNCTION IF EXISTS ncrm_private.pode_ver_negocio(bigint);
DROP FUNCTION IF EXISTS ncrm_private.negocio_corretor(bigint);
DROP FUNCTION IF EXISTS ncrm_private.passo_imutavel();
DROP FUNCTION IF EXISTS ncrm_private.config_imutavel();
DROP FUNCTION IF EXISTS ncrm_private.evento_imutavel();
DROP SCHEMA IF EXISTS ncrm_private;   -- vazio após os drops acima; sem CASCADE
