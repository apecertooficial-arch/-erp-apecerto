-- DRAFT NAO EXECUTAVEL / NAO APLICADO EM PRODUCAO
--
-- Este arquivo e o contrato SQL revisavel do P0 de alertas da Sara. Ele fica
-- deliberadamente fora de supabase/migrations enquanto a CLI oficial nao esta
-- disponivel e a alteracao de producao nao recebeu autorizacao especifica.
-- O arquivo de migration deve ser criado por `supabase migration new` e receber
-- este conteudo somente depois dos gates descritos no documento de rastreio.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Vinculo direto com o card evita depender de uma cadeia indireta
-- notificacao -> execution_id -> analise -> lead para deduplicar e resolver.
alter table public.ncrm_notificacao
  add column if not exists funil_lead_id uuid null,
  add column if not exists evento_source_id text null;

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ncrm_notificacao'::regclass
       and conname = 'ncrm_notificacao_funil_lead_id_fkey'
  ) then
    alter table public.ncrm_notificacao
      add constraint ncrm_notificacao_funil_lead_id_fkey
      foreign key (funil_lead_id) references public.f2_lead(id)
      on delete set null;
  end if;
end
$constraint$;

create index if not exists ncrm_notificacao_funil_lead_id_idx
  on public.ncrm_notificacao(funil_lead_id)
  where funil_lead_id is not null;

comment on column public.ncrm_notificacao.funil_lead_id is
  'Card F2 ao qual a pendencia pertence; permite uma unica pendencia aberta por card e publico.';
comment on column public.ncrm_notificacao.evento_source_id is
  'Evento/checkpoint de origem da pendencia; execution_id continua sendo a correlacao da ultima execucao.';

-- Backfill sem ler PII e sem apagar historico.
update public.ncrm_notificacao n
   set funil_lead_id = a.funil_lead_id,
       evento_source_id = a.evento_source_id
  from public.f2_sara_analise a
 where n.execution_id = a.evento_execution_id
   and n.tipo = 'acao_vencida'
   and n.chave like 'sara:acao-vencida:%'
   and (n.funil_lead_id is null
        or n.evento_source_id is distinct from a.evento_source_id);

-- Pendencia de card descartado nao pode permanecer na fila operacional.
update public.ncrm_notificacao n
   set resolvida_em = coalesce(n.resolvida_em, now()),
       resolvida_por = coalesce(n.resolvida_por, 'automatica_f2')
  from public.f2_lead f
 where n.funil_lead_id = f.id
   and n.resolvida_em is null
   and n.tipo = 'acao_vencida'
   and n.chave like 'sara:acao-vencida:%'
   and f.descartado_em is not null;

-- Se nao existe mais corretor, o aviso pessoal fecha; a gestao continua com
-- uma unica pendencia para decidir a distribuicao.
update public.ncrm_notificacao n
   set resolvida_em = coalesce(n.resolvida_em, now()),
       resolvida_por = coalesce(n.resolvida_por, 'automatica_f2')
  from public.f2_lead f
 where n.funil_lead_id = f.id
   and n.resolvida_em is null
   and n.tipo = 'acao_vencida'
   and n.chave like 'sara:acao-vencida:%'
   and n.publico = 'corretor'
   and f.corretor_id is null;

-- Consolida o estoque atual: preserva a ocorrencia mais recente como aberta e
-- resolve as anteriores. O contador registra quantas cobrancas foram reunidas.
with grupos as (
  select n.id,
         n.funil_lead_id,
         n.publico,
         row_number() over (
           partition by n.funil_lead_id, n.publico
           order by n.criada_em desc, n.id desc
         ) as ordem,
         count(*) over (
           partition by n.funil_lead_id, n.publico
         ) as ocorrencias,
         min(n.criada_em) over (
           partition by n.funil_lead_id, n.publico
         ) as primeira_ocorrencia
    from public.ncrm_notificacao n
   where n.resolvida_em is null
     and n.tipo = 'acao_vencida'
     and n.chave like 'sara:acao-vencida:%'
     and n.funil_lead_id is not null
), resolvidas as (
  update public.ncrm_notificacao n
     set resolvida_em = now(),
         resolvida_por = 'automatica_f2'
    from grupos g
   where n.id = g.id
     and g.ordem > 1
  returning n.id
)
update public.ncrm_notificacao n
   set chave = 'sara:acao-vencida:f2:' || g.funil_lead_id::text || ':' || g.publico,
       repeticoes = greatest(n.repeticoes, g.ocorrencias::integer - 1),
       criada_em = least(n.criada_em, g.primeira_ocorrencia),
       corretor_id = f.corretor_id,
       negocio_id = f.origem_negocio_id,
       deep_link = case when f.origem_negocio_id is null then '/notificacoes'
                        else '/negocio/' || f.origem_negocio_id::text end
  from grupos g
  join public.f2_lead f on f.id = g.funil_lead_id
 where n.id = g.id
   and g.ordem = 1;

