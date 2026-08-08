-- O CICLO DO PESCADO, DE PONTA A PONTA (ago/2026)
--
-- Complemento de 20260813160000. La ficou a flag e a sentinela; aqui ficam as
-- quatro funcoes que fazem o ciclo acontecer, e a correcao de ordem no resgate
-- da Sara -- que sem isso deixaria de reler card sem prazo para sempre.

-- 1) A PESCA entrega o card sem prazo.
CREATE OR REPLACE FUNCTION public.f2_pescar_negocio(p_negocio_id bigint, p_substituir_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid()); v_corretor bigint; v_cnome text;
  v_admin boolean := public.f2_admin(); v_dapi_ok boolean; v_novo uuid;
  v_nome text; v_tel text; v_lead bigint;
  v_corte timestamptz := clock_timestamp();
  m public.f2_momento_config%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'sem_sessao'); END IF;
  v_corretor := public.f2_corretor_atual();
  IF v_corretor IS NULL AND v_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao'); END IF;
  IF p_substituir_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'substituicao_desativada'); END IF;

  SELECT * INTO m FROM public.f2_momento_config WHERE codigo = 'CADENCIA_PESCADO' AND ativo LIMIT 1;
  IF m.codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'momento_cadencia_pescado_ausente'); END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('f2_pescar_negocio'));

  SELECT l.id, l.nome, l.telefone INTO v_lead, v_nome, v_tel
    FROM public.negocios n JOIN public.leads l ON l.id = n.lead_id
   WHERE n.id = p_negocio_id AND n.stage_id = public.aquario_stage_id()
     AND n.status = 'aberto' AND n.corretor_id IS NULL AND l.corretor_id IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'lead_nao_disponivel_no_aquario'); END IF;
  IF EXISTS (SELECT 1 FROM public.f2_lead WHERE origem_negocio_id = p_negocio_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'ja_esta_no_funil'); END IF;

  SELECT nome INTO v_cnome FROM public.corretores WHERE id = v_corretor;

  INSERT INTO public.f2_lead (
    origem_negocio_id, nome, telefone, corretor_id, corretor_nome,
    etapa, momento_codigo, acao_codigo, acao_rotulo, proxima_acao_em,
    cadencia_passo, ultima_reavaliacao_resumo, corte_conversa_em,
    historico_completo, atualizado_por
  ) VALUES (
    p_negocio_id, v_nome, v_tel, v_corretor, v_cnome,
    m.etapa, m.codigo, m.acao_codigo, m.acao_rotulo,
    public.f2_sem_prazo(),
    0, 'Lead pescado do Aquario. Sem prazo: chame quando puder.', v_corte,
    false, v_uid
  ) RETURNING id INTO v_novo;

  IF v_corretor IS NOT NULL THEN
    UPDATE public.negocios SET corretor_id = v_corretor WHERE id = p_negocio_id AND corretor_id IS NULL;
    UPDATE public.leads    SET corretor_id = v_corretor WHERE id = v_lead AND corretor_id IS NULL;
  END IF;

  UPDATE public.leads
     SET tags = COALESCE((SELECT jsonb_agg(t) FROM jsonb_array_elements(tags) t
                           WHERE t->>'name' IS DISTINCT FROM 'Aquário'), '[]'::jsonb)
   WHERE id = v_lead AND tags @> '[{"name":"Aquário"}]'::jsonb;

  INSERT INTO public.f2_evento (funil_lead_id, tipo, titulo, detalhe, payload, criado_por)
  VALUES (v_novo, 'momento_alterado', 'Lead pescado do Aquario',
    'Entrou em Pescado sem prazo. Chame o cliente: se ele responder, o card vai sozinho para Em atendimento; se nao, fica aqui ate voce atualizar.',
    jsonb_build_object('etapa', m.etapa, 'momento', m.codigo, 'sem_prazo', true,
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
        COALESCE(v_cnome, '#' || v_corretor) || ' pescou o lead com a instancia D-API desconectada.');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_novo, 'etapa', m.etapa,
                            'momento', m.codigo, 'corretor_id', v_corretor);
END;
$function$;

