-- Fonte canônica ERP -> site.
--
-- Objetivos:
--   * empreendimentos + unidades são a única origem editorial do catálogo;
--   * aprovação/publicação acontece por uma RPC transacional e auditável;
--   * leads de unidades carregam a FK real, nunca um UUID sintético;
--   * preço total em reais e completude mínima são revalidados no banco;
--   * a view pública continua security_invoker e expõe somente o necessário.

-- ---------------------------------------------------------------------------
-- 1. Lead público aponta para a unidade real
-- ---------------------------------------------------------------------------

alter table public.site_leads
  add column if not exists unidade_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.site_leads'::regclass
      and conname = 'site_leads_unidade_id_fkey'
  ) then
    alter table public.site_leads
      add constraint site_leads_unidade_id_fkey
      foreign key (unidade_id)
      references public.unidades(id)
      on delete set null
      not valid;
  end if;
end
$$;

-- A coluna é nova e começa nula; validar agora evita deixar a FK apenas
-- declarativa. Reaplicar a migration continua seguro.
alter table public.site_leads
  validate constraint site_leads_unidade_id_fkey;

create index if not exists site_leads_unidade_criado_idx
  on public.site_leads (unidade_id, criado_em desc)
  where unidade_id is not null;

comment on column public.site_leads.unidade_id is
  'Unidade real selecionada no site. A FK elimina IDs sintéticos e preserva o vínculo correto no CRM.';

-- A lista fechada continua impedindo payload arbitrário; unidade_id passa a ser
-- uma chave comercial permitida porque também existe como FK tipada.
alter table public.site_leads
  drop constraint if exists site_leads_context_check;

alter table public.site_leads
  add constraint site_leads_context_check check (
    jsonb_typeof(context) = 'object'
    and octet_length(context::text) <= 8000
    and (context - array[
      'empreendimento_id', 'empreendimento_nome', 'unidade_id',
      'preferencia_horario', 'captacao_id', 'finalidade', 'bairro',
      'cidade', 'area_util', 'valor_imovel', 'percentual_financiado',
      'valor_entrada', 'valor_financiar', 'renda_mensal', 'estado_civil',
      'objetivo', 'tipo_imovel', 'source'
    ]::text[]) = '{}'::jsonb
  );

alter table public.site_leads
  drop constraint if exists site_leads_context_unidade_consistente;

alter table public.site_leads
  add constraint site_leads_context_unidade_consistente check (
    (
      unidade_id is null
      and not (context ? 'unidade_id')
    )
    or (
      unidade_id is not null
      and context ->> 'unidade_id' = unidade_id::text
    )
  );

create schema if not exists private;

-- Snapshot anterior às normalizações abaixo. Guarda somente IDs internos e
-- flags editoriais: nenhum nome, contato, endereço, mídia ou preço.
create table if not exists private.produto_publicacao_snapshot_20260821 (
  entidade text not null check (entidade in ('empreendimento', 'unidade')),
  entidade_id uuid not null,
  empreendimento_id uuid not null,
  publicado boolean,
  aprovacao text,
  rascunho boolean,
  disponivel boolean,
  capturado_em timestamptz not null default statement_timestamp(),
  primary key (entidade, entidade_id),
  check (
    (entidade = 'empreendimento' and rascunho is not null and disponivel is null)
    or
    (entidade = 'unidade' and rascunho is null and disponivel is not null)
  )
);

create table if not exists private.produto_publicacao_snapshot_20260821_controle (
  id boolean primary key default true check (id),
  capturado_em timestamptz not null default statement_timestamp(),
  total_empreendimentos bigint not null check (total_empreendimentos >= 0),
  total_unidades bigint not null check (total_unidades >= 0)
);

revoke all privileges
  on private.produto_publicacao_snapshot_20260821,
     private.produto_publicacao_snapshot_20260821_controle
  from public, anon, authenticated;

do $snapshot$
declare
  v_empreendimentos bigint;
  v_unidades bigint;
  v_snapshot_empreendimentos bigint;
  v_snapshot_unidades bigint;
begin
  -- O registro de controle torna a captura idempotente: uma reaplicação nunca
  -- sobrescreve o estado original com flags já normalizadas.
  if not exists (
    select 1
    from private.produto_publicacao_snapshot_20260821_controle
    where id
  ) then
    select count(*) into v_empreendimentos from public.empreendimentos;
    select count(*) into v_unidades from public.unidades;

    insert into private.produto_publicacao_snapshot_20260821 (
      entidade,
      entidade_id,
      empreendimento_id,
      publicado,
      aprovacao,
      rascunho,
      disponivel
    )
    select
      'empreendimento',
      e.id,
      e.id,
      e.publicado,
      e.aprovacao,
      e.rascunho,
      null
    from public.empreendimentos e
    on conflict (entidade, entidade_id) do nothing;

    insert into private.produto_publicacao_snapshot_20260821 (
      entidade,
      entidade_id,
      empreendimento_id,
      publicado,
      aprovacao,
      rascunho,
      disponivel
    )
    select
      'unidade',
      u.id,
      u.empreendimento_id,
      u.publicado,
      u.aprovacao,
      null,
      u.disponivel
    from public.unidades u
    on conflict (entidade, entidade_id) do nothing;

    select count(*) filter (where entidade = 'empreendimento'),
           count(*) filter (where entidade = 'unidade')
      into v_snapshot_empreendimentos, v_snapshot_unidades
    from private.produto_publicacao_snapshot_20260821;

    if v_snapshot_empreendimentos <> v_empreendimentos
       or v_snapshot_unidades <> v_unidades then
      raise exception
        'PRODUCT_SNAPSHOT_INCOMPLETE: esperado %/% e capturado %/%',
        v_empreendimentos,
        v_unidades,
        v_snapshot_empreendimentos,
        v_snapshot_unidades;
    end if;

    insert into private.produto_publicacao_snapshot_20260821_controle (
      id,
      total_empreendimentos,
      total_unidades
    ) values (
      true,
      v_empreendimentos,
      v_unidades
    );
  end if;

  select total_empreendimentos, total_unidades
    into v_empreendimentos, v_unidades
  from private.produto_publicacao_snapshot_20260821_controle
  where id;

  if not found then
    raise exception 'PRODUCT_SNAPSHOT_CONTROL_MISSING: controle do snapshot ausente.';
  end if;

  select count(*) filter (where entidade = 'empreendimento'),
         count(*) filter (where entidade = 'unidade')
    into v_snapshot_empreendimentos, v_snapshot_unidades
  from private.produto_publicacao_snapshot_20260821;

  if v_snapshot_empreendimentos <> v_empreendimentos
     or v_snapshot_unidades <> v_unidades then
    raise exception
      'PRODUCT_SNAPSHOT_CORRUPTED: controle %/% e snapshot %/%',
      v_empreendimentos,
      v_unidades,
      v_snapshot_empreendimentos,
      v_snapshot_unidades;
  end if;
