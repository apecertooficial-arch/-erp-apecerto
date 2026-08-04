-- Rollback: remove a protecao do dono do lead do SLA.
--
-- NAO RECOMENDADO. Voltar isto faz o SLA poder tirar de um corretor um lead com
-- venda em processo, visita agendada ou visita realizada — foi exatamente o
-- incidente de 04/08/2026 com o negocio 18013.
--
-- Mantido apenas para simetria de versionamento. Se realmente precisar reverter,
-- prefira desligar o SLA inteiro, que e reversivel e nao redistribui nada:
--
--   UPDATE public.ncrm_sla_redistribuicao_config SET ativo = false;
--
-- Para restaurar a versao anterior da funcao, reaplique a migration
-- 20260806100000 (SLA primeira abordagem) que a definiu originalmente.

BEGIN;

DO $rb$
BEGIN
  RAISE EXCEPTION 'rollback_bloqueado: reverter esta migration reexpoe leads com visita agendada ao SLA. Desligue o SLA em ncrm_sla_redistribuicao_config ou reaplique 20260806100000 conscientemente.';
END
$rb$;

COMMIT;
