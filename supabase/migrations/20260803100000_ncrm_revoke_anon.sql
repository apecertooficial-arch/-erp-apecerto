-- CRM Nova Era — HOTFIX DE SEGURANÇA: remover privilégios diretos do papel `anon`.
--
-- CONTEXTO: estas cinco tabelas foram criadas sem REVOKE explícito e herdaram os
-- privilégios padrão do schema `public` do Supabase, ficando com SELECT, INSERT,
-- UPDATE, DELETE, TRUNCATE, REFERENCES e TRIGGER concedidos a `anon`.
--
-- NÃO havia vazamento: a RLS está ligada nas cinco e todas as policies são restritas
-- a `authenticated`, então `anon` já não lia nada. O risco era latente — bastaria uma
-- policy futura `TO public` para o acesso anônimo passar a valer, inclusive escrita.
-- Este hotfix fecha a porta na camada de privilégio, antes da RLS.
--
-- ESCOPO ESTRITO: apenas REVOKE de `anon`. Não altera RLS, policies, funções,
-- triggers, constraints, dados, nem privilégios de `authenticated`/`service_role`.
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_estado          FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_evento          FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_proposta        FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_workflow_config FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_workflow_passo  FROM anon;
