-- Incidente apenas: policies/configuração devem vir do snapshot do preflight.
\if :{?PRODUTOS_STORAGE_SNAPSHOT_RESTORE_SQL}
  \ir :PRODUTOS_STORAGE_SNAPSHOT_RESTORE_SQL
\else
  \warn 'Rollback abortado: forneça PRODUTOS_STORAGE_SNAPSHOT_RESTORE_SQL do preflight desta execução.'
  \quit 3
\endif
