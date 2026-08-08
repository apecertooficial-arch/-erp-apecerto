-- BACKFILL: todo lead que ja foi pescado volta para a etapa Pescado, sem prazo.
-- Os que estavam em tentando_contato tinham caido na cadencia de 6 tentativas
-- -- a mistura que a etapa Pescado existe para desfazer.
-- Ficam de fora: descartados, quem esta em visita e quem esta em tentativa de
-- agendamento (esses ja passaram da pergunta "ele respondeu?").
-- Logo depois, f2_pescado_promover_respondidos devolve para Em atendimento
-- exatamente quem respondeu de verdade.

do $$
declare r record; m public.f2_momento_config%rowtype; v_n int := 0;
begin
  select * into m from public.f2_momento_config where codigo = 'CADENCIA_PESCADO';

  for r in
    with pescados as (
      select distinct f.id from public.f2_lead f
       join public.f2_evento e on e.funil_lead_id = f.id
      where e.titulo ilike '%pescado%' or e.titulo ilike '%Realoca%'
      union
      select (a.depois->>'novo_id')::uuid from public.f2_config_audit a
       where a.tipo='pesca' and a.depois ? 'novo_id'
      union
      select a.entidade_id::uuid from public.erp_auditoria a
       where a.acao = 'Realocacao para a etapa Pescado'
    )
    select f.* from public.f2_lead f
     where f.id in (select id from pescados)
       and f.descartado_em is null
       and f.etapa not in ('visita')
       and f.momento_codigo <> 'TENTANDO_AGENDAMENTO'
  loop
    update public.f2_lead
       set etapa = m.etapa, momento_codigo = m.codigo,
           acao_codigo = m.acao_codigo, acao_rotulo = m.acao_rotulo,
           proxima_acao_em = public.f2_sem_prazo(),
           cadencia_passo = least(greatest(r.cadencia_passo, 0), 1)::smallint,
           ultima_reavaliacao_resumo = 'Lead pescado: voltou para a etapa Pescado, sem prazo. Nao entra mais no Meu Dia.',
           versao = versao + 1, atualizado_em = now()
     where id = r.id;

    if r.etapa is distinct from m.etapa or r.momento_codigo is distinct from m.codigo
       or r.proxima_acao_em is distinct from public.f2_sem_prazo() then
      insert into public.f2_evento(funil_lead_id, tipo, titulo, detalhe, payload)
      values (r.id, 'momento_alterado', 'Voltou para a etapa Pescado',
        'Lead do Aquario nao segue a cadencia de 6 tentativas. Etapa Pescado, sem prazo: chame uma vez; se ele responder o card sai sozinho, se nao, atualize quando decidir.',
        jsonb_build_object('de_etapa', r.etapa, 'de_momento', r.momento_codigo,
                           'para_etapa', m.etapa, 'para_momento', m.codigo,
                           'sem_prazo', true, 'regra', 'pescado_sem_cobranca'));

      insert into public.erp_auditoria(acao, modulo, entidade, entidade_id, antes, depois, detalhe)
      values ('Pescado sem prazo', 'Funil 2.0', 'f2_lead', r.id::text,
              jsonb_build_object('etapa', r.etapa, 'momento', r.momento_codigo,
                                 'proxima_acao_em', r.proxima_acao_em, 'cadencia_passo', r.cadencia_passo),
              jsonb_build_object('etapa', m.etapa, 'momento', m.codigo, 'proxima_acao_em', 'sem prazo'),
              'Regra do Pescado: fora do Meu Dia, sem prazo, uma tentativa.');
      v_n := v_n + 1;
    end if;
  end loop;

  raise notice 'cards ajustados: %', v_n;
end $$;

-- A saida do Pescado precisa ser continua: o cliente pode responder a qualquer
-- hora, e o card tem que sair sozinho. De minuto em minuto, custo desprezivel.
select cron.schedule('f2-pescado-respondeu', '* * * * *',
                     'select public.f2_pescado_promover_respondidos();')
 where not exists (select 1 from cron.job where jobname = 'f2-pescado-respondeu');
