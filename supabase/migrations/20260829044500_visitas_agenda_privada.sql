-- Agenda privada e reserva atomica de visitas.
--
-- A interface mostra apenas estados anonimos de disponibilidade. Esta trava
-- fica junto do dado para impedir que duas confirmacoes concorrentes reservem
-- o mesmo corretor ou gerente, mesmo que ambas tenham visto o horario livre.
BEGIN;

ALTER TABLE public.f2_visita
  ADD COLUMN IF NOT EXISTS fim_em timestamptz,
  ADD COLUMN IF NOT EXISTS empreendimento_id uuid REFERENCES public.empreendimentos(id),
  ADD COLUMN IF NOT EXISTS unidade text,
  ADD COLUMN IF NOT EXISTS com_gerente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gerente_id bigint REFERENCES public.gerentes(id);

CREATE INDEX IF NOT EXISTS f2_visita_gerente_inicio_ativo_idx
  ON public.f2_visita(gerente_id,inicio_em)
  WHERE com_gerente IS TRUE AND gerente_id IS NOT NULL
    AND status IN ('agendada','confirmada');

CREATE INDEX IF NOT EXISTS f2_visita_inicio_ativo_idx
  ON public.f2_visita(inicio_em)
  WHERE status IN ('agendada','confirmada');

CREATE INDEX IF NOT EXISTS visitas_data_inicio_ativo_idx
  ON public.visitas(data,hora_inicio)
  WHERE lower(COALESCE(status,'')) IN ('agendada','confirmada');

-- Retorna somente hora e estado. SECURITY DEFINER é intencional: a função
-- precisa enxergar conflitos de toda a operação, mas jamais devolve as linhas,
-- identidades ou quantidades que produziram o bloqueio.
DROP FUNCTION IF EXISTS public.f2_disponibilidade_visitas(uuid,date,bigint);
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
          AND v.inicio_em<s.fim
          AND COALESCE(v.fim_em,v.inicio_em+interval '1 hour')>s.inicio
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
      EXISTS (
        SELECT 1 FROM public.f2_visita v
        WHERE v.status IN ('agendada','confirmada')
          AND (p_visita_id IS NULL OR (v.id IS DISTINCT FROM p_visita_id AND v.origem_visita_id IS DISTINCT FROM p_visita_id))
          AND v.inicio_em<s.fim
          AND COALESCE(v.fim_em,v.inicio_em+interval '1 hour')>s.inicio
          AND pg_catalog.tstzrange(v.inicio_em,COALESCE(v.fim_em,v.inicio_em+interval '1 hour'),'[)')
              && pg_catalog.tstzrange(s.inicio,s.fim,'[)')
      ) OR EXISTS (
        SELECT 1 FROM public.visitas v
        WHERE v.data=p_data
          AND v.id IS DISTINCT FROM p_visita_id
          AND lower(COALESCE(v.status,'')) IN ('agendada','confirmada')
          AND v.hora_inicio<(s.fim AT TIME ZONE 'America/Sao_Paulo')::time
          AND COALESCE(v.hora_fim,(v.hora_inicio+interval '1 hour')::time)>(s.inicio AT TIME ZONE 'America/Sao_Paulo')::time
      ) AS ocupado
    FROM slots s
  )
  SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'inicio',pg_catalog.to_char(inicio AT TIME ZONE 'America/Sao_Paulo','HH24:MI'),
      'fim',pg_catalog.to_char(fim AT TIME ZONE 'America/Sao_Paulo','HH24:MI'),
      'estado',CASE WHEN meu THEN 'meu' WHEN ocupado OR fim<=statement_timestamp() THEN 'indisponivel' ELSE 'disponivel' END
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

