-- Funcoes SECURITY DEFINER usam search_path vazio. Por isso o nome da
-- constraint precisa incluir o schema ao ser adiada durante a reordenacao.

begin;

do $hotfix$
declare
  v_def text;
  v_fixed text;
begin
  select pg_get_functiondef(
    'public.f2_configurar_etapa(text,text,text,integer,boolean)'::regprocedure
  ) into v_def;
  v_fixed := replace(
    v_def,
    'set constraints f2_etapa_config_ordem_key deferred',
    'set constraints public.f2_etapa_config_ordem_key deferred'
  );
  if v_fixed = v_def
     and position('set constraints public.f2_etapa_config_ordem_key deferred' in v_def) = 0 then
    raise exception 'CONSTRAINT_ETAPA_NAO_LOCALIZADA_NA_FUNCAO';
  elsif v_fixed <> v_def then
    execute v_fixed;
  end if;

  select pg_get_functiondef(
    'public.f2_configurar_momento(text,text,text,text,text,integer,integer,boolean,boolean)'::regprocedure
  ) into v_def;
  v_fixed := replace(
    v_def,
    'set constraints f2_momento_etapa_ordem_uk deferred',
    'set constraints public.f2_momento_etapa_ordem_uk deferred'
  );
  if v_fixed = v_def
     and position('set constraints public.f2_momento_etapa_ordem_uk deferred' in v_def) = 0 then
    raise exception 'CONSTRAINT_MOMENTO_NAO_LOCALIZADA_NA_FUNCAO';
  elsif v_fixed <> v_def then
    execute v_fixed;
  end if;
end
$hotfix$;

do $verify$
begin
  if position(
    'set constraints public.f2_etapa_config_ordem_key deferred'
    in pg_get_functiondef('public.f2_configurar_etapa(text,text,text,integer,boolean)'::regprocedure)
  ) = 0 then
    raise exception 'CONSTRAINT_ETAPA_NAO_QUALIFICADA';
  end if;
  if position(
    'set constraints public.f2_momento_etapa_ordem_uk deferred'
    in pg_get_functiondef('public.f2_configurar_momento(text,text,text,text,text,integer,integer,boolean,boolean)'::regprocedure)
  ) = 0 then
    raise exception 'CONSTRAINT_MOMENTO_NAO_QUALIFICADA';
  end if;
end
$verify$;

commit;
