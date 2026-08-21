-- A tela permitia escolher uma ordem ja ocupada, mas as restricoes unicas
-- recusavam a gravacao. As restricoes passam a ser adiaveis para que cada RPC
-- mova o item e feche/abra o intervalo de posicoes na mesma transacao.

begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

alter table public.f2_etapa_config
  drop constraint if exists f2_etapa_config_ordem_key;
alter table public.f2_etapa_config
  add constraint f2_etapa_config_ordem_key
  unique (ordem) deferrable initially immediate;

drop index if exists public.f2_momento_etapa_ordem_uk;
alter table public.f2_momento_config
  add constraint f2_momento_etapa_ordem_uk
  unique (etapa, ordem) deferrable initially immediate;

create or replace function public.f2_configurar_etapa(
  p_codigo text,
  p_rotulo text,
  p_ajuda text,
  p_ordem integer,
  p_ativo boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_antes jsonb;
  v_codigo text := lower(btrim(p_codigo));
  v_ordem_anterior integer;
  v_existe boolean := false;
  v_livre integer;
begin
  if v_uid is null or public.f2_admin() is not true then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;

  if v_codigo !~ '^[a-z0-9_]{3,40}$'
     or char_length(btrim(p_rotulo)) not between 2 and 60
     or p_ordem not between 1 and 50 then
    return jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
  end if;

  select to_jsonb(e), e.ordem
    into v_antes, v_ordem_anterior
  from public.f2_etapa_config e
  where e.codigo = v_codigo;
  v_existe := found;

  if p_ativo is false and (
    exists(select 1 from public.f2_lead where etapa = v_codigo)
    or exists(select 1 from public.f2_momento_config where etapa = v_codigo and ativo)
  ) then
    return jsonb_build_object('ok', false, 'erro', 'etapa_em_uso');
  end if;

  set constraints public.f2_etapa_config_ordem_key deferred;

  if v_existe then
    if v_ordem_anterior <> p_ordem then
      update public.f2_etapa_config
         set ordem = case
           when codigo = v_codigo then p_ordem
           when v_ordem_anterior < p_ordem
             and ordem > v_ordem_anterior and ordem <= p_ordem then ordem - 1
           when v_ordem_anterior > p_ordem
             and ordem >= p_ordem and ordem < v_ordem_anterior then ordem + 1
           else ordem
         end,
         atualizado_em = now()
       where codigo = v_codigo
          or (v_ordem_anterior < p_ordem and ordem > v_ordem_anterior and ordem <= p_ordem)
          or (v_ordem_anterior > p_ordem and ordem >= p_ordem and ordem < v_ordem_anterior);
    end if;

    update public.f2_etapa_config
       set rotulo = btrim(p_rotulo),
           ajuda = left(coalesce(p_ajuda, ''), 240),
           ativo = coalesce(p_ativo, true),
           atualizado_em = now()
     where codigo = v_codigo;
  else
    if exists(select 1 from public.f2_etapa_config where ordem = p_ordem) then
      select serie.ordem
        into v_livre
      from generate_series(p_ordem, 50) as serie(ordem)
      left join public.f2_etapa_config e on e.ordem = serie.ordem
      where e.codigo is null
      order by serie.ordem
      limit 1;

      if v_livre is null then
        return jsonb_build_object('ok', false, 'erro', 'limite_etapas');
      end if;
      update public.f2_etapa_config
         set ordem = ordem + 1,
             atualizado_em = now()
       where ordem >= p_ordem
         and ordem < v_livre;
    end if;

    insert into public.f2_etapa_config
      (codigo, ordem, rotulo, ajuda, ativo, atualizado_em)
    values
      (v_codigo, p_ordem, btrim(p_rotulo), left(coalesce(p_ajuda, ''), 240),
       coalesce(p_ativo, true), now());
  end if;

  insert into public.f2_config_audit
    (tipo, chave, acao, antes, depois, criado_por)
  select
    'etapa', v_codigo,
    case when v_antes is null then 'criar' else 'atualizar' end,
    v_antes, to_jsonb(e), v_uid
  from public.f2_etapa_config e
  where e.codigo = v_codigo;

  return jsonb_build_object('ok', true, 'codigo', v_codigo);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro', 'ordem_em_uso');
  when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'limite_etapas');
