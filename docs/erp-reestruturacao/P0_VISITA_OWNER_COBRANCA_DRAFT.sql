-- DRAFT NAO EXECUTAVEL / NAO APLICADO EM PRODUCAO
--
-- Contrato revisavel para fechar duas lacunas do pos-visita:
--   1. somente o corretor dono da carteira registra o resultado;
--   2. cobrancas in-app persistem por visita e publico, sem duplicar.
--
-- Este arquivo fica deliberadamente fora de supabase/migrations. O arquivo de
-- migration deve nascer por `supabase migration new`, ser aplicado primeiro em
-- banco isolado e receber autorizacao especifica antes de tocar producao.
-- Push/WhatsApp permanecem DESLIGADOS: o cron cria apenas cobranca in-app.

begin;
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
      'resultado_rotulo',v_rotulo,'justificativa',v_justificativa,'proxima_acao_em',v_prazo
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
    'momento',v_momento,'proxima_acao_em',v_prazo
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

commit;
