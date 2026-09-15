-- Onda 0.5 — a conta "Design (somente leitura)" tinha papel `admin`.
--
-- PROBLEMA: 4 dos 12 usuarios eram admin, e um deles se chama literalmente
-- "Design (somente leitura)". Em podeVer(), `if (role === "admin") return true`
-- nao tem excecao: a conta via TUDO -- Financeiro, Usuarios, Permissoes,
-- Auditoria -- apesar do nome dizer o contrario.
--
-- SOLUCAO: papel passa a `corretor` e recebe um override individual de
-- permissoes somente-leitura. O override tem precedencia sobre o perfil do papel
-- (ver /api/session), entao a conta nao herda as permissoes de edicao do perfil
-- `corretor`. Fica com o que o nome promete: ver produtos e o painel.
--
-- Nao mexo nas outras 3 contas admin (Romulo, Samuel, Djair): sao pessoas, e
-- reduzir acesso de gente sem combinar nao e decisao de migracao.
--
-- REVERSAO:
--   update public.usuarios set role='admin', permissoes=null
--   where id='fd87c25c-423d-47ee-b687-18bffa92998c';

update public.usuarios
set role = 'corretor',
    permissoes = jsonb_build_object(
      'dashboard', jsonb_build_array('ver'),
      'produtos',  jsonb_build_array('ver')
    )
where id = 'fd87c25c-423d-47ee-b687-18bffa92998c'
  and nome = 'Design (somente leitura)';

insert into public.erp_auditoria (usuario_nome, acao, modulo, entidade, entidade_id, detalhe, antes, depois)
values (
  'auditoria/manutencao',
  'editar_acesso',
  'Usuários',
  'usuario',
  'fd87c25c-423d-47ee-b687-18bffa92998c',
  'Conta "Design (somente leitura)" deixou de ser admin e passou a corretor com permissoes somente-leitura (Onda 0.5)',
  jsonb_build_object('role', 'admin', 'permissoes', null),
  jsonb_build_object('role', 'corretor', 'permissoes', jsonb_build_object('dashboard', jsonb_build_array('ver'), 'produtos', jsonb_build_array('ver')))
);