end;
$fn$;

create or replace function public.f2_configurar_momento(
  p_codigo text,
  p_etapa text,
  p_rotulo text,
  p_descricao text,
  p_acao_rotulo text,
  p_prazo_minutos integer,
  p_ordem integer,
  p_exige_dapi boolean default false,
  p_ativo boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_antes jsonb;
  v_codigo text := upper(btrim(p_codigo));
  v_etapa_anterior text;
  v_ordem_anterior integer;
  v_existe boolean := false;
  v_prazo_rotulo text;
  v_livre integer;
begin
  if v_uid is null or public.f2_admin() is not true then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;

  if v_codigo !~ '^[A-Z0-9_]{3,50}$'
     or not exists(select 1 from public.f2_etapa_config where codigo = p_etapa and ativo)
     or char_length(btrim(p_rotulo)) not between 2 and 80
     or char_length(btrim(p_acao_rotulo)) not between 2 and 120
     or (p_prazo_minutos is not null and p_prazo_minutos not between 1 and 43200)
     or p_ordem not between 1 and 100 then
    return jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
  end if;

  select to_jsonb(m), m.etapa, m.ordem
    into v_antes, v_etapa_anterior, v_ordem_anterior
  from public.f2_momento_config m
  where m.codigo = v_codigo;
  v_existe := found;

  if p_ativo is false
     and exists(select 1 from public.f2_lead where momento_codigo = v_codigo) then
    return jsonb_build_object('ok', false, 'erro', 'momento_em_uso');
  end if;

  v_prazo_rotulo := case
    when p_prazo_minutos is null then 'sem prazo'
    when p_prazo_minutos % 1440 = 0 then (p_prazo_minutos / 1440) || ' dia(s)'
    when p_prazo_minutos % 60 = 0 then (p_prazo_minutos / 60) || ' hora(s)'
    else p_prazo_minutos || ' minutos'
  end;

  set constraints public.f2_momento_etapa_ordem_uk deferred;

  if v_existe and v_etapa_anterior = p_etapa and v_ordem_anterior <> p_ordem then
    update public.f2_momento_config
       set ordem = case
         when codigo = v_codigo then p_ordem
         when v_ordem_anterior < p_ordem
           and ordem > v_ordem_anterior and ordem <= p_ordem then ordem - 1
         when v_ordem_anterior > p_ordem
           and ordem >= p_ordem and ordem < v_ordem_anterior then ordem + 1
         else ordem
       end,
       atualizado_em = now()
     where etapa = p_etapa
       and (
         codigo = v_codigo
         or (v_ordem_anterior < p_ordem and ordem > v_ordem_anterior and ordem <= p_ordem)
         or (v_ordem_anterior > p_ordem and ordem >= p_ordem and ordem < v_ordem_anterior)
       );
  elsif v_existe and v_etapa_anterior <> p_etapa then
    select serie.ordem
      into v_livre
    from generate_series(p_ordem, 100) as serie(ordem)
    left join public.f2_momento_config m
      on m.etapa = p_etapa and m.ordem = serie.ordem
    where m.codigo is null
    order by serie.ordem
    limit 1;

    if v_livre is null then
      return jsonb_build_object('ok', false, 'erro', 'limite_momentos');
    end if;

    update public.f2_momento_config
       set ordem = ordem - 1,
           atualizado_em = now()
     where etapa = v_etapa_anterior
       and ordem > v_ordem_anterior;

    update public.f2_momento_config
       set ordem = ordem + 1,
           atualizado_em = now()
     where etapa = p_etapa
       and ordem >= p_ordem
       and ordem < v_livre;

    update public.f2_momento_config
       set etapa = p_etapa,
           ordem = p_ordem,
           atualizado_em = now()
     where codigo = v_codigo;
  elsif not v_existe then
    select serie.ordem
      into v_livre
    from generate_series(p_ordem, 100) as serie(ordem)
    left join public.f2_momento_config m
      on m.etapa = p_etapa and m.ordem = serie.ordem
    where m.codigo is null
    order by serie.ordem
    limit 1;

    if v_livre is null then
      return jsonb_build_object('ok', false, 'erro', 'limite_momentos');
    end if;

    update public.f2_momento_config
       set ordem = ordem + 1,
           atualizado_em = now()
     where etapa = p_etapa
       and ordem >= p_ordem
       and ordem < v_livre;
  end if;

  if v_existe then
    update public.f2_momento_config
       set etapa = p_etapa,
           ordem = p_ordem,
           rotulo = btrim(p_rotulo),
           descricao = left(btrim(p_descricao), 300),
           acao_codigo = v_codigo,
           acao_rotulo = btrim(p_acao_rotulo),
           prazo_minutos = p_prazo_minutos,
           prazo_rotulo = v_prazo_rotulo,
           exige_dapi = coalesce(p_exige_dapi, false),
           ativo = coalesce(p_ativo, true),
           atualizado_em = now()
     where codigo = v_codigo;
  else
    insert into public.f2_momento_config
      (codigo, etapa, ordem, rotulo, descricao, acao_codigo, acao_rotulo,
       prazo_minutos, prazo_rotulo, exige_dapi, ativo, atualizado_em)
    values
      (v_codigo, p_etapa, p_ordem, btrim(p_rotulo), left(btrim(p_descricao), 300),
       v_codigo, btrim(p_acao_rotulo), p_prazo_minutos, v_prazo_rotulo,
       coalesce(p_exige_dapi, false), coalesce(p_ativo, true), now());
  end if;

  insert into public.f2_config_audit
    (tipo, chave, acao, antes, depois, criado_por)
  select
    'momento', v_codigo,
    case when v_antes is null then 'criar' else 'atualizar' end,
    v_antes, to_jsonb(m), v_uid
  from public.f2_momento_config m
  where m.codigo = v_codigo;

  return jsonb_build_object('ok', true, 'codigo', v_codigo);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro', 'ordem_em_uso');
  when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'limite_momentos');
