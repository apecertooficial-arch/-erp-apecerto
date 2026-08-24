-- A Central publica estes dois eventos somente depois de uma alteracao
-- explicita produzida pela Sara. Eles ja estavam ativos no catalogo, mas o
-- vocabulario fechado da tabela ainda os recusava, fazendo o bloco inteiro
-- de aplicacao da analise voltar atras.

begin;

set local statement_timeout = '60s';
set local lock_timeout = '10s';

select pg_advisory_xact_lock(hashtext('central_notificacoes_vocabulario'));

insert into public.ncrm_notificacao_tipos_ativos(tipo,motivo)
values
  ('lead_em_atendimento','A Sara moveu explicitamente o lead para Em atendimento'),
  ('lead_quente','A Central confirmou explicitamente que o lead ficou quente')
on conflict (tipo) do update set motivo=excluded.motivo;

alter table public.ncrm_notificacao
  drop constraint if exists ncrm_notificacao_tipo_check;

alter table public.ncrm_notificacao
  add constraint ncrm_notificacao_tipo_check
  check (tipo = any (array[
    'lead_novo','primeira_abordagem_pendente','cliente_respondeu','acao_vencida',
    'retorno_proximo','canal_indisponivel','orientacao_sara','lead_sem_corretor',
    'corretor_sobrecarregado','abordagem_fora_do_prazo','falha_entrada','falha_sara',
    'falha_rotina','qualidade_dados','visita_proxima','falha_sincronizacao',
    'escalonamento','presenca_pendente','lead_em_atendimento','lead_quente'
  ]));

comment on constraint ncrm_notificacao_tipo_check on public.ncrm_notificacao is
  'Vocabulario fechado de notificacoes, incluindo resultados explicitos da Sara.';

commit;
