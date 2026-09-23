-- Feedback de visita: dono da carteira, qualidade estruturada e cobranca in-app.
-- Push/WhatsApp permanecem desligados; o cron chama apenas sincronizar(false).
-- Aplicada em producao via Supabase MCP em 2026-09-23 (versao 20260923133937).

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Vinculo direto e auditavel; a notificacao nao depende de inferir a visita por
-- negocio, texto ou horario.
alter table public.ncrm_notificacao
  add column if not exists visita_id uuid null;

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ncrm_notificacao'::regclass
       and conname = 'ncrm_notificacao_visita_id_fkey'
  ) then
    alter table public.ncrm_notificacao
      add constraint ncrm_notificacao_visita_id_fkey
      foreign key (visita_id) references public.f2_visita(id)
      on delete set null;
  end if;
end
$constraint$;

create index if not exists ncrm_notificacao_visita_id_idx
  on public.ncrm_notificacao(visita_id)
  where visita_id is not null;

-- Vocabulario fechado: acrescenta somente o novo evento e preserva os tipos
-- confirmados no schema remoto em 2026-09-19.
alter table public.ncrm_notificacao
  drop constraint if exists ncrm_notificacao_tipo_check;
alter table public.ncrm_notificacao
  add constraint ncrm_notificacao_tipo_check
  check (tipo = any (array[
    'lead_novo','primeira_abordagem_pendente','cliente_respondeu','acao_vencida',
    'retorno_proximo','canal_indisponivel','orientacao_sara','lead_sem_corretor',
    'corretor_sobrecarregado','abordagem_fora_do_prazo','falha_entrada','falha_sara',
    'falha_rotina','qualidade_dados','visita_proxima','falha_sincronizacao',
    'escalonamento','presenca_pendente','lead_em_atendimento','lead_quente',
    'visita_feedback_pendente'
  ]));

-- A obrigacao aberta e visita + publico. Chave continua legivel, mas a
-- invariavel concorrente nao depende dela.
create unique index if not exists ux_ncrm_visita_feedback_aberta_publico
  on public.ncrm_notificacao(visita_id, publico)
  where resolvida_em is null
    and tipo = 'visita_feedback_pendente'
    and visita_id is not null;

-- A mesma rubrica transparente do frontend/API. Cada criterio vale um ponto;
-- o banco nao depende de IA para decidir se o registro minimo foi atendido.
do $quality_guard$
begin
  if to_regprocedure('public.f2_feedback_visita_nota(text)') is not null then
    raise exception 'F2_FEEDBACK_QUALIDADE_COLISAO';
  end if;
end
$quality_guard$;

create function public.f2_feedback_visita_nota(p_justificativa text)
returns smallint
language plpgsql
immutable
strict
set search_path = ''
as $function$
declare
  v_presenca text := btrim(split_part(split_part(p_justificativa,' | Presença: ',2),' | ',1));
  v_acompanhantes text := btrim(split_part(split_part(p_justificativa,' | Acompanhantes: ',2),' | ',1));
  v_percepcao text := btrim(split_part(split_part(p_justificativa,' | Percepção: ',2),' | ',1));
  v_positivos text := btrim(split_part(split_part(p_justificativa,' | Pontos positivos: ',2),' | ',1));
  v_negativos text := btrim(split_part(split_part(p_justificativa,' | Pontos negativos: ',2),' | ',1));
  v_objecoes text := btrim(split_part(split_part(p_justificativa,' | Objeções: ',2),' | ',1));
  v_alternativas text := btrim(split_part(split_part(p_justificativa,' | Alternativas: ',2),' | ',1));
  v_intencao text := btrim(split_part(split_part(p_justificativa,' | Intenção: ',2),' | ',1));
  v_proxima text := btrim(split_part(split_part(p_justificativa,' | Próxima ação: ',2),' | ',1));
  v_nota smallint := 0;