end
$snapshot$;

comment on table private.produto_publicacao_snapshot_20260821 is
  'Estado editorial anterior à normalização de 2026-08-21. Sem PII; acesso restrito ao owner do banco.';

comment on table private.produto_publicacao_snapshot_20260821_controle is
  'Controle imutável de cobertura do snapshot editorial de 2026-08-21.';

create or replace function private.site_lead_normalizar_unidade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empreendimento_id uuid;
  v_empreendimento_nome text;
begin
  if new.unidade_id is null then
    -- Também cobre ON DELETE SET NULL da FK: o lead histórico é preservado,
    -- mas o identificador removido não permanece escondido no JSON.
    new.context := coalesce(new.context, '{}'::jsonb) - 'unidade_id';
    return new;
  end if;

  -- Um visitante só pode vincular um lead a uma unidade que efetivamente está
  -- visível no catálogo naquele instante. A consulta é explícita porque a
  -- função é SECURITY DEFINER.
  select u.empreendimento_id, e.nome
    into v_empreendimento_id, v_empreendimento_nome
  from public.unidades u
  join public.empreendimentos e on e.id = u.empreendimento_id
  where u.id = new.unidade_id
    and (
      (
        u.publicado is true
        and u.disponivel is true
        and u.aprovacao is not distinct from 'aprovado'
        and e.publicado is true
        and e.rascunho is false
        and e.aprovacao is not distinct from 'aprovado'
      )
      or (
        tg_op = 'UPDATE'
        and new.unidade_id is not distinct from old.unidade_id
      )
    );

  if not found then
    raise foreign_key_violation using
      message = 'SITE_LEAD_UNIT_NOT_PUBLIC: a unidade informada não está publicada no catálogo.';
  end if;

  if new.empreendimento_id is not null
     and new.empreendimento_id <> v_empreendimento_id then
    raise check_violation using
      message = 'SITE_LEAD_PROPERTY_MISMATCH: a unidade não pertence ao empreendimento informado.',
      constraint = 'site_leads_unidade_empreendimento_consistente';
  end if;

  new.empreendimento_id := v_empreendimento_id;
  new.empreendimento_nome := v_empreendimento_nome;
  new.context := jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(new.context, '{}'::jsonb),
        '{unidade_id}',
        to_jsonb(new.unidade_id::text),
        true
      ),
      '{empreendimento_id}',
      to_jsonb(v_empreendimento_id::text),
      true
    ),
    '{empreendimento_nome}',
    to_jsonb(v_empreendimento_nome),
    true
  );
  return new;
end;
$$;

revoke all on function private.site_lead_normalizar_unidade() from public;
revoke all on function private.site_lead_normalizar_unidade() from anon;
revoke all on function private.site_lead_normalizar_unidade() from authenticated;

drop trigger if exists trg_site_lead_normalizar_unidade on public.site_leads;
create trigger trg_site_lead_normalizar_unidade
before insert or update of unidade_id, context
on public.site_leads
for each row
execute function private.site_lead_normalizar_unidade();

-- Mantém a política pública estrita e compatível com a nova coluna. O BEFORE
-- trigger acima normaliza empreendimento/contexto antes desta checagem RLS.
drop policy if exists site_leads_insert_anon on public.site_leads;
create policy site_leads_insert_anon
on public.site_leads
for insert
to anon, authenticated
with check (
  char_length(trim(nome)) between 2 and 120
  and char_length(regexp_replace(telefone, '[^0-9]', '', 'g')) between 8 and 15
  and (email is null or char_length(email) between 3 and 254)
  and origem = 'site'
  and lead_type in ('comprador', 'proprietario', 'financiamento')
  and not atendido
  and crm_lead_id is null
  and crm_negocio_id is null
  and crm_synced_at is null
  and crm_sync_error is null
  and jsonb_typeof(tracking) = 'object'
  and jsonb_typeof(context) = 'object'
  and octet_length(context::text) <= 8000
  and (context - array[
    'empreendimento_id', 'empreendimento_nome', 'unidade_id',
    'preferencia_horario', 'captacao_id', 'finalidade', 'bairro',
    'cidade', 'area_util', 'valor_imovel', 'percentual_financiado',
    'valor_entrada', 'valor_financiar', 'renda_mensal', 'estado_civil',
    'objetivo', 'tipo_imovel', 'source'
  ]::text[]) = '{}'::jsonb
  and (
    (
      unidade_id is null
      and not (context ? 'unidade_id')
    )
    or (
      unidade_id is not null
      and empreendimento_id is not null
      and context ->> 'unidade_id' = unidade_id::text
    )
  )
);

-- ---------------------------------------------------------------------------
-- 2. Preço total em reais e estado editorial coerente
-- ---------------------------------------------------------------------------

-- Nenhum cadastro novo nasce na vitrine, mesmo quando o INSERT informa
-- publicado=true explicitamente. A única entrada oficial é a RPC abaixo,
-- que publica por UPDATE depois da decisão do gestor e das validações.
alter table public.empreendimentos
  alter column publicado set default false;

alter table public.unidades
  alter column publicado set default false;

comment on column public.empreendimentos.publicado is
  'Controle editorial: novos produtos nascem fora do site e só são publicados pela RPC produto_definir_publicacao.';

comment on column public.unidades.publicado is
  'Controle editorial: novas unidades nascem fora do site e só são publicadas pela RPC produto_definir_publicacao.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.empreendimentos'::regclass
      and conname = 'empreendimentos_preco_total_reais_check'
  ) then
    alter table public.empreendimentos
      add constraint empreendimentos_preco_total_reais_check check (
        publicado is not true
        or preco is null
        or (
          case
            when lower(btrim(coalesce(finalidade, ''))) like '%alug%'
              or lower(btrim(coalesce(finalidade, ''))) like '%loca%'
              then preco between 500 and 500000
            else preco between 100000 and 100000000
          end
        )
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.unidades'::regclass
      and conname = 'unidades_preco_total_reais_check'
  ) then
    alter table public.unidades
      add constraint unidades_preco_total_reais_check check (
        publicado is not true
        or (
          coalesce(valor_promo, valor_tabela) is not null
          and coalesce(valor_promo, valor_tabela) between 500 and 100000000
          and (
            valor_tabela is null
            or valor_promo is null
            or valor_promo <= valor_tabela
          )
        )
      ) not valid;
  end if;
