-- Incidente apenas. Reabre o contrato legado e exige snapshot prévio de ACL.
\if :{?PRODUTOS_ACL_SNAPSHOT_RESTORE_SQL}
  \ir :PRODUTOS_ACL_SNAPSHOT_RESTORE_SQL
\else
  \warn 'Rollback abortado: forneça PRODUTOS_ACL_SNAPSHOT_RESTORE_SQL do preflight desta execução.'
  \quit 3
\endif