-- 2) CONFIRMAR A ACAO num momento sem cobranca marca a tentativa e continua sem prazo.
CREATE OR REPLACE FUNCTION public.f2_confirmar_acao(p_id uuid, p_versao integer, p_fonte text, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_uid uuid:=(SELECT auth.uid()); v_atual public.f2_lead%ROWTYPE;
        v_m public.f2_momento_config%ROWTYPE; v_passo smallint; v_dias smallint; v_prazo timestamptz;
        v_sem_cobranca boolean; v_resumo text;
        v_dias_cadencia constant smallint[]:=ARRAY[1,2,4,6,7];
BEGIN
  IF v_uid IS NULL OR public.f2_pode_operar_lead(p_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_fonte NOT IN ('dapi','registro_operacional') THEN RETURN jsonb_build_object('ok',false,'erro','fonte_invalida'); END IF;
  SELECT * INTO v_atual FROM public.f2_lead WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','lead_inexistente'); END IF;
  IF v_atual.versao<>p_versao THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  SELECT * INTO v_m FROM public.f2_momento_config WHERE codigo=v_atual.momento_codigo;
  IF v_m.exige_dapi AND p_fonte<>'dapi' THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_dapi_obrigatoria'); END IF;

  v_sem_cobranca := COALESCE(v_m.cobra_no_meu_dia, true) IS FALSE;

  IF v_sem_cobranca THEN
    -- Pescado: a tentativa fica registrada, mas nenhum relogio comeca a correr.
    v_passo := GREATEST(v_atual.cadencia_passo, 1)::smallint;
    v_prazo := public.f2_sem_prazo();
    v_resumo := 'Mensagem enviada. O card fica em Pescado, sem prazo: se o cliente responder a Sara leva para Em atendimento; se nao, atualize quando decidir.';
  ELSIF v_atual.momento_codigo='CADENCIA_SEM_RESPOSTA' THEN
    IF v_atual.cadencia_passo<4 THEN
      v_passo:=v_atual.cadencia_passo+1;
      v_dias:=v_dias_cadencia[v_passo+1]-v_dias_cadencia[v_passo];
      v_prazo:=date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
        +make_interval(days=>v_dias)+interval '9 hours';
      v_resumo:='A mensagem foi confirmada; a Sara manteve a cadência e programou o próximo dia oficial.';
    ELSE
      v_passo:=5; v_prazo:=now()+interval '24 hours';
      v_resumo:='A cadência de sete dias foi concluída; o lead precisa de uma nova avaliação.';
    END IF;
  ELSE
    v_passo:=v_atual.cadencia_passo;
    v_prazo:=now()+make_interval(mins=>COALESCE(v_m.prazo_minutos,1440));
    v_resumo:='A ação foi confirmada; a Sara revisou o laboratório e manteve a conduta atual.';
  END IF;

  UPDATE public.f2_lead SET cadencia_passo=v_passo,proxima_acao_em=v_prazo,
    ultima_acao_confirmada_em=now(),ultima_acao_fonte=p_fonte,
    ultima_reavaliacao_sara_em=now(), ultima_reavaliacao_resumo=v_resumo,
    versao=versao+1,atualizado_em=now(),atualizado_por=v_uid
  WHERE id=p_id;

  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(p_id,'acao_confirmada','Ação confirmada por '||CASE p_fonte WHEN 'dapi' THEN 'D-API' ELSE 'registro operacional' END,
    p_observacao,jsonb_build_object('acao',v_atual.acao_codigo,'proximo_prazo',
      CASE WHEN v_sem_cobranca THEN NULL ELSE to_jsonb(v_prazo) END,
      'sem_prazo',v_sem_cobranca,'cadencia_passo',v_passo),v_uid);
  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(p_id,'sara_reavaliou','Sara reavaliou a cópia', v_resumo,
    jsonb_build_object('momento',v_atual.momento_codigo,'acao',v_atual.acao_codigo,'cadencia_passo',v_passo),v_uid);
  RETURN jsonb_build_object('ok',true,'versao',v_atual.versao+1,'prazo',v_prazo,'cadencia_passo',v_passo,'sem_prazo',v_sem_cobranca);
END;
$function$;

-- 3) A SARA, ao ver a mensagem sair, tambem respeita o "sem prazo".
CREATE OR REPLACE FUNCTION public.f2_sara_marcar_lido(p_card uuid, p_resumo text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  f f2_lead%rowtype; m f2_momento_config%rowtype;
  v_ult_envio timestamptz; v_novo_prazo timestamptz;
  v_tent int; v_ult_tent timestamptz; v_passo smallint; v_sem_cobranca boolean;
begin
  select * into f from f2_lead where id = p_card;
  if not found then return; end if;
  select * into m from f2_momento_config where codigo = f.momento_codigo;
  v_sem_cobranca := coalesce(m.cobra_no_meu_dia, true) is false;

  select max(x.enviado_em) into v_ult_envio
    from wa_contatos ct
    join wa_conversas cv on cv.contato_id = ct.id
    join wa_mensagens x on x.conversa_id = cv.id
     and x.direcao = 'enviada' and not coalesce(x.is_grupo,false)
   where right(regexp_replace(coalesce(ct.telefone,''),'\D','','g'),8)
       = right(regexp_replace(coalesce(f.telefone,''),'\D','','g'),8);

  if v_ult_envio is not null
     and v_ult_envio > coalesce(f.ultima_acao_confirmada_em, f.criado_em)
     and f.momento_codigo <> 'RETOMAR_NA_DATA'
  then
    if v_sem_cobranca then
      v_passo := greatest(f.cadencia_passo, 1)::smallint;
      v_novo_prazo := f2_sem_prazo();
    elsif f.momento_codigo = 'CADENCIA_CONTATO' then
      select t.tentativas, t.ultima_em into v_tent, v_ult_tent
        from f2_tentativas_de_contato(regexp_replace(coalesce(f.telefone,''),'\D','','g')) t;
      v_passo := least(coalesce(v_tent,1), 6)::smallint;
      v_novo_prazo := f2_cadencia_proximo_prazo(coalesce(v_ult_tent, v_ult_envio),
                                                least(coalesce(v_tent,1) + 1, 6));
      if v_novo_prazo is null or v_novo_prazo < now() then
        v_novo_prazo := f2_soma_dias_uteis(now(), 1);
      end if;
    else
      v_passo := f.cadencia_passo;
      v_novo_prazo := v_ult_envio + make_interval(mins => coalesce(m.prazo_minutos, 1440));
      if v_novo_prazo < now() then
        v_novo_prazo := now() + make_interval(mins => coalesce(m.prazo_minutos, 1440));
      end if;
    end if;

    update f2_lead
       set proxima_acao_em = v_novo_prazo, cadencia_passo = v_passo,
           ultima_acao_confirmada_em = v_ult_envio, ultima_acao_fonte = 'dapi',
           ultima_reavaliacao_sara_em = now(),
           ultima_reavaliacao_resumo = coalesce(p_resumo, ultima_reavaliacao_resumo),
           versao = versao + 1, atualizado_em = now()
     where id = p_card;

    insert into f2_evento(funil_lead_id, tipo, titulo, detalhe, payload)
    values (p_card,'acao_confirmada',
            case when v_sem_cobranca then 'Mensagem enviada — o card segue sem prazo'
                 else 'Acao cumprida — saiu do Meu Dia' end,
            case when v_sem_cobranca
                 then 'A mensagem saiu pela instancia. O card fica em Pescado aguardando resposta; nenhum prazo foi aberto.'
                 else 'A mensagem saiu pela instancia. Proxima acao em '||
                      to_char(v_novo_prazo at time zone 'America/Sao_Paulo','DD/MM HH24:MI')||'.' end,
            jsonb_build_object('mensagem_em', v_ult_envio, 'sem_prazo', v_sem_cobranca,
                               'novo_prazo', case when v_sem_cobranca then null else to_jsonb(v_novo_prazo) end,
                               'tentativa', v_passo));
    return;
  end if;

  update f2_lead
     set ultima_reavaliacao_sara_em = now(),
         ultima_reavaliacao_resumo = coalesce(p_resumo, ultima_reavaliacao_resumo)
   where id = p_card;
end $function$;

-- 4) A SAIDA DO PESCADO, deterministica: respondeu, sai. Nao depende da IA.
CREATE OR REPLACE FUNCTION public.f2_pescado_promover_respondidos()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r record; m f2_momento_config%rowtype; v_n int := 0;
begin
  select * into m from f2_momento_config where codigo = 'CONVERSANDO_QUALIFICANDO' and ativo;
  if not found then return jsonb_build_object('ok',false,'erro','momento_conversando_ausente'); end if;

  for r in
    select f.id, f.nome, ult.quando
      from f2_lead f
      cross join lateral (
        select max(x.enviado_em) as quando
          from wa_contatos ct
          join wa_conversas cv on cv.contato_id = ct.id
          join wa_mensagens x on x.conversa_id = cv.id
           and x.direcao = 'recebida' and not coalesce(x.is_grupo,false)
         where right(regexp_replace(coalesce(ct.telefone,''),'\D','','g'),8)
             = right(regexp_replace(coalesce(f.telefone,''),'\D','','g'),8)
           and x.enviado_em > f.corte_conversa_em
      ) ult
     where f.etapa = 'pescado' and f.descartado_em is null and ult.quando is not null
     limit 200
  loop
    update f2_lead
       set etapa = m.etapa, momento_codigo = m.codigo,
           acao_codigo = m.acao_codigo, acao_rotulo = m.acao_rotulo,
           proxima_acao_em = now() + make_interval(mins => coalesce(m.prazo_minutos, 1440)),
           ultima_interacao_em = greatest(coalesce(ultima_interacao_em, r.quando), r.quando),
           ultima_reavaliacao_sara_em = now(),
           ultima_reavaliacao_resumo = 'O cliente respondeu depois da pesca; o card saiu de Pescado para Em atendimento.',
           versao = versao + 1, atualizado_em = now()
     where id = r.id;

    insert into f2_evento(funil_lead_id, tipo, titulo, detalhe, payload)
    values (r.id, 'momento_alterado', 'O pescado respondeu — foi para Em atendimento',
            'Chegou mensagem do cliente depois da pesca. O card saiu de Pescado e entrou em Conversando e qualificando, com prazo de 24 horas.',
            jsonb_build_object('de','pescado','para',m.codigo,'respondeu_em',r.quando,'regra','pescado_respondeu'));
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok',true,'promovidos',v_n);
end $function$;

comment on function public.f2_pescado_promover_respondidos() is
  'Tira de Pescado todo card cujo cliente respondeu depois do corte da pesca e leva para Em atendimento / Conversando. Regra deterministica: nao depende da leitura da Sara.';

-- 5) O resgate da Sara ordenava por prazo. Com o pescado sem prazo, ele iria
--    sempre para o fim da fila e nunca seria relido. Ordena pela ultima leitura.
CREATE OR REPLACE FUNCTION public.f2_sara_resgatar_atrasados()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
declare v_card uuid; v_n int := 0;
begin
  for v_card in
    select f.id from f2_lead f
    where f.descartado_em is null
      and exists (
        select 1 from wa_contatos ct
        join wa_conversas cv on cv.contato_id = ct.id
        join wa_mensagens x on x.conversa_id = cv.id and not coalesce(x.is_grupo,false)
        where right(regexp_replace(coalesce(ct.telefone,''),'\D','','g'),8)
            = right(regexp_replace(coalesce(f.telefone,''),'\D','','g'),8)
          and x.enviado_em > coalesce(f.ultima_reavaliacao_sara_em, '-infinity'::timestamptz)
          and x.enviado_em < now() - interval '90 seconds')
      and not exists (select 1 from f2_sara_fila q where q.funil_lead_id = f.id)
    order by coalesce(f.ultima_reavaliacao_sara_em, f.criado_em)
    limit 30
  loop
    perform f2_sara_ler_conversa(v_card);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok',true,'resgatados',v_n);
end $function$;

grant execute on function public.f2_sem_prazo() to authenticated, anon;
revoke execute on function public.f2_pescado_promover_respondidos() from public, anon;
