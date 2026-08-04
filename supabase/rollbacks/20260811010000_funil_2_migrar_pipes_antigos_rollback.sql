-- Rollback lógico da promoção do Funil 2.0.
-- Atenção: remove somente cópias que receberam o evento canônico desta
-- migration; os negócios, leads, visitas e vendas originais não são tocados.
BEGIN;
SET LOCAL lock_timeout = '5s';

DELETE FROM public.f2_lead f
WHERE EXISTS (
  SELECT 1 FROM public.f2_evento e
  WHERE e.funil_lead_id=f.id AND e.titulo='Migrado dos pipes antigos'
);

CREATE TRIGGER f2_lead_limite_dois BEFORE INSERT ON public.f2_lead
FOR EACH ROW EXECUTE FUNCTION public.f2_limitar_dois_leads();

COMMIT;
