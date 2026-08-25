-- Integridade da Central de Automações Cloud V4.
--
-- Esta migration não apaga órfãos históricos. As FKs NOT VALID passam a
-- proteger todas as novas gravações, enquanto a limpeza antiga pode ser
-- revisada separadamente e com rollback explícito.

begin;

alter table public.automacoes
  add column if not exists produto_id bigint,
  add column if not exists legado_sem_produto boolean not null default false;

create index if not exists automacoes_produto_id_idx
  on public.automacoes(produto_id)
  where produto_id is not null;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid='public.automacoes'::regclass
       and conname='automacoes_produto_fk'
  ) then
    alter table public.automacoes
      add constraint automacoes_produto_fk
      foreign key (produto_id) references public.produtos(id)
      on delete set null not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid='public.automacao_versoes'::regclass
       and conname='automacao_versoes_automacao_fk'
  ) then
    alter table public.automacao_versoes
      add constraint automacao_versoes_automacao_fk
      foreign key (automacao_id) references public.automacoes(id)
      on delete cascade not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid='public.motor_execucoes'::regclass
       and conname='motor_execucoes_automacao_fk'
  ) then
    alter table public.motor_execucoes
      add constraint motor_execucoes_automacao_fk
      foreign key (automacao_id) references public.automacoes(id)
      on delete set null not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid='public.motor_fila'::regclass
       and conname='motor_fila_automacao_fk'
  ) then
    alter table public.motor_fila
      add constraint motor_fila_automacao_fk
      foreign key (automacao_id) references public.automacoes(id)
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid='public.automacao_versoes'::regclass
       and conname='automacao_versoes_id_automacao_key'
  ) then
    alter table public.automacao_versoes
      add constraint automacao_versoes_id_automacao_key unique (id,automacao_id);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid='public.automacoes'::regclass
       and conname='automacoes_versao_pertence_automacao_fk'
  ) then
    alter table public.automacoes
      add constraint automacoes_versao_pertence_automacao_fk
      foreign key (versao_publicada_id,id)
      references public.automacao_versoes(id,automacao_id)
      on delete restrict not valid;
  end if;
end
$constraints$;

