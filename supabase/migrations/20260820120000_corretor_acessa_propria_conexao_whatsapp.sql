-- Configurações, para o perfil Corretor, é a tela limitada da própria conexão.
-- O RPC wa_v7_painel e a Edge Function dapi-qr já restringem sessões pelo
-- usuario_id/corretor_id; aqui restauramos apenas a descoberta da tela no ERP.
update public.perfis
   set permissoes = jsonb_set(
         coalesce(permissoes, '{}'::jsonb),
         '{configuracoes}',
         '["ver", "ver_conexoes"]'::jsonb,
         true
       ),
       atualizado_em = now()
 where id = 'corretor';
