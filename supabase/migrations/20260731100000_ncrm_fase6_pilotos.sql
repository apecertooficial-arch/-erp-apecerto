-- CRM Nova Era — FASE 6 (PR A): gestão de pilotos, acesso auditável, checklist e adoção.
-- ---------------------------------------------------------------------------
-- ADITIVA: só objetos ncrm_*. O admin libera pilotos POR NOME (sem UUID manual):
-- a listagem devolve nome/papel/status e o id fica interno à interface.
-- Samuel (canário compilado) permanece sempre autorizado, mesmo sem registro aqui.

-- ============================ 1. CONFIG E TABELAS ============================
CREATE TABLE public.ncrm_piloto_config (
  id                 boolean PRIMARY KEY DEFAULT true,
  limite_pilotos     integer NOT NULL DEFAULT 2 CHECK (limite_pilotos BETWEEN 0 AND 50),
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_por     uuid NULL,
  CONSTRAINT ck_ncrm_piloto_cfg_singleton CHECK (id = true)
);
INSERT INTO public.ncrm_piloto_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ncrm_piloto_config FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_piloto_config ENABLE ROW LEVEL SECURITY;

-- Piloto liberado. Remoção é LÓGICA (ativo=false), preservando a auditoria.
CREATE TABLE public.ncrm_piloto (
  usuario_id    uuid PRIMARY KEY REFERENCES public.usuarios(id),
  ativo         boolean NOT NULL DEFAULT true,
  liberado_por  uuid NOT NULL,
  liberado_em   timestamptz NOT NULL DEFAULT now(),
  removido_por  uuid NULL,
  removido_em   timestamptz NULL
);
REVOKE ALL ON public.ncrm_piloto FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_piloto ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ncrm_piloto_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('liberar','remover','limite')),
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ncrm_piloto_audit_usuario ON public.ncrm_piloto_audit (usuario_id, criado_em DESC);
REVOKE ALL ON public.ncrm_piloto_audit FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_piloto_audit ENABLE ROW LEVEL SECURITY;

-- Último acesso ao CRM Nova Era (adoção). Idempotente por usuário+dia.
CREATE TABLE public.ncrm_acesso (
  usuario_id  uuid NOT NULL REFERENCES public.usuarios(id),
  dia         date NOT NULL,
  aberturas   integer NOT NULL DEFAULT 1 CHECK (aberturas > 0),
  primeiro_em timestamptz NOT NULL DEFAULT now(),
  ultimo_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, dia)
);
REVOKE ALL ON public.ncrm_acesso FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_acesso ENABLE ROW LEVEL SECURITY;

-- ============================ 2. AUTORIZAÇÃO ============================
-- Fonte da verdade do acesso: canário compilado (Samuel) OU admin OU piloto ativo.
CREATE FUNCTION public.ncrm_tem_acesso()
  RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF v_uid = '4dfdffae-0009-41de-8d6f-2365a06dc066'::uuid THEN RETURN true; END IF;  -- Samuel: sempre
  IF COALESCE(public.can_manage_all(), false) THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM public.ncrm_piloto p WHERE p.usuario_id = v_uid AND p.ativo);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_tem_acesso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_tem_acesso() TO authenticated;

-- Registro de acesso (adoção). Não altera nada comercial.
CREATE FUNCTION public.ncrm_registrar_acesso()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  INSERT INTO public.ncrm_acesso (usuario_id, dia) VALUES (v_uid, (now() AT TIME ZONE 'America/Sao_Paulo')::date)
  ON CONFLICT (usuario_id, dia) DO UPDATE SET aberturas = public.ncrm_acesso.aberturas + 1, ultimo_em = now();
  RETURN jsonb_build_object('ok',true);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_registrar_acesso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_acesso() TO authenticated;