end
$$;

create or replace function private.produto_validar_preco_unidade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finalidade text;
  v_aluguel boolean;
  v_minimo numeric;
  v_maximo numeric;
  v_validar_preco boolean := tg_op = 'INSERT';
begin
  select e.finalidade
    into v_finalidade
  from public.empreendimentos e
  where e.id = new.empreendimento_id;

  if not found then
    raise foreign_key_violation using
      message = 'PRODUCT_PARENT_NOT_FOUND: empreendimento da unidade não encontrado.';
  end if;

  if tg_op = 'INSERT' then
    new.publicado := false;
  end if;

  v_aluguel := lower(btrim(coalesce(v_finalidade, ''))) like '%alug%'
    or lower(btrim(coalesce(v_finalidade, ''))) like '%loca%';
  v_minimo := case when v_aluguel then 500 else 100000 end;
  v_maximo := case when v_aluguel then 500000 else 100000000 end;

  if tg_op = 'UPDATE' then
    v_validar_preco := new.empreendimento_id is distinct from old.empreendimento_id
      or new.valor_tabela is distinct from old.valor_tabela
      or new.valor_promo is distinct from old.valor_promo
      or (new.publicado is true and old.publicado is not true);
  end if;

  if v_validar_preco
     and coalesce(new.valor_promo, new.valor_tabela) is null then
    raise check_violation using
      message = 'UNIT_PRICE_REQUIRED: informe o valor total da unidade em reais.',
      constraint = 'unidades_preco_total_reais_check';
  end if;

  if v_validar_preco
     and new.valor_tabela is not null
     and new.valor_tabela not between v_minimo and v_maximo then
    raise check_violation using
      message = case when v_aluguel
        then 'UNIT_PRICE_INVALID: informe o aluguel mensal total em reais.'
        else 'UNIT_PRICE_INVALID: informe o preço total em reais; por exemplo, 710000 para R$ 710 mil.'
      end,
      constraint = 'unidades_preco_total_reais_check';
  end if;

  if v_validar_preco
     and new.valor_promo is not null
     and new.valor_promo not between v_minimo and v_maximo then
    raise check_violation using
      message = case when v_aluguel
        then 'UNIT_PROMO_PRICE_INVALID: informe o aluguel promocional total em reais.'
        else 'UNIT_PROMO_PRICE_INVALID: informe o preço promocional total em reais.'
      end,
      constraint = 'unidades_preco_total_reais_check';
  end if;

  if v_validar_preco
     and new.valor_tabela is not null
     and new.valor_promo is not null
     and new.valor_promo > new.valor_tabela then
    raise check_violation using
      message = 'UNIT_PROMO_ABOVE_LIST: o preço promocional não pode superar o valor de tabela.',
      constraint = 'unidades_preco_total_reais_check';
  end if;

  -- Pendente, reprovada ou indisponível nunca fica marcada para a vitrine.
  if new.aprovacao is distinct from 'aprovado'
     or new.disponivel is not true then
    new.publicado := false;
  end if;

  return new;
end;
$$;

revoke all on function private.produto_validar_preco_unidade() from public;
revoke all on function private.produto_validar_preco_unidade() from anon;
revoke all on function private.produto_validar_preco_unidade() from authenticated;

drop trigger if exists trg_produto_validar_preco_unidade on public.unidades;
create trigger trg_produto_validar_preco_unidade
before insert or update of empreendimento_id, valor_tabela, valor_promo, aprovacao, disponivel, publicado
on public.unidades
for each row
execute function private.produto_validar_preco_unidade();

-- Mesmo um gestor autenticado não publica por PATCH direto no PostgREST. A
-- RPC canônica abre uma autorização local, curta e vinculada ao usuário e ao
-- empreendimento; o trigger fecha todas as demais transições false/NULL ->
-- true. Retirar do ar continua sempre permitido como medida de segurança.
create or replace function private.produto_bloquear_publicacao_direta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_empreendimento_id uuid;
  v_contexto text;
  v_contexto_esperado text;
begin
  if tg_op = 'INSERT' then
    new.publicado := false;
    return new;
  end if;

  if new.publicado is true and old.publicado is not true then
    -- to_jsonb(NEW) mantém o mesmo trigger reutilizável nas duas tabelas sem
    -- tentar resolver uma coluna empreendimento_id que não existe no pai.
    v_empreendimento_id := case
      when tg_table_name = 'unidades'
        then (to_jsonb(new) ->> 'empreendimento_id')::uuid
      else new.id
    end;
    v_contexto := nullif(
      pg_catalog.current_setting('apecerto.produto_publicacao_context', true),
      ''
    );
    v_contexto_esperado := case when v_uid is null then null else
      v_uid::text || ':' || v_empreendimento_id::text
    end;

    if v_uid is null
       or v_contexto is distinct from v_contexto_esperado then
      raise insufficient_privilege using
        message = 'PRODUCT_PUBLICATION_RPC_REQUIRED: publique pela decisão oficial de Produtos.',
        hint = 'Use produto_definir_publicacao; despublicação direta continua permitida.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.produto_bloquear_publicacao_direta() from public;
revoke all on function private.produto_bloquear_publicacao_direta() from anon;
revoke all on function private.produto_bloquear_publicacao_direta() from authenticated;

drop trigger if exists trg_empreendimentos_bloquear_publicacao_direta
  on public.empreendimentos;
create trigger trg_empreendimentos_bloquear_publicacao_direta
before insert or update on public.empreendimentos
for each row
execute function private.produto_bloquear_publicacao_direta();

drop trigger if exists trg_unidades_bloquear_publicacao_direta
  on public.unidades;
create trigger trg_unidades_bloquear_publicacao_direta
before insert or update on public.unidades
for each row
execute function private.produto_bloquear_publicacao_direta();

comment on function private.produto_bloquear_publicacao_direta() is
  'Fail-closed: publicação false/NULL -> true exige contexto local emitido pela RPC e vinculado a auth.uid + empreendimento.';

-- Regra única usada pela validação do pai e pelo UPDATE em lote. Assim uma
-- unidade nunca é contada como pronta por uma regra e publicada por outra.
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

revoke all on function private.produto_unidade_elegivel_site(uuid) from public;
revoke all on function private.produto_unidade_elegivel_site(uuid) from anon;
revoke all on function private.produto_unidade_elegivel_site(uuid) from authenticated;

comment on function private.produto_unidade_elegivel_site(uuid) is
  'Elegibilidade integral e fail-closed de uma unidade para publicação em lote pelo empreendimento.';

