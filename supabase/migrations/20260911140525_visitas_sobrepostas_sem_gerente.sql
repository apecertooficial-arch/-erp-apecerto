-- O corretor pode organizar compromissos simultaneos. A agenda nunca impede
-- criar ou remarcar por conflito do proprio corretor. O gerente continua sendo
-- um recurso exclusivo: quando estiver ocupado, a visita e salva sem gerente.
BEGIN;

CREATE OR REPLACE FUNCTION public.f2_gerente_ocupado(
  p_gerente_id bigint,
  p_inicio timestamptz,
  p_fim timestamptz DEFAULT NULL,
  p_ignorar_visita uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $fn$
  SELECT p_gerente_id IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.f2_visita v
      WHERE v.gerente_id=p_gerente_id
        AND v.com_gerente IS TRUE
        AND v.status IN ('agendada','confirmada')
        AND (p_ignorar_visita IS NULL OR (v.id IS DISTINCT FROM p_ignorar_visita AND v.origem_visita_id IS DISTINCT FROM p_ignorar_visita))
        AND pg_catalog.tstzrange(v.inicio_em,COALESCE(v.fim_em,v.inicio_em+interval '1 hour'),'[)')
            && pg_catalog.tstzrange(p_inicio,COALESCE(p_fim,p_inicio+interval '1 hour'),'[)')
    ) OR EXISTS (
      SELECT 1
      FROM public.visitas v
      WHERE v.gerente_id=p_gerente_id
        AND v.com_gerente IS TRUE
        AND lower(COALESCE(v.status,'')) IN ('agendada','confirmada')
        AND (p_ignorar_visita IS NULL OR (
          v.id IS DISTINCT FROM p_ignorar_visita
          AND NOT EXISTS (
            SELECT 1 FROM public.f2_visita propria
            WHERE propria.id=p_ignorar_visita AND propria.origem_visita_id=v.id
          )
        ))
        AND (v.data::timestamp+COALESCE(v.hora_inicio,time '09:00')) AT TIME ZONE 'America/Sao_Paulo'<COALESCE(p_fim,p_inicio+interval '1 hour')
        AND (v.data::timestamp+COALESCE(v.hora_fim,(v.hora_inicio+interval '1 hour')::time,time '10:00')) AT TIME ZONE 'America/Sao_Paulo'>p_inicio
    )
  );
$fn$;

