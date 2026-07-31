-- =============================================================================
-- WEB PUSH: subscriptions, fila de entrega e revogacao
--
-- O que este backend NAO faz: assinar o payload com VAPID e falar com o servico
-- de push do navegador. Isso e trabalho de Edge Function, porque exige a chave
-- privada VAPID -- que fica em Secrets do servidor e nunca chega ao banco nem ao
-- aplicativo. O banco cuida de quem esta inscrito, do que precisa ser entregue e
-- de parar de tentar quando o endpoint morre.
--
-- PAYLOAD MINIMO, de proposito. A fila carrega titulo curto, tipo e deep_link.
-- Nao carrega nome de cliente, telefone nem conteudo de conversa: push aparece
-- na tela de bloqueio, e tela de bloqueio nao e lugar de dado de cliente. Quem
-- quiser o detalhe abre o aplicativo, onde ha sessao e RLS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ncrm_push_subscription (
  id             bigserial PRIMARY KEY,
  usuario_id     uuid NOT NULL,
  endpoint       text NOT NULL,
  p256dh         text NOT NULL,
  auth           text NOT NULL,
  user_agent     text NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  ultimo_sucesso_em timestamptz NULL,
  falhas_seguidas   integer NOT NULL DEFAULT 0,
  revogada_em    timestamptz NULL,
  revogada_motivo text NULL,
  CONSTRAINT ck_push_revog CHECK (revogada_motivo IS NULL OR revogada_motivo IN
    ('logout','endpoint_expirado','substituida','falhas_seguidas','usuario'))
);

-- Um endpoint identifica um dispositivo. O mesmo endpoint nao pode pertencer a
-- duas contas ao mesmo tempo: se reaparecer com outro usuario, a inscricao
-- anterior e revogada em vez de duplicada.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ncrm_push_endpoint_ativo
  ON public.ncrm_push_subscription (endpoint) WHERE revogada_em IS NULL;
CREATE INDEX IF NOT EXISTS ix_ncrm_push_usuario
  ON public.ncrm_push_subscription (usuario_id) WHERE revogada_em IS NULL;

