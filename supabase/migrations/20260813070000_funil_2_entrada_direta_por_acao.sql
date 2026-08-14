-- Funil 2.0: entrada direta pela automacao, sem esperar a varredura do cron.
--
-- JA APLICADA EM PRODUCAO em 04/08/2026. Este arquivo e o espelho fiel do que
-- esta no banco, cumprindo o item 12 do contrato (00-ESCOPO-OPERACAO-UNIFICADA.md):
-- "nenhuma regra pode existir somente no painel ou apenas no banco de producao".
--
-- CONTEXTO
-- Ate aqui o card do Funil 2.0 so nascia pelo cron f2_entrada_distribuicao (roda a
-- cada minuto) chamando f2_entrada_por_distribuicao(), que varre negocios abertos
-- com corretor criados depois de f2_entrada_config.vigente_desde e fora do Aquario.
-- Funciona, mas o operador nao escolhe a etapa e ainda espera ate 60s.
--
-- POR QUE O CARD DEPENDE DE UM NEGOCIO
-- origem_negocio_id nao e detalhe: app/api/funil2/route.ts resolve o lead_id a partir
-- dele, app/api/funil2/conversa/route.ts carrega a conversa por ele, e o BotaoWhatsApp
-- recebe negocioId={lead.origem_negocio_id}. Card sem negocio nasceria sem conversa e
-- sem WhatsApp. Por isso a acao exige um "Criar negocio" antes dela no fluxo.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.f2_entrada_direta(bigint, text);
--   -- e recriar motor_acoes sem o ramo 'f2-add-action' (o ramo e inerte se a acao
--   -- nao for usada em nenhum fluxo publicado).

CREATE OR REPLACE FUNCTION public.f2_entrada_direta(
  p_negocio_id bigint,
  p_etapa      text DEFAULT 'novo'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_m     public.f2_momento_config%ROWTYPE;
  v_id    uuid;
  v_corte timestamptz := clock_timestamp();
  v_etapa text := coalesce(nullif(trim(p_etapa), ''), 'novo');
BEGIN
  IF p_negocio_id IS NULL THEN RETURN NULL; END IF;

  -- idempotencia: ja existe card para este negocio? devolve o existente
  SELECT id INTO v_id FROM public.f2_lead WHERE origem_negocio_id = p_negocio_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- primeiro momento ativo da etapa pedida (para 'novo' = PRIMEIRA_ABORDAGEM)
  SELECT m.* INTO v_m
    FROM public.f2_momento_config m
   WHERE m.etapa = v_etapa AND m.ativo
   ORDER BY m.ordem
   LIMIT 1;

  IF v_m.codigo IS NULL THEN
    RAISE EXCEPTION 'etapa_sem_momento_ativo: %', v_etapa;
  END IF;

  INSERT INTO public.f2_lead(
    origem_negocio_id, nome, telefone, corretor_id, corretor_nome,
    etapa, momento_codigo, acao_codigo, acao_rotulo, proxima_acao_em,
    cadencia_passo, ultima_reavaliacao_resumo, corte_conversa_em, historico_completo
  )
  SELECT n.id, l.nome, l.telefone, n.corretor_id, c.nome,
         v_m.etapa, v_m.codigo, v_m.acao_codigo, v_m.acao_rotulo,
         v_corte + make_interval(mins => COALESCE(v_m.prazo_minutos, 1440)),
         0, 'Lead colocado no funil pela automacao; aguarda a primeira leitura da Sara.',
         v_corte, false
    FROM public.negocios n
    JOIN public.leads l           ON l.id = n.lead_id
    LEFT JOIN public.corretores c ON c.id = n.corretor_id
   WHERE n.id = p_negocio_id
  ON CONFLICT (origem_negocio_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.f2_lead WHERE origem_negocio_id = p_negocio_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.f2_evento(funil_lead_id, tipo, titulo, detalhe, payload)
  VALUES (v_id, 'momento_alterado', 'Lead colocado no funil pela automacao',
          'Entrou na etapa ' || v_m.etapa || ', com a primeira acao em '
            || COALESCE(v_m.prazo_minutos, 1440) || ' minutos.',
          jsonb_build_object('etapa', v_m.etapa, 'momento', v_m.codigo,
                             'origem', 'automacao', 'corte_conversa_em', v_corte));

  RETURN v_id;
END;
$function$;

-- Liga a acao 'f2-add-action' no despachante motor_acoes SEM reescrever a funcao:
-- le a definicao atual, insere um ramo no inicio da cadeia if/elsif e recria.
-- Reescrever motor_acoes inteira (14 KB, 15+ acoes em producao) seria transcricao
-- manual de codigo critico; este caminho preserva o resto byte a byte.
-- Idempotente: se o ramo ja existe, nao faz nada.
DO $mig$
DECLARE
  d      text;
  ancora text := 'if act_name=''create-lead-action'' then';
  resto  text := 'act_name=''create-lead-action'' then';
  ramo   text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'motor_acoes';

  IF d IS NULL THEN RAISE EXCEPTION 'motor_acoes nao encontrada'; END IF;

  IF position('f2-add-action' in d) > 0 THEN
    RAISE NOTICE 'ramo f2-add-action ja existe; nada a fazer';
    RETURN;
  END IF;

  IF strpos(d, ancora) = 0 THEN
    RAISE EXCEPTION 'ancora nao encontrada em motor_acoes';
  END IF;

  ramo := 'if act_name=''f2-add-action'' then'
       || ' if v_negocio_id is not null then'
       || ' perform public.f2_entrada_direta(v_negocio_id, coalesce(nullif(ao->>''f2etapa'',''''),''novo''));'
       || ' insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)'
       || ' values(p_auto,p_nome,p_bloco,''acao'',''ok'',p_lead->>''nome'',v_tel,'
       || ' ''Funil 2.0: card criado na etapa ''||coalesce(nullif(ao->>''f2etapa'',''''),''novo'')||'' (negocio #''||v_negocio_id||'')'');'
       || ' else'
       || ' insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)'
       || ' values(p_auto,p_nome,p_bloco,''acao'',''alerta'',p_lead->>''nome'',v_tel,'
       || ' ''Funil 2.0: nao ha negocio no contexto - coloque um Criar negocio antes deste passo'');'
       || ' end if;'
       || ' elsif ';

  d := replace(d, ancora, ramo || resto);
  EXECUTE d;
  RAISE NOTICE 'ramo f2-add-action adicionado a motor_acoes';
END
$mig$;
