-- A próxima ação informada no feedback deve chegar ao card. O histórico sem
-- envelope estruturado permanece honesto: pede registro humano, sem inferência.
set local lock_timeout = '5s';
set local statement_timeout = '120s';

insert into public.f2_config_audit(tipo,chave,acao,antes,depois,criado_por)
select 'momento',m.codigo,'explicitar_proxima_acao_pos_visita',
       pg_catalog.jsonb_build_object('acao_rotulo',m.acao_rotulo),
       pg_catalog.jsonb_build_object('acao_rotulo','Registrar a próxima ação pós-visita'),
       null
  from public.f2_momento_config m
 where m.codigo='ACOMPANHAMENTO_POS_VISITA'
   and m.acao_rotulo='Definir o próximo avanço';

update public.f2_momento_config
   set acao_rotulo='Registrar a próxima ação pós-visita',
       atualizado_em=statement_timestamp()
 where codigo='ACOMPANHAMENTO_POS_VISITA'
   and acao_rotulo='Definir o próximo avanço';

with alvos as materialized (
  select f.id,f.acao_rotulo as antes,
         coalesce(fonte.proxima_acao,'Registrar a próxima ação pós-visita') as depois
    from public.f2_lead f
    left join lateral (
      select extraida.proxima_acao
        from (
          select nullif(btrim(split_part(split_part(
                   v.resultado_justificativa,' | Próxima ação: ',2
                 ),' | ',1)),'') as proxima_acao
            from public.f2_visita v
           where v.funil_lead_id=f.id
             and v.status='realizada'
             and v.resultado_em is not null
             and v.resultado_justificativa like 'FEEDBACK_VISITA_V1 |%'
           order by v.resultado_em desc,v.id desc
           limit 1
        ) extraida
       where char_length(extraida.proxima_acao) between 5 and 120
    ) fonte on true
   where f.descartado_em is null
     and f.momento_codigo='ACOMPANHAMENTO_POS_VISITA'
     and f.acao_rotulo='Definir o próximo avanço'
)
insert into public.f2_config_audit(tipo,chave,acao,antes,depois,criado_por)
select 'migracao',a.id::text,'normalizar_proxima_acao_pos_visita',
       pg_catalog.jsonb_build_object('acao_rotulo',a.antes),
       pg_catalog.jsonb_build_object('acao_rotulo',a.depois),
       null
  from alvos a;

with alvos as materialized (
  select f.id,
         coalesce(fonte.proxima_acao,'Registrar a próxima ação pós-visita') as depois
    from public.f2_lead f
    left join lateral (
      select extraida.proxima_acao
        from (
          select nullif(btrim(split_part(split_part(
                   v.resultado_justificativa,' | Próxima ação: ',2
                 ),' | ',1)),'') as proxima_acao
            from public.f2_visita v
           where v.funil_lead_id=f.id
             and v.status='realizada'
             and v.resultado_em is not null
             and v.resultado_justificativa like 'FEEDBACK_VISITA_V1 |%'
           order by v.resultado_em desc,v.id desc
           limit 1
        ) extraida
       where char_length(extraida.proxima_acao) between 5 and 120
    ) fonte on true
   where f.descartado_em is null
     and f.momento_codigo='ACOMPANHAMENTO_POS_VISITA'
     and f.acao_rotulo='Definir o próximo avanço'
)
update public.f2_lead f
   set acao_rotulo=left(a.depois,120),
       versao=f.versao+1,
       atualizado_em=statement_timestamp()
  from alvos a
 where f.id=a.id;

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
  v_proxima_acao text;
  v_rotulo text;
  v_qualidade smallint;
