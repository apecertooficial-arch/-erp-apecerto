-- Central de Automacoes: corte operacional completo e observavel.
--
-- Principios:
--   * sensores apenas registram fatos;
--   * somente mapas publicados tomam decisoes comerciais;
--   * ausencia de evidencia nunca vira classificacao inventada;
--   * falhas ficam visiveis e podem ser reprocessadas com a mesma identidade;
--   * rotinas antigas sao arquivadas, nao deixadas adormecidas.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create schema if not exists private;

-- 1. A fila antiga da Sara deixa de ser um segundo motor.
create table if not exists private.central_sara_fila_legacy_archive (
  funil_lead_id uuid primary key,
  motivo text,
  pedido_em timestamptz,
  ultima_msg_em timestamptz,
  arquivado_em timestamptz not null default now(),
  motivo_arquivo text not null default 'motor_substituido_pela_central'
);
alter table private.central_sara_fila_legacy_archive enable row level security;
revoke all on table private.central_sara_fila_legacy_archive
  from public, anon, authenticated;
grant select, insert on table private.central_sara_fila_legacy_archive
  to service_role;

insert into private.central_sara_fila_legacy_archive(
  funil_lead_id, motivo, pedido_em, ultima_msg_em
)
select funil_lead_id, motivo, pedido_em, ultima_msg_em
from public.f2_sara_fila
on conflict(funil_lead_id) do update set
  motivo = excluded.motivo,
  pedido_em = excluded.pedido_em,
  ultima_msg_em = excluded.ultima_msg_em,
  arquivado_em = now();

delete from public.f2_sara_fila;

do $legacy_jobs$
declare r record;
begin
  for r in
    select jobid from cron.job
    where jobname in ('sara-tempo-real','f2-pescado-respondeu','f2_entrada_distribuicao')
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end
$legacy_jobs$;

drop trigger if exists trg_f2_sara_marcar_para_reavaliar on public.wa_mensagens;
drop trigger if exists f2_sara_marcar_para_reavaliar on public.wa_mensagens;
revoke all on function public.f2_sara_processar_fila(integer)
  from public, anon, authenticated;
revoke all on function public.f2_sara_resgatar_atrasados()
  from public, anon, authenticated;

comment on table public.f2_sara_fila is
  'Legado inativo. Eventos de conversa sao processados somente pelo motor-relogio-central e pelas automacoes publicadas.';

-- 2. A notificacao nasce da automacao #52 depois do resultado da distribuicao.
-- O trigger antigo enviava um efeito paralelo ao mapa e podia divergir do dono final.
drop trigger if exists f2_lead_notificar_primeira_abordagem on public.f2_lead;

-- 3. Recuperacao unica, auditada e sem inventar dono ou negocio.
create table if not exists private.central_recuperacao_cards_audit (
  negocio_id bigint primary key,
  lead_id bigint not null,
  funil_lead_id uuid,
  etapa text,
  resultado text not null,
  detalhe text,
  executado_em timestamptz not null default now()
);
alter table private.central_recuperacao_cards_audit enable row level security;
revoke all on table private.central_recuperacao_cards_audit
  from public, anon, authenticated;
grant select, insert, update on table private.central_recuperacao_cards_audit
  to service_role;