-- ============================ 3. GESTÃO DE PILOTOS (por NOME) ============================
CREATE FUNCTION public.ncrm_pilotos_listar()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lim int; v_usuarios jsonb; v_ativos int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  SELECT limite_pilotos INTO v_lim FROM public.ncrm_piloto_config WHERE id = true;
  SELECT count(*) INTO v_ativos FROM public.ncrm_piloto WHERE ativo;

  SELECT COALESCE(jsonb_agg(l ORDER BY l->>'nome'), '[]'::jsonb) INTO v_usuarios FROM (
    SELECT jsonb_build_object(
      'usuario_id', u.id,
      'nome', u.nome,
      'papel', u.role,
      'equipe', COALESCE(g.nome, '—'),
      'status', CASE WHEN u.ativo THEN 'ativo' ELSE 'inativo' END,
      'acesso', CASE
        WHEN u.id = '4dfdffae-0009-41de-8d6f-2365a06dc066'::uuid THEN 'sempre'
        WHEN u.role IN ('admin','executivo') THEN 'admin'
        WHEN EXISTS (SELECT 1 FROM public.ncrm_piloto p WHERE p.usuario_id = u.id AND p.ativo) THEN 'piloto'
        ELSE 'sem_acesso' END,
      'ultimo_acesso', (SELECT max(a.ultimo_em) FROM public.ncrm_acesso a WHERE a.usuario_id = u.id)
    ) AS l
    FROM public.usuarios u
    LEFT JOIN public.usuarios g ON g.id = u.superior_id
    WHERE u.ativo
  ) t;

  RETURN jsonb_build_object('ok',true,'limite',v_lim,'pilotos_ativos',v_ativos,'usuarios',v_usuarios);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_pilotos_listar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_pilotos_listar() TO authenticated;

CREATE FUNCTION public.ncrm_piloto_liberar(p_usuario_id uuid)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lim int; v_ativos int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND ativo) THEN RETURN jsonb_build_object('ok',false,'erro','usuario_invalido'); END IF;

  SELECT limite_pilotos INTO v_lim FROM public.ncrm_piloto_config WHERE id = true;
  SELECT count(*) INTO v_ativos FROM public.ncrm_piloto WHERE ativo AND usuario_id <> p_usuario_id;
  IF v_ativos >= COALESCE(v_lim, 2) THEN RETURN jsonb_build_object('ok',false,'erro','limite_atingido','limite',v_lim); END IF;

  INSERT INTO public.ncrm_piloto (usuario_id, ativo, liberado_por, liberado_em, removido_por, removido_em)
  VALUES (p_usuario_id, true, v_uid, now(), NULL, NULL)
  ON CONFLICT (usuario_id) DO UPDATE SET ativo = true, liberado_por = v_uid, liberado_em = now(), removido_por = NULL, removido_em = NULL;
  INSERT INTO public.ncrm_piloto_audit (usuario_id, acao, criado_por) VALUES (p_usuario_id, 'liberar', v_uid);
  RETURN jsonb_build_object('ok',true);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_piloto_liberar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_piloto_liberar(uuid) TO authenticated;

