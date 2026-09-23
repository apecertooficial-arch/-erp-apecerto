-- O portal do proprietário é uma fase futura. Esta migração torna reproduzível
-- somente a fronteira já aceita em produção; não cria usuário, convite, sessão,
-- política de proprietário, endpoint ou interface especulativa.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.proprietarios enable row level security;
revoke all privileges on table public.proprietarios from public, anon, authenticated;

alter table private.unidade_proprietarios enable row level security;
revoke all privileges on table private.unidade_proprietarios from public, anon, authenticated;

comment on table public.proprietarios is
  'PII canônica de proprietários. Sem acesso direto pelo Data API; o ERP atual usa somente RPCs autorizadas. Um portal futuro exige identidade, consentimento, revogação e RLS próprios antes de qualquer grant.';

comment on column public.empreendimentos.proprietario_id is
  'Vínculo canônico imóvel→proprietário. Não equivale a usuário autenticado e não autoriza acesso a portal.';

comment on table private.unidade_proprietarios is
  'Dados privados da unidade, fechados ao Data API. Não inferir vínculo de identidade nem expor em portal sem fase futura explícita.';
