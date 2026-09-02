-- Visitas simultaneas sao permitidas quando corretor e gerente sao distintos.
--
-- A trava anterior tratava a imobiliaria inteira como um unico recurso: uma
-- visita de qualquer dupla bloqueava todos os demais corretores e gerentes.
-- A disponibilidade e a confirmacao passam a proteger somente as pessoas que
-- realmente participam do compromisso.
BEGIN;

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
  ), estados AS (
    SELECT s.*,
      EXISTS (
        SELECT 1
        FROM public.f2_visita v
        JOIN public.f2_lead f ON f.id=v.funil_lead_id
        WHERE f.corretor_id=v_corretor
          AND (p_visita_id IS NULL OR (v.id IS DISTINCT FROM p_visita_id AND v.origem_visita_id IS DISTINCT FROM p_visita_id))
          AND v.status IN ('agendada','confirmada')
          AND pg_catalog.tstzrange(v.inicio_em,COALESCE(v.fim_em,v.inicio_em+interval '1 hour'),'[)')
              && pg_catalog.tstzrange(s.inicio,s.fim,'[)')
      ) OR EXISTS (
        SELECT 1 FROM public.visitas v
        WHERE v.corretor_id=v_corretor AND v.data=p_data
          AND v.id IS DISTINCT FROM p_visita_id
          AND lower(COALESCE(v.status,'')) IN ('agendada','confirmada')
          AND v.hora_inicio<(s.fim AT TIME ZONE 'America/Sao_Paulo')::time
          AND COALESCE(v.hora_fim,(v.hora_inicio+interval '1 hour')::time)>(s.inicio AT TIME ZONE 'America/Sao_Paulo')::time
      ) AS meu,
      p_gerente_id IS NOT NULL AND (
        EXISTS (
          SELECT 1 FROM public.f2_visita v
          WHERE v.gerente_id=p_gerente_id
            AND v.com_gerente IS TRUE
            AND v.status IN ('agendada','confirmada')
            AND (p_visita_id IS NULL OR (v.id IS DISTINCT FROM p_visita_id AND v.origem_visita_id IS DISTINCT FROM p_visita_id))
            AND pg_catalog.tstzrange(v.inicio_em,COALESCE(v.fim_em,v.inicio_em+interval '1 hour'),'[)')
                && pg_catalog.tstzrange(s.inicio,s.fim,'[)')
        ) OR EXISTS (
          SELECT 1 FROM public.visitas v
          WHERE v.gerente_id=p_gerente_id
            AND v.com_gerente IS TRUE
            AND v.data=p_data
            AND v.id IS DISTINCT FROM p_visita_id
            AND lower(COALESCE(v.status,'')) IN ('agendada','confirmada')
            AND v.hora_inicio<(s.fim AT TIME ZONE 'America/Sao_Paulo')::time
            AND COALESCE(v.hora_fim,(v.hora_inicio+interval '1 hour')::time)>(s.inicio AT TIME ZONE 'America/Sao_Paulo')::time
        )
      ) AS gerente_ocupado
    FROM slots s
  )
  SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'inicio',pg_catalog.to_char(inicio AT TIME ZONE 'America/Sao_Paulo','HH24:MI'),
      'fim',pg_catalog.to_char(fim AT TIME ZONE 'America/Sao_Paulo','HH24:MI'),
      'estado',CASE WHEN meu THEN 'meu' WHEN gerente_ocupado OR fim<=statement_timestamp() THEN 'indisponivel' ELSE 'disponivel' END
    ) ORDER BY hora
  ) INTO v_horarios
  FROM estados;

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

  -- Todos os gravadores usam a mesma ordem de locks. O lock da operacao
  -- serializa a confirmacao, sem transformar outro corretor em conflito.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('f2_visita:operacao',0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('f2_visita:corretor:'||v_corretor::text,0)
  );
  IF EXISTS (
    SELECT 1
    FROM public.f2_visita v
    JOIN public.f2_lead f ON f.id=v.funil_lead_id
    WHERE f.corretor_id=v_corretor
      AND v.id IS DISTINCT FROM NEW.id
      AND v.status IN ('agendada','confirmada')
      AND pg_catalog.tstzrange(v.inicio_em,COALESCE(v.fim_em,v.inicio_em+interval '1 hour'),'[)')
          && pg_catalog.tstzrange(NEW.inicio_em,v_fim,'[)')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23P01',MESSAGE='corretor_ocupado';
  END IF;

  IF NEW.com_gerente IS TRUE AND NEW.gerente_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('f2_visita:gerente:'||NEW.gerente_id::text,0)
    );
    IF EXISTS (
      SELECT 1
      FROM public.f2_visita v
      WHERE v.gerente_id=NEW.gerente_id
        AND v.com_gerente IS TRUE
        AND v.id IS DISTINCT FROM NEW.id
        AND v.status IN ('agendada','confirmada')
        AND pg_catalog.tstzrange(v.inicio_em,COALESCE(v.fim_em,v.inicio_em+interval '1 hour'),'[)')
            && pg_catalog.tstzrange(NEW.inicio_em,v_fim,'[)')
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23P01',MESSAGE='gerente_ocupado';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_bloquear_sobreposicao_visita() FROM PUBLIC,anon,authenticated;

-- O reagendamento usa a mesma unidade de concorrencia: corretor e, quando
-- solicitado, gerente. Outras duplas podem visitar em paralelo.
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
  v_corretor bigint;
  v_fim timestamptz:=COALESCE(p_fim_em,p_inicio_em+interval '1 hour');
  v_status text;
  v_resultado jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_visita_id IS NULL OR p_inicio_em IS NULL
     OR v_fim<=p_inicio_em OR p_inicio_em<=statement_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','dados_invalidos');
  END IF;

  SELECT v.* INTO v_visita
  FROM public.visitas v
  WHERE v.id=p_visita_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','visita_nao_encontrada');
  END IF;

  SELECT f.id,f.corretor_id INTO v_card_id,v_corretor
  FROM public.f2_lead f
  WHERE f.origem_negocio_id=v_visita.negocio_id AND f.descartado_em IS NULL;
  IF v_card_id IS NULL OR v_corretor IS NULL OR public.f2_pode_operar_lead(v_card_id) IS NOT TRUE THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  IF lower(COALESCE(v_visita.status,'')) NOT IN ('agendada','confirmada') THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','status_invalido');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('f2_visita:operacao',0)
  );
  SELECT v.id INTO v_f2_id
  FROM public.f2_visita v
  WHERE v.id=p_visita_id OR v.origem_visita_id=p_visita_id
  ORDER BY (v.id=p_visita_id) DESC
  LIMIT 1
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.f2_visita v
    JOIN public.f2_lead f ON f.id=v.funil_lead_id
    WHERE f.corretor_id=v_corretor
      AND v.id IS DISTINCT FROM v_f2_id
      AND v.origem_visita_id IS DISTINCT FROM p_visita_id
      AND v.status IN ('agendada','confirmada')
      AND pg_catalog.tstzrange(v.inicio_em,COALESCE(v.fim_em,v.inicio_em+interval '1 hour'),'[)')
          && pg_catalog.tstzrange(p_inicio_em,v_fim,'[)')
  ) OR EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE v.corretor_id=v_corretor
      AND v.id IS DISTINCT FROM p_visita_id
      AND lower(COALESCE(v.status,'')) IN ('agendada','confirmada')
      AND (v.data::timestamp+COALESCE(v.hora_inicio,time '09:00')) AT TIME ZONE 'America/Sao_Paulo'<v_fim
      AND (v.data::timestamp+COALESCE(v.hora_fim,(v.hora_inicio+interval '1 hour')::time,time '10:00')) AT TIME ZONE 'America/Sao_Paulo'>p_inicio_em
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','corretor_ocupado');
  END IF;

  IF COALESCE(v_visita.com_gerente,false) IS TRUE AND v_visita.gerente_id IS NOT NULL
     AND (EXISTS (
       SELECT 1 FROM public.f2_visita v
       WHERE v.gerente_id=v_visita.gerente_id
         AND v.com_gerente IS TRUE
         AND v.id IS DISTINCT FROM v_f2_id
         AND v.origem_visita_id IS DISTINCT FROM p_visita_id
         AND v.status IN ('agendada','confirmada')
         AND pg_catalog.tstzrange(v.inicio_em,COALESCE(v.fim_em,v.inicio_em+interval '1 hour'),'[)')
             && pg_catalog.tstzrange(p_inicio_em,v_fim,'[)')
     ) OR EXISTS (
       SELECT 1 FROM public.visitas v
       WHERE v.gerente_id=v_visita.gerente_id
         AND v.com_gerente IS TRUE
         AND v.id IS DISTINCT FROM p_visita_id
         AND lower(COALESCE(v.status,'')) IN ('agendada','confirmada')
         AND (v.data::timestamp+COALESCE(v.hora_inicio,time '09:00')) AT TIME ZONE 'America/Sao_Paulo'<v_fim
         AND (v.data::timestamp+COALESCE(v.hora_fim,(v.hora_inicio+interval '1 hour')::time,time '10:00')) AT TIME ZONE 'America/Sao_Paulo'>p_inicio_em
     )) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','gerente_ocupado');
  END IF;

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

  UPDATE public.f2_visita
  SET origem_visita_id=p_visita_id
  WHERE id=(v_resultado->>'id')::uuid;
  UPDATE public.visitas
  SET data=(p_inicio_em AT TIME ZONE 'America/Sao_Paulo')::date,
      hora_inicio=(p_inicio_em AT TIME ZONE 'America/Sao_Paulo')::time,
      hora_fim=(v_fim AT TIME ZONE 'America/Sao_Paulo')::time,
      atualizado_em=statement_timestamp()
  WHERE id=p_visita_id;

  RETURN pg_catalog.jsonb_build_object('ok',true,'id',p_visita_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_reagendar_visita(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f2_reagendar_visita(uuid,timestamptz,timestamptz) TO authenticated,service_role;

COMMIT;
