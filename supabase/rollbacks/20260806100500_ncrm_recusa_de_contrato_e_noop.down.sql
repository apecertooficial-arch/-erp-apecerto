-- Rollback inerte de proposito. Reverter faria a recusa de contrato voltar a
-- ser tratada como erro retentavel, gerando retry para algo que nunca vai
-- passar. Nao ha ganho em desfazer, so ruido.
SELECT 1;
