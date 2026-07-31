-- Rollback deliberadamente INERTE.
--
-- Desfazer esta migration significaria devolver a anon/authenticated o EXECUTE
-- sobre uma funcao de sistema que funciona como oraculo de quem esta no piloto.
-- Rollback de uma correcao de exposicao nao reabre a exposicao. Se for preciso
-- reverter, o caminho e uma migration nova, revisada, com justificativa.
--
-- Mantido como arquivo para o harness exercitar rollback e reaplicacao.
SELECT 1;
