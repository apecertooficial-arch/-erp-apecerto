-- Funil 2.0 — visita movimenta o lead e cobra feedback.
BEGIN;

ALTER TABLE public.f2_visita
  ADD COLUMN IF NOT EXISTS feedback_em timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_por uuid;

INSERT INTO public.f2_momento_config(
  codigo,etapa,ordem,rotulo,descricao,acao_codigo,acao_rotulo,
  prazo_minutos,prazo_rotulo,exige_dapi,ativo,atualizado_em
) VALUES(
  'VISITA_AGENDADA','em_atendimento',8,'Visita agendada',
  'A visita está marcada; confirmar o compromisso 24 horas antes.',
  'CONFIRMAR_VISITA','Confirmar a visita',1440,'24 horas antes',false,true,now()
) ON CONFLICT(codigo) DO UPDATE SET
  etapa=EXCLUDED.etapa,ordem=EXCLUDED.ordem,rotulo=EXCLUDED.rotulo,
  descricao=EXCLUDED.descricao,acao_codigo=EXCLUDED.acao_codigo,
  acao_rotulo=EXCLUDED.acao_rotulo,prazo_minutos=EXCLUDED.prazo_minutos,
  prazo_rotulo=EXCLUDED.prazo_rotulo,ativo=true,atualizado_em=now();

CREATE OR REPLACE FUNCTION public.f2_salvar_visita(
  p_id uuid,p_lead_id uuid,p_inicio_em timestamptz,p_imovel text,
  p_status text DEFAULT 'agendada',p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  v_uid uuid:=(SELECT auth.uid()); v_id uuid:=COALESCE(p_id,gen_random_uuid());
  v_lead public.f2_lead%ROWTYPE; v_momento text; v_etapa text;
  v_prazo timestamptz; v_feedback_min integer:=120;
  v_feedback boolean:=p_status='realizada' AND char_length(btrim(COALESCE(p_observacao,'')))>=10;
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  SELECT * INTO v_lead FROM public.f2_lead WHERE id=p_lead_id FOR UPDATE;
  IF NOT FOUND OR p_status NOT IN ('agendada','confirmada','realizada','cancelada','nao_compareceu')
     OR p_inicio_em IS NULL OR char_length(btrim(p_imovel)) NOT BETWEEN 2 AND 120 THEN
    RETURN jsonb_build_object('ok',false,'erro','dados_invalidos');
  END IF;
  SELECT feedback_visita_min INTO v_feedback_min FROM public.f2_operacao_config WHERE id;
  INSERT INTO public.f2_visita(id,funil_lead_id,inicio_em,imovel,status,observacao,feedback_em,feedback_por,atualizado_por)
  VALUES(v_id,p_lead_id,p_inicio_em,btrim(p_imovel),p_status,left(NULLIF(btrim(p_observacao),''),500),
    CASE WHEN v_feedback THEN now() ELSE NULL END,CASE WHEN v_feedback THEN v_uid ELSE NULL END,v_uid)
  ON CONFLICT(id) DO UPDATE SET inicio_em=EXCLUDED.inicio_em,imovel=EXCLUDED.imovel,status=EXCLUDED.status,
    observacao=EXCLUDED.observacao,feedback_em=CASE WHEN v_feedback THEN COALESCE(public.f2_visita.feedback_em,now()) ELSE NULL END,
    feedback_por=CASE WHEN v_feedback THEN COALESCE(public.f2_visita.feedback_por,v_uid) ELSE NULL END,
    atualizado_em=now(),atualizado_por=v_uid WHERE public.f2_visita.funil_lead_id=p_lead_id;
  IF p_status IN ('agendada','confirmada') THEN
    v_etapa:='em_atendimento'; v_momento:='VISITA_AGENDADA'; v_prazo:=GREATEST(now(),p_inicio_em-interval '24 hours');
  ELSIF p_status='realizada' AND v_feedback THEN
    v_etapa:='pos_visita'; v_momento:='ACOMPANHAMENTO_POS_VISITA'; v_prazo:=now()+interval '24 hours';
  ELSIF p_status='realizada' THEN
    v_etapa:='pos_visita'; v_momento:='COLETAR_FEEDBACK'; v_prazo:=p_inicio_em+make_interval(mins=>COALESCE(v_feedback_min,120));
  ELSE
    v_etapa:='em_atendimento'; v_momento:='TENTANDO_AGENDAMENTO'; v_prazo:=now()+interval '12 hours';
  END IF;
  UPDATE public.f2_lead f SET etapa=v_etapa,momento_codigo=m.codigo,acao_codigo=m.acao_codigo,
    acao_rotulo=m.acao_rotulo,proxima_acao_em=v_prazo,versao=f.versao+1,atualizado_em=now(),atualizado_por=v_uid
  FROM public.f2_momento_config m WHERE f.id=p_lead_id AND m.codigo=v_momento AND m.ativo;
  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(p_lead_id,'visita_atualizada',CASE p_status WHEN 'agendada' THEN 'Visita agendada'
      WHEN 'confirmada' THEN 'Visita confirmada' WHEN 'realizada' THEN CASE WHEN v_feedback THEN 'Visita realizada e feedback registrado' ELSE 'Visita realizada — feedback obrigatório' END
      WHEN 'cancelada' THEN 'Visita cancelada — remarcar' ELSE 'Cliente não compareceu — remarcar' END,
    left(NULLIF(btrim(p_observacao),''),500),jsonb_build_object('visita_id',v_id,'status',p_status,'momento',v_momento,'prazo',v_prazo),v_uid);
  INSERT INTO public.f2_config_audit(tipo,chave,acao,depois,criado_por)
  SELECT 'visita',v_id::text,'salvar',to_jsonb(v),v_uid FROM public.f2_visita v WHERE id=v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'momento',v_momento,'feedback_completo',v_feedback,'proxima_acao_em',v_prazo);
END;$fn$;
REVOKE ALL ON FUNCTION public.f2_salvar_visita(uuid,uuid,timestamptz,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_salvar_visita(uuid,uuid,timestamptz,text,text,text) TO authenticated,service_role;

WITH recentes AS (
  SELECT DISTINCT ON (funil_lead_id) funil_lead_id,inicio_em
  FROM public.f2_visita WHERE status IN ('agendada','confirmada')
  ORDER BY funil_lead_id,inicio_em DESC
)
UPDATE public.f2_lead f SET etapa='em_atendimento',momento_codigo='VISITA_AGENDADA',acao_codigo='CONFIRMAR_VISITA',
  acao_rotulo='Confirmar a visita',proxima_acao_em=GREATEST(now(),v.inicio_em-interval '24 hours'),versao=f.versao+1,atualizado_em=now()
FROM recentes v
WHERE f.id=v.funil_lead_id;

WITH recentes AS (
  SELECT DISTINCT ON (funil_lead_id) funil_lead_id,inicio_em
  FROM public.f2_visita WHERE status='realizada' AND feedback_em IS NULL
  ORDER BY funil_lead_id,inicio_em DESC
)
UPDATE public.f2_lead f SET etapa='pos_visita',momento_codigo='COLETAR_FEEDBACK',acao_codigo='COLETAR_FEEDBACK',
  acao_rotulo='Registrar feedback da visita',proxima_acao_em=v.inicio_em+interval '2 hours',versao=f.versao+1,atualizado_em=now()
FROM recentes v
WHERE f.id=v.funil_lead_id;
COMMIT;