begin
  if v_presenca in ('Sozinho(a)','Com companheiro(a)','Com família','Outros') then v_nota:=v_nota+1; end if;
  if v_presenca='Sozinho(a)' or (char_length(v_acompanhantes)>=3 and lower(v_acompanhantes)<>'não informado') then v_nota:=v_nota+1; end if;
  if v_percepcao in ('Encantado','Gostou','Neutro','Não gostou') then v_nota:=v_nota+1; end if;
  if char_length(v_positivos)>=3 then v_nota:=v_nota+1; end if;
  if char_length(v_negativos)>=3 then v_nota:=v_nota+1; end if;
  if char_length(v_objecoes)>=3 then v_nota:=v_nota+1; end if;
  if char_length(v_alternativas)>=3 and lower(v_alternativas) not in ('não informado','não oferecidas') then v_nota:=v_nota+1; end if;
  if v_intencao in ('Fazer proposta','Continuar negociação','Conhecer outra opção','Manter acompanhamento','Solicitar encerramento') then v_nota:=v_nota+1; end if;
  if char_length(v_proxima)>=5 then v_nota:=v_nota+1; end if;
  if char_length(v_proxima)>=12 then v_nota:=v_nota+1; end if;
  return least(10,v_nota);
end;
$function$;

revoke all on function public.f2_feedback_visita_nota(text)
  from public,anon,authenticated;

-- Série gerencial sanitizada. Só mede os novos envelopes estruturados; o
-- histórico legado permanece contabilizado, mas nunca recebe nota retroativa.
create or replace function public.f2_feedback_visita_performance(
  p_inicio date default null,
  p_fim date default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_inicio date := coalesce(
    p_inicio,
    (statement_timestamp() at time zone 'America/Sao_Paulo')::date - 89
  );
  v_fim date := coalesce(
    p_fim,
    (statement_timestamp() at time zone 'America/Sao_Paulo')::date
  );
  v_feedback_min integer;
  v_historico_total integer := 0;
  v_estruturados_total integer := 0;
  v_itens jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null or public.f2_admin() is not true then
    return pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  end if;
  if v_fim < v_inicio or v_fim-v_inicio > 366 then
    return pg_catalog.jsonb_build_object('ok',false,'erro','periodo_invalido');
  end if;

  select feedback_visita_min into v_feedback_min
    from public.f2_operacao_config where id=true;
  if v_feedback_min is null then
    raise exception 'F2_VISITA_CONFIG_AUSENTE';
  end if;

  with resultados as materialized (
    select v.id,v.resultado_por,v.inicio_em,v.fim_em,v.resultado_em,
           v.resultado_justificativa,
           v.resultado_justificativa like 'FEEDBACK_VISITA_V1 |%' as estruturado
      from public.f2_visita v
     where v.status='realizada'
       and v.resultado_em is not null
       and (v.resultado_em at time zone 'America/Sao_Paulo')::date
           between v_inicio and v_fim
  )
  select count(*)::integer,
         count(*) filter(where estruturado)::integer
    into v_historico_total,v_estruturados_total
    from resultados;

  with estruturados as materialized (
    select v.resultado_por,
           public.f2_feedback_visita_nota(v.resultado_justificativa) as nota,
           greatest(0,extract(epoch from (
             v.resultado_em-coalesce(v.fim_em,v.inicio_em+interval '1 hour')
           ))/60)::integer as resposta_min
      from public.f2_visita v
     where v.status='realizada'
       and v.resultado_em is not null
       and v.resultado_justificativa like 'FEEDBACK_VISITA_V1 |%'
       and (v.resultado_em at time zone 'America/Sao_Paulo')::date
           between v_inicio and v_fim
  ), por_corretor as (
    select c.id as corretor_id,coalesce(u.nome,'Corretor não identificado') as corretor,
           count(*)::integer as feedbacks,
           round(avg(e.nota)::numeric,1) as nota_media,
           round(avg(e.resposta_min)::numeric,0)::integer as resposta_media_min,
           count(*) filter(where e.nota<9)::integer as abaixo_minimo,
           round(100.0*count(*) filter(where e.resposta_min<=v_feedback_min)
             /nullif(count(*),0),1) as dentro_prazo_percentual
      from estruturados e
      left join public.usuarios u on u.id=e.resultado_por
      left join public.corretores c on c.usuario_id=e.resultado_por
     group by c.id,u.nome
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'corretor_id',corretor_id,'corretor',corretor,'feedbacks',feedbacks,
    'nota_media',nota_media,'resposta_media_min',resposta_media_min,
    'abaixo_minimo',abaixo_minimo,
    'dentro_prazo_percentual',dentro_prazo_percentual
  ) order by nota_media asc,resposta_media_min desc,corretor),'[]'::jsonb)
    into v_itens from por_corretor;

  return pg_catalog.jsonb_build_object(
    'ok',true,'inicio',v_inicio,'fim',v_fim,
    'historico_total',v_historico_total,
    'estruturados_total',v_estruturados_total,
    'legados_total',v_historico_total-v_estruturados_total,
    'feedback_visita_min',v_feedback_min,
    'itens',v_itens
  );
