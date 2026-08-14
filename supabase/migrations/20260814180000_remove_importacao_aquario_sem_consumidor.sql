-- Importação antiga não possui interface nem consumidor. A base histórica de
-- recall existente permanece intacta; nenhuma linha de leads/negocios é tocada.
DROP FUNCTION IF EXISTS public.aquario_importar(jsonb);
