-- Collaboration, governance and honest metrics for Studio. Additive and idempotent.
create table if not exists public.social_piece_tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.social_organizations(id) on delete cascade,
  piece_id uuid not null references public.social_pieces(id) on delete cascade, responsavel_id uuid, revisor_id uuid,
  prazo_em timestamptz, status text not null default 'pendente' check (status in ('pendente','em_andamento','bloqueada','concluida')),
  pendencia text, criado_por uuid not null references auth.users(id), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table if not exists public.social_piece_comments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.social_organizations(id) on delete cascade,
  piece_id uuid not null references public.social_pieces(id) on delete cascade, piece_version_id uuid references public.social_piece_versions(id) on delete set null,
  slide_index integer, cena_index integer, comentario text not null check (char_length(comentario) between 1 and 2000), autor_id uuid not null references auth.users(id), resolvido_em timestamptz, criado_em timestamptz not null default now()
);
create table if not exists public.social_metrics_snapshots (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.social_organizations(id) on delete cascade,
  campaign_id uuid references public.social_campaigns(id) on delete cascade, piece_id uuid references public.social_pieces(id) on delete cascade,
  template_version_id uuid references public.social_template_versions(id) on delete set null, periodo_inicio date not null, periodo_fim date not null,
  fonte text not null default 'nao_conectada', alcance integer, impressoes integer, curtidas integer, comentarios integer, compartilhamentos integer, salvamentos integer, cliques integer, observacao text,
  criado_em timestamptz not null default now(), check (periodo_fim >= periodo_inicio)
);
create index if not exists social_piece_tasks_board_idx on public.social_piece_tasks(organization_id,status,prazo_em);
create index if not exists social_piece_comments_context_idx on public.social_piece_comments(piece_id,piece_version_id,criado_em desc);
create index if not exists social_metrics_campaign_period_idx on public.social_metrics_snapshots(campaign_id,periodo_inicio,periodo_fim);
alter table public.social_piece_tasks enable row level security;
alter table public.social_piece_comments enable row level security;
alter table public.social_metrics_snapshots enable row level security;
do $$ begin
  create policy social_piece_tasks_select on public.social_piece_tasks for select to authenticated using (public.social_has_permission('ver', organization_id));
  create policy social_piece_tasks_write on public.social_piece_tasks for all to authenticated using (public.social_has_permission('editar', organization_id)) with check (public.social_has_permission('editar', organization_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy social_piece_comments_select on public.social_piece_comments for select to authenticated using (public.social_has_permission('ver', organization_id));
  create policy social_piece_comments_write on public.social_piece_comments for all to authenticated using (public.social_has_permission('revisar', organization_id)) with check (public.social_has_permission('revisar', organization_id) and autor_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy social_metrics_select on public.social_metrics_snapshots for select to authenticated using (public.social_has_permission('ver', organization_id));
  create policy social_metrics_write on public.social_metrics_snapshots for insert to authenticated with check (public.social_has_permission('editar', organization_id));
exception when duplicate_object then null; end $$;
grant select, insert, update on public.social_piece_tasks, public.social_piece_comments, public.social_metrics_snapshots to authenticated;