end;
$function$;

revoke all on function public.f2_feedback_visita_performance(date,date)
  from public,anon;
grant execute on function public.f2_feedback_visita_performance(date,date)
  to authenticated,service_role;

-- Substitui a RPC atual sem mudar assinatura. A diferenca de autorizacao e
-- intencional: admin/gestor acompanha e cobra; somente o corretor dono grava.
create or replace function public.f2_registrar_resultado_visita(
  p_visita_id uuid,
  p_status text,
  p_resultado_codigo text,
  p_justificativa text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_visita public.f2_visita%rowtype;
  v_corretor_atual bigint := public.current_broker_id();
  v_corretor_dono bigint;
  v_momento text;
  v_prazo timestamptz;
  v_justificativa text := left(btrim(coalesce(p_justificativa,'')),800);
  v_rotulo text;
  v_qualidade smallint;
begin
  select * into v_visita
    from public.f2_visita
   where id = p_visita_id
   for update;
  if v_visita.id is not null then
    -- O mesmo lock cobre a validacao do dono e a atualizacao subsequente do
    -- card, impedindo troca concorrente de corretor durante o feedback.
    select f.corretor_id into v_corretor_dono
      from public.f2_lead f
     where f.id = v_visita.funil_lead_id
     for update;
  end if;

  if v_uid is null
     or v_visita.id is null
     or v_corretor_atual is null
     or v_corretor_dono is distinct from v_corretor_atual then
    return pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  end if;
  if p_status not in ('realizada','cancelada','nao_compareceu')
     or p_resultado_codigo is null
     or char_length(v_justificativa) < 10 then
    return pg_catalog.jsonb_build_object('ok',false,'erro','resultado_invalido');
  end if;
  -- A visita realizada não pode ser encerrada por cliente antigo ou chamada
  -- manual com uma frase curta. O envelope V1 é legível, versionado e cabe no
  -- campo textual vigente; uma migration posterior poderá promovê-lo a JSONB
  -- sem perder o histórico capturado durante a transição.
  if p_status = 'realizada' and (
       v_justificativa !~ '^FEEDBACK_VISITA_V1[ ]\|[ ]Presença:[ ](Sozinho[(]a[)]|Com companheiro[(]a[)]|Com família|Outros)[ ]\|'
       or v_justificativa !~ '[ ]\|[ ]Percepção:[ ](Encantado|Gostou|Neutro|Não gostou)[ ]\|'
       or v_justificativa !~ '[ ]\|[ ]Pontos positivos:[ ][^|]{3,}[ ]\|'
       or v_justificativa !~ '[ ]\|[ ]Pontos negativos:[ ][^|]{3,}[ ]\|'
       or v_justificativa !~ '[ ]\|[ ]Objeções:[ ][^|]{3,}[ ]\|'
       or v_justificativa !~ '[ ]\|[ ]Intenção:[ ](Fazer proposta|Continuar negociação|Conhecer outra opção|Manter acompanhamento|Solicitar encerramento)[ ]\|'
       or v_justificativa !~ '[ ]\|[ ]Próxima ação:[ ][^|]{5,}[ ]\|'
     ) then
    return pg_catalog.jsonb_build_object('ok',false,'erro','feedback_incompleto');
  end if;
  if p_status <> 'realizada' and (
       v_justificativa !~ '^RESULTADO_VISITA_V1[ ]\|[ ]Motivo:[ ][^|]{3,}[ ]\|'
       or v_justificativa !~ '[ ]\|[ ]Próxima ação:[ ][^|]{12,}[ ]\|'
     ) then
    return pg_catalog.jsonb_build_object('ok',false,'erro','resultado_encaminhamento_incompleto');
  end if;
  if p_status = 'realizada' then
    v_qualidade:=public.f2_feedback_visita_nota(v_justificativa);
    if v_qualidade < 9 then
      return pg_catalog.jsonb_build_object(
        'ok',false,'erro','feedback_qualidade_insuficiente','qualidade',v_qualidade
      );
    end if;
  end if;
  if (p_status='realizada' and p_resultado_codigo not in
        ('fara_proposta','interessado','quer_outra_opcao','precisa_conversar','nao_gostou'))
     or (p_status='cancelada' and p_resultado_codigo not in
        ('remarcar','cliente_cancelou','corretor_cancelou','produto_indisponivel','conflito_agenda','sem_confirmacao','outro'))
     or (p_status='nao_compareceu' and p_resultado_codigo <> 'nao_compareceu') then
    return pg_catalog.jsonb_build_object('ok',false,'erro','resultado_incompativel');
  end if;
  if p_status='realizada'
     and coalesce(v_visita.fim_em,v_visita.inicio_em+interval '1 hour') > statement_timestamp() then
    return pg_catalog.jsonb_build_object('ok',false,'erro','visita_ainda_nao_terminou');
  end if;

  update public.f2_visita set
    status=p_status,resultado_codigo=p_resultado_codigo,
    resultado_justificativa=v_justificativa,resultado_em=statement_timestamp(),
    resultado_por=v_uid,
    feedback_em=case when p_status='realizada' then statement_timestamp() else null end,
    feedback_por=case when p_status='realizada' then v_uid else null end,
    atualizado_em=statement_timestamp(),atualizado_por=v_uid
  where id=p_visita_id;

  if p_status='realizada' then
    v_momento:='ACOMPANHAMENTO_POS_VISITA';
    v_prazo:=statement_timestamp()+interval '24 hours';
  else
    v_momento:='VISITA_CANCELADA';
    v_prazo:=statement_timestamp()+interval '12 hours';
  end if;

  update public.f2_lead f set
    etapa=m.etapa,momento_codigo=m.codigo,acao_codigo=m.acao_codigo,
    acao_rotulo=m.acao_rotulo,proxima_acao_em=v_prazo,versao=f.versao+1,
    atualizado_em=statement_timestamp(),atualizado_por=v_uid
  from public.f2_momento_config m
  where f.id=v_visita.funil_lead_id and m.codigo=v_momento and m.ativo;

  v_rotulo:=case p_resultado_codigo
    when 'fara_proposta' then 'Vai receber proposta'
    when 'interessado' then 'Gostou e seguirá em atendimento'
    when 'quer_outra_opcao' then 'Quer conhecer outra opção'
    when 'precisa_conversar' then 'Precisa conversar ou pensar'
    when 'nao_gostou' then 'Não gostou do imóvel'
    when 'remarcar' then 'Será remarcada'
    when 'cliente_cancelou' then 'Cliente cancelou'
    when 'corretor_cancelou' then 'Corretor cancelou'
    when 'produto_indisponivel' then 'Imóvel ficou indisponível'
    when 'conflito_agenda' then 'Conflito de agenda'
    when 'sem_confirmacao' then 'Cliente não confirmou'
    when 'nao_compareceu' then 'Cliente não compareceu'
    else 'Outro motivo' end;

  insert into public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  values(
    v_visita.funil_lead_id,'visita_atualizada',
    case p_status when 'realizada' then 'Resultado da visita registrado'
      when 'cancelada' then 'Cancelamento da visita justificado'
      else 'Ausência do cliente registrada' end,
    v_justificativa,
    pg_catalog.jsonb_build_object(
      'visita_id',p_visita_id,'status',p_status,'resultado_codigo',p_resultado_codigo,
      'resultado_rotulo',v_rotulo,'justificativa',v_justificativa,'proxima_acao_em',v_prazo,
      'qualidade_feedback_nota',v_qualidade
    ),v_uid
  );

  insert into public.f2_config_audit(tipo,chave,acao,depois,criado_por)
  select 'visita',p_visita_id::text,'registrar_resultado',to_jsonb(v),v_uid
  from public.f2_visita v where v.id=p_visita_id;

  -- A tarefa some imediatamente para corretor e gestao. Se a proxima acao
  -- vencer, a cobranca seguinte pertence ao contrato da Sara, nao a esta visita.
  update public.ncrm_notificacao
     set resolvida_em=coalesce(resolvida_em,statement_timestamp()),
         resolvida_por=coalesce(resolvida_por,'automatica_f2')
   where visita_id=p_visita_id
     and tipo='visita_feedback_pendente'
     and resolvida_em is null;

  return pg_catalog.jsonb_build_object(
    'ok',true,'id',p_visita_id,'status',p_status,'resultado_codigo',p_resultado_codigo,
    'resultado_rotulo',v_rotulo,'resultado_em',statement_timestamp(),
    'momento',v_momento,'proxima_acao_em',v_prazo,'qualidade_feedback_nota',v_qualidade
  );
end;
$function$;

revoke all on function public.f2_registrar_resultado_visita(uuid,text,text,text)
  from public,anon;
grant execute on function public.f2_registrar_resultado_visita(uuid,text,text,text)
  to authenticated,service_role;

-- Reconciliador temporal. Ele usa os limites ja configuraveis no Funil 2:
--   corretor: feedback_visita_min (hoje, 120 min);
--   gestao: 2 x feedback_visita_min;
--   urgente: atraso da gestao + notificacao_urgente_min.
create or replace function ncrm_private.f2_visitas_feedback_sincronizar(
  p_enfileirar_push boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cfg public.f2_operacao_config%rowtype;
  v_abertas integer := 0;
  v_resolvidas integer := 0;
begin
  select * into v_cfg from public.f2_operacao_config where id=true;
  if not found then
    raise exception 'F2_VISITA_CONFIG_AUSENTE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('f2-visitas-feedback-sincronizar',0)
  );

  with pendentes as materialized (
    select v.id as visita_id, f.origem_negocio_id as negocio_id,
           f.corretor_id,
           coalesce(v.fim_em,v.inicio_em+interval '1 hour') as encerrou_em,
           greatest(0,extract(epoch from (
             statement_timestamp()-coalesce(v.fim_em,v.inicio_em+interval '1 hour')
           ))/60)::integer as atraso_min
      from public.f2_visita v
      join public.f2_lead f on f.id=v.funil_lead_id
     where coalesce(v.fim_em,v.inicio_em+interval '1 hour')<=statement_timestamp()
       and (
         v.status in ('agendada','confirmada')
         or (
           v.status in ('realizada','cancelada','nao_compareceu')
           and (v.resultado_em is null or v.resultado_codigo is null
             or char_length(btrim(coalesce(v.resultado_justificativa,'')))<10)
         )
       )
  ), candidatas as (
    select p.*, a.publico,
           case when a.publico='corretor'
                then v_cfg.feedback_visita_min
                else v_cfg.feedback_visita_min*2 end as cobrar_apos_min
      from pendentes p
      cross join (values ('corretor'::text),('gestao'::text)) a(publico)
     where (a.publico='gestao' or p.corretor_id is not null)
       and p.atraso_min >= case when a.publico='corretor'
                                then v_cfg.feedback_visita_min
                                else v_cfg.feedback_visita_min*2 end
  )
  insert into public.ncrm_notificacao(
    chave,tipo,publico,prioridade,titulo,detalhe,negocio_id,corretor_id,
    deep_link,repeticoes,visita_id
  )
  select
    'f2-visita-feedback:'||c.visita_id::text||':'||c.publico,
    'visita_feedback_pendente',c.publico,
    case when c.atraso_min >= v_cfg.feedback_visita_min*2+v_cfg.notificacao_urgente_min
         then 1 else 2 end,
    case when c.publico='gestao'
         then 'Corretor com feedback de visita pendente'
         else 'Feedback de visita pendente' end,
    case when c.publico='gestao'
         then 'Cobre o corretor responsável e acompanhe a conclusão na Agenda.'
         else 'Registre o desfecho e a próxima ação na Agenda.' end,
    c.negocio_id,c.corretor_id,'/agenda',0,c.visita_id
  from candidatas c
  on conflict (visita_id,publico)
    where resolvida_em is null
      and tipo='visita_feedback_pendente'
      and visita_id is not null
  do update set
    prioridade=excluded.prioridade,
    titulo=excluded.titulo,
    detalhe=excluded.detalhe,
    negocio_id=excluded.negocio_id,
    corretor_id=excluded.corretor_id,
    deep_link=excluded.deep_link,
    vista_em=case
      when public.ncrm_notificacao.corretor_id is distinct from excluded.corretor_id
        then null
      else public.ncrm_notificacao.vista_em end;
  get diagnostics v_abertas = row_count;

  with resolvidas as (
    update public.ncrm_notificacao n
       set resolvida_em=statement_timestamp(),
           resolvida_por=coalesce(n.resolvida_por,'automatica_f2')
     where n.resolvida_em is null
       and n.tipo='visita_feedback_pendente'
       and not exists (
         select 1
           from public.f2_visita v
          where v.id=n.visita_id
            and coalesce(v.fim_em,v.inicio_em+interval '1 hour')<=statement_timestamp()
            and (
              v.status in ('agendada','confirmada')
              or (
                v.status in ('realizada','cancelada','nao_compareceu')
                and (v.resultado_em is null or v.resultado_codigo is null
                  or char_length(btrim(coalesce(v.resultado_justificativa,'')))<10)
              )
            )
       )
    returning n.id
  ) select count(*) into v_resolvidas from resolvidas;

  -- Efeito externo exige decisao separada. O cron criado abaixo passa false.
  if p_enfileirar_push then
    perform ncrm_private.push_enfileirar(200);
  end if;

  return pg_catalog.jsonb_build_object(
    'ok',true,'sincronizadas',v_abertas,'resolvidas',v_resolvidas,
    'push_enfileirado',p_enfileirar_push
  );
end;
$function$;

revoke all on function ncrm_private.f2_visitas_feedback_sincronizar(boolean)
  from public,anon,authenticated;
grant execute on function ncrm_private.f2_visitas_feedback_sincronizar(boolean)
  to service_role;

-- O cron e idempotente e estritamente in-app. Nao envia WhatsApp/push.
do $cron$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job
   where jobname='f2-visitas-feedback-cobrancas';
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule(
    'f2-visitas-feedback-cobrancas',
    '*/10 * * * *',
    'select ncrm_private.f2_visitas_feedback_sincronizar(false);'
  );
end
$cron$;

-- Preflight estrutural dentro da propria migration. Nao consulta PII.
do $verify$
declare v_duplicados integer;
begin
  select count(*) into v_duplicados
    from (
      select visita_id,publico
        from public.ncrm_notificacao
       where resolvida_em is null
         and tipo='visita_feedback_pendente'
       group by visita_id,publico
      having count(*)>1
    ) d;
  if v_duplicados<>0 then
    raise exception 'F2_VISITA_COBRANCA_DUPLICADA: %',v_duplicados;
  end if;
  if position(
       'current_broker_id' in pg_get_functiondef(
         'public.f2_registrar_resultado_visita(uuid,text,text,text)'::regprocedure
       )
     )=0 then
    raise exception 'F2_VISITA_OWNER_GUARD_AUSENTE';
  end if;
end
$verify$;

