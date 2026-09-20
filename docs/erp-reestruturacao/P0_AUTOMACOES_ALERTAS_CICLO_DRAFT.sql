-- DRAFT NAO EXECUTAVEL / NAO APLICADO EM PRODUCAO
--
-- Contrato revisavel para ligar cada aviso criado pelo motor a sua automacao,
-- bloco, lead, publico e tipo, e encerrar a obrigacao quando a autoridade que
-- a criou for desligada, arquivada ou remover aquela acao do mapa publicado.
-- O historico e preservado: nenhuma linha e apagada ou reaberta.
--
-- Este arquivo permanece fora de supabase/migrations ate ser criado pela CLI
-- oficial, compilado e ensaiado em um Postgres/Supabase isolado.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

alter table public.ncrm_notificacao
  add column if not exists automacao_id bigint null,
  add column if not exists automacao_bloco_id text null,
  add column if not exists lead_id bigint null;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ncrm_notificacao'::regclass
       and conname = 'ncrm_notificacao_automacao_id_fkey'
  ) then
    alter table public.ncrm_notificacao
      add constraint ncrm_notificacao_automacao_id_fkey
      foreign key (automacao_id) references public.automacoes(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ncrm_notificacao'::regclass
       and conname = 'ncrm_notificacao_lead_id_fkey'
  ) then
    alter table public.ncrm_notificacao
      add constraint ncrm_notificacao_lead_id_fkey
      foreign key (lead_id) references public.leads(id)
      on delete set null;
  end if;
end
$constraints$;

create index if not exists ncrm_notificacao_automacao_aberta_idx
  on public.ncrm_notificacao(automacao_id, automacao_bloco_id, publico, tipo)
  where resolvida_em is null and automacao_id is not null;

comment on column public.ncrm_notificacao.automacao_id is
  'Automacao proprietaria do aviso; preenchida para chaves automacao:*.';
comment on column public.ncrm_notificacao.automacao_bloco_id is
  'Bloco publicado que originou o aviso; permite fechar obrigacoes removidas do mapa.';
comment on column public.ncrm_notificacao.lead_id is
  'Lead usado na identidade idempotente da acao de notificacao; zero legado vira null.';

-- Backfill aceita o formato legado de quatro partes e o canônico atual de seis
-- partes. O join impede criar uma FK falsa para automação/lead que já não
-- exista. Nenhum título, detalhe ou PII é lido, transformado ou registrado.
with parsed as (
  select n.id,
         split_part(n.chave, ':', 2)::bigint as automacao_id,
         split_part(n.chave, ':', 3) as bloco_id,
         nullif(split_part(n.chave, ':', 4), '0')::bigint as lead_id
    from public.ncrm_notificacao n
   where n.chave ~ '^automacao:[0-9]+:[^:]+:[0-9]+(?::[^:]+:[^:]+)?$'
), existentes as (
  select p.id, p.automacao_id, p.bloco_id,
         case when l.id is null then null else p.lead_id end as lead_id
    from parsed p
    join public.automacoes a on a.id = p.automacao_id
    left join public.leads l on l.id = p.lead_id
)
update public.ncrm_notificacao n
   set automacao_id = e.automacao_id,
       automacao_bloco_id = e.bloco_id,
       lead_id = e.lead_id
  from existentes e
 where n.id = e.id
   and (n.automacao_id is distinct from e.automacao_id
        or n.automacao_bloco_id is distinct from e.bloco_id
        or n.lead_id is distinct from e.lead_id);

-- Resolver automático precisa ter autoria própria para a auditoria distinguir
-- ciclo de automação de conclusão humana, Sara ou sincronizador legado.
alter table public.ncrm_notificacao
  drop constraint if exists ncrm_notificacao_resolvida_por_check;
alter table public.ncrm_notificacao
  add constraint ncrm_notificacao_resolvida_por_check
  check (resolvida_por is null or resolvida_por in (
    'automatica', 'usuario', 'automatica_f2', 'f2_sync', 'troca_dono_f2',
    'automacao_ciclo', 'automacao_evidencia'
  ) or resolvida_por like 'central:%');

