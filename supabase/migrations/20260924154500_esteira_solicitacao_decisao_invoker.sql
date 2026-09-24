-- Endurece a decisão para executar integralmente sob as policies do gestor autenticado.

drop policy if exists vsol_decide_manage on public.venda_solicitacoes;
create policy vsol_decide_manage on public.venda_solicitacoes
  for update to authenticated
  using (public.can_manage_all())
  with check (public.can_manage_all());

alter function public.esteira_solicitacao_decidir(uuid,boolean,text,uuid)
  security invoker;

comment on function public.esteira_solicitacao_decidir(uuid,boolean,text,uuid) is
  'Decide solicitação gerencial com trava, criação atômica da venda e retry idempotente. SECURITY INVOKER com RLS e autorização interna.';
