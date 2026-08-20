-- Consolida as políticas de Produtos instaladas pela migração anterior.
-- As antigas políticas ALL de admin ficaram redundantes porque as novas regras
-- já incluem is_product_manager() e as políticas SELECT autenticadas continuam.

drop policy if exists empreend_write_admin on public.empreendimentos;
drop policy if exists unidades_write_admin on public.unidades;
drop policy if exists midias_write_admin on public.midias;

-- FKs usadas em filtros, vínculo de condomínio/proprietário e regras RLS.
create index if not exists empreendimentos_captador_corretor_id_idx
  on public.empreendimentos (captador_corretor_id);
create index if not exists empreendimentos_condominio_id_idx
  on public.empreendimentos (condominio_id);
create index if not exists empreendimentos_proprietario_id_idx
  on public.empreendimentos (proprietario_id);
create index if not exists unidades_captador_corretor_id_idx
  on public.unidades (captador_corretor_id);