create or replace function ncrm_private.automacao_notificacao_configurada(
  p_mapa jsonb,
  p_bloco_id text,
  p_publico text,
  p_tipo text
) returns boolean
language sql
immutable
set search_path = ''
as $function$
  select exists (
    select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(p_mapa #> '{automation,blocks}') = 'array'
            then p_mapa #> '{automation,blocks}'
          else '[]'::jsonb
        end
      ) bloco
      cross join lateral jsonb_path_query(
        bloco,
        '$.** ? (@.name == "send-notification-action")'
      ) acao(obj)
     where bloco->>'id' = p_bloco_id
       and coalesce(nullif(acao.obj #>> '{options,publico}', ''), 'corretor') = p_publico
       and coalesce(nullif(acao.obj #>> '{options,tipo}', ''), 'acao_vencida') = p_tipo
  );
$function$;

revoke all on function ncrm_private.automacao_notificacao_configurada(jsonb,text,text,text)
  from public, anon, authenticated;

-- Reconciliação inicial: fecha somente o que perdeu sua autoridade. Automação
-- ativa + publicada + ação ainda configurada permanece intocada, mesmo antiga.
update public.ncrm_notificacao n
   set resolvida_em = coalesce(n.resolvida_em, now()),
       resolvida_por = coalesce(n.resolvida_por, 'automacao_ciclo')
  from public.automacoes a
 where n.automacao_id = a.id
   and n.resolvida_em is null
   and n.chave like 'automacao:%'
   and (
     a.ativa is distinct from true
     or a.status is distinct from 'publicado'
     or coalesce(a.arquivada, false)
     or not ncrm_private.automacao_notificacao_configurada(
       a.mapa, n.automacao_bloco_id, n.publico, n.tipo
     )
   );

-- Toda nova chave do motor recebe o vínculo direto, inclusive sem depender de
-- o corpo atual de motor_acoes ser copiado/recriado nesta migration.
create or replace function ncrm_private.notificacao_vincular_automacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
declare
  v_automacao_id bigint;
  v_lead_id bigint;
begin
  if new.chave not like 'automacao:%' then
    return new;
  end if;

  -- Linhas históricas de quatro partes entram pelo backfill acima, mas o
  -- produtor atual deve sempre materializar público e tipo na identidade.
  if new.chave ~ '^automacao:[0-9]+:[^:]+:[0-9]+$' then
    raise exception 'AUTOMACAO_NOTIFICACAO_CHAVE_LEGADA';
  end if;
  if new.chave !~ '^automacao:[0-9]+:[^:]+:[0-9]+:[^:]+:[^:]+$' then
    raise exception 'AUTOMACAO_NOTIFICACAO_CHAVE_INVALIDA';
  end if;

  v_automacao_id := split_part(new.chave, ':', 2)::bigint;
  v_lead_id := nullif(split_part(new.chave, ':', 4), '0')::bigint;

  if not exists (select 1 from public.automacoes where id = v_automacao_id) then
    raise exception 'AUTOMACAO_NOTIFICACAO_SEM_AUTORIDADE';
  end if;
  if v_lead_id is not null
     and not exists (select 1 from public.leads where id = v_lead_id) then
    raise exception 'AUTOMACAO_NOTIFICACAO_LEAD_INEXISTENTE';
  end if;

  new.automacao_id := v_automacao_id;
  new.automacao_bloco_id := split_part(new.chave, ':', 3);
  new.lead_id := v_lead_id;
  return new;
end
$trigger$;

revoke all on function ncrm_private.notificacao_vincular_automacao()
  from public, anon, authenticated;

drop trigger if exists trg_ncrm_notificacao_vincular_automacao
  on public.ncrm_notificacao;
create trigger trg_ncrm_notificacao_vincular_automacao
before insert or update of chave
on public.ncrm_notificacao
for each row
execute function ncrm_private.notificacao_vincular_automacao();

-- Arquivar, desligar, despublicar ou remover a ação fecha a obrigação aberta.
-- Desarquivar/republicar não reabre histórico: uma nova execução real poderá
-- criar nova obrigação pela mesma chave somente após a anterior estar fechada.
create or replace function ncrm_private.automacao_resolver_notificacoes_ciclo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
begin
  update public.ncrm_notificacao n
     set resolvida_em = coalesce(n.resolvida_em, now()),
         resolvida_por = coalesce(n.resolvida_por, 'automacao_ciclo')
   where n.automacao_id = new.id
     and n.resolvida_em is null
     and n.chave like 'automacao:%'
     and (
       new.ativa is distinct from true
       or new.status is distinct from 'publicado'
       or coalesce(new.arquivada, false)
       or not ncrm_private.automacao_notificacao_configurada(
         new.mapa, n.automacao_bloco_id, n.publico, n.tipo
       )
     );
  return new;
end
$trigger$;

revoke all on function ncrm_private.automacao_resolver_notificacoes_ciclo()
  from public, anon, authenticated;

drop trigger if exists trg_automacao_resolver_notificacoes_ciclo
  on public.automacoes;
create trigger trg_automacao_resolver_notificacoes_ciclo
after update of ativa, status, arquivada, mapa
on public.automacoes
for each row
when (
  new.ativa is distinct from old.ativa
  or new.status is distinct from old.status
  or new.arquivada is distinct from old.arquivada
  or new.mapa is distinct from old.mapa
)
execute function ncrm_private.automacao_resolver_notificacoes_ciclo();

do $verify$
declare
  v_sem_vinculo integer;
  v_sem_autoridade integer;
  v_formato_invalido integer;
begin
  select count(*) into v_sem_vinculo
    from public.ncrm_notificacao
   where chave ~ '^automacao:[0-9]+:[^:]+:[0-9]+(?::[^:]+:[^:]+)?$'
     and automacao_id is null;

  select count(*) into v_formato_invalido
    from public.ncrm_notificacao
   where chave like 'automacao:%'
     and chave !~ '^automacao:[0-9]+:[^:]+:[0-9]+(?::[^:]+:[^:]+)?$';

  select count(*) into v_sem_autoridade
    from public.ncrm_notificacao n
    join public.automacoes a on a.id = n.automacao_id
   where n.resolvida_em is null
     and n.chave like 'automacao:%'
     and (
       a.ativa is distinct from true
       or a.status is distinct from 'publicado'
       or coalesce(a.arquivada, false)
       or not ncrm_private.automacao_notificacao_configurada(
         a.mapa, n.automacao_bloco_id, n.publico, n.tipo
       )
     );

  if v_sem_vinculo <> 0 or v_sem_autoridade <> 0 or v_formato_invalido <> 0 then
    raise exception
      'AUTOMACAO_ALERTA_CICLO_FAILED: sem_vinculo=%, sem_autoridade=%, formato_invalido=%',
      v_sem_vinculo, v_sem_autoridade, v_formato_invalido;
  end if;
end
$verify$;

commit;
