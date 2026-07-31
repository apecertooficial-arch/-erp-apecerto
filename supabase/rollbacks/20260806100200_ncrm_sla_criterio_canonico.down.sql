-- Remove a regra canonica e a funcao de elegibilidade.
--
-- Nao restauramos a versao que decidia por "etapa = novo": foi ela que produziu
-- o julgamento errado. Voltar a ela reintroduziria o defeito. Sem a rotina, a
-- confirmacao de primeira saida simplesmente para — nada e medido errado.
--
-- Os dados nao sao tocados: primeira_saida_humana_em, sla_minutos e os eventos
-- ja gravados sao historico de atendimento, nao artefato de codigo.
DROP FUNCTION IF EXISTS ncrm_private.confirmar_primeiras_saidas(int);
DROP FUNCTION IF EXISTS ncrm_private.elegivel_sla_piloto(bigint,timestamptz);
