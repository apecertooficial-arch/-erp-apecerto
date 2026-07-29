-- CRM Nova Era — CRON do runner observer (Fase 3). PREPARADO, NÃO APLICADO.
-- ---------------------------------------------------------------------------
-- Agenda a invocação da Edge Function ncrm-sara-observer. Só faz efeito quando
-- (a) a Edge estiver IMPLANTADA, (b) pg_cron + pg_net existirem, (c) a config
-- estiver enabled=true. Nasce DESLIGADO (enabled=false) e o modo observer é o
-- kill-switch final: mesmo agendado, o runner não roda fora de observer.
-- Não aplicar nesta rodada (depende de deploy de Edge + segredos em Vault).

CREATE TABLE IF NOT EXISTS public.ncrm_sara_runner_config (
  id            boolean PRIMARY KEY DEFAULT true,
  enabled       boolean NOT NULL DEFAULT false,   -- nasce desligado
  edge_url      text NULL,                         -- URL da Edge Function
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid NULL,
  CONSTRAINT ck_ncrm_sara_runner_singleton CHECK (id = true)
);
INSERT INTO public.ncrm_sara_runner_config (id, enabled) VALUES (true, false) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ncrm_sara_runner_config FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_sara_runner_config ENABLE ROW LEVEL SECURITY;

-- Tick agendado: só dispara HTTP quando enabled=true, modo=observer e pg_net disponível.
-- O segredo (service key / cron secret) vem do Vault (não versionado).
CREATE OR REPLACE FUNCTION ncrm_private.sara_runner_tick()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_enabled boolean; v_url text; v_modo text; v_secret text;
BEGIN
  SELECT enabled, edge_url INTO v_enabled, v_url FROM public.ncrm_sara_runner_config WHERE id = true;
  SELECT modo INTO v_modo FROM public.ncrm_sara_config WHERE id = true;
  IF COALESCE(v_enabled,false) IS NOT TRUE OR v_url IS NULL OR COALESCE(v_modo,'observer') <> 'observer' THEN
    RETURN;  -- desligado, sem URL, ou fora de observer => não faz nada (kill-switch)
  END IF;
  -- Segredo do Vault (nome 'ncrm_sara_cron_secret'); ausente => aborta silenciosamente.
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'ncrm_sara_cron_secret' LIMIT 1;
  EXCEPTION WHEN others THEN v_secret := NULL; END;
  IF v_secret IS NULL THEN RETURN; END IF;
  -- Dispara a Edge (pg_net). O corpo do runner respeita novamente o kill-switch.
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
    body := jsonb_build_object('origem','pg_cron')
  );
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.sara_runner_tick() FROM PUBLIC;

-- Agendamento (a cada 5 min) SOMENTE se pg_cron existir. Inerte até enabled=true.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('ncrm_sara_observer', '*/5 * * * *', $$ SELECT ncrm_private.sara_runner_tick(); $$);
  END IF;
END $do$;
