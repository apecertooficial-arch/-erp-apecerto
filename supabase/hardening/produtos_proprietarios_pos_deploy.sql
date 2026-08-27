-- Produtos v6 / fase de contração.
-- NÃO É MIGRAÇÃO AUTOMÁTICA. Aplicar somente no Gate C, depois que o ERP com
-- as RPCs produto_proprietario_* estiver implantado e validado. Esta etapa
-- fecha o acesso direto à tabela de PII sem quebrar a versão anterior do ERP.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.proprietarios enable row level security;
revoke all privileges on table public.proprietarios from public, anon, authenticated;

comment on table public.proprietarios is
  'PII de proprietários. Acesso operacional exclusivo pelas RPCs produto_proprietario_* com autorização por gestão/captação.';
