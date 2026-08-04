-- Funil 2.0: revalidação do mesmo momento e avanço correto da cadência 1/2/4/6/7.
-- Mantém o limite de duas cópias e não escreve em nenhum objeto operacional.
BEGIN;

CREATE OR REPLACE FUNCTION public.f2_atualizar_momento(
  p_id uuid,p_versao integer,p_momento_codigo text,p_prazo_combinado timestamptz DEFAULT NULL,p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE v_uid uuid:=(SELECT auth.uid()); v_atual public.f2_lead%ROWTYPE;
        v_m public.f2_momento_config%ROWTYPE; v_prazo timestamptz; v_mesmo boolean;
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  SELECT * INTO v_atual FROM public.f2_lead WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','lead_inexistente'); END IF;
  IF v_atual.versao<>p_versao THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  SELECT * INTO v_m FROM public.f2_momento_config WHERE codigo=p_momento_codigo AND ativo;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','momento_invalido'); END IF;
  v_mesmo:=v_atual.momento_codigo=v_m.codigo;
  v_prazo:=CASE WHEN v_m.codigo='RETORNO_PROGRAMADO'
    THEN COALESCE(p_prazo_combinado,now()+interval '5 days')
    ELSE now()+make_interval(mins=>COALESCE(v_m.prazo_minutos,1440)) END;
  IF v_prazo<=now() THEN RETURN jsonb_build_object('ok',false,'erro','prazo_no_passado'); END IF;

  UPDATE public.f2_lead SET etapa=v_m.etapa,momento_codigo=v_m.codigo,
    acao_codigo=v_m.acao_codigo,acao_rotulo=v_m.acao_rotulo,proxima_acao_em=v_prazo,
    cadencia_passo=CASE
      WHEN v_m.codigo='CADENCIA_SEM_RESPOSTA' AND v_atual.momento_codigo<>'CADENCIA_SEM_RESPOSTA' THEN 0
      ELSE v_atual.cadencia_passo END,
    ultima_reavaliacao_sara_em=now(),
    ultima_reavaliacao_resumo=COALESCE(NULLIF(btrim(p_observacao),''),
      CASE WHEN v_mesmo THEN 'O momento foi revalidado e a próxima obrigação recalculada.'
           ELSE 'O momento foi alterado e a próxima obrigação recalculada.' END),
    versao=versao+1,atualizado_em=now(),atualizado_por=v_uid
  WHERE id=p_id;
  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  -- O vocabulário de f2_evento é fechado. A revalidação usa o tipo oficial
  -- existente e permanece distinguível por payload.mesmo_momento = true.
  VALUES(p_id,'momento_alterado',
    CASE WHEN v_mesmo THEN 'Momento revalidado: ' ELSE 'Momento atualizado para ' END||v_m.rotulo,p_observacao,
    jsonb_build_object('etapa_anterior',v_atual.etapa,'momento_anterior',v_atual.momento_codigo,'prazo',v_prazo,'mesmo_momento',v_mesmo),v_uid);
  RETURN jsonb_build_object('ok',true,'versao',v_atual.versao+1,'etapa',v_m.etapa,'momento_codigo',v_m.codigo,'prazo',v_prazo,'mesmo_momento',v_mesmo);
END;
$fn$;
REVOKE ALL ON FUNCTION public.f2_atualizar_momento(uuid,integer,text,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_atualizar_momento(uuid,integer,text,timestamptz,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.f2_confirmar_acao(
  p_id uuid,p_versao integer,p_fonte text,p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE v_uid uuid:=(SELECT auth.uid()); v_atual public.f2_lead%ROWTYPE;
        v_m public.f2_momento_config%ROWTYPE; v_passo smallint; v_dias smallint; v_prazo timestamptz;
        v_dias_cadencia constant smallint[]:=ARRAY[1,2,4,6,7];
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_fonte NOT IN ('dapi','registro_operacional') THEN RETURN jsonb_build_object('ok',false,'erro','fonte_invalida'); END IF;
  SELECT * INTO v_atual FROM public.f2_lead WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','lead_inexistente'); END IF;
  IF v_atual.versao<>p_versao THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  SELECT * INTO v_m FROM public.f2_momento_config WHERE codigo=v_atual.momento_codigo;
  IF v_m.exige_dapi AND p_fonte<>'dapi' THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_dapi_obrigatoria'); END IF;

  IF v_atual.momento_codigo='CADENCIA_SEM_RESPOSTA' THEN
    IF v_atual.cadencia_passo<4 THEN
      v_passo:=v_atual.cadencia_passo+1;
      v_dias:=v_dias_cadencia[v_passo+1]-v_dias_cadencia[v_passo];
      v_prazo:=date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
        +make_interval(days=>v_dias)+interval '9 hours';
    ELSE
      v_passo:=5;
      v_prazo:=now()+interval '24 hours';
    END IF;
  ELSE
    v_passo:=v_atual.cadencia_passo;
    v_prazo:=now()+make_interval(mins=>COALESCE(v_m.prazo_minutos,1440));
  END IF;

  UPDATE public.f2_lead SET cadencia_passo=v_passo,proxima_acao_em=v_prazo,
    ultima_acao_confirmada_em=now(),ultima_acao_fonte=p_fonte,
    ultima_reavaliacao_sara_em=now(),
    ultima_reavaliacao_resumo=CASE WHEN v_atual.momento_codigo='CADENCIA_SEM_RESPOSTA' AND v_passo<5
      THEN 'A mensagem foi confirmada; a Sara manteve a cadência e programou o próximo dia oficial.'
      WHEN v_atual.momento_codigo='CADENCIA_SEM_RESPOSTA'
      THEN 'A cadência de sete dias foi concluída; o lead precisa de uma nova avaliação.'
      ELSE 'A ação foi confirmada; a Sara revisou o laboratório e manteve a conduta atual.' END,
    versao=versao+1,atualizado_em=now(),atualizado_por=v_uid
  WHERE id=p_id;
  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(p_id,'acao_confirmada','Ação confirmada por '||CASE p_fonte WHEN 'dapi' THEN 'D-API' ELSE 'registro operacional' END,
    p_observacao,jsonb_build_object('acao',v_atual.acao_codigo,'proximo_prazo',v_prazo,'cadencia_passo',v_passo),v_uid);
  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(p_id,'sara_reavaliou','Sara reavaliou a cópia',
    CASE WHEN v_atual.momento_codigo='CADENCIA_SEM_RESPOSTA' AND v_passo<5 THEN 'Próximo dia da cadência programado.'
         WHEN v_atual.momento_codigo='CADENCIA_SEM_RESPOSTA' THEN 'Cadência concluída; revisão necessária.'
         ELSE 'A conduta foi mantida após a ação de demonstração.' END,
    jsonb_build_object('momento',v_atual.momento_codigo,'acao',v_atual.acao_codigo,'cadencia_passo',v_passo),v_uid);
  RETURN jsonb_build_object('ok',true,'versao',v_atual.versao+1,'prazo',v_prazo,'cadencia_passo',v_passo);
END;
$fn$;
REVOKE ALL ON FUNCTION public.f2_confirmar_acao(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_confirmar_acao(uuid,integer,text,text) TO authenticated,service_role;

COMMIT;