end;
$fn$;

revoke all on function public.f2_configurar_etapa(text,text,text,integer,boolean)
  from public, anon;
grant execute on function public.f2_configurar_etapa(text,text,text,integer,boolean)
  to authenticated, service_role;

revoke all on function public.f2_configurar_momento(text,text,text,text,text,integer,integer,boolean,boolean)
  from public, anon;
grant execute on function public.f2_configurar_momento(text,text,text,text,text,integer,integer,boolean,boolean)
  to authenticated, service_role;

-- Ordem operacional pedida: Pescado encerra a sequencia de colunas ativas.
set constraints f2_etapa_config_ordem_key deferred;
update public.f2_etapa_config
   set ordem = case codigo
     when 'novo' then 1
     when 'tentando_contato' then 2
     when 'em_atendimento' then 3
     when 'visita' then 4
     when 'atualizar_manual' then 5
     when 'legado' then 6
     when 'pescado' then 7
     else ordem
   end,
   atualizado_em = now()
 where codigo in (
   'novo', 'tentando_contato', 'em_atendimento', 'visita',
   'atualizar_manual', 'legado', 'pescado'
 );

do $verify$
begin
  if (select ordem from public.f2_etapa_config where codigo = 'pescado') <>
     (select max(ordem) from public.f2_etapa_config where ativo) then
    raise exception 'PESCADO_NAO_E_A_ULTIMA_ETAPA_ATIVA';
  end if;
end
$verify$;

commit;
