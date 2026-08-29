-- A aplicacao atomica da Sara grava dois eventos de auditoria. A restricao
-- existente ja aceita sara_reavaliou, mas ainda bloqueava o checkpoint que
-- garante a verificacao futura da proxima acao.
do $migration$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into strict v_def
    from pg_constraint
   where conrelid='public.f2_evento'::regclass
     and conname='f2_evento_tipo_check';

  if md5(v_def) <> 'af43c34b52748d6b9607aaddb052c2c3' then
    raise exception 'SARA_EVENT_TYPE_STALE_VERSION: f2_evento_tipo_check mudou: %',md5(v_def);
  end if;

  alter table public.f2_evento drop constraint f2_evento_tipo_check;
  alter table public.f2_evento add constraint f2_evento_tipo_check check (
    tipo=any(array[
      'importacao'::text,'momento_alterado'::text,'acao_confirmada'::text,
      'sara_reavaliou'::text,'sara_checkpoint_agendado'::text,
      'correcao_classificacao'::text,'visita_atualizada'::text,
      'negociacao_criada'::text,'lead_distribuido'::text,'observacao'::text,
      'lead_descartado'::text,'nota_adicionada'::text,'cadencia_avancou'::text
    ])
  );
end
$migration$;
