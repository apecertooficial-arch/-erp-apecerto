-- Funil 2.0: reinicio controlado do piloto.
--
-- 1. Preserva integralmente as copias operacionais importadas em arquivo privado.
-- 2. Mantem os 99 leads programados sem depender da existencia antecipada de um card.
-- 3. O card nasce em Novo somente quando a roleta realmente distribuir o lead.
-- 4. Nao altera nem apaga leads, negocios, mensagens D-API, visitas ou vendas originais.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create table if not exists ncrm_private.f2_arquivo_batch (
  id uuid primary key default gen_random_uuid(),
  motivo text not null,
  contagens jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  restaurado_em timestamptz
);

create table if not exists ncrm_private.f2_arquivo_item (
  batch_id uuid not null references ncrm_private.f2_arquivo_batch(id) on delete restrict,
  tipo text not null check (tipo in ('lead','evento','visita','negociacao','historico_vinculo','sara_analise')),
  chave text not null,
  dados jsonb not null,
  primary key (batch_id,tipo,chave)
);

revoke all on ncrm_private.f2_arquivo_batch,ncrm_private.f2_arquivo_item from public,anon,authenticated;
grant select on ncrm_private.f2_arquivo_batch,ncrm_private.f2_arquivo_item to service_role;

-- A fila antiga apontava por FK para a copia que seria apagada. Conservamos o
-- UUID antigo apenas como rastreabilidade e criamos um novo vinculo, inicialmente
-- nulo, para o card que nascera no momento da distribuicao.
do $do$
declare v_constraint text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='ncrm_private' and table_name='f2_distribuicao_programada'
      and column_name='funil_lead_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='ncrm_private' and table_name='f2_distribuicao_programada'
      and column_name='funil_lead_arquivo_id'
  ) then
    select conname into v_constraint
    from pg_constraint
    where conrelid='ncrm_private.f2_distribuicao_programada'::regclass
      and contype='f'
      and confrelid='public.f2_lead'::regclass
    limit 1;
    if v_constraint is not null then
      execute format('alter table ncrm_private.f2_distribuicao_programada drop constraint %I',v_constraint);
    end if;
    alter table ncrm_private.f2_distribuicao_programada
      rename column funil_lead_id to funil_lead_arquivo_id;
  end if;
end
$do$;

alter table ncrm_private.f2_distribuicao_programada
  add column if not exists funil_lead_id uuid null references public.f2_lead(id) on delete set null;

create index if not exists f2_dist_programada_card_novo_idx
  on ncrm_private.f2_distribuicao_programada(funil_lead_id);

-- Interruptor independente da fila. A fila continua pendente, mas nenhuma
-- rotina pode distribuir enquanto o dono nao autorizar uma nova janela.
create table if not exists ncrm_private.f2_distribuicao_controle (
  programa text primary key,
  ativo boolean not null default false,
  motivo_pausa text,
  atualizado_em timestamptz not null default now()
);
revoke all on ncrm_private.f2_distribuicao_controle from public,anon,authenticated;
grant select on ncrm_private.f2_distribuicao_controle to service_role;
insert into ncrm_private.f2_distribuicao_controle(programa,ativo,motivo_pausa,atualizado_em)
values('pipes-antigos-20260805',false,'Aguardando corretores instalarem o aplicativo e confirmacao explicita do gestor',now())
on conflict(programa) do update
set ativo=false,motivo_pausa=excluded.motivo_pausa,atualizado_em=now();

do $cron$
begin
  if exists(select 1 from cron.job where jobname='f2-distribuicao-programada-20260805') then
    perform cron.unschedule('f2-distribuicao-programada-20260805');
  end if;
end
$cron$;

-- Arquivo privado completo e reversivel.
do $arquivo$
declare
  v_batch uuid;
