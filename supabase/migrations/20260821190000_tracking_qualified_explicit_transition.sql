-- LeadQualificado é registrado pela ação explícita do Funil 2.0.
-- Não é trigger, cron, fila oculta nem escritor de private.lead_attribution.

create or replace function public.tracking_register_qualified_transition(
  p_f2_lead_id uuid,
  p_previous_momento text,
  p_new_momento text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.f2_lead%rowtype;
  v_delivery_id uuid;
begin
  if auth.role() <> 'service_role' and not public.is_equipe() then
    return jsonb_build_object('ok',false,'aplicado',false,'motivo','sem_permissao');
  end if;

  select * into v_lead
  from public.f2_lead
  where id = p_f2_lead_id
    and descartado_em is null;

  if not found or v_lead.momento_codigo is distinct from p_new_momento then
    return jsonb_build_object('ok',false,'aplicado',false,'motivo','estado_divergente');
  end if;

  if coalesce(p_previous_momento,'') <> 'CONVERSANDO_QUALIFICANDO'
     or p_new_momento not in (
       'PROCURANDO_PRODUTO',
       'PRODUTO_ENVIADO',
       'TENTANDO_AGENDAMENTO',
       'VISITA_AGENDADA',
       'VISITA_REALIZADA'
     ) then
    return jsonb_build_object('ok',true,'aplicado',false,'motivo','nao_e_conclusao_de_qualificacao');
  end if;

  if v_lead.origem_negocio_id is null then
    return jsonb_build_object('ok',false,'aplicado',false,'motivo','negocio_ausente');
  end if;

  v_delivery_id := private.enqueue_meta_crm_event(
    'qualified',
    'f2_lead',
    v_lead.id::text,
    v_lead.origem_negocio_id,
    coalesce(v_lead.atualizado_em, now())
  );

  return jsonb_build_object(
    'ok',true,
    'aplicado',v_delivery_id is not null,
    'motivo',case when v_delivery_id is null then 'deduplicado' else 'enfileirado' end,
    'delivery_id',v_delivery_id
  );
end;
$$;

revoke all on function public.tracking_register_qualified_transition(uuid,text,text)
  from public, anon;
grant execute on function public.tracking_register_qualified_transition(uuid,text,text)
  to authenticated, service_role;

comment on function public.tracking_register_qualified_transition(uuid,text,text) is
  'Registra LeadQualificado somente após a ação explícita atualizarMomento; nunca escreve atribuição.';
