-- Remove o nome intermediario criado durante a implantacao. Ele nunca fez parte
-- do contrato aceito por ncrm_notificacao; o fluxo publicado usa o tipo canonico
-- canal_indisponivel.
delete from public.ncrm_notificacao_tipos_ativos
where tipo='envio_abordagem_falhou';
