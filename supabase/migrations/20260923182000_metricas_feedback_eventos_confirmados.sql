-- Desempenho de feedback parte de resultados confirmados no histórico de
-- eventos. O recorte e os denominadores seguem explícitos no contrato da RPC.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function public.f2_feedback_visita_performance(
  p_inicio date default null,
  p_fim date default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_inicio date := coalesce(
    p_inicio,
    (statement_timestamp() at time zone 'America/Sao_Paulo')::date - 89
  );
  v_fim date := coalesce(
    p_fim,
    (statement_timestamp() at time zone 'America/Sao_Paulo')::date
  );
  v_feedback_min integer;
  v_historico_total integer := 0;
  v_estruturados_total integer := 0;
  v_itens jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null or public.f2_admin() is not true then
    return pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  end if;
  if v_fim < v_inicio or v_fim-v_inicio > 366 then
    return pg_catalog.jsonb_build_object('ok',false,'erro','periodo_invalido');
  end if;

  select feedback_visita_min into v_feedback_min
    from public.f2_operacao_config where id=true;
  if v_feedback_min is null then
    raise exception 'F2_VISITA_CONFIG_AUSENTE';
  end if;

  -- Uma visita pode receber uma correção posterior. Para não inflar o placar,
  -- vale apenas o último evento confirmado da visita dentro do recorte.
  with eventos_confirmados as materialized (
    select distinct on (e.payload->>'visita_id')
           e.payload->>'visita_id' as visita_id,
           e.payload->>'justificativa' as justificativa
      from public.f2_evento e
     where e.tipo='visita_atualizada'
       and e.payload->>'status'='realizada'
       and coalesce(e.payload->>'visita_id','')<>''
       and (e.criado_em at time zone 'America/Sao_Paulo')::date
           between v_inicio and v_fim
     order by e.payload->>'visita_id',e.criado_em desc,e.id desc
  )
  select count(*)::integer,
         count(*) filter(where justificativa like 'FEEDBACK_VISITA_V1 |%')::integer
    into v_historico_total,v_estruturados_total
    from eventos_confirmados;

  with eventos_confirmados as materialized (
    select distinct on (e.payload->>'visita_id')
           e.payload->>'visita_id' as visita_id,
           e.criado_por as resultado_por,
           e.criado_em as resultado_em,
           e.payload->>'justificativa' as justificativa
      from public.f2_evento e
     where e.tipo='visita_atualizada'
       and e.payload->>'status'='realizada'
       and coalesce(e.payload->>'visita_id','')<>''
       and (e.criado_em at time zone 'America/Sao_Paulo')::date
           between v_inicio and v_fim
     order by e.payload->>'visita_id',e.criado_em desc,e.id desc
  ), estruturados as materialized (
    select e.resultado_por,
           public.f2_feedback_visita_nota(e.justificativa) as nota,
           greatest(0,extract(epoch from (
             e.resultado_em-coalesce(v.fim_em,v.inicio_em+interval '1 hour')
           ))/60)::integer as resposta_min
      from eventos_confirmados e
      join public.f2_visita v on v.id::text=e.visita_id
     where e.justificativa like 'FEEDBACK_VISITA_V1 |%'
  ), por_corretor as (
    select c.id as corretor_id,
           coalesce(u.nome,'Corretor não identificado') as corretor,
           count(*)::integer as feedbacks,
           round(avg(e.nota)::numeric,1) as nota_media,
           round(avg(e.resposta_min)::numeric,0)::integer as resposta_media_min,
           count(*) filter(where e.nota<9)::integer as abaixo_minimo,
           count(*) filter(where e.resposta_min<=v_feedback_min)::integer
             as dentro_prazo_total,
           round(100.0*count(*) filter(where e.resposta_min<=v_feedback_min)
             /nullif(count(*),0),1) as dentro_prazo_percentual
      from estruturados e
      left join public.usuarios u on u.id=e.resultado_por
      left join public.corretores c on c.usuario_id=e.resultado_por
     group by c.id,u.nome
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'corretor_id',corretor_id,'corretor',corretor,'feedbacks',feedbacks,
    'nota_media',nota_media,'resposta_media_min',resposta_media_min,
    'abaixo_minimo',abaixo_minimo,
    'dentro_prazo_total',dentro_prazo_total,
    'dentro_prazo_percentual',dentro_prazo_percentual
  ) order by nota_media asc,resposta_media_min desc,corretor),'[]'::jsonb)
    into v_itens from por_corretor;

  return pg_catalog.jsonb_build_object(
    'ok',true,'inicio',v_inicio,'fim',v_fim,
    'fonte','eventos_confirmados',
    'unidade','visitas_com_resultado_confirmado',
    'historico_total',v_historico_total,
    'estruturados_total',v_estruturados_total,
    'legados_total',v_historico_total-v_estruturados_total,
    'feedback_visita_min',v_feedback_min,
    'itens',v_itens
  );
end;
$function$;

revoke all on function public.f2_feedback_visita_performance(date,date)
  from public,anon;
grant execute on function public.f2_feedback_visita_performance(date,date)
  to authenticated,service_role;
