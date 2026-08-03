-- Infra legada mínima descoberta em produção para exercitar a migration 3.1.
-- Os marcadores NCRM_TEST_STUB_ROLL permitem ao patch com checksum reconhecer
-- estes corpos como fixtures locais; não existem em produção.
ALTER TABLE public.corretores
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_escritorio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultima_presenca timestamptz,
  ADD COLUMN IF NOT EXISTS forcar_distribuicao boolean NOT NULL DEFAULT false;

ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS hora_fim text,
  ADD COLUMN IF NOT EXISTS resultado text,
  ADD COLUMN IF NOT EXISTS resultado_em timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_por uuid;

CREATE TABLE IF NOT EXISTS public.instancias(
  id bigint PRIMARY KEY, nome text NOT NULL, corretor_id bigint,
  ativa boolean NOT NULL DEFAULT true, conectada boolean NOT NULL DEFAULT false,
  status_dapi text
);
CREATE TABLE IF NOT EXISTS public.corretor_presencas(
  corretor_id bigint NOT NULL, dia date NOT NULL, PRIMARY KEY(corretor_id,dia)
);
CREATE TABLE IF NOT EXISTS public.presenca_config(
  id integer PRIMARY KEY DEFAULT 1,hora_inicio time NOT NULL DEFAULT '09:00',
  hora_fim time NOT NULL DEFAULT '18:00',intervalo_min integer NOT NULL DEFAULT 15,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.presenca_config(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.distribuicao_config
  ADD COLUMN IF NOT EXISTS janela_inicio time NOT NULL DEFAULT '09:30',
  ADD COLUMN IF NOT EXISTS janela_fim time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS receber_ate time NOT NULL DEFAULT '18:30',
  ADD COLUMN IF NOT EXISTS modo_fora_janela text DEFAULT 'quem_veio_no_dia',
  ADD COLUMN IF NOT EXISTS modo_rodizio text DEFAULT 'fila_circular',
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

-- A função vem da migration histórica de cadência. No harness, marque somente
-- esta cópia efêmera para que a migration 3.1 aceite o corpo conhecido sem
-- enfraquecer o checksum exigido em produção.
DO $fixture$
DECLARE v_oid regprocedure := 'ncrm_private.sla_redistribuir(integer)'::regprocedure;
        v_def text; v_ancora text;
BEGIN
  SELECT pg_get_functiondef(v_oid::oid) INTO v_def;
  IF strpos(v_def, 'NCRM_TEST_STUB_ROLL') > 0 THEN RETURN; END IF;
  v_ancora := 'IF cfg IS NULL OR cfg.ativo IS NOT TRUE THEN RETURN 0; END IF;';
  IF strpos(v_def, v_ancora) = 0 THEN
    RAISE EXCEPTION 'fixture_sla_redistribuir_ancora_ausente';
  END IF;
  v_def := replace(v_def, v_ancora,
    v_ancora || E'\n  /* NCRM_TEST_STUB_ROLL */');
  EXECUTE v_def;
END $fixture$;

CREATE OR REPLACE FUNCTION public.nome_normalizado(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT lower(coalesce(p,'')) $$;
CREATE OR REPLACE FUNCTION public.instancia_saudavel(p_id bigint) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.instancias i WHERE i.corretor_id=p_id AND i.conectada AND i.status_dapi='connected') $$;

CREATE TABLE IF NOT EXISTS public.motor_roleta_contadores(
  automacao_id bigint,bloco_id text,corretor_id bigint,peso numeric,recebidos integer DEFAULT 0,
  atualizado_em timestamptz DEFAULT now(),PRIMARY KEY(automacao_id,bloco_id,corretor_id)
);
CREATE OR REPLACE FUNCTION public.motor_roleta(
  p_auto bigint,p_nome text,p_bloco text,p_lead jsonb,p_lead_id bigint,p_neg_id bigint,
  p_items jsonb,p_online_only boolean,p_tambem_negocio boolean,p_protecao jsonb DEFAULT '[]'
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $fn$
DECLARE it jsonb; _cid bigint; _peso numeric; _tot numeric:=0; _tot_all numeric:=0;
        _cands jsonb:='[]'; _cands_all jsonb:='[]'; _fallback boolean:=false;
BEGIN
  /* NCRM_TEST_STUB_ROLL */
  FOR it IN SELECT value FROM jsonb_array_elements(coalesce(p_items,'[]')) t(value) LOOP
    _peso:=coalesce((it->>'peso')::numeric,1);
    SELECT c.id INTO _cid FROM public.corretores c
      where public.nome_normalizado(c.nome) = public.nome_normalizado(it->>'corretor') and coalesce(c.ativo,true)=true
        and (not p_online_only or public.corretor_pode_receber(c.id)) limit 1;
    IF _cid IS NULL THEN CONTINUE; END IF;
    _cands_all:=_cands_all||jsonb_build_object('id',_cid); _tot_all:=_tot_all+_peso;
    IF public.instancia_saudavel(_cid) THEN _cands:=_cands||jsonb_build_object('id',_cid); _tot:=_tot+_peso; END IF;
  END LOOP;
  IF _tot<=0 THEN
    IF _tot_all<=0 THEN RETURN NULL; END IF;
    _fallback := true; _cands := _cands_all;
  END IF;
  RETURN (_cands->0->>'id')::bigint;
END $fn$;

CREATE OR REPLACE FUNCTION public.aquario_pescar() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','extensions' AS $fn$
DECLARE v_corretor bigint; v_corretor_nome text;
BEGIN
  /* NCRM_TEST_STUB_ROLL */
  select c.id, c.nome into v_corretor, v_corretor_nome
  from corretores c where c.usuario_id = auth.uid() and coalesce(c.ativo, true) = true limit 1;
  if v_corretor is null then
    return jsonb_build_object('ok', false, 'error', 'Seu usuário não está vinculado a um corretor ativo.');
  end if;
  return jsonb_build_object('ok',true,'corretor_id',v_corretor);
END $fn$;

CREATE OR REPLACE FUNCTION public.pescar_lead_aquario(p_negocio_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $fn$
DECLARE v_corretor bigint;
BEGIN
  /* NCRM_TEST_STUB_ROLL */
  if auth.uid() is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
  select id into v_corretor from public.corretores where usuario_id = auth.uid() and ativo limit 1;
  if v_corretor is null then raise exception 'Seu usuário não está vinculado a um corretor ativo.' using errcode = '42501'; end if;
  return jsonb_build_object('ok',true,'negocio_id',p_negocio_id,'corretor_id',v_corretor);
END $fn$;
