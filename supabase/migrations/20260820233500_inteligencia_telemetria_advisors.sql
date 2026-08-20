-- Ajustes apontados pelos advisors após instalar a telemetria operacional.

begin;

create index if not exists ix_motor_roleta_eventos_lead
  on ncrm_private.motor_roleta_eventos(lead_id);
create index if not exists ix_motor_roleta_eventos_escolhido
  on ncrm_private.motor_roleta_eventos(escolhido_corretor_id)
  where escolhido_corretor_id is not null;

alter table ncrm_private.corretor_atividade_estado enable row level security;
alter table ncrm_private.corretor_atividade_diaria enable row level security;

drop policy if exists corretor_atividade_estado_proprio on ncrm_private.corretor_atividade_estado;
create policy corretor_atividade_estado_proprio
on ncrm_private.corretor_atividade_estado
for all to authenticated
using (exists (
  select 1 from public.corretores c
  where c.id=corretor_id and c.usuario_id=(select auth.uid()) and c.ativo
))
with check (exists (
  select 1 from public.corretores c
  where c.id=corretor_id and c.usuario_id=(select auth.uid()) and c.ativo
));

drop policy if exists corretor_atividade_diaria_propria on ncrm_private.corretor_atividade_diaria;
create policy corretor_atividade_diaria_propria
on ncrm_private.corretor_atividade_diaria
for all to authenticated
using (exists (
  select 1 from public.corretores c
  where c.id=corretor_id and c.usuario_id=(select auth.uid()) and c.ativo
))
with check (exists (
  select 1 from public.corretores c
  where c.id=corretor_id and c.usuario_id=(select auth.uid()) and c.ativo
));

grant usage on schema ncrm_private to authenticated;
grant select,insert,update on ncrm_private.corretor_atividade_estado,
  ncrm_private.corretor_atividade_diaria to authenticated;

alter function public.corretor_atividade_heartbeat(boolean,boolean) security invoker;

commit;
