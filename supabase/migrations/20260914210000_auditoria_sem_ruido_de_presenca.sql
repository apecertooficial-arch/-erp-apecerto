-- Onda 5.2 — tirar o batimento de presenca do log de auditoria.
--
-- PROBLEMA: em 14/09/2026, 5.906 dos 7.380 registros de erp_auditoria (80%)
-- eram "Usuarios: registro editado em corretores", gerados pelo trigger a cada
-- atualizacao de online/ultima_presenca/no_escritorio/presente_data. O sinal
-- real (7 editar_acesso, 2 criar_usuario) ficava afogado no ruido.
--
-- SOLUCAO: o trigger de UPDATE passa a disparar apenas quando alguma coluna
-- QUE NAO SEJA de presenca mudar. INSERT e DELETE continuam sempre auditados.
-- Nenhum dado e apagado; o historico antigo permanece.
--
-- REVERSAO: dropar os dois triggers abaixo e recriar o original:
--   create trigger trg_audit_corretores after insert or update or delete on public.corretores
--   for each row execute function public.fn_auditoria_trigger('Usuários');

drop trigger if exists trg_audit_corretores on public.corretores;

create trigger trg_audit_corretores_ins_del
after insert or delete on public.corretores
for each row execute function public.fn_auditoria_trigger('Usuários');

create trigger trg_audit_corretores_upd
after update on public.corretores
for each row
when (
  (to_jsonb(old) - 'online' - 'ultima_presenca' - 'no_escritorio' - 'presente_data')
  is distinct from
  (to_jsonb(new) - 'online' - 'ultima_presenca' - 'no_escritorio' - 'presente_data')
)
execute function public.fn_auditoria_trigger('Usuários');
