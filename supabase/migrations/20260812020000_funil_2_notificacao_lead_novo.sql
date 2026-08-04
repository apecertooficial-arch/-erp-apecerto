-- Funil 2.0 -> Central de Avisos -> Web Push.
--
-- O gerador historico observa ncrm_estado. Os cards oficiais do Funil 2.0
-- vivem em f2_lead, portanto um card novo podia nascer sem aviso. Este trigger
-- cria a mesma notificacao canônica no instante da distribuição e a resolve
-- assim que a primeira abordagem deixa de estar pendente.
BEGIN;

CREATE OR REPLACE FUNCTION ncrm_private.f2_notificar_primeira_abordagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_chave text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_chave := 'f2-novo:' || OLD.id::text;
    UPDATE public.ncrm_notificacao
       SET resolvida_em=COALESCE(resolvida_em,now()),
           resolvida_por=COALESCE(resolvida_por,'automatica_f2')
     WHERE chave=v_chave AND resolvida_em IS NULL;
    RETURN OLD;
  END IF;

  v_chave := 'f2-novo:' || NEW.id::text;
  IF NEW.etapa <> 'novo'
     OR NEW.ultima_acao_confirmada_em IS NOT NULL THEN
    UPDATE public.ncrm_notificacao
       SET resolvida_em=COALESCE(resolvida_em,now()),
           resolvida_por=COALESCE(resolvida_por,'automatica_f2')
     WHERE chave=v_chave AND resolvida_em IS NULL;
    RETURN NEW;
  END IF;

  IF NEW.corretor_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.ncrm_notificacao
    (chave,tipo,publico,prioridade,titulo,detalhe,negocio_id,corretor_id,deep_link,repeticoes)
  VALUES
    (v_chave,'primeira_abordagem_pendente','corretor',1,
     'Lead novo esperando o primeiro contato','Chame o cliente pelo WhatsApp',
     NEW.origem_negocio_id,NEW.corretor_id,'/negocio/'||NEW.origem_negocio_id,0)
  ON CONFLICT DO NOTHING;

  -- A função é idempotente por subscription + notification. Chamá-la aqui
  -- reduz a espera do corretor; os crons continuam como rede de segurança.
  BEGIN
    PERFORM ncrm_private.push_enfileirar(200);
  EXCEPTION WHEN OTHERS THEN
    -- Push jamais pode impedir a atribuição do lead. O cron repetirá o
    -- enfileiramento; o aviso dentro do app já está persistido.
    RAISE WARNING 'f2_push_enfileirar_falhou: %', SQLERRM;
  END;
  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION ncrm_private.f2_notificar_primeira_abordagem()
  FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS f2_lead_notificar_primeira_abordagem ON public.f2_lead;
CREATE TRIGGER f2_lead_notificar_primeira_abordagem
AFTER INSERT OR UPDATE OR DELETE
ON public.f2_lead
FOR EACH ROW EXECUTE FUNCTION ncrm_private.f2_notificar_primeira_abordagem();

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.f2_lead'::regclass
       AND tgname='f2_lead_notificar_primeira_abordagem'
       AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'trigger_f2_push_ausente'; END IF;
  IF has_function_privilege('anon','ncrm_private.f2_notificar_primeira_abordagem()','EXECUTE')
     OR has_function_privilege('authenticated','ncrm_private.f2_notificar_primeira_abordagem()','EXECUTE') THEN
    RAISE EXCEPTION 'trigger_f2_push_exposto';
  END IF;
END
$check$;

COMMIT;