-- A invariavel de negocio fica no banco, inclusive sob concorrencia.
create unique index if not exists ux_ncrm_sara_acao_aberta_lead_publico
  on public.ncrm_notificacao(funil_lead_id, publico)
  where resolvida_em is null
    and tipo = 'acao_vencida'
    and chave like 'sara:acao-vencida:%'
    and funil_lead_id is not null;

create or replace function public.f2_sara_alertar_checkpoint_nao_executado(
  p_analise_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_a public.f2_sara_analise%rowtype;
  v_f public.f2_lead%rowtype;
  v_afetadas integer := 0;
begin
  select * into v_a
    from public.f2_sara_analise
   where id = p_analise_id;

  if not found
     or v_a.evento_tipo not in ('lead.next_action_due', 'lead.cadence_due')
     or v_a.evento_execution_id is null then
    return jsonb_build_object(
      'ok', true, 'alertou', false,
      'motivo', 'checkpoint_sem_evento_auditavel'
    );
  end if;

  select * into v_f
    from public.f2_lead
   where id = v_a.funil_lead_id;

  if not found then
    return jsonb_build_object(
      'ok', true, 'alertou', false,
      'motivo', 'card_f2_ausente'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('sara-alerta:' || v_f.id::text, 0)
  );

  -- Evidencia positiva ou descarte encerra a cobranca para os dois publicos.
  if v_a.acao_anterior_executada is true or v_f.descartado_em is not null then
    update public.ncrm_notificacao
       set resolvida_em = coalesce(resolvida_em, now()),
           resolvida_por = coalesce(resolvida_por, 'automatica_f2')
     where funil_lead_id = v_f.id
       and resolvida_em is null
       and tipo = 'acao_vencida'
       and chave like 'sara:acao-vencida:%';
    get diagnostics v_afetadas = row_count;
    return jsonb_build_object(
      'ok', true, 'alertou', false, 'resolvidas', v_afetadas,
      'motivo', case when v_f.descartado_em is not null
                     then 'card_descartado'
                     else 'acao_comprovada' end
    );
  end if;

  -- Ausencia de conclusao comprovada nao e o mesmo que falha comprovada.
  if v_a.acao_anterior_executada is distinct from false then
    return jsonb_build_object(
      'ok', true, 'alertou', false,
      'motivo', 'checkpoint_sem_falha_comprovada'
    );
  end if;

  -- Corretor removido nao pode continuar recebendo cobranca pessoal antiga.
  if v_f.corretor_id is null then
    update public.ncrm_notificacao
       set resolvida_em = coalesce(resolvida_em, now()),
           resolvida_por = coalesce(resolvida_por, 'automatica_f2')
     where funil_lead_id = v_f.id
       and publico = 'corretor'
       and resolvida_em is null
       and tipo = 'acao_vencida'
       and chave like 'sara:acao-vencida:%';
  end if;

  insert into public.ncrm_notificacao(
    chave, tipo, publico, prioridade, titulo, detalhe,
    negocio_id, corretor_id, deep_link, repeticoes,
    execution_id, funil_lead_id, evento_source_id
  )
  select
    'sara:acao-vencida:f2:' || v_f.id::text || ':' || p.publico,
    'acao_vencida', p.publico, 1,
    'Acao esperada sem evidencia',
    'A Sara reavaliou o prazo e nao encontrou evidencia posterior de conclusao.',
    v_f.origem_negocio_id, v_f.corretor_id,
    case when v_f.origem_negocio_id is null then '/notificacoes'
         else '/negocio/' || v_f.origem_negocio_id::text end,
    0, v_a.evento_execution_id, v_f.id, v_a.evento_source_id
  from (values ('gestao'::text), ('corretor'::text)) as p(publico)
  where p.publico = 'gestao' or v_f.corretor_id is not null
  on conflict (funil_lead_id, publico)
    where resolvida_em is null
      and tipo = 'acao_vencida'
      and chave like 'sara:acao-vencida:%'
      and funil_lead_id is not null
  do update set
    chave = excluded.chave,
    titulo = excluded.titulo,
    detalhe = excluded.detalhe,
    negocio_id = excluded.negocio_id,
    corretor_id = excluded.corretor_id,
    deep_link = excluded.deep_link,
    evento_source_id = excluded.evento_source_id,
    repeticoes = case
      when public.ncrm_notificacao.execution_id is distinct from excluded.execution_id
        then public.ncrm_notificacao.repeticoes + 1
      else public.ncrm_notificacao.repeticoes
    end,
    vista_em = case
      when public.ncrm_notificacao.execution_id is distinct from excluded.execution_id
        then null
      else public.ncrm_notificacao.vista_em
    end,
    execution_id = excluded.execution_id;

  get diagnostics v_afetadas = row_count;
  return jsonb_build_object(
    'ok', true, 'alertou', v_afetadas > 0,
    'afetadas', v_afetadas,
    'execution_id', v_a.evento_execution_id,
    'funil_lead_id', v_f.id
  );
end
$function$;

revoke all on function public.f2_sara_alertar_checkpoint_nao_executado(bigint)
  from public, anon, authenticated;
grant execute on function public.f2_sara_alertar_checkpoint_nao_executado(bigint)
  to service_role;

-- Resolucao imediata para os comandos operacionais que nao dependem de uma
-- nova rodada da IA: confirmacao manual, descarte ou troca de responsavel.
create or replace function ncrm_private.f2_sara_resolver_alerta_operacional()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
begin
  if new.descartado_em is not null
     or new.ultima_acao_confirmada_em is distinct from old.ultima_acao_confirmada_em then
    update public.ncrm_notificacao
       set resolvida_em = coalesce(resolvida_em, now()),
           resolvida_por = coalesce(resolvida_por, 'automatica_f2')
     where funil_lead_id = new.id
       and resolvida_em is null
       and tipo = 'acao_vencida'
       and chave like 'sara:acao-vencida:%';
  elsif new.corretor_id is distinct from old.corretor_id then
    update public.ncrm_notificacao
       set resolvida_em = coalesce(resolvida_em, now()),
           resolvida_por = coalesce(resolvida_por, 'automatica_f2')
     where funil_lead_id = new.id
       and publico = 'corretor'
       and resolvida_em is null
       and tipo = 'acao_vencida'
       and chave like 'sara:acao-vencida:%';
  end if;
  return new;
end
$trigger$;

revoke all on function ncrm_private.f2_sara_resolver_alerta_operacional()
  from public, anon, authenticated;

drop trigger if exists trg_f2_sara_resolver_alerta_operacional
  on public.f2_lead;
create trigger trg_f2_sara_resolver_alerta_operacional
after update of descartado_em, ultima_acao_confirmada_em, corretor_id
on public.f2_lead
for each row
when (
  new.descartado_em is distinct from old.descartado_em
  or new.ultima_acao_confirmada_em is distinct from old.ultima_acao_confirmada_em
  or new.corretor_id is distinct from old.corretor_id
)
execute function ncrm_private.f2_sara_resolver_alerta_operacional();

-- O total e calculado sobre todo o escopo autorizado; somente a lista visual
-- recebe LIMIT 100. Assim duplicatas nao mascaram o contador real.
create or replace function public.ncrm_notificacoes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_gestor boolean;
  v_corretor bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  end if;

  perform ncrm_private.notificacoes_sincronizar();
  v_gestor := coalesce(public.can_manage_all(), false);
  v_corretor := public.current_broker_id();

  return (
    with escopo as materialized (
      select *
        from public.ncrm_notificacao
       where resolvida_em is null
         and (
           (v_gestor and publico = 'gestao')
           or (
             publico = 'corretor'
             and (
               v_gestor
               or corretor_id = v_corretor
               or coalesce(public.manages_broker(corretor_id), false)
             )
           )
         )
    ), itens as (
      select * from escopo
       order by prioridade, criada_em desc
       limit 100
    )
    select jsonb_build_object(
      'ok', true,
      'gestor', v_gestor,
      'pendentes', (select count(*) from escopo),
      'urgentes', (select count(*) from escopo where prioridade = 1),
      'nao_vistas', (select count(*) from escopo where vista_em is null),
      'itens', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'tipo', tipo,
          'titulo', titulo,
          'detalhe', detalhe,
          'negocio_id', negocio_id,
          'prioridade', prioridade,
          'desde', criada_em,
          'deep_link', deep_link,
          'reaberturas', repeticoes,
          'vista', vista_em is not null
        ) order by prioridade, criada_em desc)
        from itens
      ), '[]'::jsonb)
    )
  );
end
$function$;

revoke all on function public.ncrm_notificacoes() from public, anon;
grant execute on function public.ncrm_notificacoes()
  to authenticated, service_role;

do $verify$
declare
  v_duplicados integer;
  v_descartados integer;
begin
  select count(*) into v_duplicados
    from (
      select funil_lead_id, publico
        from public.ncrm_notificacao
       where resolvida_em is null
         and tipo = 'acao_vencida'
         and chave like 'sara:acao-vencida:%'
         and funil_lead_id is not null
       group by funil_lead_id, publico
      having count(*) > 1
    ) d;

  select count(*) into v_descartados
    from public.ncrm_notificacao n
    join public.f2_lead f on f.id = n.funil_lead_id
   where n.resolvida_em is null
     and n.tipo = 'acao_vencida'
     and n.chave like 'sara:acao-vencida:%'
     and f.descartado_em is not null;

  if v_duplicados <> 0 or v_descartados <> 0 then
    raise exception
      'SARA_ALERTA_DEDUPE_FAILED: duplicados=%, descartados_abertos=%',
      v_duplicados, v_descartados;
  end if;
end
$verify$;

commit;
