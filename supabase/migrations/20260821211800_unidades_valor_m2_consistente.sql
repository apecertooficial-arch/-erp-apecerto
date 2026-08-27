-- Mantém o valor por m² derivado do preço efetivo e corrige, de forma
-- auditável e idempotente, a área da unidade AP0342.

set lock_timeout = '5s';
set statement_timeout = '30s';

-- Uma regra pura concentra os mesmos limites amplos usados pela qualidade do
-- ERP. Ela não substitui avaliação mercadológica por bairro; só barra erros
-- materiais de digitação de preço ou área.
create or replace function private.produto_valor_m2_plausivel(
  p_preco numeric,
  p_area numeric,
  p_finalidade text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_preco is null or p_preco <= 0 or p_area is null or p_area <= 0 then false
    when lower(btrim(coalesce(p_finalidade, ''))) like '%alug%'
      or lower(btrim(coalesce(p_finalidade, ''))) like '%loca%'
      then p_preco / p_area between 10 and 2000
    else p_preco / p_area between 3000 and 100000
  end;
$$;

revoke all on function private.produto_valor_m2_plausivel(numeric, numeric, text)
  from public, anon, authenticated, service_role;

comment on function private.produto_valor_m2_plausivel(numeric, numeric, text) is
  'Regra fail-closed de valor por m²: venda 3 mil–100 mil; aluguel 10–2 mil.';

-- Reforça a fonte única usada pela validação e pelos UPDATEs em lote da
-- publicação canônica. Uma unidade fora da faixa nunca é contada nem ativada.
create or replace function private.produto_unidade_elegivel_site(
  p_unidade_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.unidades u
    join public.empreendimentos e on e.id = u.empreendimento_id
    where u.id = p_unidade_id
      and u.disponivel is true
      and u.aprovacao is not distinct from 'aprovado'
      and nullif(btrim(coalesce(u.numero, '')), '') is not null
      and nullif(btrim(coalesce(u.tipologia, '')), '') is not null
      and u.area_m2 > 0
      and coalesce(u.valor_promo, u.valor_tabela) is not null
      and case
        when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
          or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
          then coalesce(u.valor_promo, u.valor_tabela) between 500 and 500000
        else coalesce(u.valor_promo, u.valor_tabela) between 100000 and 100000000
      end
      and private.produto_valor_m2_plausivel(
        coalesce(u.valor_promo, u.valor_tabela),
        u.area_m2,
        e.finalidade
      ) is true
      and (
        u.valor_tabela is null
        or u.valor_promo is null
        or u.valor_promo <= u.valor_tabela
      )
      and (
        (
          u.de_terceiros is true
          and nullif(btrim(coalesce(u.proprietario_nome, '')), '') is not null
          and nullif(btrim(coalesce(u.proprietario_contato, '')), '') is not null
          and nullif(btrim(coalesce(u.acesso_tipo, '')), '') is not null
          and nullif(btrim(coalesce(u.acesso_instrucoes, '')), '') is not null
          and (
            u.acesso_tipo is distinct from 'chave_digital'
            or nullif(btrim(coalesce(u.acesso_codigo, '')), '') is not null
          )
          and exists (
            select 1
            from public.midias m
            where m.unidade_id = u.id
              and m.tipo = 'foto'::public.tipo_midia
          )
        )
        or (
          u.de_terceiros is false
          and (
            select count(*)
            from public.midias m
            where m.empreendimento_id = u.empreendimento_id
              and (m.unidade_id is null or m.unidade_id = u.id)
              and m.tipo = 'foto'::public.tipo_midia
          ) >= 6
        )
      )
  );
$$;

revoke all on function private.produto_unidade_elegivel_site(uuid)
  from public, anon, authenticated, service_role;

comment on function private.produto_unidade_elegivel_site(uuid) is
  'Elegibilidade integral, incluindo valor por m² plausível, usada por validação e publicação em lote.';

-- O helper filtra o lote do pai. Este gate complementar cobre a publicação
-- individual e também impede que uma edição deixe uma unidade já publicada
-- com preço/área incompatíveis. Rascunhos continuam podendo ser salvos.
create or replace function private.produto_bloquear_valor_m2_incompativel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finalidade text;
  v_preco numeric := coalesce(new.valor_promo, new.valor_tabela);
  v_valor_m2 numeric;
  v_minimo numeric;
  v_maximo numeric;
  v_aluguel boolean;
begin
  if new.publicado is not true then
    return new;
  end if;

  select e.finalidade
    into v_finalidade
  from public.empreendimentos e
  where e.id = new.empreendimento_id;

  if not found then
    raise foreign_key_violation using
      message = 'PRODUCT_PARENT_NOT_FOUND: empreendimento da unidade não encontrado.';
  end if;

  if private.produto_valor_m2_plausivel(v_preco, new.area_m2, v_finalidade) is not true then
    v_aluguel := lower(btrim(coalesce(v_finalidade, ''))) like '%alug%'
      or lower(btrim(coalesce(v_finalidade, ''))) like '%loca%';
    v_minimo := case when v_aluguel then 10 else 3000 end;
    v_maximo := case when v_aluguel then 2000 else 100000 end;
    v_valor_m2 := case
      when v_preco > 0 and new.area_m2 > 0 then round(v_preco / new.area_m2, 2)
      else null
    end;

    raise exception using
      errcode = 'P0001',
      message = format(
        'UNIT_PRICE_M2_INVALID: preço e área incompatíveis; valor calculado de R$ %s/m² fora da faixa de R$ %s a R$ %s/m² para %s.',
        coalesce(v_valor_m2::text, 'indisponível'),
        v_minimo,
        v_maximo,
        case when v_aluguel then 'aluguel' else 'venda' end
      ),
      detail = jsonb_build_object(
        'preco', v_preco,
        'area_m2', new.area_m2,
        'valor_m2', v_valor_m2,
        'valor_m2_minimo', v_minimo,
        'valor_m2_maximo', v_maximo
      )::text,
      hint = 'Revise o preço total em reais e a área útil em m² antes de publicar.';
  end if;

  return new;
end;
$$;

revoke all on function private.produto_bloquear_valor_m2_incompativel()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_unidades_bloquear_valor_m2_incompativel on public.unidades;
create trigger trg_unidades_bloquear_valor_m2_incompativel
before update of empreendimento_id, area_m2, valor_tabela, valor_promo, publicado
on public.unidades
for each row execute function private.produto_bloquear_valor_m2_incompativel();

comment on function private.produto_bloquear_valor_m2_incompativel() is
  'Gate da publicação individual e de edições em unidades publicadas; retorna UNIT_PRICE_M2_INVALID com limites.';

create or replace function private.unidade_recalcular_valor_m2()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_preco numeric;
begin
  v_preco := coalesce(new.valor_promo, new.valor_tabela);

  if new.area_m2 is null or new.area_m2 <= 0 or v_preco is null or v_preco <= 0 then
    new.valor_m2 := null;
  else
    new.valor_m2 := round(v_preco / new.area_m2, 2);
  end if;

  return new;
end;
$$;

revoke all on function private.unidade_recalcular_valor_m2() from public, anon, authenticated, service_role;

drop trigger if exists trg_unidades_recalcular_valor_m2 on public.unidades;
create trigger trg_unidades_recalcular_valor_m2
before insert or update of area_m2, valor_tabela, valor_promo, valor_m2 on public.unidades
for each row execute function private.unidade_recalcular_valor_m2();

comment on function private.unidade_recalcular_valor_m2() is
  'Mantém valor_m2 derivado do preço efetivo e da área; não reescreve legado em atualizações editoriais sem relação com preço/área.';

do $$
declare
  v_unidade_id uuid;
  v_empreendimento_id uuid;
  v_area numeric;
  v_valor_tabela numeric;
  v_valor_promo numeric;
  v_valor_m2 numeric;
  v_publicado boolean;
  v_aprovacao text;
  v_disponivel boolean;
  v_antes jsonb;
  v_depois jsonb;
begin
  -- A correcao abaixo e um patch de dado historico. Em uma base criada pelo
  -- baseline nao existe AP0062/AP0342 para corrigir; o contrato estrutural e
  -- os gatilhos acima continuam sendo instalados normalmente.
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (
       select 1 from public.empreendimentos e where e.codigo='AP0062'
     ) then
    return;
  end if;

  -- Os códigos possuem índices UNIQUE no esquema canônico. Resolver primeiro
  -- o pai e depois a unidade evita UUID gerado hardcoded e fixa a ordem de lock.
  select e.id
    into strict v_empreendimento_id
  from public.empreendimentos e
  where e.codigo = 'AP0062'
  for update;

  select
    u.id,
    u.area_m2,
    u.valor_tabela,
    u.valor_promo,
    u.valor_m2,
    u.publicado,
    u.aprovacao,
    u.disponivel
  into strict
    v_unidade_id,
    v_area,
    v_valor_tabela,
    v_valor_promo,
    v_valor_m2,
    v_publicado,
    v_aprovacao,
    v_disponivel
  from public.unidades u
  where u.empreendimento_id = v_empreendimento_id
    and u.codigo = 'AP0342'
  for update;

  -- Reexecução segura: a correção já aplicada não cria auditoria duplicada.
  if v_area = 73
     and v_valor_tabela = 850000
     and v_valor_promo = 850000
     and v_valor_m2 = round(850000::numeric / 73::numeric, 2) then
    if not exists (
      select 1
      from public.erp_auditoria a
      where a.entidade = 'unidade'
        and a.entidade_id = v_unidade_id::text
        and a.acao = 'corrigir_dado'
        and a.antes @> jsonb_build_object(
          'area_m2', 850::numeric,
          'valor_m2', 1000::numeric
        )
        and a.depois @> jsonb_build_object(
          'area_m2', 73::numeric,
          'valor_m2', round(850000::numeric / 73::numeric, 2)
        )
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'AP0342_ALREADY_CORRECTED_UNAUDITED: estado final existe sem a auditoria obrigatória';
    end if;
    return;
  end if;

  if v_area is distinct from 850
     or v_valor_tabela is distinct from 850000
     or v_valor_promo is distinct from 850000
     or v_valor_m2 is distinct from 1000 then
    raise exception using
      errcode = 'P0001',
      message = 'AP0342_UNEXPECTED_STATE: correção abortada; os dados foram alterados após o preflight',
      detail = jsonb_build_object(
        'area_m2', v_area,
        'valor_tabela', v_valor_tabela,
        'valor_promo', v_valor_promo,
        'valor_m2', v_valor_m2
      )::text;
  end if;

  v_antes := jsonb_build_object(
    'codigo', 'AP0342',
    'area_m2', v_area,
    'valor_m2', v_valor_m2,
    'valor_tabela', v_valor_tabela,
    'valor_promo', v_valor_promo,
    'publicado', v_publicado,
    'aprovacao', v_aprovacao,
    'disponivel', v_disponivel
  );

  update public.unidades
  set area_m2 = 73
  where id = v_unidade_id
    and empreendimento_id = v_empreendimento_id
    and codigo = 'AP0342'
    and area_m2 = 850
    and valor_tabela = 850000
    and valor_promo = 850000;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'AP0342_UPDATE_MISSED: nenhuma linha foi corrigida';
  end if;

  select jsonb_build_object(
    'codigo', u.codigo,
    'area_m2', u.area_m2,
    'valor_m2', u.valor_m2,
    'valor_tabela', u.valor_tabela,
    'valor_promo', u.valor_promo,
    'publicado', u.publicado,
    'aprovacao', u.aprovacao,
    'disponivel', u.disponivel
  )
  into strict v_depois
  from public.unidades u
  where u.id = v_unidade_id
    and u.empreendimento_id = v_empreendimento_id;

  if (v_depois ->> 'area_m2')::numeric is distinct from 73::numeric
     or (v_depois ->> 'valor_m2')::numeric is distinct from round(850000::numeric / 73::numeric, 2)
     or (v_depois -> 'publicado') is distinct from (v_antes -> 'publicado')
     or (v_depois -> 'aprovacao') is distinct from (v_antes -> 'aprovacao')
     or (v_depois -> 'disponivel') is distinct from (v_antes -> 'disponivel') then
    raise exception using
      errcode = 'P0001',
      message = 'AP0342_POSTCONDITION_FAILED: área, valor por m² ou estado editorial divergente';
  end if;

  insert into public.erp_auditoria (
    usuario_id,
    usuario_nome,
    acao,
    modulo,
    entidade,
    entidade_id,
    antes,
    depois,
    detalhe
  ) values (
    null,
    'Correção de dados autorizada',
    'corrigir_dado',
    'Produtos',
    'unidade',
    v_unidade_id::text,
    v_antes,
    v_depois,
    'AP0342: área corrigida de 850 m² para 73 m². Evidências: cadastro pai AP0062 e anúncio-fonte QuintoAndar 895655250. txid=' || txid_current()
  );
end;
$$;
