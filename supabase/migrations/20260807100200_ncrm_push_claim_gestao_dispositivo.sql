-- =============================================================================
-- CLAIM/LEASE, PUSH DE GESTAO, LOGOUT POR DISPOSITIVO E DEEP-LINK VALIDADO
--
-- Quatro correcoes sobre o Web Push recem-versionado, antes de qualquer
-- aplicacao em producao.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. DEEP-LINK: rota canonica, validada, sem dado de cliente
--
-- Nao da para validar contra as rotas finais do aplicativo, que estao sendo
-- construidas em paralelo. O que da para garantir e o contrato: caminho interno,
-- prefixo reconhecido, sem URL externa e sem dado pessoal embutido. Se a rota
-- final divergir, muda-se o builder num lugar so.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ncrm_private.deep_link_valido(p_link text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
  SELECT p_link IS NOT NULL
     AND left(p_link, 1) = '/'            -- caminho interno, sempre
     AND left(p_link, 2) <> '//'          -- '//host' e URL externa disfarcada
     AND position('://' in p_link) = 0    -- sem esquema
     AND position('@' in p_link) = 0      -- sem credencial nem e-mail
     AND length(p_link) <= 200
     -- prefixos reconhecidos; qualquer outro destino e rota inventada
     AND (p_link ~ '^/negocio/[0-9]+(/[a-z-]+)?$'
       OR p_link ~ '^/agenda(/[0-9a-f-]+)?$'
       OR p_link ~ '^/gestao/[a-z-]+$'
       OR p_link ~ '^/meu-dia$'
       OR p_link ~ '^/notificacoes$')
     -- nada que pareca telefone ou nome de pessoa no destino
     AND p_link !~ '[0-9]{8,}'
     AND p_link !~ '[A-Za-zÀ-ÿ]{3,}\s+[A-Za-zÀ-ÿ]{3,}';
$fn$;

COMMENT ON FUNCTION ncrm_private.deep_link_valido(text) IS
  'Contrato do deep-link: caminho interno, prefixo reconhecido, sem URL externa e sem dado pessoal.';

REVOKE ALL ON FUNCTION ncrm_private.deep_link_valido(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.deep_link_valido(text) TO service_role;

-- Limpa qualquer destino que nao respeite o contrato antes de impor o CHECK.
UPDATE public.ncrm_notificacao
   SET deep_link = NULL
 WHERE deep_link IS NOT NULL AND NOT ncrm_private.deep_link_valido(deep_link);

ALTER TABLE public.ncrm_notificacao DROP CONSTRAINT IF EXISTS ck_ncrm_notif_deep_link;
ALTER TABLE public.ncrm_notificacao ADD CONSTRAINT ck_ncrm_notif_deep_link
  CHECK (deep_link IS NULL OR ncrm_private.deep_link_valido(deep_link));

UPDATE public.ncrm_push_fila
   SET deep_link = NULL
 WHERE deep_link IS NOT NULL AND NOT ncrm_private.deep_link_valido(deep_link);

ALTER TABLE public.ncrm_push_fila DROP CONSTRAINT IF EXISTS ck_ncrm_push_deep_link;
ALTER TABLE public.ncrm_push_fila ADD CONSTRAINT ck_ncrm_push_deep_link
  CHECK (deep_link IS NULL OR ncrm_private.deep_link_valido(deep_link));

-- ---------------------------------------------------------------------------
-- 2. CLAIM/LEASE: dois workers nao mandam o mesmo aviso
-- ---------------------------------------------------------------------------
ALTER TABLE public.ncrm_push_fila
  ADD COLUMN IF NOT EXISTS processando_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS lease_ate      timestamptz NULL,
  ADD COLUMN IF NOT EXISTS tentativa_id   uuid NULL,
  ADD COLUMN IF NOT EXISTS worker_id      text NULL;

COMMENT ON COLUMN public.ncrm_push_fila.lease_ate IS
  'Ate quando a reserva vale. Passou disso, o item volta para a fila sozinho.';
COMMENT ON COLUMN public.ncrm_push_fila.tentativa_id IS
  'Identifica a reserva. O resultado so e aceito com o id da tentativa vigente.';

ALTER TABLE public.ncrm_push_fila DROP CONSTRAINT IF EXISTS ck_push_fila_status;
ALTER TABLE public.ncrm_push_fila ADD CONSTRAINT ck_push_fila_status
  CHECK (status IN ('pendente','processando','entregue','descartado'));

DROP INDEX IF EXISTS public.ix_ncrm_push_fila_pendente;
CREATE INDEX IF NOT EXISTS ix_ncrm_push_fila_pendente
  ON public.ncrm_push_fila (proxima_em NULLS FIRST, id) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS ix_ncrm_push_fila_lease
  ON public.ncrm_push_fila (lease_ate) WHERE status = 'processando';

-- Devolve a fila o que ficou reservado por um worker que nao voltou.
CREATE OR REPLACE FUNCTION ncrm_private.push_liberar_leases()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_n int;
BEGIN
  UPDATE public.ncrm_push_fila
     SET status='pendente', processando_em=NULL, lease_ate=NULL,
         tentativa_id=NULL, worker_id=NULL,
         ultimo_erro = coalesce(ultimo_erro,'lease_expirado')
   WHERE status='processando' AND lease_ate IS NOT NULL AND lease_ate < now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.push_liberar_leases() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.push_liberar_leases() TO service_role;

-- Reserva atomica. SKIP LOCKED faz cada worker levar itens diferentes sem
-- esperar pelo outro; sem isso, dois workers concorrentes leriam a mesma linha.
CREATE OR REPLACE FUNCTION ncrm_private.push_reservar(
  p_worker_id text, p_limite int DEFAULT 50, p_lease_seg int DEFAULT 120
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_tentativa uuid := gen_random_uuid();
BEGIN
  PERFORM ncrm_private.push_liberar_leases();

  RETURN (
    WITH reservados AS (
      SELECT id FROM public.ncrm_push_fila
       WHERE status = 'pendente' AND (proxima_em IS NULL OR proxima_em <= now())
       ORDER BY id
       LIMIT GREATEST(LEAST(p_limite, 200), 1)
       FOR UPDATE SKIP LOCKED
    ), marcados AS (
      UPDATE public.ncrm_push_fila f
         SET status='processando', processando_em=now(),
             lease_ate = now() + make_interval(secs => GREATEST(LEAST(p_lease_seg, 600), 30)),
             tentativa_id = v_tentativa,
             worker_id = left(coalesce(p_worker_id,'desconhecido'), 60)
        FROM reservados r WHERE f.id = r.id
      RETURNING f.*
    )
    SELECT jsonb_build_object(
      'ok', true, 'tentativa_id', v_tentativa,
      'itens', COALESCE(jsonb_agg(jsonb_build_object(
        'fila_id', m.id, 'tentativa_id', m.tentativa_id,
        'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
        'titulo', m.titulo, 'corpo', m.corpo, 'deep_link', m.deep_link,
        'tipo', m.tipo, 'tentativas', m.tentativas)), '[]'::jsonb))
      FROM marcados m
      JOIN public.ncrm_push_subscription s
        ON s.id = m.subscription_id AND s.revogada_em IS NULL);
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.push_reservar(text,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.push_reservar(text,int,int) TO service_role;

COMMENT ON FUNCTION ncrm_private.push_reservar(text,int,int) IS
  'Reserva itens com FOR UPDATE SKIP LOCKED. O worker so recebe o que conseguiu reservar.';

-- Resultado agora exige o id da reserva: worker atrasado nao conclui item que
-- ja foi reprocessado por outro.
CREATE OR REPLACE FUNCTION ncrm_private.push_resultado(
  p_fila_id bigint, p_ok boolean, p_http_status int DEFAULT NULL,
  p_erro text DEFAULT NULL, p_tentativa_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_sub bigint; v_tent int; v_tid uuid; v_status text;
BEGIN
  SELECT subscription_id, tentativas, tentativa_id, status
    INTO v_sub, v_tent, v_tid, v_status
    FROM public.ncrm_push_fila WHERE id = p_fila_id FOR UPDATE;
  IF v_sub IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','item_inexistente'); END IF;

  -- Reserva vencida ou de outro worker: ignora sem tocar em nada. Isto e o que
  -- torna o retry idempotente do ponto de vista de quem chega atrasado.
  IF p_tentativa_id IS NOT NULL AND v_tid IS DISTINCT FROM p_tentativa_id THEN
    RETURN jsonb_build_object('ok',true,'status','ignorado_reserva_expirada');
  END IF;
  IF v_status IN ('entregue','descartado') THEN
    RETURN jsonb_build_object('ok',true,'status','ja_concluido');
  END IF;

  IF p_ok THEN
    UPDATE public.ncrm_push_fila
       SET status='entregue', entregue_em=now(), tentativas=v_tent+1,
           proxima_em=NULL, lease_ate=NULL, processando_em=NULL
     WHERE id = p_fila_id;
    UPDATE public.ncrm_push_subscription
       SET ultimo_sucesso_em=now(), falhas_seguidas=0, atualizado_em=now()
     WHERE id = v_sub;
    RETURN jsonb_build_object('ok',true,'status','entregue');
  END IF;

  IF p_http_status IN (404, 410) THEN
    UPDATE public.ncrm_push_subscription
       SET revogada_em=now(), revogada_motivo='endpoint_expirado', atualizado_em=now()
     WHERE id = v_sub AND revogada_em IS NULL;
    UPDATE public.ncrm_push_fila
       SET status='descartado', tentativas=v_tent+1, lease_ate=NULL, processando_em=NULL,
           ultimo_erro=left(coalesce(p_erro,'endpoint_expirado'),200), proxima_em=NULL
     WHERE id = p_fila_id;
    RETURN jsonb_build_object('ok',true,'status','endpoint_removido');
  END IF;

  UPDATE public.ncrm_push_subscription
     SET falhas_seguidas = falhas_seguidas + 1, atualizado_em = now() WHERE id = v_sub;
  UPDATE public.ncrm_push_subscription
     SET revogada_em=now(), revogada_motivo='falhas_seguidas', atualizado_em=now()
   WHERE id = v_sub AND revogada_em IS NULL AND falhas_seguidas >= 10;

  IF v_tent + 1 >= 3 THEN
    UPDATE public.ncrm_push_fila
       SET status='descartado', tentativas=v_tent+1, lease_ate=NULL, processando_em=NULL,
           ultimo_erro=left(coalesce(p_erro,'falha'),200), proxima_em=NULL
     WHERE id = p_fila_id;
    RETURN jsonb_build_object('ok',true,'status','descartado_apos_3_tentativas');
  END IF;

  UPDATE public.ncrm_push_fila
     SET status='pendente', tentativas=v_tent+1, lease_ate=NULL, processando_em=NULL,
         tentativa_id=NULL, ultimo_erro=left(coalesce(p_erro,'falha'),200),
         proxima_em = now() + make_interval(mins => 5 * (v_tent + 1))
   WHERE id = p_fila_id;
  RETURN jsonb_build_object('ok',true,'status','retry_agendado');
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.push_resultado(bigint,boolean,int,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.push_resultado(bigint,boolean,int,text,uuid) TO service_role;

-- A leitura sem reserva sai de cena: existia so enquanto nao havia claim.
DROP FUNCTION IF EXISTS ncrm_private.push_proximos(int);
DROP FUNCTION IF EXISTS ncrm_private.push_resultado(bigint,boolean,int,text);

-- ---------------------------------------------------------------------------
-- 3. PUSH PARA GESTAO
--
-- lead_sem_corretor e escalonamento sao exatamente os casos em que ninguem esta
-- olhando -- e eram os unicos que nao chegavam a ninguem, porque a fila so
-- atendia publico corretor. Destinatario e quem tem papel de gestao, nunca todo
-- usuario autenticado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ncrm_private.push_enfileirar(p_limite int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_corretor int := 0; v_gestao int := 0;
BEGIN
  -- a) notificacoes do corretor dono do atendimento
  INSERT INTO public.ncrm_push_fila
    (subscription_id, notificacao_id, idempotency_key, titulo, corpo, deep_link, tipo)
  SELECT s.id, n.id, 'notif:'||n.id::text,
         n.titulo,
         CASE n.tipo
           WHEN 'cliente_respondeu' THEN 'Um cliente respondeu'
           WHEN 'primeira_abordagem_pendente' THEN 'Um lead novo esta esperando'
           ELSE 'Abra o aplicativo para ver'
         END,
         n.deep_link, n.tipo
    FROM public.ncrm_notificacao n
    JOIN public.corretores c ON c.id = n.corretor_id
    JOIN public.ncrm_push_subscription s ON s.usuario_id = c.usuario_id AND s.revogada_em IS NULL
   WHERE n.resolvida_em IS NULL AND n.vista_em IS NULL
     AND n.prioridade = 1 AND n.publico = 'corretor'
     AND n.criada_em > now() - interval '1 hour'
   LIMIT GREATEST(p_limite, 1)
  ON CONFLICT (subscription_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_corretor = ROW_COUNT;

  -- b) notificacoes de gestao, para quem responde pela operacao
  INSERT INTO public.ncrm_push_fila
    (subscription_id, notificacao_id, idempotency_key, titulo, corpo, deep_link, tipo)
  SELECT s.id, n.id, 'notif:'||n.id::text,
         n.titulo,
         CASE n.tipo
           WHEN 'lead_sem_corretor' THEN 'Um atendimento esta sem corretor'
           WHEN 'escalonamento' THEN 'Um atendimento parou'
           WHEN 'falha_sincronizacao' THEN 'Uma conversa nao entrou no CRM'
           ELSE 'Abra o aplicativo para ver'
         END,
         n.deep_link, n.tipo
    FROM public.ncrm_notificacao n
    JOIN public.usuarios u ON coalesce(u.ativo, true)
                          AND u.role IN ('admin','diretor','gerente')
    JOIN public.ncrm_push_subscription s ON s.usuario_id = u.id AND s.revogada_em IS NULL
   WHERE n.resolvida_em IS NULL AND n.vista_em IS NULL
     AND n.prioridade = 1 AND n.publico = 'gestao'
     AND n.criada_em > now() - interval '1 hour'
   LIMIT GREATEST(p_limite, 1)
  ON CONFLICT (subscription_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_gestao = ROW_COUNT;

  -- Notificacao ja vista no aplicativo nao precisa mais tocar o celular.
  UPDATE public.ncrm_push_fila f
     SET status = 'descartado', ultimo_erro = 'ja_vista_no_app'
    FROM public.ncrm_notificacao n
   WHERE n.id = f.notificacao_id AND f.status = 'pendente'
     AND (n.vista_em IS NOT NULL OR n.resolvida_em IS NOT NULL);

  RETURN jsonb_build_object('ok', true, 'corretor', v_corretor, 'gestao', v_gestao,
                            'enfileiradas', v_corretor + v_gestao);
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.push_enfileirar(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.push_enfileirar(int) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. LOGOUT POR DISPOSITIVO
--
-- Sair do celular nao pode desligar o Push do notebook. Quatro intencoes
-- distintas, cada uma com seu nome.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ncrm_push_sair_deste_dispositivo(p_endpoint text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_n int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF coalesce(btrim(p_endpoint),'') = '' THEN
    RETURN jsonb_build_object('ok',false,'erro','endpoint_obrigatorio');
  END IF;

  UPDATE public.ncrm_push_subscription
     SET revogada_em=now(), revogada_motivo='logout', atualizado_em=now()
   WHERE usuario_id = v_uid AND revogada_em IS NULL AND endpoint = p_endpoint;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'revogadas', v_n,
    'observacao', 'outros dispositivos deste usuario continuam recebendo');
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_push_sair_deste_dispositivo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_push_sair_deste_dispositivo(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ncrm_push_sair_de_todos()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_n int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  UPDATE public.ncrm_push_subscription
     SET revogada_em=now(), revogada_motivo='logout', atualizado_em=now()
   WHERE usuario_id = v_uid AND revogada_em IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'revogadas', v_n);
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_push_sair_de_todos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_push_sair_de_todos() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ncrm_push_remover_dispositivo(p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_n int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  -- o id vem da lista do proprio usuario, e o usuario_id confere de novo aqui
  UPDATE public.ncrm_push_subscription
     SET revogada_em=now(), revogada_motivo='usuario', atualizado_em=now()
   WHERE id = p_id AND usuario_id = v_uid AND revogada_em IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN jsonb_build_object('ok',false,'erro','dispositivo_nao_encontrado'); END IF;
  RETURN jsonb_build_object('ok', true, 'revogadas', v_n);
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_push_remover_dispositivo(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_push_remover_dispositivo(bigint) TO authenticated, service_role;

-- A RPC generica sai: o nome nao dizia qual das quatro intencoes era.
DROP FUNCTION IF EXISTS public.ncrm_push_revogar(text,text);

-- ---------------------------------------------------------------------------
-- 5. Liberacao de lease tambem por cron, para fila nao ficar presa se o worker
--    morrer entre a reserva e o resultado.
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron ausente (harness); agendamento ignorado'; RETURN;
  END IF;
  PERFORM cron.unschedule('ncrm_push_liberar_leases')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ncrm_push_liberar_leases');
  PERFORM cron.schedule('ncrm_push_liberar_leases', '*/2 * * * *',
                        'SELECT ncrm_private.push_liberar_leases();');
END $cron$;
