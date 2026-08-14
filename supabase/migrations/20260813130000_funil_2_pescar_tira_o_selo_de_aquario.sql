-- PESCAR TIRA O SELO DE AQUARIO (ago/2026)
--
-- f2_pescar_negocio dava posse do lead ao corretor (leads.corretor_id e
-- negocios.corretor_id) mas NAO removia a tag "Aquario". O lead saia da agua
-- parada na pratica e continuava marcado como agua parada no dado.
--
-- Consequencia real: qualquer contagem ou filtro que confie na tag mente. O
-- Aquario aparece maior do que e, e o lead ja trabalhado se esconde de quem
-- procura pela carteira do corretor. No Kapri, 47 dos 56 leads da carteira
-- dele estavam assim -- mais de 80% invisiveis por um selo que ninguem apagou.
--
-- Aqui a tag sai na hora da pesca, junto com a posse: sao a mesma decisao.
-- Os 135 leads que ja estavam com o selo errado foram limpos em producao na
-- mesma passada, com registro em erp_auditoria.
--
-- Unica mudanca em relacao a versao anterior desta funcao: a variavel v_lead
-- (para nao reconsultar o negocio) e o UPDATE que remove a tag.

create or replace function public.f2_pescar_negocio(p_negocio_id bigint, p_substituir_id uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
DECLARE
  v_uid       uuid := (SELECT auth.uid());
  v_corretor  bigint;
  v_cnome     text;
  v_admin     boolean := public.f2_admin();
  v_dapi_ok   boolean;
  v_novo      uuid;
  v_nome      text;
  v_tel       text;
  v_lead      bigint;
  v_corte     timestamptz := clock_timestamp();
  m           public.f2_momento_config%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_sessao');
  END IF;

  v_corretor := public.f2_corretor_atual();

  -- Sem trava de aptidao: basta ser corretor cadastrado. Admin sem cadastro de
  -- corretor continua podendo pescar para teste, e ai o card nasce sem dono.
  IF v_corretor IS NULL AND v_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  IF p_substituir_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'substituicao_desativada');
  END IF;

  SELECT * INTO m FROM public.f2_momento_config
   WHERE codigo = 'PRIMEIRA_ABORDAGEM' AND ativo LIMIT 1;
  IF m.codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'momento_primeira_abordagem_ausente');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('f2_pescar_negocio'));

  SELECT l.id, l.nome, l.telefone INTO v_lead, v_nome, v_tel
    FROM public.negocios n
    JOIN public.leads l ON l.id = n.lead_id
   WHERE n.id = p_negocio_id
     AND n.stage_id = public.aquario_stage_id()
     AND n.status = 'aberto'
     AND n.corretor_id IS NULL
     AND l.corretor_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'lead_nao_disponivel_no_aquario');
  END IF;

  IF EXISTS (SELECT 1 FROM public.f2_lead WHERE origem_negocio_id = p_negocio_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'ja_esta_no_funil');
  END IF;

  SELECT nome INTO v_cnome FROM public.corretores WHERE id = v_corretor;

  INSERT INTO public.f2_lead (
    origem_negocio_id, nome, telefone, corretor_id, corretor_nome,
    etapa, momento_codigo, acao_codigo, acao_rotulo, proxima_acao_em,
    cadencia_passo, ultima_reavaliacao_resumo, corte_conversa_em,
    historico_completo, atualizado_por
  ) VALUES (
    p_negocio_id, v_nome, v_tel, v_corretor, v_cnome,
    m.etapa, m.codigo, m.acao_codigo, m.acao_rotulo,
    v_corte + make_interval(mins => COALESCE(m.prazo_minutos, 5)),
    0, 'Lead pescado; aguarda a primeira leitura da Sara.', v_corte,
    false, v_uid
  )
  RETURNING id INTO v_novo;

  -- Posse tambem no negocio de origem: sem isso o mesmo lead volta a aparecer
  -- no Aquario para os outros e a roleta pode redistribui-lo por cima.
  IF v_corretor IS NOT NULL THEN
    UPDATE public.negocios SET corretor_id = v_corretor
     WHERE id = p_negocio_id AND corretor_id IS NULL;
    UPDATE public.leads SET corretor_id = v_corretor
     WHERE id = v_lead AND corretor_id IS NULL;
  END IF;

  -- O SELO SAI JUNTO COM A POSSE. Lead pescado nao e mais agua parada: deixar
  -- a tag faz o Aquario parecer maior do que e e esconde o lead de quem
  -- procura pela carteira do corretor.
  UPDATE public.leads
     SET tags = COALESCE((
           SELECT jsonb_agg(t) FROM jsonb_array_elements(tags) t
            WHERE t->>'name' IS DISTINCT FROM 'Aquário'
         ), '[]'::jsonb)
   WHERE id = v_lead
     AND tags @> '[{"name":"Aquário"}]'::jsonb;

  INSERT INTO public.f2_evento (funil_lead_id, tipo, titulo, detalhe, payload, criado_por)
  VALUES (v_novo, 'momento_alterado', 'Lead pescado do Aquario',
    'Entrou como Novo, sem historico anterior e com primeira abordagem em '
      || COALESCE(m.prazo_minutos, 5) || ' minutos.',
    jsonb_build_object('etapa', m.etapa, 'momento', m.codigo,
                       'corretor_id', v_corretor, 'corte_conversa_em', v_corte), v_uid);

  INSERT INTO public.f2_config_audit (tipo, chave, acao, depois, criado_por)
  VALUES ('pesca', p_negocio_id::text, 'pescar_lead_aquario',
          jsonb_build_object('novo_id', v_novo, 'corretor_id', v_corretor, 'substituiu', false), v_uid);

  -- Alerta nao-bloqueante: pescou sem poder falar com o cliente.
  IF v_corretor IS NOT NULL THEN
    v_dapi_ok := public.instancia_saudavel(v_corretor);
    IF v_dapi_ok IS NOT TRUE THEN
      INSERT INTO public.motor_execucoes
        (automacao_id, automacao_nome, bloco_id, evento, status, lead_nome, lead_telefone, detalhe)
      VALUES (NULL, 'Pesca do Aquario', 'PESCA', 'distribuicao', 'alerta', v_nome, v_tel,
        COALESCE(v_cnome, '#' || v_corretor)
        || ' pescou o lead com a instancia D-API desconectada — a primeira abordagem pode nao sair no prazo.');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_novo, 'etapa', m.etapa,
                            'momento', m.codigo, 'corretor_id', v_corretor);
END;
$function$;
