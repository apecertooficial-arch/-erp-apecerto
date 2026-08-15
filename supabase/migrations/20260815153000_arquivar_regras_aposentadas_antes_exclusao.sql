-- Arquivo privado e imutável das regras substituídas pela Central de Automações.
-- A exclusão dos objetos públicos continua proibida antes de 19/08/2026.

create schema if not exists ncrm_private;
revoke all on schema ncrm_private from public, anon, authenticated;

create table if not exists ncrm_private.arquivo_f2_cadencia_regua_20260815
as table public.f2_cadencia_regua with data;

create table if not exists ncrm_private.arquivo_funil_regra_20260815
as table public.funil_regra with data;

create table if not exists ncrm_private.arquivo_funil_regra_execucao_20260815
as table public.funil_regra_execucao with data;

create table if not exists ncrm_private.arquivo_funil_regra_funcoes_20260815 as
select
  n.nspname as schema_nome,
  p.proname as funcao_nome,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  pg_get_functiondef(p.oid) as definicao,
  now() as arquivado_em
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'f2_cadencia_proximo_prazo',
    'funil_regra_candidatos',
    'funil_regra_excluir',
    'funil_regra_ler',
    'funil_regra_previa',
    'funil_regra_salvar',
    'funil_tick'
  );

revoke all on table
  ncrm_private.arquivo_f2_cadencia_regua_20260815,
  ncrm_private.arquivo_funil_regra_20260815,
  ncrm_private.arquivo_funil_regra_execucao_20260815,
  ncrm_private.arquivo_funil_regra_funcoes_20260815
from public, anon, authenticated;

grant select on table
  ncrm_private.arquivo_f2_cadencia_regua_20260815,
  ncrm_private.arquivo_funil_regra_20260815,
  ncrm_private.arquivo_funil_regra_execucao_20260815,
  ncrm_private.arquivo_funil_regra_funcoes_20260815
to service_role;

do $$
begin
  if (select count(*) from ncrm_private.arquivo_f2_cadencia_regua_20260815)
       <> (select count(*) from public.f2_cadencia_regua) then
    raise exception 'arquivo incompleto: f2_cadencia_regua';
  end if;

  if (select count(*) from ncrm_private.arquivo_funil_regra_20260815)
       <> (select count(*) from public.funil_regra) then
    raise exception 'arquivo incompleto: funil_regra';
  end if;

  if (select count(*) from ncrm_private.arquivo_funil_regra_execucao_20260815)
       <> (select count(*) from public.funil_regra_execucao) then
    raise exception 'arquivo incompleto: funil_regra_execucao';
  end if;

  if (select count(*) from ncrm_private.arquivo_funil_regra_funcoes_20260815) <> 7 then
    raise exception 'arquivo incompleto: funcoes das regras aposentadas';
  end if;
end;
$$;

comment on table ncrm_private.arquivo_f2_cadencia_regua_20260815 is
  'Backup privado antes da exclusao autorizada apos 19/08/2026.';
comment on table ncrm_private.arquivo_funil_regra_20260815 is
  'Backup privado antes da exclusao autorizada apos 19/08/2026.';
comment on table ncrm_private.arquivo_funil_regra_execucao_20260815 is
  'Backup privado antes da exclusao autorizada apos 19/08/2026.';
comment on table ncrm_private.arquivo_funil_regra_funcoes_20260815 is
  'Definicoes restauraveis das funcoes dependentes antes da exclusao apos 19/08/2026.';
