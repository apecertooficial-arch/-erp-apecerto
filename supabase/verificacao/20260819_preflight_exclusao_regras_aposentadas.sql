-- Preflight somente leitura para o corte das regras aposentadas.
-- Execute em 19/08/2026 ou depois. Qualquer divergência aborta o corte.

do $$
declare
  v_funcoes text[];
  v_crons integer;
  v_triggers integer;
  v_regras_sara integer;
begin
  if current_date < date '2026-08-19' then
    raise exception 'retencao vigente ate 19/08/2026';
  end if;

  if (select count(*) from public.f2_cadencia_regua)
       <> (select count(*) from ncrm_private.arquivo_f2_cadencia_regua_20260815) then
    raise exception 'f2_cadencia_regua mudou depois do backup';
  end if;

  if (select count(*) from public.funil_regra)
       <> (select count(*) from ncrm_private.arquivo_funil_regra_20260815) then
    raise exception 'funil_regra mudou depois do backup';
  end if;

  if (select count(*) from public.funil_regra_execucao)
       <> (select count(*) from ncrm_private.arquivo_funil_regra_execucao_20260815) then
    raise exception 'funil_regra_execucao mudou depois do backup';
  end if;

  select array_agg(p.proname order by p.proname)
    into v_funcoes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and (
      pg_get_functiondef(p.oid) ilike '%f2_cadencia_regua%'
      or pg_get_functiondef(p.oid) ilike '%funil_regra%'
    );

  if v_funcoes is distinct from array[
    'f2_cadencia_proximo_prazo',
    'funil_regra_candidatos',
    'funil_regra_excluir',
    'funil_regra_ler',
    'funil_regra_previa',
    'funil_regra_salvar',
    'funil_tick'
  ]::text[] then
    raise exception 'dependencias de funcao mudaram: %', v_funcoes;
  end if;

  select count(*) into v_crons
  from cron.job
  where command ilike any(array[
    '%f2_cadencia_regua%',
    '%f2_cadencia_proximo_prazo%',
    '%funil_regra%',
    '%funil_tick%'
  ]);
  if v_crons <> 0 then
    raise exception 'existem % crons dependentes', v_crons;
  end if;

  select count(*) into v_triggers
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and n.nspname = 'public'
    and c.relname in ('f2_cadencia_regua', 'funil_regra', 'funil_regra_execucao');
  if v_triggers <> 0 then
    raise exception 'existem % triggers inesperadas', v_triggers;
  end if;

  select count(*) into v_regras_sara
  from public.f2_sara_pedido
  where regra_id is not null;
  if v_regras_sara <> 0 then
    raise exception 'existem % pedidos Sara ligados a funil_regra', v_regras_sara;
  end if;
end;
$$;

select 'preflight_aprovado' as resultado,
       current_date as executado_em,
       (select count(*) from public.f2_cadencia_regua) as cadencias_arquivadas,
       (select count(*) from public.funil_regra) as regras_arquivadas,
       (select count(*) from public.funil_regra_execucao) as execucoes_arquivadas;