-- Backfill apenas quando todas as abordagens selecionadas apontam de forma
-- inequívoca para o mesmo produto ativo. Grupo textual nunca é usado como FK.
with inferred as (
  select a.id,
         min(ab.produto_id) as produto_id
    from public.automacoes a
    cross join lateral jsonb_array_elements(
      coalesce(a.mapa_rascunho,a.mapa)->'automation'->'blocks'
    ) block
    cross join lateral jsonb_array_elements_text(
      coalesce(block#>'{options,abordagemIds}','[]'::jsonb)
    ) approach_id
    join public.abordagens ab on ab.id=approach_id::bigint
   where a.produto_id is null
     and block->>'type'='send-approach'
     and ab.produto_id is not null
   group by a.id
  having min(ab.produto_id)=max(ab.produto_id)
)
update public.automacoes a
   set produto_id=i.produto_id
  from inferred i
  join public.produtos p on p.id=i.produto_id and p.ativo
 where a.id=i.id;

-- Miruna, Adelmo e outros fluxos publicados antes da adoção de produtos
-- possuem abordagens válidas, porém ainda sem produto_id. Preserve somente
-- esse conjunto já publicado; automações novas continuam obrigadas a escolher
-- um produto. A marca não muda o mapa nem a versão presa às execuções.
with published as (
  select a.id,coalesce(v.mapa,a.mapa) as mapa
    from public.automacoes a
    left join public.automacao_versoes v on v.id=a.versao_publicada_id
   where a.produto_id is null
), legacy as (
  select p.id
    from published p
    cross join lateral jsonb_array_elements(
      coalesce(p.mapa#>'{automation,blocks}','[]'::jsonb)
    ) block
    cross join lateral jsonb_array_elements_text(
      coalesce(block#>'{options,abordagemIds}','[]'::jsonb)
    ) approach_id
    left join public.abordagens ab
      on ab.id=case when approach_id~'^[0-9]+$' then approach_id::bigint end
   where block->>'type'='send-approach'
     and coalesce(nullif(block#>>'{options,produtoId}','')::bigint,0)=0
   group by p.id
  having count(*)>0
     and bool_and(ab.id is not null and ab.produto_id is null)
)
update public.automacoes a
   set legado_sem_produto=true
  from legacy l
 where a.id=l.id;

create or replace function public.automacao_validar_referencias(
  p_automacao_id bigint,
  p_mapa jsonb
) returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $function$
declare
  v_errors jsonb:='[]'::jsonb;
  v_product_id bigint;
  v_effective_product_id bigint;
  v_legacy_productless boolean:=false;
  v_block jsonb;
  v_approach_id bigint;
  v_member_id bigint;
  v_instance_id bigint;
begin
  select a.produto_id,a.legado_sem_produto
    into v_product_id,v_legacy_productless
    from public.automacoes a where a.id=p_automacao_id;
  if not found then
    return jsonb_build_object('ok',false,'erros',jsonb_build_array('automacao_nao_encontrada'));
  end if;

  if v_product_id is not null and not exists(
    select 1 from public.produtos p where p.id=v_product_id and p.ativo
  ) then
    v_errors:=v_errors||jsonb_build_array('produto_da_automacao_inexistente_ou_inativo');
  end if;

  for v_block in
    select value from jsonb_array_elements(coalesce(p_mapa#>'{automation,blocks}','[]'::jsonb))
  loop
    if v_block->>'type'='send-approach' then
      v_effective_product_id:=coalesce(nullif(v_block#>>'{options,produtoId}','')::bigint,v_product_id,0);
      if v_effective_product_id=0 and not v_legacy_productless then
        v_errors:=v_errors||jsonb_build_array('bloco_'||(v_block->>'id')||'_produto_invalido');
      elsif v_effective_product_id>0 and not exists(
        select 1 from public.produtos p where p.id=v_effective_product_id and p.ativo
      ) then
        v_errors:=v_errors||jsonb_build_array('bloco_'||(v_block->>'id')||'_produto_invalido');
      end if;

      for v_approach_id in
        select value::bigint from jsonb_array_elements_text(coalesce(v_block#>'{options,abordagemIds}','[]'::jsonb))
      loop
        if not exists(
          select 1 from public.abordagens ab
           where ab.id=v_approach_id and ab.ativo
             and (
               (v_effective_product_id>0 and ab.produto_id=v_effective_product_id)
               or (v_effective_product_id=0 and v_legacy_productless and ab.produto_id is null)
             )
        ) then
          v_errors:=v_errors||jsonb_build_array('bloco_'||(v_block->>'id')||'_abordagem_'||v_approach_id||'_fora_do_produto');
        end if;
      end loop;

      for v_member_id,v_instance_id in
        select key::bigint,value::bigint
          from jsonb_each_text(coalesce(v_block#>'{options,instanciaPorCorretor}','{}'::jsonb))
         where value~'^[0-9]+$' and value::bigint>0
      loop
        if not exists(
          select 1 from public.instancias i
           where i.id=v_instance_id and i.corretor_id=v_member_id
             and i.ativa and i.conectada and i.status_dapi='connected'
        ) then
          v_errors:=v_errors||jsonb_build_array('bloco_'||(v_block->>'id')||'_instancia_invalida_para_corretor_'||v_member_id);
        end if;
      end loop;
    elsif v_block->>'type'='ai-agent' and not exists(
      select 1 from public.agentes_ia ai
       where ai.id=nullif(v_block#>>'{options,agenteId}','')::bigint and ai.ativo
    ) then
      v_errors:=v_errors||jsonb_build_array('bloco_'||(v_block->>'id')||'_agente_ia_invalido');
    end if;
  end loop;

  return jsonb_build_object('ok',jsonb_array_length(v_errors)=0,'erros',v_errors);
exception when invalid_text_representation then
  return jsonb_build_object('ok',false,'erros',v_errors||jsonb_build_array('referencia_com_id_invalido'));
end
$function$;

revoke all on function public.automacao_validar_referencias(bigint,jsonb)
  from public,anon;
grant execute on function public.automacao_validar_referencias(bigint,jsonb)
  to authenticated,service_role;

create or replace function public.automacao_versao_integridade_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_validation jsonb;
begin
  v_validation:=public.automacao_validar_referencias(new.automacao_id,new.mapa);
  if coalesce((v_validation->>'ok')::boolean,false) is not true then
    raise exception using errcode='22023',
      message='AUTOMATION_REFERENCE_INVALID: '||(v_validation->'erros')::text;
  end if;
  return new;
end
$function$;

revoke all on function public.automacao_versao_integridade_trigger()
  from public,anon,authenticated;

drop trigger if exists trg_automacao_versao_integridade on public.automacao_versoes;
create trigger trg_automacao_versao_integridade
before insert or update of mapa,automacao_id on public.automacao_versoes
for each row execute function public.automacao_versao_integridade_trigger();

-- O explicador continua disponível para administradores autenticados, mas
-- deixa de ignorar RLS e deixa de ser executável por anon/public.
do $secure_explainer$
begin
  if to_regprocedure('public.automacao_explicar(bigint)') is not null then
    execute 'alter function public.automacao_explicar(bigint) security invoker';
    execute 'alter function public.automacao_explicar(bigint) set search_path=''''';
    execute 'revoke all on function public.automacao_explicar(bigint) from public,anon';
    execute 'grant execute on function public.automacao_explicar(bigint) to authenticated,service_role';
  end if;
end
$secure_explainer$;

do $verify$
begin
  if not exists(
    select 1 from information_schema.columns
     where table_schema='public' and table_name='automacoes' and column_name='produto_id'
  ) then raise exception 'automacoes.produto_id ausente'; end if;

  if to_regprocedure('public.automacao_explicar(bigint)') is not null and exists(
    select 1 from information_schema.routine_privileges
     where specific_schema='public' and routine_name='automacao_explicar'
       and grantee in ('PUBLIC','anon') and privilege_type='EXECUTE'
  ) then raise exception 'automacao_explicar ainda executavel por anon/public'; end if;

  if not exists(
    select 1 from pg_trigger
     where tgrelid='public.automacao_versoes'::regclass
       and tgname='trg_automacao_versao_integridade' and not tgisinternal
  ) then raise exception 'gatilho de integridade da versao ausente'; end if;
end
$verify$;

commit;
