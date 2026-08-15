-- Exclusao fisica da regua e do motor de regras aposentados.
-- Os dados e DDL permanecem arquivados no schema privado ncrm_private.

begin;

alter table if exists public.f2_sara_pedido
  drop constraint if exists f2_sara_pedido_regra_id_fkey;

alter table if exists public.f2_sara_pedido
  drop column if exists regra_id;

drop function if exists public.funil_regra_previa(bigint);
drop function if exists public.funil_tick(boolean, integer);
drop function if exists public.funil_regra_candidatos(bigint);
drop function if exists public.funil_regra_excluir(bigint);
drop function if exists public.funil_regra_ler();
drop function if exists public.funil_regra_salvar(jsonb);
drop function if exists public.f2_cadencia_proximo_prazo(timestamptz, integer);

drop table if exists public.funil_regra_execucao;
drop table if exists public.funil_regra;
drop table if exists public.f2_cadencia_regua;

commit;
