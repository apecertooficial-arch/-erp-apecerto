-- Presenca deterministica para distribuicao de leads.
--
-- A elegibilidade e calculada no instante da distribuicao. Os crons apenas
-- limpam estado e enviam avisos; nenhum registro historico de comparecimento
-- pode manter um corretor na fila depois que a confirmacao atual expirar.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

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

-- O cron passa a ser somente uma limpeza visual/operacional. Mesmo se ele
-- atrasar, a funcao acima continua recusando presenca vencida.
CREATE OR REPLACE FUNCTION public.presenca_derrubar_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE v_count integer;
BEGIN
  UPDATE public.corretores c
     SET online=false,
         no_escritorio=false
   WHERE (coalesce(c.online,false) OR coalesce(c.no_escritorio,false))
     AND (
       c.ultima_presenca IS NULL OR
       c.ultima_presenca <= now()-make_interval(mins=>public.regra_presenca_validade_min())
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$fn$;

-- Confirmacao gravada apenas pelo servico de borda, depois de validar o JWT e
-- comparar o IP observado pela infraestrutura com a lista configurada.
CREATE OR REPLACE FUNCTION public.presenca_registrar_segura(
  p_sub uuid,
  p_no_escritorio boolean,
  p_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_corretor bigint;
  v_local timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
  v_cfg public.presenca_config%ROWTYPE;
BEGIN
  SELECT c.id INTO v_corretor
    FROM public.corretores c
   WHERE c.usuario_id=p_sub AND coalesce(c.ativo,false)
   LIMIT 1;
  IF v_corretor IS NULL THEN
    RETURN jsonb_build_object('ok',false,'erro','corretor_nao_encontrado');
  END IF;

  INSERT INTO public.presenca_diagnostico(corretor_id,parametro_recebido,ip)
  VALUES(v_corretor,coalesce(p_no_escritorio,false)::text,left(coalesce(p_ip,''),60));

  IF coalesce(p_no_escritorio,false) IS NOT TRUE THEN
    UPDATE public.corretores
       SET online=false,no_escritorio=false
     WHERE id=v_corretor;
    RETURN jsonb_build_object('ok',false,'no_escritorio',false,'erro','fora_do_escritorio');
  END IF;

  UPDATE public.corretores
     SET online=true,no_escritorio=true,ultima_presenca=now()
   WHERE id=v_corretor;

  INSERT INTO public.presenca_estado(
    corretor_id,ultima_confirmacao,aguardando_desde,prazo_em,proxima_tentativa_em
  ) VALUES(v_corretor,now(),NULL,NULL,NULL)
  ON CONFLICT(corretor_id) DO UPDATE SET
    ultima_confirmacao=EXCLUDED.ultima_confirmacao,
    aguardando_desde=NULL,
    prazo_em=NULL,
    proxima_tentativa_em=NULL;

  SELECT * INTO v_cfg FROM public.presenca_config WHERE id=1;
  IF v_cfg.ativa
     AND extract(isodow from v_local)::integer=ANY(v_cfg.dias_semana)
     AND v_local::time BETWEEN v_cfg.hora_inicio AND v_cfg.hora_fim THEN
    INSERT INTO public.corretor_presencas(corretor_id,dia)
    VALUES(v_corretor,public.ncrm_dia_operacional(now()))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'no_escritorio',true,
    'validade_min',public.regra_presenca_validade_min()
  );
END
$fn$;
REVOKE ALL ON FUNCTION public.presenca_registrar_segura(uuid,boolean,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.presenca_registrar_segura(uuid,boolean,text)
  TO service_role;

-- A aplicacao pode conferir um IP sem receber a lista de IPs do escritorio.
CREATE OR REPLACE FUNCTION public.presenca_ip_confere(p_ip text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $fn$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND nullif(trim(p_ip),'') IS NOT NULL
     AND EXISTS(
       SELECT 1 FROM public.escritorio_config e
        WHERE e.id=1 AND trim(p_ip)=ANY(e.ips)
     )
$fn$;
REVOKE ALL ON FUNCTION public.presenca_ip_confere(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.presenca_ip_confere(text) TO authenticated,service_role;

-- Sair da fila precisa limpar as duas flags, nao apenas `online`.
CREATE OR REPLACE FUNCTION public.presenca_derrubar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE v_corretor bigint;
BEGIN
  SELECT c.id INTO v_corretor
    FROM public.corretores c
   WHERE c.usuario_id=(SELECT auth.uid());
  IF v_corretor IS NULL THEN RETURN jsonb_build_object('ok',false); END IF;

  UPDATE public.corretores
     SET online=false,no_escritorio=false
   WHERE id=v_corretor;
  INSERT INTO public.presenca_estado(corretor_id,ultima_confirmacao)
  VALUES(v_corretor,now())
  ON CONFLICT(corretor_id) DO UPDATE SET
    ultima_confirmacao=now(),aguardando_desde=NULL,prazo_em=NULL;
  RETURN jsonb_build_object('ok',true,'online',false,'no_escritorio',false);
END
$fn$;

-- Autoaprender IP a partir de duas pessoas na mesma rede e uma suposicao.
-- Presenca deterministica exige que a gestao cadastre explicitamente o IP.
DO $cron$
DECLARE v_job bigint;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname='escritorio-ip-autoaprender';
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;

  SELECT jobid INTO v_job FROM cron.job WHERE jobname='presenca_registrar_dia';
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;

  SELECT jobid INTO v_job FROM cron.job WHERE jobname='presenca_derrubar_expirados';
  IF v_job IS NULL THEN
    PERFORM cron.schedule(
      'presenca_derrubar_expirados','* * * * *',
      'select public.presenca_derrubar_expirados()'
    );
  ELSE
    PERFORM cron.alter_job(
      v_job,
      schedule:='* * * * *',
      command:='select public.presenca_derrubar_expirados()',
      active:=true
    );
  END IF;
END
$cron$;

-- Corrige imediatamente flags vencidas quando a migration for aplicada.
SELECT public.presenca_derrubar_expirados();

DO $check$
BEGIN
  IF EXISTS(
    SELECT 1 FROM cron.job
     WHERE jobname IN ('escritorio-ip-autoaprender','presenca_registrar_dia')
  ) THEN RAISE EXCEPTION 'cron_de_presenca_nao_deterministico_ainda_ativo'; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM cron.job
     WHERE jobname='presenca_derrubar_expirados' AND active
  ) THEN RAISE EXCEPTION 'limpeza_de_presenca_inativa'; END IF;
END
$check$;

COMMIT;
