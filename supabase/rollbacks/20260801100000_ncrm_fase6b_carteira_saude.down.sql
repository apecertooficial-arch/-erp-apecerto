-- ROLLBACK versionado da FASE 6 (PR B). Remove apenas objetos criados por esta migration.
-- Nenhum dado do CRM antigo, de leads, negócios, conversas, visitas, propostas ou vendas é tocado.
DROP FUNCTION IF EXISTS public.ncrm_saude_acao(text,text,text);
DROP FUNCTION IF EXISTS public.ncrm_saude();
DROP TABLE IF EXISTS public.ncrm_saude_acao_audit;

DROP FUNCTION IF EXISTS public.ncrm_migracao_rollback(bigint);
DROP FUNCTION IF EXISTS public.ncrm_migracao_aprovar(bigint,text,text,text,timestamptz,text);
DROP FUNCTION IF EXISTS public.ncrm_migracao_registrar_analise(jsonb);
DROP FUNCTION IF EXISTS public.ncrm_migracao_contexto(bigint[]);
DROP FUNCTION IF EXISTS public.ncrm_migracao_preview(jsonb);
DROP TABLE IF EXISTS public.ncrm_migracao_item;
DROP TABLE IF EXISTS public.ncrm_migracao_analise;

DROP FUNCTION IF EXISTS public.ncrm_treinamento_equipe();
DROP FUNCTION IF EXISTS public.ncrm_treinamento_marcar(text,boolean);
DROP FUNCTION IF EXISTS public.ncrm_treinamento_meu();
DROP TABLE IF EXISTS public.ncrm_treinamento;