REVOKE ALL ON FUNCTION public.f2_gerente_ocupado(bigint,timestamptz,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_gerente_ocupado(bigint,timestamptz,timestamptz,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.f2_disponibilidade_visitas(
  p_lead_id uuid,
  p_data date,
  p_gerente_id bigint DEFAULT NULL,
  p_visita_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_corretor bigint;
  v_horarios jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR public.f2_pode_operar_lead(p_lead_id) IS NOT TRUE THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;

  SELECT f.corretor_id INTO v_corretor
  FROM public.f2_lead f
  WHERE f.id=p_lead_id AND f.descartado_em IS NULL;
  IF v_corretor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','lead_nao_encontrado');
  END IF;
  IF p_gerente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gerentes g WHERE g.id=p_gerente_id AND g.ativo IS TRUE
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','gerente_invalido');
  END IF;

  WITH slots AS (
    SELECT
      hora,
      (p_data::timestamp+pg_catalog.make_interval(hours=>hora)) AT TIME ZONE 'America/Sao_Paulo' AS inicio,
      (p_data::timestamp+pg_catalog.make_interval(hours=>hora+1)) AT TIME ZONE 'America/Sao_Paulo' AS fim
    FROM pg_catalog.generate_series(7,20) AS serie(hora)
  )
  SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'inicio',pg_catalog.to_char(inicio AT TIME ZONE 'America/Sao_Paulo','HH24:MI'),
      'fim',pg_catalog.to_char(fim AT TIME ZONE 'America/Sao_Paulo','HH24:MI'),
      'estado',CASE
        WHEN fim<=statement_timestamp() THEN 'indisponivel'
        WHEN p_gerente_id IS NOT NULL
          AND public.f2_gerente_ocupado(p_gerente_id,inicio,fim,p_visita_id) THEN 'sem_gerente'
        ELSE 'disponivel'
      END
    ) ORDER BY hora
  ) INTO v_horarios
  FROM slots;

  RETURN pg_catalog.jsonb_build_object(
    'ok',true,
    'data',p_data,
    'duracao_min',60,
    'horarios',COALESCE(v_horarios,'[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_disponibilidade_visitas(uuid,date,bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f2_disponibilidade_visitas(uuid,date,bigint,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.f2_bloquear_sobreposicao_visita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $fn$
DECLARE
  v_corretor bigint;
  v_fim timestamptz:=COALESCE(NEW.fim_em,NEW.inicio_em+interval '1 hour');
BEGIN
  IF NEW.status NOT IN ('agendada','confirmada') THEN RETURN NEW; END IF;
  IF v_fim<=NEW.inicio_em THEN
    RAISE EXCEPTION USING ERRCODE='22007',MESSAGE='intervalo_visita_invalido';
  END IF;

  SELECT f.corretor_id INTO v_corretor
  FROM public.f2_lead f
  WHERE f.id=NEW.funil_lead_id;
  IF v_corretor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='corretor_visita_ausente';
  END IF;

  -- Escritas diretas tambem recebem o mesmo fallback atomico. O lock impede
  -- duas confirmacoes concorrentes de reservarem o mesmo gerente.
  IF NEW.com_gerente IS TRUE AND NEW.gerente_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('f2_visita:gerente:'||NEW.gerente_id::text,0)
    );
    IF public.f2_gerente_ocupado(NEW.gerente_id,NEW.inicio_em,v_fim,NEW.id) THEN
      NEW.com_gerente:=false;
      NEW.gerente_id:=NULL;
    END IF;
  ELSIF NEW.gerente_id IS NULL THEN
    NEW.com_gerente:=false;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_bloquear_sobreposicao_visita() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.f2_salvar_visita(
  p_id uuid,
  p_lead_id uuid,
  p_inicio_em timestamptz,
  p_imovel text,
  p_status text DEFAULT 'agendada',
  p_observacao text DEFAULT NULL,
  p_empreendimento_id uuid DEFAULT NULL,
  p_unidade text DEFAULT NULL,
  p_com_gerente boolean DEFAULT false,
  p_gerente_id bigint DEFAULT NULL,
  p_fim_em timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_uid uuid:=(SELECT auth.uid());
  v_id uuid:=COALESCE(p_id,pg_catalog.gen_random_uuid());
  v_lead public.f2_lead%ROWTYPE;
  v_momento text;
  v_prazo timestamptz;
  v_feedback_min integer:=120;
  v_imovel text:=btrim(COALESCE(p_imovel,''));
  v_feedback boolean:=p_status='realizada' AND char_length(btrim(COALESCE(p_observacao,'')))>=10;
  v_dia_da_visita timestamptz;
  v_fim timestamptz:=COALESCE(p_fim_em,p_inicio_em+interval '1 hour');
  v_com_gerente boolean:=COALESCE(p_com_gerente,false) AND p_gerente_id IS NOT NULL;
  v_gerente_id bigint:=CASE WHEN COALESCE(p_com_gerente,false) THEN p_gerente_id ELSE NULL END;
  v_gerente_removido boolean:=false;
BEGIN
  IF v_uid IS NULL OR public.f2_pode_operar_lead(p_lead_id) IS NOT TRUE THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  SELECT * INTO v_lead FROM public.f2_lead WHERE id=p_lead_id FOR UPDATE;

  IF p_empreendimento_id IS NOT NULL AND char_length(v_imovel)<2 THEN
    SELECT e.nome INTO v_imovel FROM public.empreendimentos e WHERE e.id=p_empreendimento_id;
    v_imovel:=btrim(COALESCE(v_imovel,''));
  END IF;

  IF v_lead.id IS NULL OR p_status NOT IN ('agendada','confirmada','realizada','cancelada','nao_compareceu')
     OR p_inicio_em IS NULL OR v_fim<=p_inicio_em OR char_length(v_imovel) NOT BETWEEN 2 AND 120 THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','dados_invalidos');
  END IF;

  IF v_com_gerente THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('f2_visita:gerente:'||v_gerente_id::text,0)
    );
    IF public.f2_gerente_ocupado(v_gerente_id,p_inicio_em,v_fim,v_id) THEN
      v_com_gerente:=false;
      v_gerente_id:=NULL;
      v_gerente_removido:=true;
    END IF;
  END IF;

  SELECT feedback_visita_min INTO v_feedback_min FROM public.f2_operacao_config WHERE id;

  INSERT INTO public.f2_visita(id,funil_lead_id,inicio_em,fim_em,imovel,status,observacao,
    empreendimento_id,unidade,com_gerente,gerente_id,feedback_em,feedback_por,atualizado_por)
  VALUES(v_id,p_lead_id,p_inicio_em,v_fim,v_imovel,p_status,left(NULLIF(btrim(p_observacao),''),500),
    p_empreendimento_id,left(NULLIF(btrim(p_unidade),''),60),v_com_gerente,v_gerente_id,
    CASE WHEN v_feedback THEN statement_timestamp() ELSE NULL END,
    CASE WHEN v_feedback THEN v_uid ELSE NULL END,v_uid)
  ON CONFLICT(id) DO UPDATE SET inicio_em=EXCLUDED.inicio_em,fim_em=EXCLUDED.fim_em,
    imovel=EXCLUDED.imovel,status=EXCLUDED.status,observacao=EXCLUDED.observacao,
    empreendimento_id=EXCLUDED.empreendimento_id,unidade=EXCLUDED.unidade,
    com_gerente=EXCLUDED.com_gerente,gerente_id=EXCLUDED.gerente_id,
    feedback_em=CASE WHEN v_feedback THEN COALESCE(public.f2_visita.feedback_em,statement_timestamp()) ELSE NULL END,
    feedback_por=CASE WHEN v_feedback THEN COALESCE(public.f2_visita.feedback_por,v_uid) ELSE NULL END,
    atualizado_em=statement_timestamp(),atualizado_por=v_uid
    WHERE public.f2_visita.funil_lead_id=p_lead_id;

  v_dia_da_visita:=(pg_catalog.date_trunc('day',p_inicio_em AT TIME ZONE 'America/Sao_Paulo')+interval '8 hours')
                    AT TIME ZONE 'America/Sao_Paulo';
  IF p_status IN ('agendada','confirmada') THEN
    v_momento:='VISITA_AGENDADA'; v_prazo:=GREATEST(statement_timestamp(),v_dia_da_visita);
  ELSIF p_status='realizada' THEN
    v_momento:='VISITA_REALIZADA'; v_prazo:=p_inicio_em+pg_catalog.make_interval(mins=>COALESCE(v_feedback_min,120));
  ELSE
    v_momento:='VISITA_CANCELADA'; v_prazo:=statement_timestamp()+interval '12 hours';
  END IF;

  UPDATE public.f2_lead f SET etapa=m.etapa,momento_codigo=m.codigo,acao_codigo=m.acao_codigo,
    acao_rotulo=m.acao_rotulo,proxima_acao_em=v_prazo,versao=f.versao+1,
    atualizado_em=statement_timestamp(),atualizado_por=v_uid
  FROM public.f2_momento_config m
  WHERE f.id=p_lead_id AND m.codigo=v_momento AND m.ativo;

  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(p_lead_id,'visita_atualizada',CASE p_status
      WHEN 'agendada' THEN 'Visita agendada'
      WHEN 'confirmada' THEN 'Visita confirmada'
      WHEN 'realizada' THEN CASE WHEN v_feedback THEN 'Visita realizada e feedback registrado' ELSE 'Visita realizada — feedback obrigatório' END
      WHEN 'cancelada' THEN 'Visita cancelada — remarcar'
      ELSE 'Cliente não compareceu — remarcar' END,
    left(NULLIF(btrim(p_observacao),''),500),
    pg_catalog.jsonb_build_object('visita_id',v_id,'status',p_status,'momento',v_momento,'prazo',v_prazo,
      'empreendimento_id',p_empreendimento_id,'com_gerente',v_com_gerente,'gerente_removido',v_gerente_removido),v_uid);

  INSERT INTO public.f2_config_audit(tipo,chave,acao,depois,criado_por)
  SELECT 'visita',v_id::text,'salvar',to_jsonb(v),v_uid FROM public.f2_visita v WHERE id=v_id;

  RETURN pg_catalog.jsonb_build_object('ok',true,'id',v_id,'momento',v_momento,
    'feedback_completo',v_feedback,'proxima_acao_em',v_prazo,
    'com_gerente',v_com_gerente,'gerente_removido',v_gerente_removido);
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_salvar_visita(uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,bigint,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_salvar_visita(uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,bigint,timestamptz) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.f2_reagendar_visita(
  p_visita_id uuid,
  p_inicio_em timestamptz,
  p_fim_em timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_visita public.visitas%ROWTYPE;
  v_card_id uuid;
  v_f2_id uuid;
  v_fim timestamptz:=COALESCE(p_fim_em,p_inicio_em+interval '1 hour');
  v_status text;
  v_resultado jsonb;
  v_com_gerente boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_visita_id IS NULL OR p_inicio_em IS NULL
     OR v_fim<=p_inicio_em OR p_inicio_em<=statement_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','dados_invalidos');
  END IF;

  SELECT v.* INTO v_visita FROM public.visitas v WHERE v.id=p_visita_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','visita_nao_encontrada');
  END IF;

  SELECT f.id INTO v_card_id
  FROM public.f2_lead f
  WHERE f.origem_negocio_id=v_visita.negocio_id AND f.descartado_em IS NULL;
  IF v_card_id IS NULL OR public.f2_pode_operar_lead(v_card_id) IS NOT TRUE THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  IF lower(COALESCE(v_visita.status,'')) NOT IN ('agendada','confirmada') THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','status_invalido');
  END IF;

  SELECT v.id INTO v_f2_id
  FROM public.f2_visita v
  WHERE v.id=p_visita_id OR v.origem_visita_id=p_visita_id
  ORDER BY (v.id=p_visita_id) DESC
  LIMIT 1
  FOR UPDATE;

  v_status:=CASE WHEN lower(v_visita.status)='confirmada' THEN 'confirmada' ELSE 'agendada' END;
  SELECT public.f2_salvar_visita(
    COALESCE(v_f2_id,pg_catalog.gen_random_uuid()),v_card_id,p_inicio_em,
    left(COALESCE(NULLIF(btrim(v_visita.produto),''),NULLIF(btrim(v_visita.local),''),'Visita'),120),
    v_status,v_visita.observacoes,v_visita.empreendimento_id,v_visita.unidade,
    COALESCE(v_visita.com_gerente,false),v_visita.gerente_id,v_fim
  ) INTO v_resultado;
  IF COALESCE((v_resultado->>'ok')::boolean,false) IS NOT TRUE THEN
    RETURN v_resultado;
  END IF;

  v_com_gerente:=COALESCE((v_resultado->>'com_gerente')::boolean,false);
  UPDATE public.f2_visita
  SET origem_visita_id=p_visita_id
  WHERE id=(v_resultado->>'id')::uuid;
  UPDATE public.visitas
  SET data=(p_inicio_em AT TIME ZONE 'America/Sao_Paulo')::date,
      hora_inicio=(p_inicio_em AT TIME ZONE 'America/Sao_Paulo')::time,
      hora_fim=(v_fim AT TIME ZONE 'America/Sao_Paulo')::time,
      com_gerente=v_com_gerente,
      gerente_id=CASE WHEN v_com_gerente THEN v_visita.gerente_id ELSE NULL END,
      atualizado_em=statement_timestamp()
  WHERE id=p_visita_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok',true,
    'id',p_visita_id,
    'com_gerente',v_com_gerente,
    'gerente_removido',COALESCE((v_resultado->>'gerente_removido')::boolean,false)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_reagendar_visita(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f2_reagendar_visita(uuid,timestamptz,timestamptz) TO authenticated,service_role;

COMMIT;