create table if not exists private.central_recuperacao_quarentena (
  lead_id bigint primary key,
  motivo text not null,
  origem text,
  criado_em timestamptz,
  registrado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
alter table private.central_recuperacao_quarentena enable row level security;
revoke all on table private.central_recuperacao_quarentena
  from public, anon, authenticated;
grant select, insert, update on table private.central_recuperacao_quarentena
  to service_role;

create table if not exists private.central_config_audit (
  id bigint generated always as identity primary key,
  chave text not null,
  valor jsonb not null,
  usuario_id uuid,
  criado_em timestamptz not null default now()
);
alter table private.central_config_audit enable row level security;
revoke all on table private.central_config_audit from public, anon, authenticated;
grant select, insert on table private.central_config_audit to service_role;

insert into private.central_recuperacao_quarentena(lead_id,motivo,origem,criado_em)
select l.id,'negocio_ausente',l.origem,l.criado_em
from public.leads l
where l.criado_em >= timestamptz '2026-08-19 21:00:00+00'
  and l.origem in ('automacao','campanha-miruna','meta_lead_ads','google')
  and not exists(select 1 from public.negocios n where n.lead_id=l.id)
on conflict(lead_id) do update set
  motivo=excluded.motivo, origem=excluded.origem, criado_em=excluded.criado_em;

do $recover_cards$
declare
  r record;
  v_card uuid;
  v_etapa text;
  v_momento text;
  v_disparos integer;
begin
  for r in
    select n.id negocio_id,n.lead_id,l.nome,l.telefone,l.email,n.stage_id
    from public.negocios n
    join public.leads l on l.id=n.lead_id
    where l.criado_em >= timestamptz '2026-08-19 21:00:00+00'
      and l.origem in ('automacao','campanha-miruna','meta_lead_ads','google')
      and n.status='aberto'
      and n.pipeline_id=public.f2_pipeline_id()
      and not exists(
        select 1 from public.f2_lead f where f.origem_negocio_id=n.id
      )
    order by n.id
  loop
    select coalesce(nullif(s.chave,''),'novo') into v_etapa
    from public.pipeline_stages s where s.id=r.stage_id;
    v_etapa:=coalesce(v_etapa,'novo');
    begin
      v_card:=public.f2_entrada_direta(r.negocio_id,v_etapa);
      if v_card is null then
        raise exception 'f2_entrada_direta_retornou_nulo';
      end if;
      select momento_codigo into v_momento from public.f2_lead where id=v_card;
      v_disparos:=public.motor_evento_disparar(
        'checagem-diaria-trigger',
        jsonb_build_object(
          'nome',coalesce(r.nome,'Lead'),'telefone',coalesce(r.telefone,''),
          'email',coalesce(r.email,''),'__funil_lead_id',v_card,
          '__motor_priority',5,'__motor_evento','recuperacao_explicita'
        ),v_momento
      );
      insert into private.central_recuperacao_cards_audit(
        negocio_id,lead_id,funil_lead_id,etapa,resultado,detalhe
      ) values(
        r.negocio_id,r.lead_id,v_card,v_etapa,'recuperado',
        'Card criado pela recuperacao explicita; automacoes Sara enfileiradas: '||v_disparos
      ) on conflict(negocio_id) do update set
        funil_lead_id=excluded.funil_lead_id,etapa=excluded.etapa,
        resultado=excluded.resultado,detalhe=excluded.detalhe,executado_em=now();
    exception when others then
      insert into private.central_recuperacao_cards_audit(
        negocio_id,lead_id,etapa,resultado,detalhe
      ) values(r.negocio_id,r.lead_id,v_etapa,'quarentena',left(sqlstate||': '||sqlerrm,500))
      on conflict(negocio_id) do update set
        resultado='quarentena',detalhe=excluded.detalhe,executado_em=now();
    end;
  end loop;
end
$recover_cards$;

-- 4. Nao aplicavel e fora do funil sao resultados terminais, nao panes.
do $patch_ai_noop$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_rodar_unchecked'
    and p.prokind='f' limit 1;
  if v_def is null then raise exception 'motor_rodar_unchecked_ausente'; end if;
  if position('AI_RESULTADO_TERMINAL_IGNORADO' in v_def)>0 then return; end if;

  v_old := $old$      if coalesce((_res->>'ok')::boolean,false) is not true then
        trace:=trace||'>> Agente falhou'||chr(10);
        cur:=nullif(b#>>'{options,errorNextBlockId}','');
        if cur is null then
          if _res->>'erro'='ia_indisponivel' then
            raise exception using errcode='P0001',
              message='AUTOMATION_RETRY: AI_UNAVAILABLE';
          end if;
          raise exception using errcode='P0001',
            message='AUTOMATION_MODULE_FAILED: ai-agent:'||coalesce(_res->>'erro','erro');
        end if;
        continue;
      end if;$old$;

  v_new := $new$      if coalesce((_res->>'ok')::boolean,false) is not true then
        if _res->>'erro' in ('lead_fora_do_funil','analise_nao_aplicavel') then
          insert into public.motor_execucoes(
            automacao_id,automacao_nome,bloco_id,evento,status,
            lead_nome,lead_telefone,detalhe
          ) values(
            p_auto_id,a_nome,cur,'agente','ignorado',p_lead->>'nome',v_tel,
            'AI_RESULTADO_TERMINAL_IGNORADO: '||(_res->>'erro')
          );
          trace:=trace||'>> Agente ignorado: resultado nao aplicavel'||chr(10);
          cur:=null;
          continue;
        end if;
        trace:=trace||'>> Agente falhou'||chr(10);
        cur:=nullif(b#>>'{options,errorNextBlockId}','');
        if cur is null then
          if _res->>'erro'='ia_indisponivel' then
            raise exception using errcode='P0001',
              message='AUTOMATION_RETRY: AI_UNAVAILABLE';
          end if;
          raise exception using errcode='P0001',
            message='AUTOMATION_MODULE_FAILED: ai-agent:'||coalesce(_res->>'erro','erro');
        end if;
        continue;
      end if;$new$;

  if position(v_old in v_def)=0 then
    raise exception 'ancora_ai_noop_nao_encontrada';
  end if;
  v_def:=replace(v_def,v_old,v_new);
  execute v_def;
end
$patch_ai_noop$;

-- 5. Saude, revisao, quarentena, replay e freio visivel.
create or replace function public.central_saude_operacional()
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_result jsonb;
begin
  if not coalesce(public.can_manage_all(),false) then
    raise exception using errcode='42501',message='CENTRAL_ADMIN_REQUIRED';
  end if;

  select jsonb_build_object(
    'agora',now(),
    'abordagem_automatica',coalesce((
      select ativo from public.motor_flags where nome='abordagem_automatica'
    ),false),
    'automacoes',jsonb_build_object(
      'ativas',(select count(*) from public.automacoes a
        where a.ativa and a.status='publicado' and not coalesce(a.arquivada,false)),
      'invalidas',(select count(*) from public.automacoes a
        join public.automacao_versoes v on v.id=a.versao_publicada_id
        where a.ativa and a.status='publicado' and not coalesce(a.arquivada,false)
          and coalesce((public.automacao_validar_mapa(v.mapa)->>'ok')::boolean,false) is not true)
    ),
    'execucoes_24h',(select coalesce(jsonb_object_agg(status,qty),'{}'::jsonb)
      from (select status,count(*) qty from public.motor_execucoes
        where criado_em>=now()-interval '24 hours' group by status) s),
    'fila',jsonb_build_object(
      'pendentes',(select count(*) from public.motor_fila where status='pendente'),
      'quarentena',(select count(*) from public.motor_fila where status='erro'),
      'mais_antiga',(select min(criado_em) from public.motor_fila where status='erro')
    ),
    'sara',jsonb_build_object(
      'fila_legada',(select count(*) from public.f2_sara_fila),
      'revisao_humana',(select count(*) from public.f2_sara_analise a
        where a.status='revisao_humana'
          and not exists(select 1 from public.f2_sara_decisao d where d.analise_id=a.id)),
      'sem_evidencia',(select count(*) from public.f2_sara_analise a
        where a.status='sem_historico' and a.analisado_em>=now()-interval '7 days'),
      'qualidade_pendente',(select count(*) from public.f2_lead f
        where f.descartado_em is null and f.etapa<>'legado'
          and f.qualidade_atendimento_nota is null)
    ),
    'integridade',jsonb_build_object(
      'lead_recente_sem_negocio',(select count(*) from public.leads l
        where l.criado_em>=now()-interval '48 hours'
          and not exists(select 1 from public.negocios n where n.lead_id=l.id)),
      'negocio_funil2_sem_card',(select count(*) from public.negocios n
        join public.leads l on l.id=n.lead_id
        where l.criado_em>=now()-interval '48 hours'
          and n.status='aberto' and n.pipeline_id=public.f2_pipeline_id()
          and not exists(select 1 from public.f2_lead f where f.origem_negocio_id=n.id))
    ),
    'presenca',jsonb_build_object(
      'elegiveis',(select count(*) from public.corretores c
        where c.ativo and coalesce((public.ncrm_corretor_elegibilidade(c.id)->>'elegivel')::boolean,false)),
      'ativos',(select count(*) from public.corretores c where c.ativo)
    ),
    'quarentena',(select coalesce(jsonb_agg(q order by q.id desc),'[]'::jsonb)
      from (
        select f.id,a.nome automacao,f.bloco_id,f.tentativas,
               left(coalesce(f.ultimo_erro,''),240) erro,f.criado_em,f.processado_em
        from public.motor_fila f join public.automacoes a on a.id=f.automacao_id
        where f.status='erro' order by f.id desc limit 20
      ) q),
    'revisoes',(select coalesce(jsonb_agg(r order by r.analisado_em desc),'[]'::jsonb)
      from (
        select a.id analise_id,a.funil_lead_id,f.nome,f.momento_codigo,
               a.resumo,a.confianca,a.analisado_em
        from public.f2_sara_analise a
        join public.f2_lead f on f.id=a.funil_lead_id
        where a.status='revisao_humana'
          and not exists(select 1 from public.f2_sara_decisao d where d.analise_id=a.id)
        order by a.analisado_em desc limit 12
      ) r),
    'contratos',jsonb_build_array(
      jsonb_build_object('nome','Automacoes publicadas validas','ok',not exists(
        select 1 from public.automacoes a join public.automacao_versoes v on v.id=a.versao_publicada_id
        where a.ativa and a.status='publicado' and not coalesce(a.arquivada,false)
          and coalesce((public.automacao_validar_mapa(v.mapa)->>'ok')::boolean,false) is not true)),
      jsonb_build_object('nome','Sem fila paralela da Sara','ok',not exists(select 1 from public.f2_sara_fila)),
      jsonb_build_object('nome','Sem notificacao paralela','ok',not exists(
        select 1 from pg_trigger where tgname='f2_lead_notificar_primeira_abordagem' and not tgisinternal)),
      jsonb_build_object('nome','Presenca sem inferencia','ok',not exists(
        select 1 from cron.job where jobname in ('escritorio-ip-autoaprender','presenca_registrar_dia'))),
      jsonb_build_object('nome','Relogio unico da Central','ok',exists(
        select 1 from cron.job where jobname='motor-relogio-central' and active)),
      jsonb_build_object('nome','Entradas recentes com card','ok',not exists(
        select 1 from public.negocios n join public.leads l on l.id=n.lead_id
        where l.criado_em>=now()-interval '48 hours' and n.status='aberto'
          and n.pipeline_id=public.f2_pipeline_id()
          and not exists(select 1 from public.f2_lead f where f.origem_negocio_id=n.id))),
      jsonb_build_object('nome','Freio de mensagens existente','ok',exists(
        select 1 from public.motor_flags where nome='abordagem_automatica')),
      jsonb_build_object('nome','Rastreamento Meta explicito','ok',not exists(
        select 1 from pg_trigger where tgname='trg_motor_fila_meta_attribution' and not tgisinternal)),
      jsonb_build_object('nome','Runtime revalida publicacao','ok',position(
        'AUTOMATION_RUNTIME_CONTRACT_INVALID' in pg_get_functiondef((
          select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname='motor_rodar' and p.prokind='f' limit 1
        )))>0)
    )
  ) into v_result;
  return v_result;
end
$fn$;

revoke all on function public.central_saude_operacional()
  from public, anon;
grant execute on function public.central_saude_operacional()
  to authenticated, service_role;

create or replace function public.central_reprocessar_fila(p_fila_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_f public.motor_fila%rowtype;
  v_nome text;
begin
  if not coalesce(public.can_manage_all(),false) then
    raise exception using errcode='42501',message='CENTRAL_ADMIN_REQUIRED';
  end if;
  select * into v_f from public.motor_fila
  where id=p_fila_id and status='erro' for update;
  if not found then
    return jsonb_build_object('ok',false,'erro','ITEM_NAO_ESTA_EM_QUARENTENA');
  end if;
  select nome into v_nome from public.automacoes where id=v_f.automacao_id;
  update public.motor_fila set
    status='pendente',due_at=now(),processado_em=null,tentativas=0,
    ultimo_erro='REPROCESSAMENTO_MANUAL_SOLICITADO'
  where id=v_f.id;
  insert into public.motor_execucoes(
    automacao_id,automacao_nome,bloco_id,evento,status,
    lead_nome,lead_telefone,detalhe
  ) values(
    v_f.automacao_id,v_nome,v_f.bloco_id,'reprocessamento','alerta',
    v_f.lead->>'nome',v_f.lead->>'telefone',
    'Item #'||v_f.id||' saiu da quarentena mantendo a identidade idempotente original'
  );
  return jsonb_build_object('ok',true,'fila_id',v_f.id,'status','pendente');
end
$fn$;
revoke all on function public.central_reprocessar_fila(bigint)
  from public, anon;
grant execute on function public.central_reprocessar_fila(bigint)
  to authenticated, service_role;

create or replace function public.central_abordagem_emergencia(p_liberar boolean)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
begin
  if not coalesce(public.can_manage_all(),false) then
    raise exception using errcode='42501',message='CENTRAL_ADMIN_REQUIRED';
  end if;
  insert into public.motor_flags(nome,ativo,atualizado_em)
  values('abordagem_automatica',coalesce(p_liberar,false),now())
  on conflict(nome) do update set ativo=excluded.ativo,atualizado_em=now();
  insert into private.central_config_audit(chave,valor,usuario_id)
  values(
    'abordagem_automatica',
    jsonb_build_object('ativo',coalesce(p_liberar,false)),
    (select auth.uid())
  );
  return jsonb_build_object('ok',true,'abordagem_automatica',coalesce(p_liberar,false));
end
$fn$;
revoke all on function public.central_abordagem_emergencia(boolean)
  from public, anon;
grant execute on function public.central_abordagem_emergencia(boolean)
  to authenticated, service_role;

-- A migracao nunca libera mensagens por conta propria.
insert into public.motor_flags(nome,ativo,atualizado_em)
values('abordagem_automatica',false,now())
on conflict(nome) do update set ativo=false,atualizado_em=now();

do $verify$
begin
  if exists(select 1 from public.f2_sara_fila) then
    raise exception 'FILA_SARA_LEGADA_NAO_ESVAZIADA';
  end if;
  if exists(select 1 from cron.job where jobname in (
    'sara-tempo-real','f2-pescado-respondeu','f2_entrada_distribuicao',
    'escritorio-ip-autoaprender','presenca_registrar_dia'
  )) then raise exception 'CRON_COM_DECISAO_LEGADA_AINDA_EXISTE'; end if;
  if exists(select 1 from pg_trigger
    where tgname='f2_lead_notificar_primeira_abordagem' and not tgisinternal
  ) then raise exception 'NOTIFICACAO_PARALELA_AINDA_EXISTE'; end if;
  if exists(
    select 1 from public.negocios n join public.leads l on l.id=n.lead_id
    where l.criado_em>=timestamptz '2026-08-19 21:00:00+00'
      and l.origem in ('automacao','campanha-miruna','meta_lead_ads','google')
      and n.status='aberto' and n.pipeline_id=public.f2_pipeline_id()
      and not exists(select 1 from public.f2_lead f where f.origem_negocio_id=n.id)
  ) then raise exception 'NEGOCIO_RECENTE_SEM_CARD'; end if;
  if not exists(select 1 from cron.job
    where jobname='motor-relogio-central' and active
  ) then raise exception 'RELOGIO_CENTRAL_INATIVO'; end if;
  if coalesce((select ativo from public.motor_flags
    where nome='abordagem_automatica'),false) then
    raise exception 'ABORDAGEM_AUTOMATICA_NAO_PODE_SER_LIBERADA_NESTE_CORTE';
  end if;
end
$verify$;

commit;
