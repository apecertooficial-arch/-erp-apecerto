-- Produtos v4: a unidade continua sendo o imóvel comercial canônico.
-- Proprietário sai da tabela amplamente legível, a origem comercial passa a
-- ser explícita e a fila de qualidade vira uma consulta permanente e segura.

set lock_timeout = '5s';
set statement_timeout = '60s';

create table if not exists private.unidade_proprietarios (
  unidade_id uuid primary key references public.unidades(id) on delete cascade,
  captador_corretor_id bigint not null references public.corretores(id),
  nome text not null check (nullif(btrim(nome), '') is not null),
  contato text not null check (nullif(btrim(contato), '') is not null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.unidade_proprietarios enable row level security;
revoke all on table private.unidade_proprietarios from public, anon, authenticated;

insert into private.unidade_proprietarios (
  unidade_id, captador_corretor_id, nome, contato
)
select u.id, u.captador_corretor_id, btrim(u.proprietario_nome), btrim(u.proprietario_contato)
from public.unidades u
where u.captador_corretor_id is not null
  and nullif(btrim(coalesce(u.proprietario_nome, '')), '') is not null
  and nullif(btrim(coalesce(u.proprietario_contato, '')), '') is not null
on conflict (unidade_id) do update
set captador_corretor_id = excluded.captador_corretor_id,
    nome = excluded.nome,
    contato = excluded.contato,
    updated_at = now();

update public.unidades
set proprietario_nome = null,
    proprietario_contato = null
where proprietario_nome is not null or proprietario_contato is not null;

-- Os dois produtos legados de terceiros já possuem proprietario_id protegido
-- por RLS. As cópias textuais deixam de existir na tabela comercial.
update public.empreendimentos
set proprietario_nome = null,
    proprietario_tel = null,
    proprietario_email = null
where proprietario_nome is not null
   or proprietario_tel is not null
   or proprietario_email is not null;

create or replace function private.produto_proteger_proprietario_unidade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corretor_id bigint;
begin
  if new.proprietario_nome is not null or new.proprietario_contato is not null then
    if nullif(btrim(coalesce(new.proprietario_nome, '')), '') is null
       or nullif(btrim(coalesce(new.proprietario_contato, '')), '') is null then
      raise check_violation using
        message = 'UNIT_OWNER_REQUIRED: informe nome e contato do proprietário.';
    end if;
    if new.captador_corretor_id is null then
      raise check_violation using
        message = 'UNIT_CAPTOR_REQUIRED: vincule o captador antes de salvar o proprietário.';
    end if;

    if (select auth.uid()) is not null then
      select c.id into v_corretor_id
      from public.corretores c
      where c.usuario_id = (select auth.uid())
      limit 1;
      if v_corretor_id is distinct from new.captador_corretor_id then
        raise insufficient_privilege using
          message = 'UNIT_OWNER_FORBIDDEN: somente o captador pode salvar o proprietário.';
      end if;
    end if;

    insert into private.unidade_proprietarios (
      unidade_id, captador_corretor_id, nome, contato
    ) values (
      new.id, new.captador_corretor_id, btrim(new.proprietario_nome), btrim(new.proprietario_contato)
    )
    on conflict (unidade_id) do update
    set captador_corretor_id = excluded.captador_corretor_id,
        nome = excluded.nome,
        contato = excluded.contato,
        updated_at = now();

    update public.unidades
    set proprietario_nome = null,
        proprietario_contato = null
    where id = new.id
      and (proprietario_nome is not null or proprietario_contato is not null);
  end if;
  return new;
end;
$$;

revoke all on function private.produto_proteger_proprietario_unidade()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_unidades_proteger_proprietario on public.unidades;
create trigger trg_unidades_proteger_proprietario
after insert or update of proprietario_nome, proprietario_contato
on public.unidades
for each row execute function private.produto_proteger_proprietario_unidade();

create or replace function private.produto_bloquear_proprietario_inline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.origem = 'terceiros'
     and new.proprietario_id is null
     and (new.proprietario_nome is not null
       or new.proprietario_tel is not null
       or new.proprietario_email is not null) then
    raise check_violation using
      message = 'PRODUCT_OWNER_REFERENCE_REQUIRED: salve o proprietário protegido antes de vincular o imóvel.';
  end if;
  new.proprietario_nome := null;
  new.proprietario_tel := null;
  new.proprietario_email := null;
  return new;
end;
$$;

revoke all on function private.produto_bloquear_proprietario_inline()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_empreendimentos_bloquear_proprietario_inline on public.empreendimentos;
create trigger trg_empreendimentos_bloquear_proprietario_inline
before insert or update of proprietario_nome, proprietario_tel, proprietario_email
on public.empreendimentos
for each row execute function private.produto_bloquear_proprietario_inline();

alter table public.unidades
  add column if not exists origem_comercial text;

update public.unidades u
set origem_comercial = case
  when u.de_terceiros is true then 'terceiros'
  when lower(btrim(coalesce(e.status::text, ''))) like '%pronto%' then 'remanescente'
  else 'lancamento'
end
from public.empreendimentos e
where e.id = u.empreendimento_id
  and u.origem_comercial is null;

alter table public.unidades alter column origem_comercial set not null;
alter table public.unidades drop constraint if exists unidades_origem_comercial_check;
alter table public.unidades add constraint unidades_origem_comercial_check
  check (origem_comercial in ('terceiros', 'lancamento', 'remanescente'));

create or replace function private.produto_definir_origem_comercial_unidade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if new.de_terceiros is true then
    new.origem_comercial := 'terceiros';
  else
    select e.status into v_status
    from public.empreendimentos e where e.id = new.empreendimento_id;
    new.origem_comercial := case
      when lower(btrim(coalesce(v_status, ''))) like '%pronto%' then 'remanescente'
      else 'lancamento'
    end;
  end if;
  return new;
end;
$$;

revoke all on function private.produto_definir_origem_comercial_unidade()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_unidades_definir_origem_comercial on public.unidades;
create trigger trg_unidades_definir_origem_comercial
before insert or update of de_terceiros, empreendimento_id
on public.unidades
for each row execute function private.produto_definir_origem_comercial_unidade();

create or replace function private.produto_atualizar_origem_estoque()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    update public.unidades
    set origem_comercial = case
      when lower(btrim(coalesce(new.status::text, ''))) like '%pronto%' then 'remanescente'
      else 'lancamento'
    end
    where empreendimento_id = new.id and de_terceiros is false;
  end if;
  return new;
end;
$$;

revoke all on function private.produto_atualizar_origem_estoque()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_empreendimentos_atualizar_origem_estoque on public.empreendimentos;
create trigger trg_empreendimentos_atualizar_origem_estoque
after update of status on public.empreendimentos
for each row execute function private.produto_atualizar_origem_estoque();

create or replace function public.produto_unidades_origens()
returns table (unidade_id uuid, origem_comercial text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.origem_comercial
  from public.unidades u
  where (select auth.uid()) is not null;
$$;

revoke all on function public.produto_unidades_origens()
  from public, anon, authenticated, service_role;
grant execute on function public.produto_unidades_origens()
  to authenticated;

create or replace function private.produto_unidade_proprietario_completo(p_unidade_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.unidade_proprietarios p
    where p.unidade_id = p_unidade_id
      and nullif(btrim(p.nome), '') is not null
      and nullif(btrim(p.contato), '') is not null
  );
$$;

revoke all on function private.produto_unidade_proprietario_completo(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.produto_unidades_proprietarios_ler(
  p_empreendimento_ids uuid[]
)
returns table (
  unidade_id uuid,
  proprietario_nome text,
  proprietario_contato text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.unidade_id, p.nome, p.contato
  from private.unidade_proprietarios p
  join public.unidades u on u.id = p.unidade_id
  join public.corretores c on c.id = u.captador_corretor_id
  where (select auth.uid()) is not null
    and c.usuario_id = (select auth.uid())
    and u.empreendimento_id = any(coalesce(p_empreendimento_ids, array[]::uuid[]));
$$;

revoke all on function public.produto_unidades_proprietarios_ler(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.produto_unidades_proprietarios_ler(uuid[])
  to authenticated;

create or replace function public.produto_unidades_proprietario_status(
  p_unidade_ids uuid[]
)
returns table (unidade_id uuid, completo boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, private.produto_unidade_proprietario_completo(u.id)
  from public.unidades u
  where (select auth.uid()) is not null
    and u.id = any(coalesce(p_unidade_ids, array[]::uuid[]));
$$;

revoke all on function public.produto_unidades_proprietario_status(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.produto_unidades_proprietario_status(uuid[])
  to authenticated;

create or replace function public.produto_qualidade_fila()
returns table (
  unidade_id uuid,
  empreendimento_id uuid,
  codigo text,
  numero text,
  produto_nome text,
  origem_comercial text,
  problemas text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.empreendimento_id, u.codigo, u.numero, e.nome,
         u.origem_comercial, q.problemas
  from public.unidades u
  join public.empreendimentos e on e.id = u.empreendimento_id
  cross join lateral (
    select array_remove(array[
      case when u.de_terceiros and u.captador_corretor_id is null then 'sem_captador' end,
      case when u.de_terceiros and not private.produto_unidade_proprietario_completo(u.id) then 'sem_proprietario' end,
      case when not exists (
        select 1 from public.midias m
        where m.unidade_id = u.id and m.tipo = 'foto'::public.tipo_midia
      ) then 'sem_foto_propria' end,
      case when not u.de_terceiros and e.condominio_id is null then 'sem_condominio_referencia' end,
      case when coalesce(u.valor_promo, u.valor_tabela) is null
        or case
          when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
            or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
            then coalesce(u.valor_promo, u.valor_tabela) not between 500 and 500000
          else coalesce(u.valor_promo, u.valor_tabela) not between 100000 and 100000000
        end then 'preco_invalido' end
    ], null)::text[] as problemas
  ) q
  where (select auth.uid()) is not null
    and (
      public.is_product_manager()
      or u.captador_corretor_id in (
        select c.id from public.corretores c
        where c.usuario_id = (select auth.uid())
      )
    )
    and cardinality(q.problemas) > 0
  order by e.nome, u.numero;
$$;

revoke all on function public.produto_qualidade_fila()
  from public, anon, authenticated, service_role;
grant execute on function public.produto_qualidade_fila()
  to authenticated;

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
      and (u.valor_tabela is null or u.valor_promo is null
           or u.valor_promo <= u.valor_tabela)
      and exists (
        select 1 from public.midias m
        where m.unidade_id = u.id
          and m.tipo = 'foto'::public.tipo_midia
      )
      and (
        u.de_terceiros is false
        or (
          u.de_terceiros is true
          and u.captador_corretor_id is not null
          and private.produto_unidade_proprietario_completo(u.id)
          and nullif(btrim(coalesce(u.acesso_tipo, '')), '') is not null
          and nullif(btrim(coalesce(u.acesso_instrucoes, '')), '') is not null
          and (u.acesso_tipo is distinct from 'chave_digital'
               or nullif(btrim(coalesce(u.acesso_codigo, '')), '') is not null)
        )
      )
  );
$$;

revoke all on function private.produto_unidade_elegivel_site(uuid)
  from public, anon, authenticated, service_role;

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
  select e.* into v_emp from public.empreendimentos e
  where e.id = p_empreendimento_id;
  if not found then
    raise no_data_found using message = 'PRODUCT_NOT_FOUND: empreendimento não encontrado.';
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
    select u.* into v_unidade from public.unidades u
    where u.id = p_unidade_id and u.empreendimento_id = p_empreendimento_id;
    if not found then
      raise no_data_found using message = 'UNIT_NOT_FOUND: unidade não encontrada neste empreendimento.';
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
    if v_fotos_unidade < 1 then
      v_bloqueios := array_append(v_bloqueios, 'Adicionar ao menos uma foto própria da unidade');
    end if;
    if v_unidade.de_terceiros is true then
      if v_unidade.captador_corretor_id is null then
        v_bloqueios := array_append(v_bloqueios, 'Vincular o corretor captador da unidade');
      end if;
      if not private.produto_unidade_proprietario_completo(v_unidade.id) then
        v_bloqueios := array_append(v_bloqueios, 'Completar proprietário e contato da unidade');
      end if;
      if nullif(btrim(coalesce(v_unidade.acesso_tipo, '')), '') is null
         or nullif(btrim(coalesce(v_unidade.acesso_instrucoes, '')), '') is null
         or (v_unidade.acesso_tipo = 'chave_digital'
             and nullif(btrim(coalesce(v_unidade.acesso_codigo, '')), '') is null) then
        v_bloqueios := array_append(v_bloqueios, 'Completar instruções de acesso da unidade');
      end if;
    end if;
  else
    select count(*)::integer, min(coalesce(u.valor_promo, u.valor_tabela)), min(u.area_m2)
      into v_unidades_validas, v_preco, v_area
    from public.unidades u
    where u.empreendimento_id = p_empreendimento_id
      and private.produto_unidade_elegivel_site(u.id) is true;
    v_preco := coalesce(v_emp.preco, v_preco);
    v_area := coalesce(v_emp.area_util, v_area);
    if v_fotos_pai < 6 then
      v_bloqueios := array_append(v_bloqueios, 'Adicionar pelo menos 6 fotos de áreas comuns do empreendimento');
    end if;
    if not v_capa_pai then
      v_bloqueios := array_append(v_bloqueios, 'Definir a capa do empreendimento');
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
    v_bloqueios := array_append(v_bloqueios,
      case when v_aluguel then 'Corrigir o aluguel mensal total em reais'
           else 'Corrigir o preço total em reais (ex.: 710000 para R$ 710 mil)' end);
  end if;
  if v_unidades_validas = 0 then
    v_bloqueios := array_append(v_bloqueios,
      'Cadastrar ao menos uma unidade aprovada, disponível e com foto própria');
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
    'capa_definida', case when p_unidade_id is null then v_capa_pai else v_capa_unidade end,
    'unidades_disponiveis', v_unidades_validas
  );
end;
$$;

revoke all on function private.produto_validacao_publicacao(uuid, uuid)
  from public, anon, authenticated, service_role;

comment on table private.unidade_proprietarios is
  'Nome e contato do proprietário, acessíveis somente por rotinas que validam o corretor captador.';
comment on column public.unidades.origem_comercial is
  'Classificação canônica da unidade vendável: terceiros, lançamento ou remanescente.';