REVOKE ALL ON public.ncrm_push_subscription FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_push_subscription ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ncrm_push_subscription IS
  'Inscricoes de Web Push por usuario e dispositivo. Escrita so por RPC; o app nunca toca na tabela.';

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ncrm_push_fila (
  id              bigserial PRIMARY KEY,
  subscription_id bigint NOT NULL REFERENCES public.ncrm_push_subscription(id) ON DELETE CASCADE,
  notificacao_id  bigint NULL REFERENCES public.ncrm_notificacao(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  titulo          text NOT NULL,
  corpo           text NULL,
  deep_link       text NULL,
  tipo            text NULL,
  tentativas      integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pendente',
  ultimo_erro     text NULL,
  proxima_em      timestamptz NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  entregue_em     timestamptz NULL,
  CONSTRAINT ck_push_fila_status CHECK (status IN ('pendente','entregue','descartado')),
  CONSTRAINT ck_push_fila_titulo CHECK (length(btrim(titulo)) BETWEEN 3 AND 120),
  CONSTRAINT ck_push_fila_corpo  CHECK (corpo IS NULL OR length(corpo) <= 180)
);

-- Idempotencia: a mesma notificacao para o mesmo dispositivo entra uma vez so,
-- mesmo que o gerador rode de novo antes da entrega.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ncrm_push_fila_idem
  ON public.ncrm_push_fila (subscription_id, idempotency_key);
CREATE INDEX IF NOT EXISTS ix_ncrm_push_fila_pendente
  ON public.ncrm_push_fila (proxima_em NULLS FIRST, id) WHERE status = 'pendente';

REVOKE ALL ON public.ncrm_push_fila FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_push_fila ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ncrm_push_fila IS
  'Fila de Web Push. Payload minimo de proposito: nada de nome, telefone ou conteudo de conversa.';

-- ---------------------------------------------------------------------------
-- Registrar ou atualizar a inscricao do dispositivo atual. O usuario vem de
-- auth.uid(), nunca do corpo da chamada: o app nao escolhe por quem se inscreve.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ncrm_push_registrar(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_id bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF coalesce(btrim(p_endpoint),'') = '' OR coalesce(btrim(p_p256dh),'') = ''
     OR coalesce(btrim(p_auth),'') = '' THEN
    RETURN jsonb_build_object('ok',false,'erro','inscricao_incompleta');
  END IF;
  IF length(p_endpoint) > 2000 THEN
    RETURN jsonb_build_object('ok',false,'erro','endpoint_invalido');
  END IF;

  -- Mesmo endpoint em outra conta: o dispositivo trocou de dono. A inscricao
  -- antiga sai, senao o usuario anterior continuaria recebendo push ali.
  UPDATE public.ncrm_push_subscription
     SET revogada_em = now(), revogada_motivo = 'substituida', atualizado_em = now()
   WHERE endpoint = p_endpoint AND revogada_em IS NULL AND usuario_id <> v_uid;

  INSERT INTO public.ncrm_push_subscription (usuario_id, endpoint, p256dh, auth, user_agent)
  VALUES (v_uid, p_endpoint, p_p256dh, p_auth, left(coalesce(p_user_agent,''), 300))
  ON CONFLICT (endpoint) WHERE revogada_em IS NULL DO UPDATE
    SET p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        falhas_seguidas = 0,
        atualizado_em = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'subscription_id', v_id);
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_push_registrar(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_push_registrar(text,text,text,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Revogar. Sem argumento revoga TODOS os dispositivos do usuario, que e o que o
-- logout precisa fazer: sair da conta e sair de todo lugar onde ela avisa.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ncrm_push_revogar(
  p_endpoint text DEFAULT NULL, p_motivo text DEFAULT 'usuario'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_n int; v_motivo text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  v_motivo := CASE WHEN p_motivo IN ('logout','usuario') THEN p_motivo ELSE 'usuario' END;

  UPDATE public.ncrm_push_subscription
     SET revogada_em = now(), revogada_motivo = v_motivo, atualizado_em = now()
   WHERE usuario_id = v_uid AND revogada_em IS NULL
     AND (p_endpoint IS NULL OR endpoint = p_endpoint);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'revogadas', v_n);
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_push_revogar(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_push_revogar(text,text) TO authenticated, service_role;

COMMENT ON FUNCTION public.ncrm_push_revogar(text,text) IS
  'Revoga inscricoes do proprio usuario. Sem endpoint, revoga todas: e o que o logout chama.';

-- ---------------------------------------------------------------------------
-- Enfileirar: transforma notificacao urgente e nao vista em push.
--
-- So prioridade 1 vira push. Prioridade 2 em diante e coisa para ver quando
-- abrir o aplicativo; empurrar tudo para a tela de bloqueio treina o corretor a
-- ignorar. E o fallback in-app ja existe: a notificacao esta la de qualquer jeito.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ncrm_private.push_enfileirar(p_limite int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_n int := 0;
BEGIN
  INSERT INTO public.ncrm_push_fila
    (subscription_id, notificacao_id, idempotency_key, titulo, corpo, deep_link, tipo)
  SELECT s.id, n.id, 'notif:'||n.id::text,
         n.titulo,
         -- corpo generico de proposito: sem nome, telefone ou conversa
         CASE n.tipo
           WHEN 'cliente_respondeu' THEN 'Um cliente respondeu'
           WHEN 'primeira_abordagem_pendente' THEN 'Um lead novo esta esperando'
           WHEN 'lead_sem_corretor' THEN 'Um atendimento esta sem corretor'
           WHEN 'escalonamento' THEN 'Um atendimento parou'
           ELSE 'Abra o aplicativo para ver'
         END,
         n.deep_link, n.tipo
    FROM public.ncrm_notificacao n
    JOIN public.corretores c ON c.id = n.corretor_id
    JOIN public.ncrm_push_subscription s ON s.usuario_id = c.usuario_id AND s.revogada_em IS NULL
   WHERE n.resolvida_em IS NULL
     AND n.vista_em IS NULL
     AND n.prioridade = 1
     AND n.publico = 'corretor'
     AND n.criada_em > now() - interval '1 hour'
   LIMIT GREATEST(p_limite, 1)
  ON CONFLICT (subscription_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Notificacao ja vista no aplicativo nao precisa mais tocar o celular.
  UPDATE public.ncrm_push_fila f
     SET status = 'descartado', ultimo_erro = 'ja_vista_no_app'
    FROM public.ncrm_notificacao n
   WHERE n.id = f.notificacao_id AND f.status = 'pendente'
     AND (n.vista_em IS NOT NULL OR n.resolvida_em IS NOT NULL);

  RETURN jsonb_build_object('ok', true, 'enfileiradas', v_n);
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.push_enfileirar(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.push_enfileirar(int) TO service_role;

-- ---------------------------------------------------------------------------
-- Resultado da entrega, reportado pela Edge Function que assina com VAPID.
-- 404 e 410 significam endpoint morto: revoga na hora, sem retry. Os demais
-- erros tem tres tentativas com espera crescente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ncrm_private.push_resultado(
  p_fila_id bigint, p_ok boolean, p_http_status int DEFAULT NULL, p_erro text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_sub bigint; v_tent int;
BEGIN
  SELECT subscription_id, tentativas INTO v_sub, v_tent
    FROM public.ncrm_push_fila WHERE id = p_fila_id;
  IF v_sub IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','item_inexistente'); END IF;

  IF p_ok THEN
    UPDATE public.ncrm_push_fila
       SET status='entregue', entregue_em=now(), tentativas=v_tent+1, proxima_em=NULL
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
       SET status='descartado', tentativas=v_tent+1,
           ultimo_erro=left(coalesce(p_erro,'endpoint_expirado'),200), proxima_em=NULL
     WHERE id = p_fila_id;
    RETURN jsonb_build_object('ok',true,'status','endpoint_removido');
  END IF;

  UPDATE public.ncrm_push_subscription
     SET falhas_seguidas = falhas_seguidas + 1, atualizado_em = now() WHERE id = v_sub;

  -- Dispositivo que falha muitas vezes seguidas parou de existir de fato.
  UPDATE public.ncrm_push_subscription
     SET revogada_em=now(), revogada_motivo='falhas_seguidas', atualizado_em=now()
   WHERE id = v_sub AND revogada_em IS NULL AND falhas_seguidas >= 10;

  IF v_tent + 1 >= 3 THEN
    UPDATE public.ncrm_push_fila
       SET status='descartado', tentativas=v_tent+1,
           ultimo_erro=left(coalesce(p_erro,'falha'),200), proxima_em=NULL
     WHERE id = p_fila_id;
    RETURN jsonb_build_object('ok',true,'status','descartado_apos_3_tentativas');
  END IF;

  UPDATE public.ncrm_push_fila
     SET tentativas=v_tent+1, ultimo_erro=left(coalesce(p_erro,'falha'),200),
         proxima_em = now() + make_interval(mins => 5 * (v_tent + 1))
   WHERE id = p_fila_id;
  RETURN jsonb_build_object('ok',true,'status','retry_agendado');
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.push_resultado(bigint,boolean,int,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.push_resultado(bigint,boolean,int,text) TO service_role;

-- ---------------------------------------------------------------------------
-- O que o worker consome. Devolve o segredo da inscricao porque quem chama e a
-- Edge Function com service_role: ela precisa de p256dh e auth para cifrar o
-- payload. Nenhum papel de usuario executa isto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ncrm_private.push_proximos(p_limite int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'fila_id', f.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'titulo', f.titulo, 'corpo', f.corpo, 'deep_link', f.deep_link, 'tipo', f.tipo,
      'tentativas', f.tentativas)), '[]'::jsonb)
    FROM (
      SELECT * FROM public.ncrm_push_fila
       WHERE status = 'pendente' AND (proxima_em IS NULL OR proxima_em <= now())
       ORDER BY id LIMIT GREATEST(p_limite, 1)
    ) f
    JOIN public.ncrm_push_subscription s ON s.id = f.subscription_id AND s.revogada_em IS NULL);
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.push_proximos(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.push_proximos(int) TO service_role;

COMMENT ON FUNCTION ncrm_private.push_proximos(int) IS
  'Consumido pela Edge Function que assina com VAPID. Devolve segredo de inscricao; apenas service_role executa.';

-- ---------------------------------------------------------------------------
-- Estado das minhas inscricoes, para a tela de ajustes. Sem endpoint nem chave:
-- devolver segredo para o cliente seria entregar de graca o que a RPC protege.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ncrm_push_meus_dispositivos()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  RETURN (SELECT jsonb_build_object('ok',true,
    'ativos', count(*),
    'itens', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'dispositivo', left(coalesce(user_agent,'desconhecido'), 60),
      'desde', criado_em, 'ultimo_sucesso', ultimo_sucesso_em) ORDER BY criado_em DESC), '[]'::jsonb))
    FROM public.ncrm_push_subscription
   WHERE usuario_id = v_uid AND revogada_em IS NULL);
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_push_meus_dispositivos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_push_meus_dispositivos() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enfileiramento automatico. A ENTREGA continua parada ate a Edge Function
-- existir e ser agendada, de proposito: a fila pode encher sem risco, e nada sai
-- enquanto ninguem consumir.
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron ausente (harness); agendamento ignorado'; RETURN;
  END IF;
  PERFORM cron.unschedule('ncrm_push_enfileirar')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ncrm_push_enfileirar');
  PERFORM cron.schedule('ncrm_push_enfileirar', '*/5 * * * *',
                        'SELECT ncrm_private.push_enfileirar(200);');
  RAISE NOTICE 'enfileiramento de push agendado; entrega depende da Edge Function';
END $cron$;
