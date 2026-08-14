-- ETAPA "PESCADO": O LEAD DO AQUARIO TEM CADENCIA PROPRIA (ago/2026)
--
-- Ate aqui, lead pescado nascia em "Lead novo / Primeira abordagem" e logo caia
-- na mesma cadencia de "Tentando contato" dos leads distribuidos -- 6 tentativas
-- ao longo de uma semana. Sao naturezas diferentes: o lead distribuido acabou de
-- levantar a mao; o lead do Aquario nunca falou com a imobiliaria. Insistir seis
-- vezes num contato frio queima o numero e ocupa o Meu Dia do corretor com o que
-- tem menor chance de responder.
--
-- Agora ele entra numa etapa propria, com UMA tentativa (decisao do Romulo):
-- o corretor manda a mensagem, e o lead fica ali ate acontecer uma de duas coisas.
--
--   RESPONDEU  -> a Sara le a conversa e move para "Em atendimento / Conversando
--                 e qualificando". Isso ja funciona hoje e nao precisou de codigo
--                 novo: f2_sara_elegiveis reavalia qualquer card cuja ultima
--                 mensagem seja mais nova que a ultima releitura, seja qual for a
--                 etapa, e f2_sara_aplicar_leitura ja aceita CONVERSANDO_QUALIFICANDO.
--
--   NAO RESPONDEU -> com cadencia_passo >= 1 o card passa a mostrar
--                 "Decidir: insistir ou descartar" e para de cobrar prazo. Quem
--                 decide e o corretor. Mesma mecanica que "Tentando contato" ja
--                 usa no fim da fila -- a equipe nao precisa aprender nada novo.
--
-- A etapa entra em ordem 2, logo depois de "Lead novo": as duas sao portas de
-- entrada. As demais descem uma posicao.

-- 1) f2_etapa_config.ordem e UNIQUE e limitado a 1..50, entao nao da para usar
--    uma faixa de desvio nem um "ordem + 1" linha a linha (colide no meio do
--    caminho). Empurrando de tras para frente, cada posicao ja esta livre quando
--    a proxima chega. A etapa 50 (pos_visita, inativa) fica de fora do laco.
do $$
declare r record;
begin
  for r in select codigo, ordem from public.f2_etapa_config
            where ordem between 2 and 48 order by ordem desc loop
    update public.f2_etapa_config set ordem = r.ordem + 1 where codigo = r.codigo;
  end loop;
end $$;

insert into public.f2_etapa_config (codigo, ordem, rotulo, ajuda, ativo)
values ('pescado', 2, 'Pescado',
        'Lead que o corretor puxou do Aquário. Uma tentativa de contato: se responder, a Sara leva para Em atendimento; se não responder, fica aqui aguardando sua decisão.',
        true)
on conflict (codigo) do update
  set ordem = excluded.ordem, rotulo = excluded.rotulo, ajuda = excluded.ajuda,
      ativo = true, atualizado_em = now();

-- 2) O momento. UMA tentativa: com cadencia_passo >= 1 o front ja mostra
--    "Decidir: insistir ou descartar" (MOMENTOS_COM_CADENCIA em modelo.ts).
--    exige_dapi porque a acao e mandar mensagem -- sem WhatsApp conectado o
--    corretor nao tem como executar.
insert into public.f2_momento_config
  (codigo, etapa, ordem, rotulo, descricao, acao_codigo, acao_rotulo,
   prazo_minutos, prazo_rotulo, exige_dapi, ativo)
values ('CADENCIA_PESCADO', 'pescado', 1, 'Contato do pescado',
        'Uma tentativa de contato com o lead recém-puxado do Aquário. Se ele responder, a Sara move para Em atendimento. Se não, o card aguarda sua decisão.',
        'insistir', 'Enviar a mensagem de contato', 60, '1 hora', true, true)
on conflict (codigo) do update
  set etapa = excluded.etapa, ordem = excluded.ordem, rotulo = excluded.rotulo,
      descricao = excluded.descricao, acao_codigo = excluded.acao_codigo,
      acao_rotulo = excluded.acao_rotulo, prazo_minutos = excluded.prazo_minutos,
      prazo_rotulo = excluded.prazo_rotulo,
      exige_dapi = excluded.exige_dapi, ativo = true, atualizado_em = now();

-- 3) Pescar passa a entregar o lead na etapa nova.
--    Unica mudanca em relacao a versao anterior: o momento buscado deixa de ser
--    PRIMEIRA_ABORDAGEM e passa a ser CADENCIA_PESCADO, e o texto do evento
--    acompanha. O resto -- posse, remocao do selo de aquario, auditoria e alerta
--    de D-API desconectada -- continua igual.
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

  IF v_corretor IS NULL AND v_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  IF p_substituir_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'substituicao_desativada');
  END IF;

  -- A etapa do pescado, nao mais a primeira abordagem do lead distribuido.
  SELECT * INTO m FROM public.f2_momento_config
   WHERE codigo = 'CADENCIA_PESCADO' AND ativo LIMIT 1;
  IF m.codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'momento_cadencia_pescado_ausente');
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
    v_corte + make_interval(mins => COALESCE(m.prazo_minutos, 60)),
    0, 'Lead pescado; aguarda a primeira leitura da Sara.', v_corte,
    false, v_uid
  )
  RETURNING id INTO v_novo;

  IF v_corretor IS NOT NULL THEN
    UPDATE public.negocios SET corretor_id = v_corretor
     WHERE id = p_negocio_id AND corretor_id IS NULL;
    UPDATE public.leads SET corretor_id = v_corretor
     WHERE id = v_lead AND corretor_id IS NULL;
  END IF;

  -- O selo sai junto com a posse: lead pescado nao e mais agua parada.
  UPDATE public.leads
     SET tags = COALESCE((
           SELECT jsonb_agg(t) FROM jsonb_array_elements(tags) t
            WHERE t->>'name' IS DISTINCT FROM 'Aquário'
         ), '[]'::jsonb)
   WHERE id = v_lead
     AND tags @> '[{"name":"Aquário"}]'::jsonb;

  INSERT INTO public.f2_evento (funil_lead_id, tipo, titulo, detalhe, payload, criado_por)
  VALUES (v_novo, 'momento_alterado', 'Lead pescado do Aquario',
    'Entrou na etapa Pescado com uma tentativa de contato. Se responder, a Sara leva para Em atendimento; se nao, o card aguarda decisao.',
    jsonb_build_object('etapa', m.etapa, 'momento', m.codigo,
                       'corretor_id', v_corretor, 'corte_conversa_em', v_corte), v_uid);

  INSERT INTO public.f2_config_audit (tipo, chave, acao, depois, criado_por)
  VALUES ('pesca', p_negocio_id::text, 'pescar_lead_aquario',
          jsonb_build_object('novo_id', v_novo, 'corretor_id', v_corretor, 'substituiu', false), v_uid);

  IF v_corretor IS NOT NULL THEN
    v_dapi_ok := public.instancia_saudavel(v_corretor);
    IF v_dapi_ok IS NOT TRUE THEN
      INSERT INTO public.motor_execucoes
        (automacao_id, automacao_nome, bloco_id, evento, status, lead_nome, lead_telefone, detalhe)
      VALUES (NULL, 'Pesca do Aquario', 'PESCA', 'distribuicao', 'alerta', v_nome, v_tel,
        COALESCE(v_cnome, '#' || v_corretor)
        || ' pescou o lead com a instancia D-API desconectada — o contato pode nao sair no prazo.');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_novo, 'etapa', m.etapa,
                            'momento', m.codigo, 'corretor_id', v_corretor);
END;
$function$;