begin
  insert into ncrm_private.f2_arquivo_batch(motivo,contagens)
  values (
    'Reinicio do piloto em 04/08/2026; migracao gradual a partir de 05/08/2026',
    jsonb_build_object(
      'lead',(select count(*) from public.f2_lead),
      'evento',(select count(*) from public.f2_evento),
      'visita',(select count(*) from public.f2_visita),
      'negociacao',(select count(*) from public.f2_negociacao),
      'historico_vinculo',(select count(*) from public.f2_historico_vinculo),
      'sara_analise',(select count(*) from public.f2_sara_analise)
    )
  ) returning id into v_batch;

  insert into ncrm_private.f2_arquivo_item select v_batch,'lead',id::text,to_jsonb(t) from public.f2_lead t;
  insert into ncrm_private.f2_arquivo_item select v_batch,'evento',id::text,to_jsonb(t) from public.f2_evento t;
  insert into ncrm_private.f2_arquivo_item select v_batch,'visita',id::text,to_jsonb(t) from public.f2_visita t;
  insert into ncrm_private.f2_arquivo_item select v_batch,'negociacao',id::text,to_jsonb(t) from public.f2_negociacao t;
  insert into ncrm_private.f2_arquivo_item
    select v_batch,'historico_vinculo',funil_lead_id::text||':'||contato_id::text,to_jsonb(t)
    from public.f2_historico_vinculo t;
  insert into ncrm_private.f2_arquivo_item select v_batch,'sara_analise',id::text,to_jsonb(t) from public.f2_sara_analise t;

  if (select count(*) from ncrm_private.f2_arquivo_item where batch_id=v_batch and tipo='lead')
     <> (select count(*) from public.f2_lead) then
    raise exception 'f2_arquivo_incompleto';
  end if;

  -- Os filhos usam ON DELETE CASCADE; os originais fora de f2_* ficam intactos.
  delete from public.f2_lead;
end
$arquivo$;

