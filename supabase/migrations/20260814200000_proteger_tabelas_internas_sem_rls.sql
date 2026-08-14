-- Fecha acesso direto do navegador a tabelas exclusivamente internas.
--
-- Não há DELETE nem alteração de dados. Funções SECURITY DEFINER, postgres e
-- service_role continuam acessando as filas e diagnósticos normalmente. Sem
-- políticas para anon/authenticated, a API pública passa a negar acesso.

alter table public.f2_soltura_represados enable row level security;
alter table public._mig_pipe2_to_funil20_bkp enable row level security;
alter table public.presenca_diagnostico enable row level security;
alter table public.f2_soltura_agenda enable row level security;
alter table public.ncrm_notificacao_tipos_ativos enable row level security;
alter table public.f2_sara_fila enable row level security;
alter table public.f2_fila_decisao enable row level security;

comment on table public._mig_pipe2_to_funil20_bkp is
  'Backup da migração Pipe 2 → Funil 2.0; preservado para rollback e protegido por RLS.';
