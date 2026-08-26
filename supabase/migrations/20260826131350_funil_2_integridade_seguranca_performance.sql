-- Funil 2: corrige a topologia visível, fecha RPCs privilegiadas anônimas e
-- adiciona os índices apontados pelos advisors. Não apaga nem reclassifica
-- leads, visitas ou históricos.

set constraints f2_etapa_config_ordem_key deferred;

update public.f2_etapa_config
set
  ordem = case codigo
    when 'novo' then 1
    when 'tentando_contato' then 2
    when 'em_atendimento' then 3
    when 'visita' then 4
    when 'pos_visita' then 5
    when 'pescado' then 6
    when 'atualizar_manual' then 7
    when 'legado' then 8
    else ordem
  end,
  ativo = case when codigo = 'pos_visita' then true else ativo end,
  ajuda = case codigo
    when 'pos_visita' then 'Registrar feedback, objeções e o próximo passo depois da visita.'
    when 'atualizar_manual' then 'Exceção administrativa: revisar e devolver o lead ao fluxo comercial.'
    when 'legado' then 'Carteira histórica preservada; não participa do quadro comercial principal.'
    else ajuda
  end
where codigo in (
  'novo','tentando_contato','em_atendimento','visita','pos_visita',
  'pescado','atualizar_manual','legado'
);

create index if not exists f2_lead_momento_codigo_idx
  on public.f2_lead (momento_codigo);

create index if not exists f2_visita_empreendimento_id_idx
  on public.f2_visita (empreendimento_id)
  where empreendimento_id is not null;

create index if not exists f2_visita_gerente_id_idx
  on public.f2_visita (gerente_id)
  where gerente_id is not null;

-- SECURITY DEFINER em schema exposto nasce executável por PUBLIC. Primeiro
-- fechamos todas as funções privilegiadas do domínio f2 para acesso anônimo;
-- depois reabrimos somente a API usada pelo ERP autenticado. Rotinas de motor,
-- carga e Sara continuam disponíveis ao service_role e ao dono das funções.
do $block$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as assinatura
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'f2\_%' escape '\'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      fn.assinatura
    );
    execute format('grant execute on function %s to service_role', fn.assinatura);
  end loop;

  for fn in
    select p.oid::regprocedure as assinatura
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'f2_admin',
        'f2_atualizar_momento',
        'f2_atualizar_temperatura',
        'f2_carteira_antiga',
        'f2_configurar_etapa',
        'f2_configurar_momento',
        'f2_configurar_operacao',
        'f2_confirmar_acao',
        'f2_corretor_atual',
        'f2_descartar_lead',
        'f2_listar_aquario',
        'f2_pescar_negocio',
        'f2_pode_operar_lead',
        'f2_salvar_negociacao',
        'f2_salvar_nota',
        'f2_salvar_visita',
        'f2_trazer_lead_antigo'
      ])
  loop
    execute format('grant execute on function %s to authenticated', fn.assinatura);
  end loop;
end
$block$;