REVOKE ALL ON FUNCTION public.f2_disponibilidade_visitas(uuid,date,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_disponibilidade_visitas(uuid,date,bigint,uuid) TO authenticated,service_role;

-- Reagenda as duas representações ainda existentes da visita na mesma
-- transação. O calendário usa o id legado; o CRM usa f2_visita. Nenhuma delas
-- pode ficar com um horário diferente da outra.
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

  SELECT f.id INTO v_card_id
  FROM public.f2_lead f
  WHERE f.origem_negocio_id=v_visita.negocio_id AND f.descartado_em IS NULL;
  IF v_card_id IS NULL OR public.f2_pode_operar_lead(v_card_id) IS NOT TRUE THEN
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
    WHERE v.id IS DISTINCT FROM v_f2_id
      AND v.origem_visita_id IS DISTINCT FROM p_visita_id
      AND v.status IN ('agendada','confirmada')
      AND v.inicio_em<v_fim
      AND COALESCE(v.fim_em,v.inicio_em+interval '1 hour')>p_inicio_em
  ) OR EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE v.id IS DISTINCT FROM p_visita_id
      AND lower(COALESCE(v.status,'')) IN ('agendada','confirmada')
      AND (v.data::timestamp+COALESCE(v.hora_inicio,time '09:00')) AT TIME ZONE 'America/Sao_Paulo'<v_fim
      AND (v.data::timestamp+COALESCE(v.hora_fim,(v.hora_inicio+interval '1 hour')::time,time '10:00')) AT TIME ZONE 'America/Sao_Paulo'>p_inicio_em
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'erro','horario_ocupado');
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

REVOKE ALL ON FUNCTION public.f2_reagendar_visita(uuid,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_reagendar_visita(uuid,timestamptz,timestamptz) TO authenticated,service_role;

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

  -- A ordem fixa (operação, corretor e gerente) evita deadlock entre reservas.
  -- O primeiro lock fecha a corrida entre dois corretores que viram o mesmo
  -- horário livre ao mesmo tempo.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('f2_visita:operacao',0)
  );
  IF EXISTS (
    SELECT 1
    FROM public.f2_visita v
    WHERE v.id<>NEW.id
      AND v.status IN ('agendada','confirmada')
      AND v.inicio_em<v_fim
      AND COALESCE(v.fim_em,v.inicio_em+interval '1 hour')>NEW.inicio_em
      AND pg_catalog.tstzrange(v.inicio_em,COALESCE(v.fim_em,v.inicio_em+interval '1 hour'),'[)')
          && pg_catalog.tstzrange(NEW.inicio_em,v_fim,'[)')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23P01',MESSAGE='horario_ocupado';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('f2_visita:corretor:'||v_corretor::text,0)
  );
  IF EXISTS (
    SELECT 1
    FROM public.f2_visita v
    JOIN public.f2_lead f ON f.id=v.funil_lead_id
    WHERE f.corretor_id=v_corretor
      AND v.id<>NEW.id
      AND v.status IN ('agendada','confirmada')
      AND v.inicio_em<v_fim
      AND COALESCE(v.fim_em,v.inicio_em+interval '1 hour')>NEW.inicio_em
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
        AND v.id<>NEW.id
        AND v.status IN ('agendada','confirmada')
        AND v.inicio_em<v_fim
        AND COALESCE(v.fim_em,v.inicio_em+interval '1 hour')>NEW.inicio_em
        AND pg_catalog.tstzrange(v.inicio_em,COALESCE(v.fim_em,v.inicio_em+interval '1 hour'),'[)')
            && pg_catalog.tstzrange(NEW.inicio_em,v_fim,'[)')
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23P01',MESSAGE='gerente_ocupado';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS f2_visita_sem_sobreposicao ON public.f2_visita;
CREATE TRIGGER f2_visita_sem_sobreposicao
BEFORE INSERT OR UPDATE OF funil_lead_id,inicio_em,fim_em,status,com_gerente,gerente_id
ON public.f2_visita
FOR EACH ROW EXECUTE FUNCTION public.f2_bloquear_sobreposicao_visita();

REVOKE ALL ON FUNCTION public.f2_bloquear_sobreposicao_visita() FROM PUBLIC,anon,authenticated;

COMMIT;
