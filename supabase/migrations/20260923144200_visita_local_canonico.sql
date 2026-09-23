-- Local informado no agendamento vive na visita canonica e no espelho da Agenda.
set local lock_timeout = '5s';
set local statement_timeout = '120s';

alter table public.f2_visita add column if not exists local text;

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.f2_visita'::regclass
       and conname = 'f2_visita_local_valido_check'
  ) then
    alter table public.f2_visita
      add constraint f2_visita_local_valido_check
      check (local is null or char_length(btrim(local)) between 1 and 300);
  end if;
end
$constraint$;

create or replace function public.f2_espelhar_visita_na_agenda(p_visita_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare v record; v_local text;
begin
  select fv.id,fv.inicio_em,fv.fim_em,fv.imovel,fv.local,fv.status,fv.observacao,
         fv.empreendimento_id,fv.unidade,fv.com_gerente,fv.gerente_id,
         fv.resultado_codigo,fv.resultado_justificativa,fv.resultado_em,fv.resultado_por,
         fl.nome as cliente,n.id as negocio_id,n.lead_id,n.corretor_id
    into v
    from public.f2_visita fv
    join public.f2_lead fl on fl.id=fv.funil_lead_id
    left join public.negocios n on n.id=fl.origem_negocio_id
   where fv.id=p_visita_id;
  if not found then return; end if;

  select nullif(btrim(concat_ws(', ',e.nome,e.bairro,e.cidade)),'')
    into v_local from public.empreendimentos e where e.id=v.empreendimento_id;

  insert into public.visitas(
    id,lead_id,negocio_id,corretor_id,cliente_nome,empreendimento_id,produto,unidade,
    data,hora_inicio,hora_fim,local,observacoes,com_gerente,gerente_id,status,
    resultado,resultado_detalhe_codigo,motivo_cancelamento,resultado_justificativa,resultado_em,resultado_por
  ) values (
    v.id,v.lead_id,v.negocio_id,v.corretor_id,v.cliente,v.empreendimento_id,v.imovel,v.unidade,
    (v.inicio_em at time zone 'America/Sao_Paulo')::date,
    (v.inicio_em at time zone 'America/Sao_Paulo')::time,
    case when v.fim_em is not null then (v.fim_em at time zone 'America/Sao_Paulo')::time
         else ((v.inicio_em+interval '1 hour') at time zone 'America/Sao_Paulo')::time end,
    coalesce(nullif(btrim(v.local),''),v_local,v.imovel),v.observacao,
    coalesce(v.com_gerente,false),v.gerente_id,v.status,
    case when v.resultado_codigo in ('interessado','quer_outra_opcao','precisa_conversar','nao_gostou','nao_compareceu','remarcar','fara_proposta')
      then v.resultado_codigo when v.status='cancelada' then 'remarcar' else null end,
    v.resultado_codigo,
    case when v.status in ('cancelada','nao_compareceu') then v.resultado_justificativa else null end,
    v.resultado_justificativa,v.resultado_em,v.resultado_por
  )
  on conflict(id) do update set
    cliente_nome=excluded.cliente_nome,empreendimento_id=excluded.empreendimento_id,
    produto=excluded.produto,unidade=excluded.unidade,data=excluded.data,
    hora_inicio=excluded.hora_inicio,hora_fim=excluded.hora_fim,local=excluded.local,
    observacoes=excluded.observacoes,com_gerente=excluded.com_gerente,
    gerente_id=excluded.gerente_id,status=excluded.status,resultado=excluded.resultado,
    resultado_detalhe_codigo=excluded.resultado_detalhe_codigo,
    motivo_cancelamento=excluded.motivo_cancelamento,
    resultado_justificativa=excluded.resultado_justificativa,resultado_em=excluded.resultado_em,
    resultado_por=excluded.resultado_por,atualizado_em=statement_timestamp();
end;
$function$;

revoke all on function public.f2_espelhar_visita_na_agenda(uuid)
  from public,anon,authenticated;
grant execute on function public.f2_espelhar_visita_na_agenda(uuid)
  to service_role;

-- A chamada existente e a gravacao do Local compartilham a mesma transacao.
-- Se a segunda etapa falhar, o agendamento inteiro e revertido.
create function public.f2_salvar_visita_local(
  p_id uuid, p_lead_id uuid, p_inicio_em timestamptz, p_imovel text,
  p_status text, p_observacao text, p_empreendimento_id uuid, p_unidade text,
  p_com_gerente boolean, p_gerente_id bigint, p_fim_em timestamptz,
  p_local text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_local text := nullif(left(btrim(coalesce(p_local,'')),300),'');
begin
  v_result := public.f2_salvar_visita(
    p_id,p_lead_id,p_inicio_em,p_imovel,p_status,p_observacao,
    p_empreendimento_id,p_unidade,p_com_gerente,p_gerente_id,p_fim_em
  );
  if coalesce(v_result->>'ok','false') <> 'true' or v_local is null then
    return v_result;
  end if;

  update public.f2_visita set local=v_local
   where id=(v_result->>'id')::uuid and funil_lead_id=p_lead_id;
  if not found then
    raise exception 'F2_VISITA_LOCAL_NAO_PERSISTIDO';
  end if;
  return v_result;
end;
$function$;

revoke all on function public.f2_salvar_visita_local(
  uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,bigint,timestamptz,text
) from public,anon;
grant execute on function public.f2_salvar_visita_local(
  uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,bigint,timestamptz,text
) to authenticated,service_role;
