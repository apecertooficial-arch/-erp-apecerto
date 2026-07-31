-- Volta ao estado anterior ao claim/lease.
--
-- O CHECK de deep-link e removido, mas os destinos ja gravados permanecem: eles
-- passaram na validacao e continuam validos.
DO $rb$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule('ncrm_push_liberar_leases')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ncrm_push_liberar_leases');
  END IF;
END $rb$;

-- Itens reservados voltam para a fila antes de a reserva deixar de existir.
UPDATE public.ncrm_push_fila
   SET status='pendente', processando_em=NULL, lease_ate=NULL, tentativa_id=NULL, worker_id=NULL
 WHERE status='processando';

DROP FUNCTION IF EXISTS public.ncrm_push_remover_dispositivo(bigint);
DROP FUNCTION IF EXISTS public.ncrm_push_sair_de_todos();
DROP FUNCTION IF EXISTS public.ncrm_push_sair_deste_dispositivo(text);
DROP FUNCTION IF EXISTS ncrm_private.push_reservar(text,int,int);
DROP FUNCTION IF EXISTS ncrm_private.push_liberar_leases();
DROP FUNCTION IF EXISTS ncrm_private.push_resultado(bigint,boolean,int,text,uuid);

ALTER TABLE public.ncrm_push_fila DROP CONSTRAINT IF EXISTS ck_ncrm_push_deep_link;
ALTER TABLE public.ncrm_notificacao DROP CONSTRAINT IF EXISTS ck_ncrm_notif_deep_link;

ALTER TABLE public.ncrm_push_fila DROP CONSTRAINT IF EXISTS ck_push_fila_status;
ALTER TABLE public.ncrm_push_fila ADD CONSTRAINT ck_push_fila_status
  CHECK (status IN ('pendente','entregue','descartado'));

DROP FUNCTION IF EXISTS ncrm_private.deep_link_valido(text);

-- As colunas de lease permanecem: sao aditivas e nao atrapalham.
