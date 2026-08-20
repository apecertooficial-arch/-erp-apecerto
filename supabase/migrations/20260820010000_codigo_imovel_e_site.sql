-- Código de referência do imóvel (AP0001, ...) em empreendimentos e unidades,
-- com trigger para novos registros, e exposição do código + unidades no site.
-- (Aplicada em produção via MCP em 2026-08-19/20; arquivo registrado para versionamento.)

create sequence if not exists public.imovel_codigo_seq;
alter table public.empreendimentos add column if not exists codigo text;
alter table public.unidades add column if not exists codigo text;

create or replace function public.atribuir_codigo_imovel() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.codigo is null then
    new.codigo := 'AP' || lpad(nextval('public.imovel_codigo_seq')::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_codigo_empreendimento on public.empreendimentos;
create trigger trg_codigo_empreendimento before insert on public.empreendimentos
for each row execute function public.atribuir_codigo_imovel();

drop trigger if exists trg_codigo_unidade on public.unidades;
create trigger trg_codigo_unidade before insert on public.unidades
for each row execute function public.atribuir_codigo_imovel();

create unique index if not exists empreendimentos_codigo_key on public.empreendimentos (codigo);
create unique index if not exists unidades_codigo_key on public.unidades (codigo);