-- O legado é normalizado somente quando há risco objetivo de exposição:
-- estado editorial inválido ou preço crítico. Demais lacunas continuam
-- marcadas no ERP para correção gradual, sem corte comercial automático.
update public.unidades u
set publicado = false
from public.empreendimentos e
where e.id = u.empreendimento_id
  and u.publicado is true
  and (
    u.disponivel is not true
    or u.aprovacao is distinct from 'aprovado'
    or coalesce(u.valor_promo, u.valor_tabela) is null
    or case
      when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
        or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
        then coalesce(u.valor_promo, u.valor_tabela) not between 500 and 500000
      else coalesce(u.valor_promo, u.valor_tabela) not between 100000 and 100000000
    end
    or (
      u.valor_tabela is not null
      and u.valor_promo is not null
      and u.valor_promo > u.valor_tabela
    )
  );

update public.empreendimentos e
set publicado = false
where e.publicado is true
  and e.preco is not null
  and case
    when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
      or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
      then e.preco not between 500 and 500000
    else e.preco not between 100000 and 100000000
  end;

-- Substitui a versão legada (`not publicado ...`), que seria permissiva caso
-- alguma coluna viesse a aceitar NULL no futuro.
alter table public.empreendimentos
  drop constraint if exists empreendimentos_publicacao_consistente;

alter table public.empreendimentos
  add constraint empreendimentos_publicacao_consistente check (
    publicado is not true
    or (
      rascunho is false
      and aprovacao is not distinct from 'aprovado'
    )
  );

alter table public.empreendimentos
  validate constraint empreendimentos_preco_total_reais_check;

alter table public.unidades
  validate constraint unidades_preco_total_reais_check;

alter table public.unidades
  drop constraint if exists unidades_publicacao_consistente;

alter table public.unidades
  add constraint unidades_publicacao_consistente check (
    publicado is not true
    or (disponivel is true and aprovacao is not distinct from 'aprovado')
  );

-- Índices parciais acompanham exatamente os predicados do catálogo público.
create index if not exists empreendimentos_site_publicados_idx
  on public.empreendimentos (destaque desc, ordem, nome, id)
  where publicado is true
    and rascunho is false
    and aprovacao is not distinct from 'aprovado';

create index if not exists unidades_site_visiveis_idx
  on public.unidades (empreendimento_id, numero, id)
  where publicado is true
    and disponivel is true
    and aprovacao is not distinct from 'aprovado';

-- ---------------------------------------------------------------------------
-- 3. Completude mínima revalidada no banco
-- ---------------------------------------------------------------------------

