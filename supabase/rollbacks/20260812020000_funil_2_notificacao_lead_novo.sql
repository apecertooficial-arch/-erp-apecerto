BEGIN;

DROP TRIGGER IF EXISTS f2_lead_notificar_primeira_abordagem ON public.f2_lead;
DROP FUNCTION IF EXISTS ncrm_private.f2_notificar_primeira_abordagem();

UPDATE public.ncrm_notificacao
   SET resolvida_em=COALESCE(resolvida_em,now()),
       resolvida_por=COALESCE(resolvida_por,'rollback_f2_push')
 WHERE chave LIKE 'f2-novo:%' AND resolvida_em IS NULL;

COMMIT;