CREATE FUNCTION public.ncrm_piloto_remover(p_usuario_id uuid)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_usuario_id = '4dfdffae-0009-41de-8d6f-2365a06dc066'::uuid THEN RETURN jsonb_build_object('ok',false,'erro','usuario_sempre_autorizado'); END IF;
  UPDATE public.ncrm_piloto SET ativo = false, removido_por = v_uid, removido_em = now() WHERE usuario_id = p_usuario_id AND ativo;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','nao_era_piloto'); END IF;
  INSERT INTO public.ncrm_piloto_audit (usuario_id, acao, criado_por) VALUES (p_usuario_id, 'remover', v_uid);
  RETURN jsonb_build_object('ok',true);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_piloto_remover(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_piloto_remover(uuid) TO authenticated;

CREATE FUNCTION public.ncrm_piloto_limite(p_limite int)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_limite IS NULL OR p_limite < 0 OR p_limite > 50 THEN RETURN jsonb_build_object('ok',false,'erro','limite_invalido'); END IF;
  UPDATE public.ncrm_piloto_config SET limite_pilotos = p_limite, atualizado_em = now(), atualizado_por = v_uid WHERE id = true;
  INSERT INTO public.ncrm_piloto_audit (usuario_id, acao, detalhe, criado_por) VALUES (v_uid, 'limite', jsonb_build_object('limite', p_limite), v_uid);
  RETURN jsonb_build_object('ok',true,'limite',p_limite);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_piloto_limite(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_piloto_limite(int) TO authenticated;

-- ============================ 4. CHECKLIST DE ROLLOUT ============================
-- Pronto / Atenção / Bloqueado. Instâncias desconectadas geram ATENÇÃO — nunca bloqueiam.
CREATE FUNCTION public.ncrm_rollout_checklist()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
        v_ingest boolean; v_runner boolean; v_sara text; v_desde timestamptz;
        v_conect int; v_desconect int; v_pilotos int; v_leads int; v_analises int;
        v_erros int; v_ult_analise timestamptz; v_decisoes int; v_sla numeric;
        v_itens jsonb; v_geral text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;

  SELECT ativo, ativo_desde INTO v_ingest, v_desde FROM public.ncrm_ingest_config WHERE id = true;
  SELECT enabled INTO v_runner FROM public.ncrm_sara_runner_config WHERE id = true;
  SELECT modo INTO v_sara FROM public.ncrm_sara_config WHERE id = true;
  SELECT ultima_execucao INTO v_ult_analise FROM public.ncrm_sara_runner_estado WHERE id = true;
  SELECT count(*) FILTER (WHERE status = 'connected'), count(*) FILTER (WHERE status <> 'connected')
    INTO v_conect, v_desconect FROM public.wa_instancias;
  SELECT count(*) INTO v_pilotos FROM public.ncrm_piloto WHERE ativo;
  SELECT count(*) INTO v_leads FROM public.ncrm_estado;
  SELECT count(*) INTO v_analises FROM public.ncrm_sara_analise;
  SELECT count(*) INTO v_decisoes FROM public.ncrm_sara_analise WHERE decisao <> 'pendente';
  SELECT count(*) INTO v_erros FROM public.ncrm_ingest_checkpoint WHERE status = 'erro';
  SELECT COALESCE(avg(EXTRACT(epoch FROM (primeira_resposta_em - msg_automatica_em))/60), 0)::numeric(12,1)
    INTO v_sla FROM public.ncrm_estado WHERE primeira_resposta_em IS NOT NULL AND msg_automatica_em IS NOT NULL;

  v_itens := jsonb_build_array(
    jsonb_build_object('item','Entrada de novos atendimentos','estado', CASE WHEN COALESCE(v_ingest,false) THEN 'pronto' ELSE 'bloqueado' END,
      'detalhe', CASE WHEN COALESCE(v_ingest,false) THEN 'Ligada desde ' || to_char(v_desde AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ELSE 'Desligada — o piloto não recebe novos atendimentos' END),
    jsonb_build_object('item','Análise automática da Sara','estado', CASE WHEN COALESCE(v_runner,false) THEN 'pronto' ELSE 'atencao' END,
      'detalhe', CASE WHEN COALESCE(v_runner,false) THEN 'Ligada · última análise ' || COALESCE(to_char(v_ult_analise AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI'),'—') ELSE 'Desligada' END),
    jsonb_build_object('item','Sara apenas sugerindo','estado', CASE WHEN COALESCE(v_sara,'') = 'observer' THEN 'pronto' ELSE 'atencao' END,
      'detalhe','Modo atual: ' || COALESCE(v_sara,'—') || ' · execução automática bloqueada'),
    jsonb_build_object('item','WhatsApp conectado','estado', CASE WHEN v_desconect = 0 THEN 'pronto' ELSE 'atencao' END,
      'detalhe', v_conect || ' conectadas · ' || v_desconect || ' sem conexão (não impede o restante do ERP)'),
    jsonb_build_object('item','Usuários piloto','estado', CASE WHEN v_pilotos > 0 THEN 'pronto' ELSE 'atencao' END,
      'detalhe', CASE WHEN v_pilotos > 0 THEN v_pilotos || ' corretor(es) liberado(s)' ELSE 'Somente o administrador tem acesso' END),
    jsonb_build_object('item','Atendimentos processados','estado', CASE WHEN v_leads > 0 THEN 'pronto' ELSE 'atencao' END, 'detalhe', v_leads || ' no piloto'),
    jsonb_build_object('item','Análises da Sara','estado', CASE WHEN v_analises > 0 THEN 'pronto' ELSE 'atencao' END,
      'detalhe', v_analises || ' análises · ' || v_decisoes || ' com decisão do corretor'),
    jsonb_build_object('item','Erros de entrada','estado', CASE WHEN v_erros = 0 THEN 'pronto' ELSE 'bloqueado' END, 'detalhe', v_erros || ' com erro'),
    jsonb_build_object('item','Tempo de 1ª resposta','estado','pronto','detalhe', v_sla || ' min em média'),
    jsonb_build_object('item','Desligamento de emergência','estado','pronto','detalhe','Disponível no Painel do piloto (entrada e análise automática)')
  );

  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens) i WHERE i->>'estado' = 'bloqueado') THEN 'bloqueado'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens) i WHERE i->>'estado' = 'atencao') THEN 'atencao'
    ELSE 'pronto' END INTO v_geral;

  RETURN jsonb_build_object('ok',true,'geral',v_geral,'itens',v_itens);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_rollout_checklist() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_rollout_checklist() TO authenticated;

-- ============================ 5. ADOÇÃO DIÁRIA ============================
-- Sem ranking punitivo: mostra quem usou, quem não usou e onde há oportunidade de coaching.
CREATE FUNCTION public.ncrm_adocao_painel(p_dias int DEFAULT 7)
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_d int := LEAST(GREATEST(COALESCE(p_dias,7),1),60);
        v_usuarios jsonb; v_tot jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;

  SELECT COALESCE(jsonb_agg(l ORDER BY (l->>'acessou')::boolean DESC, l->>'nome'), '[]'::jsonb) INTO v_usuarios FROM (
    SELECT jsonb_build_object(
      'usuario_id', u.id, 'nome', u.nome, 'papel', u.role,
      'acessou', EXISTS (SELECT 1 FROM public.ncrm_acesso a WHERE a.usuario_id = u.id AND a.dia > (now() AT TIME ZONE 'America/Sao_Paulo')::date - v_d),
      'ultimo_acesso', (SELECT max(a.ultimo_em) FROM public.ncrm_acesso a WHERE a.usuario_id = u.id),
      'atendimentos', (SELECT count(*) FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
                        JOIN public.corretores c ON c.id = n.corretor_id WHERE c.usuario_id = u.id),
      'acoes_vencidas', (SELECT count(*) FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
                        JOIN public.corretores c ON c.id = n.corretor_id
                        WHERE c.usuario_id = u.id AND e.saida IS NULL AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()),
      'sem_proxima_acao', (SELECT count(*) FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
                        JOIN public.corretores c ON c.id = n.corretor_id
                        WHERE c.usuario_id = u.id AND e.saida IS NULL AND e.proxima_acao_em IS NULL)
    ) AS l
    FROM public.usuarios u
    WHERE u.ativo AND (u.id = '4dfdffae-0009-41de-8d6f-2365a06dc066'::uuid
                       OR u.role IN ('admin','executivo')
                       OR EXISTS (SELECT 1 FROM public.ncrm_piloto p WHERE p.usuario_id = u.id AND p.ativo))
  ) t;

  v_tot := jsonb_build_object(
    'periodo_dias', v_d,
    'acessaram', (SELECT count(DISTINCT usuario_id) FROM public.ncrm_acesso WHERE dia > (now() AT TIME ZONE 'America/Sao_Paulo')::date - v_d),
    'atendimentos', (SELECT count(*) FROM public.ncrm_estado),
    'acoes_vencidas', (SELECT count(*) FROM public.ncrm_estado WHERE saida IS NULL AND proxima_acao_em IS NOT NULL AND proxima_acao_em < now()),
    'com_proxima_acao_pct', (SELECT round(100.0 * count(*) FILTER (WHERE proxima_acao_em IS NOT NULL) / GREATEST(count(*),1),1) FROM public.ncrm_estado WHERE saida IS NULL),
    'sara_analises', (SELECT count(*) FROM public.ncrm_sara_analise),
    'sara_aceitas', (SELECT count(*) FROM public.ncrm_sara_analise WHERE decisao = 'aprovada'),
    'sara_rejeitadas', (SELECT count(*) FROM public.ncrm_sara_analise WHERE decisao = 'rejeitada'),
    'visitas', (SELECT count(*) FROM public.ncrm_estado WHERE saida = 'pipeline_visitas'),
    'propostas', (SELECT count(*) FROM public.ncrm_estado WHERE saida = 'esteira_vendas')
  );

  RETURN jsonb_build_object('ok',true,'totais',v_tot,'usuarios',v_usuarios);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_adocao_painel(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_adocao_painel(int) TO authenticated;