-- Restaura um arquivo somente por service_role. Serve como rollback logico e
-- devolve as linhas nas mesmas tabelas/IDs, desde que o piloto ainda esteja vazio.
create or replace function ncrm_private.f2_restaurar_arquivo(p_batch uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare v_contagens jsonb;
begin
  if exists(select 1 from public.f2_lead) then
    raise exception 'f2_restauracao_exige_funil_vazio';
  end if;
  select contagens into v_contagens from ncrm_private.f2_arquivo_batch where id=p_batch for update;
  if v_contagens is null then raise exception 'f2_arquivo_inexistente'; end if;

  insert into public.f2_lead select (jsonb_populate_record(null::public.f2_lead,dados)).*
    from ncrm_private.f2_arquivo_item where batch_id=p_batch and tipo='lead';
  insert into public.f2_evento select (jsonb_populate_record(null::public.f2_evento,dados)).*
    from ncrm_private.f2_arquivo_item where batch_id=p_batch and tipo='evento';
  insert into public.f2_visita select (jsonb_populate_record(null::public.f2_visita,dados)).*
    from ncrm_private.f2_arquivo_item where batch_id=p_batch and tipo='visita';
  insert into public.f2_negociacao select (jsonb_populate_record(null::public.f2_negociacao,dados)).*
    from ncrm_private.f2_arquivo_item where batch_id=p_batch and tipo='negociacao';
  insert into public.f2_historico_vinculo select (jsonb_populate_record(null::public.f2_historico_vinculo,dados)).*
    from ncrm_private.f2_arquivo_item where batch_id=p_batch and tipo='historico_vinculo';
  insert into public.f2_sara_analise select (jsonb_populate_record(null::public.f2_sara_analise,dados)).*
    from ncrm_private.f2_arquivo_item where batch_id=p_batch and tipo='sara_analise';
  update ncrm_private.f2_arquivo_batch set restaurado_em=now() where id=p_batch;
  return jsonb_build_object('ok',true,'batch',p_batch,'contagens',v_contagens);
end
$fn$;
revoke all on function ncrm_private.f2_restaurar_arquivo(uuid) from public,anon,authenticated;
grant execute on function ncrm_private.f2_restaurar_arquivo(uuid) to service_role;

-- A roleta continua usando exatamente os participantes/pesos publicados na
-- automacao 42 e as mesmas travas oficiais. A diferenca e apenas temporal: o
-- card de atendimento nasce depois da atribuicao, nunca antes.
create or replace function ncrm_private.f2_distribuir_programados(p_lote integer default 15)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r record;
  v_automacao_nome text;
  v_items jsonb;
  v_corretor_id bigint;
  v_corretor_nome text;
  v_funil_lead_id uuid;
  v_momento record;
  v_distribuidos integer:=0;
  v_aguardando integer:=0;
  v_ignorados integer:=0;
begin
  if p_lote<1 or p_lote>15 then raise exception 'O lote deve estar entre 1 e 15'; end if;

  if not coalesce((select ativo from ncrm_private.f2_distribuicao_controle
                   where programa='pipes-antigos-20260805'),false) then
    return jsonb_build_object('ok',true,'status','pausado_pelo_gestor','distribuidos',0,
      'pendentes',(select count(*) from ncrm_private.f2_distribuicao_programada
        where programa='pipes-antigos-20260805' and status='pendente'));
  end if;

  select a.nome,b.bloco->'options'->'distribuicao'->'items'
  into v_automacao_nome,v_items
  from public.automacoes a
  cross join lateral jsonb_array_elements(a.mapa->'automation'->'blocks') b(bloco)
  where a.id=42 and a.ativa is true and a.status='publicado'
    and b.bloco->>'type'='distribution' limit 1;
  if v_items is null or jsonb_array_length(v_items)=0 then
    raise exception 'Automacao 42 nao possui bloco de distribuicao publicado';
  end if;

  select * into v_momento from public.f2_momento_config where codigo='PRIMEIRA_ABORDAGEM' and ativo limit 1;
  if not found then raise exception 'Momento PRIMEIRA_ABORDAGEM ausente'; end if;

  for r in
    select q.programa,q.lead_id,q.negocio_id,q.funil_lead_arquivo_id,
      l.nome,l.telefone,l.corretor_id lead_corretor_id,n.corretor_id negocio_corretor_id,
      n.stage_id,n.pipeline_id,n.criado_em negocio_criado_em,l.tags
    from ncrm_private.f2_distribuicao_programada q
    join public.negocios n on n.id=q.negocio_id and n.lead_id=q.lead_id
    join public.leads l on l.id=q.lead_id
    where q.programa='pipes-antigos-20260805' and q.status='pendente'
      and q.programado_para<=now()
    order by q.programado_para,q.lead_id
    for update of q,n,l skip locked limit p_lote
  loop
    if r.pipeline_id<>2 or r.stage_id=public.aquario_stage_id()
       or coalesce(r.tags,'[]'::jsonb) @> '[{"name":"Aquário"}]'::jsonb then
      update ncrm_private.f2_distribuicao_programada set status='ignorado',ultimo_erro='fora_do_escopo',processado_em=now()
      where programa=r.programa and lead_id=r.lead_id;
      v_ignorados:=v_ignorados+1; continue;
    end if;
    if r.lead_corretor_id is not null or r.negocio_corretor_id is not null then
      update ncrm_private.f2_distribuicao_programada set status='ignorado',ultimo_erro='lead_ja_possui_corretor',processado_em=now()
      where programa=r.programa and lead_id=r.lead_id;
      v_ignorados:=v_ignorados+1; continue;
    end if;

    insert into public.motor_roleta_contadores(automacao_id,bloco_id,corretor_id,peso)
    select 42,'F2_BACKLOG_20260805',c.id,(i.item->>'peso')::numeric
    from jsonb_array_elements(v_items) i(item)
    join public.corretores c on public.nome_normalizado(c.nome)=public.nome_normalizado(i.item->>'corretor')
    where coalesce((i.item->>'on')::boolean,true)
      and coalesce(nullif(i.item->>'peso','')::numeric,0)>0 and coalesce(c.ativo,false)
      and public.corretor_pode_receber(c.id) and public.instancia_saudavel(c.id)
    on conflict(automacao_id,bloco_id,corretor_id) do update set peso=excluded.peso;

    select rc.corretor_id into v_corretor_id
    from public.motor_roleta_contadores rc
    join public.corretores c on c.id=rc.corretor_id
    join jsonb_array_elements(v_items) i(item)
      on public.nome_normalizado(c.nome)=public.nome_normalizado(i.item->>'corretor')
    where rc.automacao_id=42 and rc.bloco_id='F2_BACKLOG_20260805'
      and coalesce((i.item->>'on')::boolean,true)
      and coalesce(nullif(i.item->>'peso','')::numeric,0)>0 and coalesce(c.ativo,false)
      and public.corretor_pode_receber(c.id) and public.instancia_saudavel(c.id)
    order by rc.atualizado_em asc nulls first,rc.corretor_id limit 1;

    if v_corretor_id is null then
      update ncrm_private.f2_distribuicao_programada
      set tentativas=tentativas+1,ultimo_erro='nenhum_corretor_elegivel_no_horario'
      where programa=r.programa and lead_id=r.lead_id;
      v_aguardando:=v_aguardando+1; continue;
    end if;
    select nome into v_corretor_nome from public.corretores where id=v_corretor_id;

    update public.leads set corretor_id=v_corretor_id where id=r.lead_id and corretor_id is null;
    if not found then raise exception 'Falha ao atribuir lead %',r.lead_id; end if;
    update public.negocios set corretor_id=v_corretor_id,ultima_movimentacao=now()
      where id=r.negocio_id and corretor_id is null;
    if not found then raise exception 'Falha ao atribuir negocio %',r.negocio_id; end if;

    insert into public.f2_lead(
      origem_negocio_id,nome,telefone,corretor_id,corretor_nome,etapa,momento_codigo,
      acao_codigo,acao_rotulo,proxima_acao_em,cadencia_passo,ultima_reavaliacao_resumo,
      corte_conversa_em,historico_completo
    ) values (
      r.negocio_id,r.nome,r.telefone,v_corretor_id,v_corretor_nome,'novo',v_momento.codigo,
      v_momento.acao_codigo,v_momento.acao_rotulo,now()+make_interval(mins=>v_momento.prazo_minutos),0,
      'Lead distribuido gradualmente. A Sara avaliara a conversa apos a primeira interacao confirmada.',
      coalesce(r.negocio_criado_em,now()),true
    ) returning id into v_funil_lead_id;

    insert into public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload)
    values(v_funil_lead_id,'importacao','Lead distribuido para o piloto',
      'O card nasceu em Novo somente no momento da distribuicao pela roleta oficial.',
      jsonb_build_object('programa',r.programa,'lead_id',r.lead_id,'negocio_id',r.negocio_id,'corretor_id',v_corretor_id));

    update public.motor_roleta_contadores set recebidos=recebidos+1,atualizado_em=now()
      where automacao_id=42 and bloco_id='F2_BACKLOG_20260805' and corretor_id=v_corretor_id;
    insert into public.motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
    values(42,coalesce(v_automacao_nome,'Distribuicao funil 2.0'),'F2_BACKLOG_20260805','distribuicao','ok',r.nome,r.telefone,
      'Lead distribuido e criado em Novo para '||coalesce(v_corretor_nome,'#'||v_corretor_id));
    delete from public.ncrm_leads_guardados where lead_id=r.lead_id;
    update ncrm_private.f2_distribuicao_programada
    set status='distribuido',tentativas=tentativas+1,corretor_id=v_corretor_id,
      funil_lead_id=v_funil_lead_id,ultimo_erro=null,processado_em=now()
    where programa=r.programa and lead_id=r.lead_id;
    v_distribuidos:=v_distribuidos+1;
  end loop;

  return jsonb_build_object('ok',true,'distribuidos',v_distribuidos,
    'aguardando_elegivel',v_aguardando,'ignorados',v_ignorados,
    'pendentes',(select count(*) from ncrm_private.f2_distribuicao_programada
      where programa='pipes-antigos-20260805' and status='pendente'));
