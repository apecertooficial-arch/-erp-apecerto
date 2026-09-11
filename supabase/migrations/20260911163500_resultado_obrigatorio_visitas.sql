-- Resultado estruturado das visitas. Registros historicos sem resposta nao sao
-- alterados: passam a aparecer na fila de cobranca ate o corretor responde-los.
BEGIN;

ALTER TABLE public.f2_visita
  ADD COLUMN IF NOT EXISTS resultado_codigo text,
  ADD COLUMN IF NOT EXISTS resultado_justificativa text,
  ADD COLUMN IF NOT EXISTS resultado_em timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_por uuid;

ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS resultado_justificativa text,
  ADD COLUMN IF NOT EXISTS resultado_detalhe_codigo text;

CREATE INDEX IF NOT EXISTS f2_visita_resultado_pendente_idx
  ON public.f2_visita(inicio_em,status)
  WHERE resultado_em IS NULL;

CREATE OR REPLACE FUNCTION public.f2_espelhar_visita_na_agenda(p_visita_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE v record; v_local text;
BEGIN
  SELECT fv.id,fv.inicio_em,fv.fim_em,fv.imovel,fv.status,fv.observacao,
         fv.empreendimento_id,fv.unidade,fv.com_gerente,fv.gerente_id,
         fv.resultado_codigo,fv.resultado_justificativa,fv.resultado_em,fv.resultado_por,
         fl.nome AS cliente,n.id AS negocio_id,n.lead_id,n.corretor_id
    INTO v
    FROM public.f2_visita fv
    JOIN public.f2_lead fl ON fl.id=fv.funil_lead_id
    LEFT JOIN public.negocios n ON n.id=fl.origem_negocio_id
   WHERE fv.id=p_visita_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT nullif(btrim(concat_ws(', ',e.nome,e.bairro,e.cidade)),'')
    INTO v_local FROM public.empreendimentos e WHERE e.id=v.empreendimento_id;

  INSERT INTO public.visitas(
    id,lead_id,negocio_id,corretor_id,cliente_nome,empreendimento_id,produto,unidade,
    data,hora_inicio,hora_fim,local,observacoes,com_gerente,gerente_id,status,
    resultado,resultado_detalhe_codigo,motivo_cancelamento,resultado_justificativa,resultado_em,resultado_por
  ) VALUES (
    v.id,v.lead_id,v.negocio_id,v.corretor_id,v.cliente,v.empreendimento_id,v.imovel,v.unidade,
    (v.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date,
    (v.inicio_em AT TIME ZONE 'America/Sao_Paulo')::time,
    CASE WHEN v.fim_em IS NOT NULL THEN (v.fim_em AT TIME ZONE 'America/Sao_Paulo')::time
         ELSE ((v.inicio_em+interval '1 hour') AT TIME ZONE 'America/Sao_Paulo')::time END,
    coalesce(v_local,v.imovel),v.observacao,coalesce(v.com_gerente,false),v.gerente_id,v.status,
    CASE WHEN v.resultado_codigo IN ('interessado','quer_outra_opcao','precisa_conversar','nao_gostou','nao_compareceu','remarcar','fara_proposta')
      THEN v.resultado_codigo WHEN v.status='cancelada' THEN 'remarcar' ELSE NULL END,
    v.resultado_codigo,
    CASE WHEN v.status IN ('cancelada','nao_compareceu') THEN v.resultado_justificativa ELSE NULL END,
    v.resultado_justificativa,v.resultado_em,v.resultado_por
  )
  ON CONFLICT(id) DO UPDATE SET
    cliente_nome=excluded.cliente_nome,empreendimento_id=excluded.empreendimento_id,
    produto=excluded.produto,unidade=excluded.unidade,data=excluded.data,
    hora_inicio=excluded.hora_inicio,hora_fim=excluded.hora_fim,local=excluded.local,
    observacoes=excluded.observacoes,com_gerente=excluded.com_gerente,
    gerente_id=excluded.gerente_id,status=excluded.status,resultado=excluded.resultado,
    resultado_detalhe_codigo=excluded.resultado_detalhe_codigo,
    motivo_cancelamento=excluded.motivo_cancelamento,
    resultado_justificativa=excluded.resultado_justificativa,resultado_em=excluded.resultado_em,
    resultado_por=excluded.resultado_por,atualizado_em=statement_timestamp();
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_espelhar_visita_na_agenda(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f2_espelhar_visita_na_agenda(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.f2_registrar_resultado_visita(
  p_visita_id uuid,
  p_status text,
  p_resultado_codigo text,
  p_justificativa text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_uid uuid:=(SELECT auth.uid());
  v_visita public.f2_visita%ROWTYPE;
  v_momento text;
  v_prazo timestamptz;
  v_justificativa text:=left(btrim(COALESCE(p_justificativa,'')),800);
  v_rotulo text;
BEGIN
  SELECT * INTO v_visita FROM public.f2_visita WHERE id=p_visita_id FOR UPDATE;
  IF v_uid IS NULL OR v_visita.id IS NULL
     OR public.f2_pode_operar_lead(v_visita.funil_lead_id) IS NOT TRUE THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  IF p_status NOT IN ('realizada','cancelada','nao_compareceu')
     OR p_resultado_codigo IS NULL
     OR char_length(v_justificativa)<10 THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','resultado_invalido');
  END IF;
  IF (p_status='realizada' AND p_resultado_codigo NOT IN
        ('fara_proposta','interessado','quer_outra_opcao','precisa_conversar','nao_gostou'))
     OR (p_status='cancelada' AND p_resultado_codigo NOT IN
        ('remarcar','cliente_cancelou','corretor_cancelou','produto_indisponivel','conflito_agenda','sem_confirmacao','outro'))
     OR (p_status='nao_compareceu' AND p_resultado_codigo<>'nao_compareceu') THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','resultado_incompativel');
  END IF;
  IF p_status='realizada' AND COALESCE(v_visita.fim_em,v_visita.inicio_em+interval '1 hour')>statement_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','visita_ainda_nao_terminou');
  END IF;

  UPDATE public.f2_visita SET
    status=p_status,resultado_codigo=p_resultado_codigo,
    resultado_justificativa=v_justificativa,resultado_em=statement_timestamp(),
    resultado_por=v_uid,
    feedback_em=CASE WHEN p_status='realizada' THEN statement_timestamp() ELSE NULL END,
    feedback_por=CASE WHEN p_status='realizada' THEN v_uid ELSE NULL END,
    atualizado_em=statement_timestamp(),atualizado_por=v_uid
  WHERE id=p_visita_id;

  IF p_status='realizada' THEN
    v_momento:='ACOMPANHAMENTO_POS_VISITA';
    v_prazo:=statement_timestamp()+interval '24 hours';
  ELSE
    v_momento:='VISITA_CANCELADA';
    v_prazo:=statement_timestamp()+interval '12 hours';
  END IF;

  UPDATE public.f2_lead f SET
    etapa=m.etapa,momento_codigo=m.codigo,acao_codigo=m.acao_codigo,
    acao_rotulo=m.acao_rotulo,proxima_acao_em=v_prazo,versao=f.versao+1,
    atualizado_em=statement_timestamp(),atualizado_por=v_uid
  FROM public.f2_momento_config m
  WHERE f.id=v_visita.funil_lead_id AND m.codigo=v_momento AND m.ativo;

  v_rotulo:=CASE p_resultado_codigo
    WHEN 'fara_proposta' THEN 'Vai receber proposta'
    WHEN 'interessado' THEN 'Gostou e seguirá em atendimento'
    WHEN 'quer_outra_opcao' THEN 'Quer conhecer outra opção'
    WHEN 'precisa_conversar' THEN 'Precisa conversar ou pensar'
    WHEN 'nao_gostou' THEN 'Não gostou do imóvel'
    WHEN 'remarcar' THEN 'Será remarcada'
    WHEN 'cliente_cancelou' THEN 'Cliente cancelou'
    WHEN 'corretor_cancelou' THEN 'Corretor cancelou'
    WHEN 'produto_indisponivel' THEN 'Imóvel ficou indisponível'
    WHEN 'conflito_agenda' THEN 'Conflito de agenda'
    WHEN 'sem_confirmacao' THEN 'Cliente não confirmou'
    WHEN 'nao_compareceu' THEN 'Cliente não compareceu'
    ELSE 'Outro motivo' END;

  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(
    v_visita.funil_lead_id,'visita_atualizada',
    CASE p_status WHEN 'realizada' THEN 'Resultado da visita registrado'
      WHEN 'cancelada' THEN 'Cancelamento da visita justificado'
      ELSE 'Ausência do cliente registrada' END,
    v_justificativa,
    pg_catalog.jsonb_build_object(
      'visita_id',p_visita_id,'status',p_status,'resultado_codigo',p_resultado_codigo,
      'resultado_rotulo',v_rotulo,'justificativa',v_justificativa,'proxima_acao_em',v_prazo
    ),v_uid
  );

  INSERT INTO public.f2_config_audit(tipo,chave,acao,depois,criado_por)
  SELECT 'visita',p_visita_id::text,'registrar_resultado',to_jsonb(v),v_uid
  FROM public.f2_visita v WHERE v.id=p_visita_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok',true,'id',p_visita_id,'status',p_status,'resultado_codigo',p_resultado_codigo,
    'resultado_rotulo',v_rotulo,'resultado_em',statement_timestamp(),
    'momento',v_momento,'proxima_acao_em',v_prazo
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_registrar_resultado_visita(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_registrar_resultado_visita(uuid,text,text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.f2_visitas_resultado_pendente(
  p_inicio date DEFAULT NULL,
  p_fim date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_uid uuid:=(SELECT auth.uid());
  v_inicio date:=COALESCE(p_inicio,pg_catalog.date_trunc('month',statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_fim date:=COALESCE(p_fim,(pg_catalog.date_trunc('month',statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')+interval '1 month - 1 day')::date);
  v_itens jsonb;
  v_resumo jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF v_fim<v_inicio OR v_fim-v_inicio>366 THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','periodo_invalido');
  END IF;

  WITH permitidas AS (
    SELECT v.*,f.nome AS cliente,f.origem_negocio_id,c.id AS corretor_id,
           COALESCE(u.nome,'Sem responsável') AS corretor,c.usuario_id=v_uid AS meu
    FROM public.f2_visita v
    JOIN public.f2_lead f ON f.id=v.funil_lead_id
    LEFT JOIN public.corretores c ON c.id=f.corretor_id
    LEFT JOIN public.usuarios u ON u.id=c.usuario_id
    WHERE (v.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_inicio AND v_fim
      AND (public.f2_admin() IS TRUE OR c.usuario_id=v_uid)
  ), pendentes AS (
    SELECT * FROM permitidas
    WHERE (
      status IN ('agendada','confirmada')
      AND COALESCE(fim_em,inicio_em+interval '1 hour')<=statement_timestamp()
    ) OR (
      status IN ('realizada','cancelada','nao_compareceu')
      AND (resultado_em IS NULL OR resultado_codigo IS NULL
        OR char_length(btrim(COALESCE(resultado_justificativa,'')))<10)
    )
  )
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',id,'data',(inicio_em AT TIME ZONE 'America/Sao_Paulo')::date,
    'hora',pg_catalog.to_char(inicio_em AT TIME ZONE 'America/Sao_Paulo','HH24:MI'),
    'tipo',CASE WHEN com_gerente THEN 'visita com gerente' ELSE 'visita' END,
    'cliente',cliente,'local',imovel,'produto',imovel,'negocio_id',origem_negocio_id,
    'status',status,'corretor',corretor,'corretor_id',corretor_id,'meu',meu,
    'faltam_min',(EXTRACT(epoch FROM (inicio_em-statement_timestamp()))/60)::int,
    'com_gerente',com_gerente,'gerente_id',gerente_id,
    'resultado_codigo',resultado_codigo,'resultado_justificativa',resultado_justificativa,
    'resultado_em',resultado_em
  ) ORDER BY inicio_em,id),'[]'::jsonb) INTO v_itens FROM pendentes;

  WITH permitidas AS (
    SELECT v.*
    FROM public.f2_visita v
    JOIN public.f2_lead f ON f.id=v.funil_lead_id
    LEFT JOIN public.corretores c ON c.id=f.corretor_id
    WHERE (v.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_inicio AND v_fim
      AND (public.f2_admin() IS TRUE OR c.usuario_id=v_uid)
  ), marcadas AS (
    SELECT *,(
      (status IN ('agendada','confirmada') AND COALESCE(fim_em,inicio_em+interval '1 hour')<=statement_timestamp())
      OR (status IN ('realizada','cancelada','nao_compareceu') AND
        (resultado_em IS NULL OR resultado_codigo IS NULL OR char_length(btrim(COALESCE(resultado_justificativa,'')))<10))
    ) AS pendente
    FROM permitidas
  )
  SELECT pg_catalog.jsonb_build_object(
    'total',count(*),'pendentes',count(*) FILTER(WHERE pendente),
    'passadas_sem_desfecho',count(*) FILTER(WHERE pendente AND status IN ('agendada','confirmada')),
    'realizadas_sem_feedback',count(*) FILTER(WHERE pendente AND status='realizada'),
    'canceladas_sem_motivo',count(*) FILTER(WHERE pendente AND status='cancelada'),
    'nao_compareceu_sem_motivo',count(*) FILTER(WHERE pendente AND status='nao_compareceu'),
    'justificadas',count(*) FILTER(WHERE status IN ('realizada','cancelada','nao_compareceu') AND NOT pendente),
    'futuras',count(*) FILTER(WHERE status IN ('agendada','confirmada') AND NOT pendente)
  ) INTO v_resumo FROM marcadas;

  RETURN pg_catalog.jsonb_build_object(
    'ok',true,'inicio',v_inicio,'fim',v_fim,'resumo',v_resumo,'itens',v_itens
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_visitas_resultado_pendente(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_visitas_resultado_pendente(date,date) TO authenticated,service_role;

COMMIT;
