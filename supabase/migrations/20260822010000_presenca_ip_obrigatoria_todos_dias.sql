-- Acesso ao ERP fora do escritorio continua liberado, mas distribuicao de
-- lead novo exige IP/presenca atual em qualquer dia. Esta regra substitui a
-- excecao de fim de semana: trabalhar no aplicativo nao significa entrar na
-- roleta fora da rede autorizada.

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
BEGIN
  SELECT * INTO c FROM public.corretores WHERE id=p_corretor_id;
  IF c.id IS NULL OR coalesce(c.ativo,false) IS NOT TRUE THEN
    RETURN jsonb_build_object('elegivel',false,'motivo','corretor_inativo');
  END IF;

  SELECT * INTO cfg FROM public.ncrm_operacao_config WHERE id=true;
  v_validade := public.regra_presenca_validade_min();

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
DECLARE v_def text := pg_get_functiondef(
  'public.ncrm_corretor_elegibilidade(bigint,timestamptz)'::regprocedure
);
BEGIN
  IF position('fim_de_semana_sem_exigencia_presenca' IN v_def) > 0
     OR position('coalesce(c.no_escritorio,false)' IN v_def) = 0
     OR position('c.ultima_presenca > p_agora' IN v_def) = 0 THEN
    RAISE EXCEPTION 'regra_ip_todos_dias_nao_instalada';
  END IF;
END
$check$;

COMMIT;