end
$fn$;
revoke all on function ncrm_private.f2_distribuir_programados(integer) from public,anon,authenticated;
grant execute on function ncrm_private.f2_distribuir_programados(integer) to service_role;

-- O tick permanece instalado, mas fail-closed. Quando o gestor autorizar,
-- uma migration separada liga o controle e agenda a nova janela.
create or replace function ncrm_private.f2_distribuicao_programada_tick()
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
begin
  if not coalesce((select ativo from ncrm_private.f2_distribuicao_controle
                   where programa='pipes-antigos-20260805'),false) then
    return jsonb_build_object('ok',true,'status','pausado_pelo_gestor','distribuidos',0,
      'pendentes',(select count(*) from ncrm_private.f2_distribuicao_programada
        where programa='pipes-antigos-20260805' and status='pendente'));
  end if;
  return ncrm_private.f2_distribuir_programados(15);
end
$fn$;
revoke all on function ncrm_private.f2_distribuicao_programada_tick() from public,anon,authenticated;
grant execute on function ncrm_private.f2_distribuicao_programada_tick() to service_role;

-- Pos-condicoes: o Funil 2 esta vazio, a fila permanece e nenhum source foi perdido.
do $check$
declare v_fila integer;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null then return; end if;
  if exists(select 1 from public.f2_lead) then raise exception 'f2_nao_foi_zerado'; end if;
  select count(*) into v_fila from ncrm_private.f2_distribuicao_programada
    where programa='pipes-antigos-20260805' and status='pendente';
  if v_fila<>99 then raise exception 'f2_fila_esperava_99_encontrou_%',v_fila; end if;
  if coalesce((select ativo from ncrm_private.f2_distribuicao_controle
               where programa='pipes-antigos-20260805'),true) then
    raise exception 'f2_fila_nao_foi_pausada';
  end if;
  if exists(select 1 from cron.job where jobname='f2-distribuicao-programada-20260805') then
    raise exception 'f2_cron_nao_foi_desagendado';
  end if;
end
$check$;

commit;
