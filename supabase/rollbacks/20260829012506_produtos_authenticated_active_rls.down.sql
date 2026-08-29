-- Rollback conservador: restaura leitura authenticated, sem reabrir anon.
drop policy if exists empreend_select_all on public.empreendimentos;
create policy empreend_select_all on public.empreendimentos for select to authenticated using (true);
drop policy if exists unidades_select_all on public.unidades;
create policy unidades_select_all on public.unidades for select to authenticated using (true);
drop policy if exists midias_select_all on public.midias;
create policy midias_select_all on public.midias for select to authenticated using (true);
revoke all on function produtos_authz.usuario_ativo() from public, anon, authenticated;
drop policy if exists empreend_perfil_ativo_restritivo on public.empreendimentos;
drop policy if exists unidades_perfil_ativo_restritivo on public.unidades;
drop policy if exists midias_perfil_ativo_restritivo on public.midias;
