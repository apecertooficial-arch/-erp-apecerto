-- Agendar visita é uma operação diária do corretor. A tela móvel já oferece a
-- ação e o banco ainda valida que o lead pertence à carteira do usuário.
-- Faltava apenas alinhar o perfil efetivo com essa capacidade.
update public.perfis
set permissoes = jsonb_set(
  coalesce(permissoes, '{}'::jsonb),
  '{calendario}',
  case
    when coalesce(permissoes->'calendario', '[]'::jsonb) ? 'criar'
      then coalesce(permissoes->'calendario', '[]'::jsonb)
    else coalesce(permissoes->'calendario', '[]'::jsonb) || '["criar"]'::jsonb
  end,
  true
)
where id = 'corretor';
