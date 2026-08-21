-- No fim de semana a equipe trabalha na rua. A excecao e calculada no mesmo
-- ponto unico de elegibilidade, pelo fuso configurado, sem cron ou estado
-- paralelo. Somente a presenca fisica deixa de ser exigida; os demais bloqueios
-- operacionais continuam sendo aplicados.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.ncrm_corretor_elegibilidade(
  p_corretor_id bigint,
  p_agora timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  c public.corretores%ROWTYPE;
  cfg public.ncrm_operacao_config%ROWTYPE;
  apto boolean;
  conectado boolean;
  visita_pendente integer;
  suspenso_ate timestamptz;
  v_validade integer;
  v_fim_de_semana boolean;
BEGIN
  SELECT * INTO c FROM public.corretores WHERE id=p_corretor_id;
  IF c.id IS NULL OR coalesce(c.ativo,false) IS NOT TRUE THEN
    RETURN jsonb_build_object('elegivel',false,'motivo','corretor_inativo');
  END IF;

  SELECT * INTO cfg FROM public.ncrm_operacao_config WHERE id=true;
  v_validade := public.regra_presenca_validade_min();
  v_fim_de_semana := extract(
    isodow FROM p_agora AT TIME ZONE coalesce(cfg.timezone,'America/Sao_Paulo')
  ) IN (6,7);

  conectado := EXISTS(
    SELECT 1
      FROM public.instancias i
     WHERE i.corretor_id=c.id
       AND coalesce(i.ativa,true)
       AND coalesce(i.conectada,false)
       AND i.status_dapi='connected'
  );
  IF NOT conectado THEN
    RETURN jsonb_build_object('elegivel',false,'motivo','dapi_desconectada');
  END IF;

  SELECT max(s.fim_em) INTO suspenso_ate
    FROM public.ncrm_corretor_suspensao s
   WHERE s.corretor_id=c.id
     AND s.revogada_em IS NULL
     AND s.inicio_em<=p_agora
     AND s.fim_em>p_agora;
  IF suspenso_ate IS NOT NULL THEN
    RETURN jsonb_build_object('elegivel',false,'motivo','suspenso','ate',suspenso_ate);
  END IF;

  IF coalesce(cfg.exigir_feedback_visita,true) THEN
    SELECT count(*) INTO visita_pendente
      FROM public.visitas v
     WHERE v.corretor_id=c.id
       AND v.criado_em>=cfg.corte_feedback_visita
       AND v.status='realizada'
       AND v.resultado IS NULL
       AND (v.data+coalesce(nullif(v.hora_fim::text,''),nullif(v.hora_inicio::text,''),'18:00')::time)
             AT TIME ZONE cfg.timezone
           < p_agora-make_interval(mins=>cfg.feedback_visita_min);
    IF visita_pendente>0 THEN
      RETURN jsonb_build_object('elegivel',false,'motivo','feedback_visita_pendente');
    END IF;
  END IF;

  IF v_fim_de_semana THEN
    RETURN jsonb_build_object(
      'elegivel',true,
      'motivo','fim_de_semana_sem_exigencia_presenca',
      'timezone',coalesce(cfg.timezone,'America/Sao_Paulo')
    );
  END IF;

  apto := coalesce(c.no_escritorio,false)
      AND c.ultima_presenca IS NOT NULL
      AND c.ultima_presenca > p_agora-make_interval(mins=>v_validade);

  IF apto THEN
    RETURN jsonb_build_object(
      'elegivel',true,
      'motivo','presenca_atual_no_escritorio',
      'valida_ate',c.ultima_presenca+make_interval(mins=>v_validade)
    );
  END IF;

  RETURN jsonb_build_object(
    'elegivel',false,
    'motivo',CASE
      WHEN coalesce(c.no_escritorio,false) AND c.ultima_presenca IS NOT NULL
        THEN 'presenca_expirada'
      WHEN coalesce(c.online,false) THEN 'fora_da_rede_do_escritorio'
      ELSE 'presenca_nao_confirmada'
    END,
    'validade_min',v_validade
  );
END
$fn$;

DO $check$
BEGIN
  IF position(
    'fim_de_semana_sem_exigencia_presenca'
    IN pg_get_functiondef('public.ncrm_corretor_elegibilidade(bigint,timestamptz)'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'regra_fim_de_semana_nao_instalada';
  END IF;
END
$check$;

COMMIT;
