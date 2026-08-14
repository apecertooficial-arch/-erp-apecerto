-- Rollback: remove a migração por lote e a RLS da Sara para o corretor.
--
-- NÃO desfaz cards já migrados. Para reverter um lote específico, use o
-- registro em f2_config_audit (tipo='migracao') para identificar o grupo e
-- remova os f2_lead correspondentes manualmente — os negócios de origem nunca
-- foram alterados, então o CRM antigo continua íntegro.

BEGIN;

DROP FUNCTION IF EXISTS public.f2_migrar_lote(text, integer, boolean);
DROP POLICY IF EXISTS f2_sara_analise_corretor_select ON public.f2_sara_analise;

COMMIT;