create or replace function private.produto_validacao_publicacao(
  p_empreendimento_id uuid,
  p_unidade_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_emp public.empreendimentos%rowtype;
  v_unidade public.unidades%rowtype;
  v_bloqueios text[] := array[]::text[];
  v_aluguel boolean;
  v_preco_min numeric;
  v_preco_max numeric;
  v_preco numeric;
  v_area numeric;
  v_unidades_validas integer := 0;
  v_fotos_pai integer := 0;
  v_fotos_unidade integer := 0;
  v_capa_pai boolean := false;
  v_capa_unidade boolean := false;
begin
  select e.* into v_emp
  from public.empreendimentos e
  where e.id = p_empreendimento_id;

  if not found then
    raise no_data_found using
      message = 'PRODUCT_NOT_FOUND: empreendimento não encontrado.';
  end if;

  v_aluguel := lower(btrim(coalesce(v_emp.finalidade, ''))) like '%alug%'
    or lower(btrim(coalesce(v_emp.finalidade, ''))) like '%loca%';
  v_preco_min := case when v_aluguel then 500 else 100000 end;
  v_preco_max := case when v_aluguel then 500000 else 100000000 end;

  select count(*)::integer, coalesce(bool_or(m.is_capa), false)
    into v_fotos_pai, v_capa_pai
  from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is null
    and m.tipo = 'foto'::public.tipo_midia;

  if p_unidade_id is not null then
    select u.* into v_unidade
    from public.unidades u
    where u.id = p_unidade_id
      and u.empreendimento_id = p_empreendimento_id;

    if not found then
      raise no_data_found using
        message = 'UNIT_NOT_FOUND: unidade não encontrada neste empreendimento.';
    end if;

    select count(*)::integer, coalesce(bool_or(m.is_capa), false)
      into v_fotos_unidade, v_capa_unidade
    from public.midias m
    where m.empreendimento_id = p_empreendimento_id
      and m.unidade_id = p_unidade_id
      and m.tipo = 'foto'::public.tipo_midia;

    v_preco := coalesce(v_unidade.valor_promo, v_unidade.valor_tabela);
    v_area := v_unidade.area_m2;
    v_unidades_validas := case when v_unidade.disponivel is true then 1 else 0 end;

    if nullif(btrim(coalesce(v_unidade.numero, '')), '') is null
       or nullif(btrim(coalesce(v_unidade.tipologia, '')), '') is null then
      v_bloqueios := array_append(v_bloqueios, 'Informar número e tipologia da unidade');
    end if;
    if v_unidade.disponivel is not true then
      v_bloqueios := array_append(v_bloqueios, 'Marcar a unidade como disponível');
    end if;
    if v_unidade.de_terceiros is true then
      if nullif(btrim(coalesce(v_unidade.proprietario_nome, '')), '') is null
         or nullif(btrim(coalesce(v_unidade.proprietario_contato, '')), '') is null then
        v_bloqueios := array_append(v_bloqueios, 'Completar proprietário e contato da unidade');
      end if;
      if nullif(btrim(coalesce(v_unidade.acesso_tipo, '')), '') is null
         or nullif(btrim(coalesce(v_unidade.acesso_instrucoes, '')), '') is null
         or (
           v_unidade.acesso_tipo = 'chave_digital'
           and nullif(btrim(coalesce(v_unidade.acesso_codigo, '')), '') is null
         ) then
        v_bloqueios := array_append(v_bloqueios, 'Completar instruções de acesso da unidade');
      end if;
      if v_fotos_unidade < 1 then
        v_bloqueios := array_append(v_bloqueios, 'Adicionar ao menos uma foto própria da unidade');
      end if;
    elsif v_fotos_unidade + v_fotos_pai < 6 then
      v_bloqueios := array_append(v_bloqueios, 'Adicionar pelo menos 6 fotos ao imóvel');
    end if;
  else
    select count(*)::integer,
           min(coalesce(u.valor_promo, u.valor_tabela)),
           min(u.area_m2)
      into v_unidades_validas, v_preco, v_area
    from public.unidades u
    where u.empreendimento_id = p_empreendimento_id
      and private.produto_unidade_elegivel_site(u.id) is true;

    v_preco := coalesce(v_emp.preco, v_preco);
    v_area := coalesce(v_emp.area_util, v_area);

    if v_fotos_pai < 6 then
      v_bloqueios := array_append(v_bloqueios, 'Adicionar pelo menos 6 fotos do empreendimento');
    end if;
    if not v_capa_pai then
      v_bloqueios := array_append(v_bloqueios, 'Definir a foto de capa');
    end if;
  end if;

  if nullif(btrim(coalesce(v_emp.nome, '')), '') is null then
    v_bloqueios := array_append(v_bloqueios, 'Informar o nome do imóvel');
  end if;
  if char_length(btrim(coalesce(v_emp.descricao, ''))) < 80 then
    v_bloqueios := array_append(v_bloqueios, 'Escrever uma descrição com pelo menos 80 caracteres');
  end if;
  if nullif(btrim(coalesce(v_emp.endereco, '')), '') is null
     or nullif(btrim(coalesce(v_emp.bairro, '')), '') is null
     or nullif(btrim(coalesce(v_emp.cidade, '')), '') is null then
    v_bloqueios := array_append(v_bloqueios, 'Completar endereço, bairro e cidade');
  end if;
  if nullif(btrim(coalesce(v_emp.finalidade, '')), '') is null then
    v_bloqueios := array_append(v_bloqueios, 'Informar a finalidade do imóvel');
  end if;
  if v_area is null or v_area <= 0 then
    v_bloqueios := array_append(v_bloqueios, 'Informar a área útil');
  end if;
  if v_preco is null or v_preco not between v_preco_min and v_preco_max then
    v_bloqueios := array_append(
      v_bloqueios,
      case when v_aluguel
        then 'Corrigir o aluguel mensal total em reais'
        else 'Corrigir o preço total em reais (ex.: 710000 para R$ 710 mil)'
      end
    );
  end if;
  if v_unidades_validas = 0 then
    v_bloqueios := array_append(
      v_bloqueios,
      'Cadastrar ao menos uma unidade aprovada, disponível e com preço válido'
    );
  end if;

  return jsonb_build_object(
    'pronto', cardinality(v_bloqueios) = 0,
    'bloqueios', to_jsonb(v_bloqueios),
    'preco_interpretado', v_preco,
    'preco_minimo', v_preco_min,
    'preco_maximo', v_preco_max,
    'area_interpretada', v_area,
    'fotos_empreendimento', v_fotos_pai,
    'fotos_unidade', v_fotos_unidade,
    'capa_definida', case when p_unidade_id is null then v_capa_pai else v_capa_unidade or v_capa_pai end,
    'unidades_disponiveis', v_unidades_validas
  );
end;
$$;

revoke all on function private.produto_validacao_publicacao(uuid, uuid) from public;
revoke all on function private.produto_validacao_publicacao(uuid, uuid) from anon;
revoke all on function private.produto_validacao_publicacao(uuid, uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- 4. Única operação editorial: aprovar/publicar/despublicar atomicamente
-- ---------------------------------------------------------------------------

-- A função já existia, mas usava public no search_path de um SECURITY DEFINER.
-- A versão abaixo fecha a resolução de nomes e mantém a mesma matriz de papéis.
create or replace function public.is_product_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and u.ativo
      and u.role::text in (
        'admin', 'gestor', 'executivo', 'gestor_comercial', 'gestor_equipe'
      )
  );
$$;

revoke all on function public.is_product_manager() from public;
revoke all on function public.is_product_manager() from anon;
grant execute on function public.is_product_manager() to authenticated;

create or replace function public.produto_definir_publicacao(
  p_empreendimento_id uuid,
  p_publicado boolean,
  p_unidade_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_emp public.empreendimentos%rowtype;
  v_unidade public.unidades%rowtype;
  v_validacao jsonb := jsonb_build_object(
    'pronto', true,
    'bloqueios', '[]'::jsonb
  );
  v_site_visivel boolean := false;
begin
  if p_publicado is null then
    raise invalid_parameter_value using
      message = 'PRODUCT_PUBLICATION_INVALID: informe se o produto deve ser publicado.';
  end if;

  if v_uid is null or not coalesce(public.is_product_manager(), false) then
    raise insufficient_privilege using
      message = 'PRODUCT_PUBLICATION_FORBIDDEN: apenas a gestão de Produtos pode publicar ou retirar imóveis do site.';
  end if;

  -- Limpa qualquer valor herdado dentro da transação e só abre o contexto
  -- depois da autorização. O terceiro argumento=true limita o GUC à transação.
  perform pg_catalog.set_config(
    'apecerto.produto_publicacao_context',
    '',
    true
  );

  -- Locks determinísticos impedem duas decisões concorrentes de se
  -- sobrescreverem. Toda exceção desfaz publicação e auditoria juntas.
  select e.* into v_emp
  from public.empreendimentos e
  where e.id = p_empreendimento_id
  for update;

  if not found then
    raise no_data_found using
      message = 'PRODUCT_NOT_FOUND: empreendimento não encontrado.';
  end if;

  if p_unidade_id is not null then
    select u.* into v_unidade
    from public.unidades u
    where u.id = p_unidade_id
      and u.empreendimento_id = p_empreendimento_id
    for update;

    if not found then
      raise no_data_found using
        message = 'UNIT_NOT_FOUND: unidade não encontrada neste empreendimento.';
    end if;
  end if;

  if p_publicado then
    v_validacao := private.produto_validacao_publicacao(
      p_empreendimento_id,
      p_unidade_id
    );

    if not coalesce((v_validacao ->> 'pronto')::boolean, false) then
      raise exception using
        errcode = 'P0001',
        message = case when p_unidade_id is null
          then 'PRODUCT_NOT_READY: este imóvel ainda não atingiu o padrão mínimo para o site.'
          else 'UNIT_NOT_READY: esta unidade ainda não atingiu o padrão mínimo para o site.'
        end,
        detail = v_validacao::text,
        hint = 'Corrija os itens de bloqueios e tente novamente.';
    end if;

    perform pg_catalog.set_config(
      'apecerto.produto_publicacao_context',
      v_uid::text || ':' || p_empreendimento_id::text,
      true
    );

    if p_unidade_id is not null then
      update public.unidades
      set aprovacao = 'aprovado',
          publicado = true,
          reprovacao_motivo = null
      where id = p_unidade_id;
    else
      -- No primeiro "aprovar e publicar", evita o estado enganoso de prédio
      -- publicado sem qualquer unidade na vitrine. Uma republicação normal
      -- preserva escolhas individuais elegíveis; as incompletas são retiradas
      -- somente quando o gestor toma esta nova decisão sobre o pai.
      update public.unidades u
      set publicado = false
      where u.empreendimento_id = p_empreendimento_id
        and u.publicado is true
        and private.produto_unidade_elegivel_site(u.id) is not true;

      if not exists (
        select 1
        from public.unidades u
        where u.empreendimento_id = p_empreendimento_id
          and u.publicado is true
          and private.produto_unidade_elegivel_site(u.id) is true
      ) then
        update public.unidades
        set publicado = true
        where empreendimento_id = p_empreendimento_id
          and private.produto_unidade_elegivel_site(id) is true;
      end if;
    end if;

    update public.empreendimentos
    set aprovacao = 'aprovado',
        publicado = true,
        rascunho = false,
        aprovado_por = v_uid,
        aprovado_em = now(),
        published_at = coalesce(published_at, now()),
        reprovacao_motivo = null
    where id = p_empreendimento_id;
  elsif p_unidade_id is not null then
    update public.unidades
    set publicado = false
    where id = p_unidade_id;
  else
    update public.empreendimentos
    set publicado = false
    where id = p_empreendimento_id;
  end if;

  -- Não deixa a autorização disponível para outra instrução na mesma
  -- transação de um cliente SQL privilegiado.
  perform pg_catalog.set_config(
    'apecerto.produto_publicacao_context',
    '',
    true
  );

  select e.* into v_emp
  from public.empreendimentos e
  where e.id = p_empreendimento_id;

  if p_unidade_id is not null then
    select u.* into v_unidade
    from public.unidades u
    where u.id = p_unidade_id;

    v_site_visivel := v_emp.publicado is true
      and v_emp.rascunho is false
      and v_emp.aprovacao is not distinct from 'aprovado'
      and v_unidade.publicado is true
      and v_unidade.disponivel is true
      and v_unidade.aprovacao is not distinct from 'aprovado';
  else
    v_site_visivel := v_emp.publicado is true
      and v_emp.rascunho is false
      and v_emp.aprovacao is not distinct from 'aprovado'
      and exists (
        select 1
        from public.unidades u
        where u.empreendimento_id = p_empreendimento_id
          and u.publicado is true
          and u.disponivel is true
          and u.aprovacao is not distinct from 'aprovado'
      );
  end if;

  return jsonb_build_object(
    'ok', true,
    'empreendimento_id', p_empreendimento_id,
    'unidade_id', p_unidade_id,
    'publicado', case when p_unidade_id is null then v_emp.publicado else v_unidade.publicado end,
    'aprovacao', case when p_unidade_id is null then v_emp.aprovacao else v_unidade.aprovacao end,
    'rascunho', v_emp.rascunho,
    'site_visivel', v_site_visivel,
    'validacao', v_validacao
  );
end;
$$;

revoke all on function public.produto_definir_publicacao(uuid, boolean, uuid) from public;
revoke all on function public.produto_definir_publicacao(uuid, boolean, uuid) from anon;
grant execute on function public.produto_definir_publicacao(uuid, boolean, uuid) to authenticated;

comment on function public.produto_definir_publicacao(uuid, boolean, uuid) is
  'Decisão transacional do gestor. Publicar também aprova; despublicar preserva aprovação e disponibilidade. Toda mudança é auditada por trigger.';

-- Exclusão definitiva continua sem DELETE genérico. A RPC concentra papel,
-- locks, proteção do histórico comercial e auditoria em uma transação. Os
-- caminhos das mídias são devolvidos para a API remover os objetos do Storage
-- após o commit; eventual falha externa deixa apenas órfão recuperável, nunca
-- um produto parcialmente apagado no banco.
create or replace function public.produto_excluir(
  p_empreendimento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_usuario_nome text;
  v_emp public.empreendimentos%rowtype;
  v_midias_paths text[] := array[]::text[];
  v_midias_total bigint := 0;
  v_unidades_total bigint := 0;
  v_negocios bigint := 0;
  v_vendas bigint := 0;
  v_visitas bigint := 0;
  v_f2_visitas bigint := 0;
  v_pipelines bigint := 0;
  v_propostas bigint := 0;
  v_captacoes bigint := 0;
  v_vinculos_total bigint := 0;
  v_vinculos jsonb;
begin
  if v_uid is null or not coalesce(public.is_product_manager(), false) then
    raise insufficient_privilege using
      message = 'PRODUCT_DELETE_FORBIDDEN: apenas a gestão de Produtos pode excluir imóveis.';
  end if;

  -- O FOR UPDATE no pai serializa exclusão/publicação e impede a criação de
  -- novos vínculos FK enquanto a decisão é validada. As unidades também são
  -- travadas para que o resumo auditado corresponda ao conjunto excluído.
  select e.* into v_emp
  from public.empreendimentos e
  where e.id = p_empreendimento_id
  for update;

  if not found then
    raise no_data_found using
      message = 'PRODUCT_NOT_FOUND: empreendimento não encontrado.';
  end if;

  perform u.id
  from public.unidades u
  where u.empreendimento_id = p_empreendimento_id
  order by u.id
  for update;

  select count(*) into v_negocios
  from public.negocios n
  where n.empreendimento_id = p_empreendimento_id;

  select count(*) into v_vendas
  from public.vendas v
  where v.empreendimento_id = p_empreendimento_id;

  select count(*) into v_visitas
  from public.visitas v
  where v.empreendimento_id = p_empreendimento_id;

  select count(*) into v_f2_visitas
  from public.f2_visita v
  where v.empreendimento_id = p_empreendimento_id;

  select count(*) into v_pipelines
  from public.pipelines p
  where p.empreendimento_id = p_empreendimento_id;

  select count(*) into v_propostas
  from public.ncrm_proposta p
  where p.empreendimento_id = p_empreendimento_id;

  select count(*) into v_captacoes
  from public.captacoes_portal c
  where c.empreendimento_id = p_empreendimento_id;

  v_vinculos_total := v_negocios + v_vendas + v_visitas + v_f2_visitas
    + v_pipelines + v_propostas + v_captacoes;
  v_vinculos := jsonb_build_object(
    'negocios', v_negocios,
    'vendas', v_vendas,
    'visitas', v_visitas + v_f2_visitas,
    'pipelines', v_pipelines,
    'propostas', v_propostas,
    'captacoes_portal', v_captacoes
  );

  if v_vinculos_total > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCT_HAS_LINKS: este produto possui histórico comercial e não pode ser excluído.',
      detail = v_vinculos::text,
      hint = 'Preserve o imóvel ou desvincule os registros comerciais antes de excluir.';
  end if;

  select coalesce(array_agg(m.storage_path order by m.storage_path), array[]::text[]),
         count(*)
    into v_midias_paths, v_midias_total
  from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and nullif(btrim(coalesce(m.storage_path, '')), '') is not null;

  select count(*) into v_unidades_total
  from public.unidades u
  where u.empreendimento_id = p_empreendimento_id;

  delete from public.empreendimentos e
  where e.id = p_empreendimento_id;

  if not found then
    raise serialization_failure using
      message = 'PRODUCT_DELETE_RACE: o produto mudou durante a exclusão; tente novamente.';
  end if;

  select u.nome into v_usuario_nome
  from public.usuarios u
  where u.id = v_uid;

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
    v_uid,
    v_usuario_nome,
    'excluir',
    'produtos',
    'empreendimento',
    p_empreendimento_id::text,
    jsonb_build_object(
      'id', v_emp.id,
      'nome', v_emp.nome,
      'publicado', v_emp.publicado,
      'aprovacao', v_emp.aprovacao,
      'rascunho', v_emp.rascunho,
      'unidades_total', v_unidades_total,
      'midias_total', v_midias_total
    ),
    null,
    'Exclusão transacional do cadastro; caminhos de mídia devolvidos para limpeza do Storage. txid='
      || txid_current()::text
  );

  return jsonb_build_object(
    'ok', true,
    'empreendimento_id', p_empreendimento_id,
    'nome', v_emp.nome,
    'midias_paths', to_jsonb(v_midias_paths),
    'midias_total', v_midias_total,
    'unidades_total', v_unidades_total
  );
end;
$$;

revoke all on function public.produto_excluir(uuid) from public;
revoke all on function public.produto_excluir(uuid) from anon;
grant execute on function public.produto_excluir(uuid) to authenticated;

comment on function public.produto_excluir(uuid) is
  'Exclusão manager-only, transacional e auditada; bloqueia histórico comercial e retorna os caminhos de mídia para limpeza externa.';

-- Compatibilidade com /api/capture e clientes já publicados. Aprovar não
-- mantém uma segunda implementação: delega para a RPC canônica e, portanto,
-- passa pelas mesmas travas de completude, preço, lock e autorização.
create or replace function public.aprovar_empreendimento(
  p_id uuid,
  p_aprovar boolean,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_emp public.empreendimentos%rowtype;
begin
  if p_aprovar is null then
    raise invalid_parameter_value using
      message = 'PRODUCT_APPROVAL_INVALID: informe a decisão de aprovação.';
  end if;

  if p_aprovar then
    return public.produto_definir_publicacao(p_id, true, null);
  end if;

  if v_uid is null or not coalesce(public.is_product_manager(), false) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Apenas a gestão de Produtos pode reprovar empreendimentos.'
    );
  end if;

  select e.* into v_emp
  from public.empreendimentos e
  where e.id = p_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Empreendimento não encontrado.');
  end if;

  update public.empreendimentos
  set aprovacao = 'reprovado',
      publicado = false,
      aprovado_por = v_uid,
      aprovado_em = now(),
      reprovacao_motivo = nullif(btrim(coalesce(p_motivo, '')), '')
  where id = p_id;

  return jsonb_build_object(
    'ok', true,
    'empreendimento_id', p_id,
    'aprovacao', 'reprovado',
    'publicado', false,
    'site_visivel', false
  );
end;
$$;

revoke all on function public.aprovar_empreendimento(uuid, boolean, text) from public;
revoke all on function public.aprovar_empreendimento(uuid, boolean, text) from anon;
grant execute on function public.aprovar_empreendimento(uuid, boolean, text) to authenticated;

comment on function public.aprovar_empreendimento(uuid, boolean, text) is
  'Wrapper legado: aprovação delega para produto_definir_publicacao; reprovação preserva compatibilidade e permanece auditada.';

-- ---------------------------------------------------------------------------
-- 5. Auditoria obrigatória inclusive para alterações diretas/legadas
-- ---------------------------------------------------------------------------

create or replace function private.produto_auditar_publicacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text;
  v_acao text;
  v_entidade text := case when tg_table_name = 'unidades' then 'unidade' else 'empreendimento' end;
  v_antes jsonb;
  v_depois jsonb;
begin
  if tg_table_name = 'unidades' then
    if old.publicado is not distinct from new.publicado
       and old.aprovacao is not distinct from new.aprovacao
       and old.disponivel is not distinct from new.disponivel then
      return new;
    end if;
    v_antes := jsonb_build_object(
      'publicado', old.publicado,
      'aprovacao', old.aprovacao,
      'disponivel', old.disponivel,
      'empreendimento_id', old.empreendimento_id
    );
    v_depois := jsonb_build_object(
      'publicado', new.publicado,
      'aprovacao', new.aprovacao,
      'disponivel', new.disponivel,
      'empreendimento_id', new.empreendimento_id
    );
  else
    if old.publicado is not distinct from new.publicado
       and old.aprovacao is not distinct from new.aprovacao
       and old.rascunho is not distinct from new.rascunho then
      return new;
    end if;
    v_antes := jsonb_build_object(
      'publicado', old.publicado,
      'aprovacao', old.aprovacao,
      'rascunho', old.rascunho
    );
    v_depois := jsonb_build_object(
      'publicado', new.publicado,
      'aprovacao', new.aprovacao,
      'rascunho', new.rascunho
    );
  end if;

  v_acao := case
    when old.publicado is distinct from new.publicado and new.publicado is true then 'publicar'
    when old.publicado is distinct from new.publicado and new.publicado is false then 'despublicar'
    when old.aprovacao is distinct from new.aprovacao and new.aprovacao = 'aprovado' then 'aprovar'
    when old.aprovacao is distinct from new.aprovacao and new.aprovacao = 'reprovado' then 'reprovar'
    else 'atualizar_publicacao'
  end;

  select u.nome into v_nome
  from public.usuarios u
  where u.id = v_uid;

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
    v_uid,
    v_nome,
    v_acao,
    'produtos',
    v_entidade,
    new.id::text,
    v_antes,
    v_depois,
    'Mudança editorial transacional txid=' || txid_current()::text
  );

  return new;
end;
$$;

revoke all on function private.produto_auditar_publicacao() from public;
revoke all on function private.produto_auditar_publicacao() from anon;
revoke all on function private.produto_auditar_publicacao() from authenticated;

drop trigger if exists trg_empreendimentos_auditar_publicacao on public.empreendimentos;
create trigger trg_empreendimentos_auditar_publicacao
after update of publicado, aprovacao, rascunho
on public.empreendimentos
for each row
execute function private.produto_auditar_publicacao();

drop trigger if exists trg_unidades_auditar_publicacao on public.unidades;
create trigger trg_unidades_auditar_publicacao
after update of publicado, aprovacao, disponivel
on public.unidades
for each row
execute function private.produto_auditar_publicacao();

-- ---------------------------------------------------------------------------
-- 6. View única da vitrine; cada unidade expõe seu UUID verdadeiro
-- ---------------------------------------------------------------------------

create or replace view public.site_produtos
with (security_invoker = true)
as
select
  e.id, e.nome, e.slug, e.slogan, e.bairro, e.endereco, e.status, e.entrega,
  e.area_util, e.dormitorios, e.suites, e.banheiros, e.vagas, e.preco,
  e.condominio_valor, e.destaque, e.ordem, e.lazer, e.diferenciais,
  e.finalidade, e.descricao, e.iptu, e.latitude, e.longitude,
  (
    select m.storage_path
    from public.midias m
    where m.empreendimento_id = e.id
      and m.unidade_id is null
      and m.tipo = 'foto'::public.tipo_midia
    order by m.is_capa desc, m.created_at
    limit 1
  ) as capa_path,
  (
    select coalesce(
      json_agg(m.storage_path order by m.is_capa desc, m.created_at),
      '[]'::json
    )
    from public.midias m
    where m.empreendimento_id = e.id
      and m.unidade_id is null
      and m.tipo = 'foto'::public.tipo_midia
  ) as fotos,
  (
    select count(*)
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as unidades_disponiveis,
  (
    select min(coalesce(u.valor_promo, u.valor_tabela))
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as preco_min,
  (
    select max(coalesce(u.valor_promo, u.valor_tabela))
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as preco_max,
  (
    select min(u.area_m2)
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as area_min_disponivel,
  (
    select max(u.area_m2)
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as area_max_disponivel,
  (
    select min(case
      when lower(coalesce(u.tipologia, '')) like '%studio%' then 0
      when substring(coalesce(u.tipologia, '') from '^[[:space:]]*([0-9]+)') is not null
        then substring(u.tipologia from '^[[:space:]]*([0-9]+)')::integer
      else null
    end)
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as dormitorios_min_disponiveis,
  (
    select max(case
      when lower(coalesce(u.tipologia, '')) like '%studio%' then 0
      when substring(coalesce(u.tipologia, '') from '^[[:space:]]*([0-9]+)') is not null
        then substring(u.tipologia from '^[[:space:]]*([0-9]+)')::integer
      else null
    end)
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as dormitorios_max_disponiveis,
  (
    select min(u.vagas)
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as vagas_min_disponiveis,
  (
    select max(u.vagas)
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as vagas_max_disponiveis,
  (
    select array_agg(distinct u.tipologia order by u.tipologia)
      filter (where u.tipologia is not null)
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as tipologias_disponiveis,
  e.titulo, e.tour_url, e.cidade, e.uf, e.codigo,
  (
    select coalesce(
      json_agg(
        json_build_object(
          'id', u.id,
          'slug',
            coalesce(
              nullif(
                btrim(
                  regexp_replace(lower(coalesce(e.slug, '')), '[^a-z0-9]+', '-', 'g'),
                  '-'
                ),
                ''
              ),
              'imovel'
            )
            || '-un-'
            || case
              when nullif(
                btrim(
                  regexp_replace(lower(coalesce(u.codigo, '')), '[^a-z0-9]+', '-', 'g'),
                  '-'
                ),
                ''
              ) is null then ''
              else btrim(
                regexp_replace(lower(u.codigo), '[^a-z0-9]+', '-', 'g'),
                '-'
              ) || '-'
            end
            || u.id::text,
          'codigo', u.codigo,
          'numero', u.numero,
          'tipologia', u.tipologia,
          'area_m2', u.area_m2,
          'vagas', u.vagas,
          'valor', coalesce(u.valor_promo, u.valor_tabela),
          'capa_path', (
            select m.storage_path
            from public.midias m
            where m.unidade_id = u.id
              and m.tipo = 'foto'::public.tipo_midia
            order by m.is_capa desc, m.created_at
            limit 1
          ),
          'fotos', (
            select coalesce(
              json_agg(m.storage_path order by m.is_capa desc, m.created_at),
              '[]'::json
            )
            from public.midias m
            where m.unidade_id = u.id
              and m.tipo = 'foto'::public.tipo_midia
          )
        )
        order by u.numero nulls last, u.id
      ),
      '[]'::json
    )
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado is true
      and u.disponivel is true
      and u.aprovacao is not distinct from 'aprovado'
  ) as unidades_site
from public.empreendimentos e
where e.publicado is true
  and e.rascunho is false
  and e.aprovacao is not distinct from 'aprovado'
  and exists (
    select 1
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado is true
      and u.disponivel is true
      and u.aprovacao is not distinct from 'aprovado'
  );

revoke all privileges on public.site_produtos from anon, authenticated;
grant select on public.site_produtos to anon, authenticated;

comment on view public.site_produtos is
  'Fonte pública única do site: somente produtos/unidades aprovados, disponíveis e publicados; unidades carregam o UUID real.';

-- ---------------------------------------------------------------------------
-- 7. Superfícies legadas deixam de ser públicas
-- ---------------------------------------------------------------------------

-- anuncios_site permanece temporariamente para compatibilidade interna, mas
-- não alimenta nem pode ser consultada pelo visitante.
revoke all privileges on public.anuncios_site from anon;

-- A captação do proprietário exige sessão; o visitante anônimo não recebe
-- acesso direto a dados pessoais dessa tabela.
revoke all privileges on public.captacoes_portal from anon;

-- RLS não protege TRUNCATE e usuários de aplicação não criam triggers/FKs.
-- Mantemos somente os DMLs necessários pelas policies e rotas existentes.
revoke truncate, references, trigger
  on public.anuncios_site, public.captacoes_portal,
     public.empreendimentos, public.unidades
  from authenticated;

-- O JWT comum não recebe DELETE direto: a gestão usa produto_excluir(), que
-- verifica vínculos e audita a remoção dentro da mesma transação.
revoke delete on public.empreendimentos from authenticated;

comment on table public.anuncios_site is
  'LEGADO: não é fonte da vitrine. A publicação oficial usa empreendimentos/unidades e a view site_produtos.';

comment on table public.captacoes_portal is
  'Entrada autenticada de proprietários. Após análise, o imóvel comercial deve ser criado em empreendimentos/unidades.';
