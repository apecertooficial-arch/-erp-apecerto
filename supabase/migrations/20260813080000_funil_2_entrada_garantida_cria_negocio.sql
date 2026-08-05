-- Funil 2.0: a acao "Adicionar ao Funil 2.0" passa a garantir o negocio sozinha.
--
-- JA APLICADA EM PRODUCAO em 04/08/2026. Espelho fiel do banco (item 12 do contrato).
--
-- PROBLEMA OBSERVADO EM PRODUCAO
-- A acao exigia um "Criar negocio" antes dela. Com aquele bloco mal configurado
-- (funil/etapa vazios) ele nao criava nada e passava null adiante - a acao so
-- registrava "nao ha negocio no contexto" e o lead nao entrava no funil.
-- Exigir dois blocos acoplados para uma coisa so e fragil.
--
-- SOLUCAO
-- f2_entrada_garantida resolve a cadeia num passo:
--   1. garante o lead (reaproveita por telefone antes de criar)
--   2. reaproveita negocio aberto do lead - nunca duplica
--   3. se nao houver, cria com o funil/etapa configurados NA PROPRIA acao
--   4. garante corretor no negocio (o card do Funil 2.0 herda o dono daqui)
--   5. cria o card via f2_entrada_direta na etapa pedida
-- Cada desfecho vira linha em motor_execucoes.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.f2_entrada_garantida(bigint,text,text,jsonb,bigint,bigint,bigint,bigint,text,bigint);
--   -- e reapontar o ramo f2-add-action de motor_acoes para f2_entrada_direta.

CREATE OR REPLACE FUNCTION public.f2_entrada_garantida(
  p_auto bigint, p_nome text, p_bloco text, p_lead jsonb,
  p_lead_id bigint, p_negocio_id bigint, p_pipeline_id bigint,
  p_stage_id bigint, p_etapa text, p_corretor_id bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_lead_id bigint := p_lead_id; v_neg bigint := p_negocio_id;
  v_cor bigint := p_corretor_id; v_stage bigint := p_stage_id;
  v_card uuid; v_tel text;
  v_etapa text := coalesce(nullif(trim(p_etapa), ''), 'novo');
  v_criou boolean := false;
BEGIN
  v_tel := regexp_replace(coalesce(p_lead->>'telefone', ''), '\D', '', 'g');

  IF v_lead_id IS NULL AND v_tel <> '' THEN
    SELECT id INTO v_lead_id FROM leads
     WHERE regexp_replace(coalesce(telefone,''), '\D', '', 'g') = v_tel
     ORDER BY id DESC LIMIT 1;
  END IF;
  IF v_lead_id IS NULL THEN
    INSERT INTO leads(nome, telefone, email, origem, status)
    VALUES (coalesce(p_lead->>'nome','Lead'), v_tel, nullif(p_lead->>'email',''),
            coalesce(p_lead->>'origem','automacao'), 'novo')
    RETURNING id INTO v_lead_id;
  END IF;

  IF v_cor IS NULL THEN
    SELECT corretor_id INTO v_cor FROM leads WHERE id = v_lead_id;
  END IF;

  IF v_neg IS NULL THEN
    SELECT id INTO v_neg FROM negocios
     WHERE lead_id = v_lead_id AND status = 'aberto'
       AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
     ORDER BY id DESC LIMIT 1;
  END IF;

  IF v_neg IS NULL THEN
    IF p_pipeline_id IS NULL THEN
      INSERT INTO motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
      VALUES (p_auto,p_nome,p_bloco,'acao','erro',p_lead->>'nome',v_tel,
        'Funil 2.0: o lead nao tem negocio aberto e nenhum funil/etapa foi escolhido na acao - escolha um para o card poder abrir a conversa');
      RETURN jsonb_build_object('lead_id',v_lead_id,'negocio_id',null,'card_id',null);
    END IF;
    IF v_stage IS NULL THEN
      SELECT id INTO v_stage FROM pipeline_stages
       WHERE pipeline_id = p_pipeline_id ORDER BY ordem NULLS LAST, id LIMIT 1;
    END IF;
    INSERT INTO negocios(lead_id, pipeline_id, stage_id, corretor_id, status, ultima_movimentacao)
    VALUES (v_lead_id, p_pipeline_id, v_stage, v_cor, 'aberto', now())
    RETURNING id INTO v_neg;
    v_criou := true;
  ELSE
    UPDATE negocios SET corretor_id = coalesce(corretor_id, v_cor), ultima_movimentacao = now()
     WHERE id = v_neg;
  END IF;

  SELECT corretor_id INTO v_cor FROM negocios WHERE id = v_neg;
  IF v_cor IS NULL THEN
    INSERT INTO motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
    VALUES (p_auto,p_nome,p_bloco,'acao','alerta',p_lead->>'nome',v_tel,
      'Funil 2.0: negocio #'||v_neg||' sem corretor - distribua o lead antes deste passo, senao o card nasce sem dono');
  END IF;

  v_card := public.f2_entrada_direta(v_neg, v_etapa);

  INSERT INTO motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
  VALUES (p_auto,p_nome,p_bloco,'acao',
          CASE WHEN v_card IS NULL THEN 'erro' ELSE 'ok' END, p_lead->>'nome', v_tel,
          CASE WHEN v_card IS NULL THEN 'Funil 2.0: falhou ao criar o card do negocio #'||v_neg
               ELSE 'Funil 2.0: card na etapa '||v_etapa||' (negocio #'||v_neg||
                    CASE WHEN v_criou THEN ' criado agora' ELSE ' reaproveitado' END||')' END);

  RETURN jsonb_build_object('lead_id',v_lead_id,'negocio_id',v_neg,'card_id',v_card);
END;
$function$;

-- Reaponta o ramo f2-add-action de motor_acoes para a funcao acima.
-- Le a definicao atual, troca so o trecho do ramo e recria - o resto fica intacto.
DO $mig$
DECLARE d text; ini int; fim int; ramo text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='motor_acoes';
  IF d IS NULL THEN RAISE EXCEPTION 'motor_acoes nao encontrada'; END IF;

  IF position('_f2 jsonb;' in d) = 0 THEN
    IF position('v_exist bigint;' in d) = 0 THEN
      RAISE EXCEPTION 'declare de motor_acoes fora do formato esperado';
    END IF;
    d := replace(d, 'v_exist bigint;', 'v_exist bigint; _f2 jsonb;');
  END IF;

  ini := strpos(d, 'if act_name=''f2-add-action'' then');
  fim := strpos(d, 'elsif act_name=''create-lead-action'' then');
  IF ini = 0 OR fim = 0 OR fim <= ini THEN
    RAISE EXCEPTION 'ramo f2-add-action nao localizado para substituicao';
  END IF;

  ramo := 'if act_name=''f2-add-action'' then'
       || ' _f2 := public.f2_entrada_garantida(p_auto,p_nome,p_bloco,p_lead,v_lead_id,v_negocio_id,'
       || ' v_pipe,v_stage,coalesce(nullif(ao->>''f2etapa'',''''),''novo''),v_cor);'
       || ' v_lead_id := coalesce(nullif(_f2->>''lead_id'','''')::bigint, v_lead_id);'
       || ' v_negocio_id := coalesce(nullif(_f2->>''negocio_id'','''')::bigint, v_negocio_id);'
       || ' ';

  d := substr(d, 1, ini - 1) || ramo || substr(d, fim);
  EXECUTE d;
  RAISE NOTICE 'ramo f2-add-action atualizado';
END
$mig$;
