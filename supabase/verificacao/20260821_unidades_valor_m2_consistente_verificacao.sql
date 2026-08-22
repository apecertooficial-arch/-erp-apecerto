do $$
declare
  v_unidade_id uuid;
  v_empreendimento_id uuid;
  v_area numeric;
  v_valor_m2 numeric;
  v_auditorias integer;
  v_publicadas_incompativeis integer;
  v_trigger_enabled "char";
  v_trigger_def text;
  v_function_def text;
  v_security_definer boolean;
  v_function_config text[];
begin
  select e.id
    into strict v_empreendimento_id
  from public.empreendimentos e
  where e.codigo = 'AP0062';

  select u.id
    into strict v_unidade_id
  from public.unidades u
  where u.empreendimento_id = v_empreendimento_id
    and u.codigo = 'AP0342';

  select lower(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g'))
    into strict v_function_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'produto_valor_m2_plausivel'
    and pg_get_function_identity_arguments(p.oid) =
      'p_preco numeric, p_area numeric, p_finalidade text';

  if v_function_def not like '%p_preco / p_area between 10 and 2000%'
     or v_function_def not like '%p_preco / p_area between 3000 and 100000%' then
    raise exception 'FALHA: limites canônicos de valor por m² ausentes';
  end if;

  select lower(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g'))
    into strict v_function_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'produto_unidade_elegivel_site'
    and pg_get_function_identity_arguments(p.oid) = 'p_unidade_id uuid';

  if v_function_def not like '%private.produto_valor_m2_plausivel(%' then
    raise exception 'FALHA: elegibilidade do site não exige valor por m² plausível';
  end if;

  select
    t.tgenabled,
    lower(regexp_replace(pg_get_triggerdef(t.oid, true), '\s+', ' ', 'g')),
    lower(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')),
    p.prosecdef,
    p.proconfig
  into strict
    v_trigger_enabled,
    v_trigger_def,
    v_function_def,
    v_security_definer,
    v_function_config
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace n on n.oid = p.pronamespace
  where t.tgrelid = 'public.unidades'::regclass
    and t.tgname = 'trg_unidades_bloquear_valor_m2_incompativel'
    and not t.tgisinternal
    and n.nspname = 'private'
    and p.proname = 'produto_bloquear_valor_m2_incompativel';

  if v_trigger_enabled <> 'O'
     or v_trigger_def not like '%before update of empreendimento_id, area_m2, valor_tabela, valor_promo, publicado on unidades%'
     or v_function_def not like '%unit_price_m2_invalid:%'
     or not v_security_definer
     or array_position(v_function_config, 'search_path=""') is null then
    raise exception 'FALHA: gate individual de valor por m² ausente ou inseguro';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.unidades'::regclass
      and tgname = 'trg_unidades_recalcular_valor_m2'
      and not tgisinternal
  ) then
    raise exception 'FALHA: trigger de valor por m² ausente';
  end if;

  select
    t.tgenabled,
    lower(regexp_replace(pg_get_triggerdef(t.oid, true), '\s+', ' ', 'g')),
    lower(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')),
    p.prosecdef,
    p.proconfig
  into strict
    v_trigger_enabled,
    v_trigger_def,
    v_function_def,
    v_security_definer,
    v_function_config
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace n on n.oid = p.pronamespace
  where t.tgrelid = 'public.unidades'::regclass
    and t.tgname = 'trg_unidades_recalcular_valor_m2'
    and not t.tgisinternal
    and n.nspname = 'private'
    and p.proname = 'unidade_recalcular_valor_m2';

  if v_trigger_enabled <> 'O'
     or v_trigger_def not like '%before insert or update of area_m2, valor_tabela, valor_promo, valor_m2 on unidades%'
     or v_function_def not like '%new.valor_m2 := round(v_preco / new.area_m2, 2)%'
     or v_security_definer
     or array_position(v_function_config, 'search_path=""') is null then
    raise exception 'FALHA: trigger/função de valor por m² não está no contrato restrito esperado';
  end if;

  if has_function_privilege('anon', 'private.produto_valor_m2_plausivel(numeric,numeric,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.produto_valor_m2_plausivel(numeric,numeric,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.produto_valor_m2_plausivel(numeric,numeric,text)', 'EXECUTE')
     or has_function_privilege('anon', 'private.produto_unidade_elegivel_site(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.produto_unidade_elegivel_site(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.produto_unidade_elegivel_site(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'private.produto_bloquear_valor_m2_incompativel()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.produto_bloquear_valor_m2_incompativel()', 'EXECUTE')
     or has_function_privilege('service_role', 'private.produto_bloquear_valor_m2_incompativel()', 'EXECUTE')
     or has_function_privilege('anon', 'private.unidade_recalcular_valor_m2()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.unidade_recalcular_valor_m2()', 'EXECUTE')
     or has_function_privilege('service_role', 'private.unidade_recalcular_valor_m2()', 'EXECUTE') then
    raise exception 'FALHA: função interna de valor por m² exposta para papéis da API';
  end if;

  select area_m2, valor_m2
  into strict v_area, v_valor_m2
  from public.unidades
  where id = v_unidade_id
    and empreendimento_id = v_empreendimento_id
    and codigo = 'AP0342';

  if v_area is distinct from 73::numeric
     or v_valor_m2 is distinct from round(850000::numeric / 73::numeric, 2) then
    raise exception 'FALHA: AP0342 permanece divergente (área %, valor/m² %)', v_area, v_valor_m2;
  end if;

  select count(*)
  into v_auditorias
  from public.erp_auditoria
  where entidade = 'unidade'
    and entidade_id = v_unidade_id::text
    and acao = 'corrigir_dado'
    and antes @> jsonb_build_object(
      'area_m2', 850::numeric,
      'valor_m2', 1000::numeric
    )
    and depois @> jsonb_build_object(
      'area_m2', 73::numeric,
      'valor_m2', round(850000::numeric / 73::numeric, 2)
    )
    and (antes -> 'publicado') is not distinct from (depois -> 'publicado')
    and (antes -> 'aprovacao') is not distinct from (depois -> 'aprovacao')
    and (antes -> 'disponivel') is not distinct from (depois -> 'disponivel');

  if v_auditorias <> 1 then
    raise exception 'FALHA: esperado um registro de auditoria da AP0342; encontrado %', v_auditorias;
  end if;

  select count(*)::integer
    into v_publicadas_incompativeis
  from public.unidades u
  join public.empreendimentos e on e.id = u.empreendimento_id
  where u.publicado is true
    and private.produto_valor_m2_plausivel(
      coalesce(u.valor_promo, u.valor_tabela),
      u.area_m2,
      e.finalidade
    ) is not true;

  if v_publicadas_incompativeis <> 0 then
    raise exception 'FALHA: % unidade(s) publicada(s) ainda possuem preço/área incompatíveis', v_publicadas_incompativeis;
  end if;
end;
$$;

select
  u.codigo,
  u.area_m2,
  u.valor_m2,
  u.valor_tabela,
  u.valor_promo,
  u.publicado,
  u.aprovacao,
  u.disponivel
from public.unidades u
join public.empreendimentos e on e.id = u.empreendimento_id
where u.codigo = 'AP0342'
  and e.codigo = 'AP0062';