begin
  select * into v_visita
    from public.f2_visita
   where id=p_visita_id
   for update;
  if v_visita.id is not null then
    select f.corretor_id into v_corretor_dono
      from public.f2_lead f
     where f.id=v_visita.funil_lead_id
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
     or char_length(v_justificativa)<10 then
    return pg_catalog.jsonb_build_object('ok',false,'erro','resultado_invalido');
  end if;
  if p_status='realizada' and (
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
  if p_status<>'realizada' and (
       v_justificativa !~ '^RESULTADO_VISITA_V1[ ]\|[ ]Motivo:[ ][^|]{3,}[ ]\|'
       or v_justificativa !~ '[ ]\|[ ]Próxima ação:[ ][^|]{12,}[ ]\|'
     ) then
    return pg_catalog.jsonb_build_object('ok',false,'erro','resultado_encaminhamento_incompleto');
  end if;

  v_proxima_acao := nullif(left(btrim(split_part(split_part(
    v_justificativa,' | Próxima ação: ',2
  ),' | ',1)),120),'');
  if char_length(coalesce(v_proxima_acao,''))<5 then
    return pg_catalog.jsonb_build_object('ok',false,'erro','proxima_acao_invalida');
  end if;

  if p_status='realizada' then
    v_qualidade:=public.f2_feedback_visita_nota(v_justificativa);
    if v_qualidade<9 then
      return pg_catalog.jsonb_build_object(
        'ok',false,'erro','feedback_qualidade_insuficiente','qualidade',v_qualidade
      );
    end if;
  end if;
  if (p_status='realizada' and p_resultado_codigo not in
        ('fara_proposta','interessado','quer_outra_opcao','precisa_conversar','nao_gostou'))
     or (p_status='cancelada' and p_resultado_codigo not in
        ('remarcar','cliente_cancelou','corretor_cancelou','produto_indisponivel','conflito_agenda','sem_confirmacao','outro'))
     or (p_status='nao_compareceu' and p_resultado_codigo<>'nao_compareceu') then
    return pg_catalog.jsonb_build_object('ok',false,'erro','resultado_incompativel');
  end if;
  if p_status='realizada'
     and coalesce(v_visita.fim_em,v_visita.inicio_em+interval '1 hour')>statement_timestamp() then
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
    acao_rotulo=left(v_proxima_acao,120),
    proxima_acao_em=v_prazo,versao=f.versao+1,
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
      'resultado_rotulo',v_rotulo,'justificativa',v_justificativa,
      'proxima_acao_em',v_prazo,'proxima_acao_rotulo',v_proxima_acao,
      'qualidade_feedback_nota',v_qualidade
    ),v_uid
  );

  insert into public.f2_config_audit(tipo,chave,acao,depois,criado_por)
  select 'visita',p_visita_id::text,'registrar_resultado',to_jsonb(v),v_uid
  from public.f2_visita v where v.id=p_visita_id;

  update public.ncrm_notificacao
     set resolvida_em=coalesce(resolvida_em,statement_timestamp()),
         resolvida_por=coalesce(resolvida_por,'automatica_f2')
   where visita_id=p_visita_id
     and tipo='visita_feedback_pendente'
     and resolvida_em is null;

  return pg_catalog.jsonb_build_object(
    'ok',true,'id',p_visita_id,'status',p_status,
    'resultado_codigo',p_resultado_codigo,'resultado_rotulo',v_rotulo,
    'resultado_em',statement_timestamp(),'momento',v_momento,
    'proxima_acao_em',v_prazo,'proxima_acao_rotulo',v_proxima_acao,
    'qualidade_feedback_nota',v_qualidade
  );
end;
$function$;

revoke all on function public.f2_registrar_resultado_visita(uuid,text,text,text)
  from public,anon;
grant execute on function public.f2_registrar_resultado_visita(uuid,text,text,text)
  to authenticated,service_role;

do $verify$
begin
  if exists (
    select 1 from public.f2_lead f
     where f.descartado_em is null
       and f.momento_codigo='ACOMPANHAMENTO_POS_VISITA'
       and (
         nullif(btrim(f.acao_rotulo),'') is null
         or f.acao_rotulo='Definir o próximo avanço'
       )
  ) then
    raise exception 'F2_ACAO_POS_VISITA_AINDA_AMBIGUA';
  end if;
  if position(
       '''proxima_acao_rotulo'',v_proxima_acao' in pg_get_functiondef(
         'public.f2_registrar_resultado_visita(uuid,text,text,text)'::regprocedure
       )
     )=0 then
    raise exception 'F2_ACAO_POS_VISITA_NAO_PERSISTIDA';
  end if;
end
$verify$;
