-- Isola a carteira operacional anterior sem apagar historico e sem disparar
-- a importacao dos milhares de negocios que continuam fora do Funil 2.0.
--
-- Leads quentes sao identificados pelas tags canonicas aplicadas pelas
-- automacoes de entrada. Assim, uma captacao que chegar enquanto esta
-- migracao roda tambem fica protegida.

begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

insert into public.f2_etapa_config
  (codigo, ordem, rotulo, ajuda, ativo, atualizado_em)
values
  (
    'legado', 7, 'Leads legado',
    'Carteira anterior, preservada para consulta e reativacao. Nao entra no Meu Dia nem disputa a atencao com captacoes atuais.',
    true, now()
  )
on conflict (codigo) do update
   set ordem = excluded.ordem,
       rotulo = excluded.rotulo,
       ajuda = excluded.ajuda,
       ativo = true,
       atualizado_em = now();

insert into public.f2_momento_config
  (codigo, etapa, ordem, rotulo, descricao, acao_codigo, acao_rotulo,
   prazo_minutos, prazo_rotulo, exige_dapi, ativo, cobra_no_meu_dia,
   atualizado_em)
values
  (
    'LEAD_LEGADO', 'legado', 1, 'Carteira preservada',
    'Lead anterior mantido para consulta. So volta para a fila ativa quando houver uma nova oportunidade real.',
    'reativar_quando_quente', 'Fora da fila ativa',
    null, 'sem prazo', false, true, false, now()
  )
on conflict (codigo) do update
   set etapa = excluded.etapa,
       ordem = excluded.ordem,
       rotulo = excluded.rotulo,
       descricao = excluded.descricao,
       acao_codigo = excluded.acao_codigo,
       acao_rotulo = excluded.acao_rotulo,
       prazo_minutos = null,
       prazo_rotulo = excluded.prazo_rotulo,
       exige_dapi = false,
       ativo = true,
       cobra_no_meu_dia = false,
       atualizado_em = now();

create temporary table f2_alvos_leads_legado on commit drop as
select
  f.id,
  f.etapa as etapa_anterior,
  f.momento_codigo as momento_anterior,
  f.acao_codigo as acao_anterior,
  f.acao_rotulo as acao_rotulo_anterior,
  f.proxima_acao_em as prazo_anterior,
  f.cadencia_passo as cadencia_anterior
from public.f2_lead f
join public.negocios n on n.id = f.origem_negocio_id
join public.leads l on l.id = n.lead_id
where n.status = 'aberto'
  and f.descartado_em is null
  and f.etapa <> 'legado'
  and not exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(coalesce(l.tags, '[]'::jsonb)) = 'array'
          then coalesce(l.tags, '[]'::jsonb)
        else '[]'::jsonb
      end
    ) t(item)
    where lower(btrim(
      case jsonb_typeof(t.item)
        when 'string' then trim(both '"' from t.item::text)
        when 'object' then coalesce(t.item->>'name', t.item->>'nome')
      end
    )) in ('miruna', 'adelmo 2100')
  );

alter table f2_alvos_leads_legado add primary key (id);

insert into public.f2_evento
  (funil_lead_id, tipo, titulo, detalhe, payload, criado_por)
select
  a.id,
  'momento_alterado',
  'Movido para Leads legado',
  'Carteira anterior isolada da operacao atual. O estado anterior foi preservado para reativacao.',
  jsonb_build_object(
    'motivo', 'isolamento_carteira_anterior_2026_08_21',
    'etapa_anterior', a.etapa_anterior,
    'momento_anterior', a.momento_anterior,
    'acao_anterior', a.acao_anterior,
    'acao_rotulo_anterior', a.acao_rotulo_anterior,
    'prazo_anterior', a.prazo_anterior,
    'cadencia_anterior', a.cadencia_anterior
  ),
  null
from f2_alvos_leads_legado a;

update public.f2_lead f
   set etapa = 'legado',
       momento_codigo = 'LEAD_LEGADO',
       acao_codigo = 'reativar_quando_quente',
       acao_rotulo = 'Fora da fila ativa',
       proxima_acao_em = public.f2_sem_prazo(),
       cadencia_passo = 0,
       atualizado_em = now(),
       versao = f.versao + 1,
       ultima_reavaliacao_resumo = 'Carteira anterior isolada em Leads legado.'
  from f2_alvos_leads_legado a
 where f.id = a.id;

do $verify$
begin
  if exists (
    select 1
    from public.f2_lead f
    join public.negocios n on n.id = f.origem_negocio_id
    join public.leads l on l.id = n.lead_id
    where n.status = 'aberto'
      and f.descartado_em is null
      and exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(coalesce(l.tags, '[]'::jsonb)) = 'array'
              then coalesce(l.tags, '[]'::jsonb)
            else '[]'::jsonb
          end
        ) t(item)
        where lower(btrim(
          case jsonb_typeof(t.item)
            when 'string' then trim(both '"' from t.item::text)
            when 'object' then coalesce(t.item->>'name', t.item->>'nome')
          end
        )) in ('miruna', 'adelmo 2100')
      )
      and f.etapa = 'legado'
  ) then
    raise exception 'LEAD_QUENTE_MOVIDO_PARA_LEGADO';
  end if;

  if exists (
    select 1
    from f2_alvos_leads_legado a
    join public.f2_lead f on f.id = a.id
    where f.etapa <> 'legado'
       or f.momento_codigo <> 'LEAD_LEGADO'
       or f.proxima_acao_em <> public.f2_sem_prazo()
  ) then
    raise exception 'ISOLAMENTO_LEGADO_INCOMPLETO';
  end if;
end
$verify$;

commit;
