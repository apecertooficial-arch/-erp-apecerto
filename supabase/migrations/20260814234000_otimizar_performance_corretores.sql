-- Evita que performance_corretores_base reexecute a lista de telefones para
-- cada lead. Em produção, a RPC completa caiu de ~49,9 s para ~0,59 s com a
-- mesma saída (comparação old EXCEPT new = zero diferenças).
do $do$
declare
  v_def text;
  v_old_fones text := $old$
), fones as (
  select distinct pe.corretor_id, right(regexp_replace(pe.meta->>'telefone','\D','','g'), 8) f8
  from public.perf_eventos pe
  where pe.meta->>'telefone' is not null
), dupf as (
  select right(regexp_replace(l.telefone,'\D','','g'), 8) f8
  from public.leads l where nullif(l.telefone,'') is not null
  group by 1 having count(*)>1
), vd as (
$old$;
  v_new_fones text := $new$
), fones as (
  select pe.corretor_id, right(regexp_replace(pe.meta->>'telefone','\D','','g'), 8) f8
  from public.perf_eventos pe
  join cor c on c.id=pe.corretor_id
  where pe.meta->>'telefone' is not null
  group by pe.corretor_id, right(regexp_replace(pe.meta->>'telefone','\D','','g'), 8)
), dupf as (
  select right(regexp_replace(l.telefone,'\D','','g'), 8) f8
  from public.leads l where nullif(l.telefone,'') is not null
  group by 1 having count(*)>1
), leads_norm as (
  select l.*,
    case when nullif(l.telefone,'') is not null
      then right(regexp_replace(l.telefone,'\D','','g'), 8)
    end as f8
  from public.leads l
  join cor c on c.id=l.corretor_id
), vd as (
$new$;
  v_old_ld text := $old$
), ld as (
  select l.corretor_id, count(*) leads_total,
    count(*) filter (where l.criado_em>=p_inicio and l.criado_em<p_fim) leads_periodo,
    count(*) filter (where coalesce(nullif(l.origem,''),'')='') sem_origem,
    count(*) filter (where l.tags is null or jsonb_typeof(l.tags)='null' or (jsonb_typeof(l.tags)='array' and jsonb_array_length(l.tags)=0)) sem_qualif,
    count(*) filter (where nullif(l.telefone,'') is null or not exists (
      select 1 from fones f where f.corretor_id=l.corretor_id and f.f8=right(regexp_replace(l.telefone,'\D','','g'),8))) sem_inter,
    count(*) filter (where nullif(l.telefone,'') is not null and right(regexp_replace(l.telefone,'\D','','g'),8) in (select f8 from dupf)) duplicados
  from public.leads l join cor c on c.id=l.corretor_id group by l.corretor_id
), neg as (
$old$;
  v_new_ld text := $new$
), ld as (
  select l.corretor_id, count(*) leads_total,
    count(*) filter (where l.criado_em>=p_inicio and l.criado_em<p_fim) leads_periodo,
    count(*) filter (where coalesce(nullif(l.origem,''),'')='') sem_origem,
    count(*) filter (where l.tags is null or jsonb_typeof(l.tags)='null' or (jsonb_typeof(l.tags)='array' and jsonb_array_length(l.tags)=0)) sem_qualif,
    count(*) filter (where l.f8 is null or f.f8 is null) sem_inter,
    count(*) filter (where l.f8 is not null and d.f8 is not null) duplicados
  from leads_norm l
  left join fones f on f.corretor_id=l.corretor_id and f.f8=l.f8
  left join dupf d on d.f8=l.f8
  group by l.corretor_id
), neg as (
$new$;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='performance_corretores_base'
    and pg_get_function_identity_arguments(p.oid) =
      'p_inicio timestamp with time zone, p_fim timestamp with time zone';

  if v_def is null then
    raise exception 'performance_corretores_base não encontrada';
  end if;
  if position(v_old_fones in v_def)=0 then
    raise exception 'bloco fones esperado não encontrado';
  end if;
  v_def := replace(v_def, v_old_fones, v_new_fones);
  if position(v_old_ld in v_def)=0 then
    raise exception 'bloco ld esperado não encontrado';
  end if;
  v_def := replace(v_def, v_old_ld, v_new_ld);
  execute v_def;
end
$do$;

