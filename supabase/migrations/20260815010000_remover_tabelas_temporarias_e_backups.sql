-- Remove artefatos de migrações e diagnósticos já concluídos.
-- Nenhuma tabela operacional, lead, negócio, histórico, recall ou pesca entra
-- nesta lista. Deliberadamente sem CASCADE: uma dependência nova deve abortar
-- a migration em vez de ser apagada por consequência.

drop table if exists public._mig_pipe2_to_funil20_bkp;
drop table if exists public._perf_baseline;
drop table if exists public._view_backup;
drop table if exists public.mig_corretor_map;
drop table if exists public.mig_pipe_map;
drop table if exists public.ncrm_funcao_legada_backup;
drop table if exists public.ncrm_funcao_legada_esperada;
drop table if exists public.ncrm_operacao_v4_backup;
drop table if exists public.ncrm_saida_humana_continuidade_backup;
drop table if exists public.ncrm_sara_treinamento_backup;
drop table if exists public.negocios_dup_backup_20260721;
drop table if exists public.visitas_gerente_backup_20260721;
