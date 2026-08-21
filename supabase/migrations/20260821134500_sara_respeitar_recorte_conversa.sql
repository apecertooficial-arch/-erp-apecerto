begin;

create or replace function public.f2_sara_registrar_sugestao(
  p_funil_lead_id uuid,
  p_versao integer,
  p_context_hash text,
  p_origem text,
  p_status text,
  p_momento_codigo text,
  p_resumo text,
  p_evidencias jsonb,
  p_confianca numeric,
  p_mensagens integer,
  p_prazo_sugerido timestamptz,
  p_qualidade_nota numeric,
  p_qualidade_resumo text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_lead public.f2_lead%rowtype;
  v_m public.f2_momento_config%rowtype;
  v_status text;
  v_id bigint;
  v_min numeric;
begin
  if p_context_hash !~ '^[a-f0-9]{64}$'
     or p_origem not in ('ia','deterministica')
     or p_status not in ('sugestao','sem_historico')
     or jsonb_typeof(coalesce(p_evidencias,'[]'::jsonb))<>'array'
     or coalesce(char_length(btrim(p_resumo)),0) not between 3 and 800
     or coalesce(p_mensagens,0) not between 0 and 250
     or (p_qualidade_nota is not null and p_qualidade_nota not between 0 and 10)
     or (p_qualidade_nota is not null and
         coalesce(char_length(btrim(p_qualidade_resumo)),0) not between 3 and 500) then
    return jsonb_build_object('ok',false,'erro','contrato_invalido');
  end if;

  select * into v_lead from public.f2_lead
   where id=p_funil_lead_id for update;
  if not found then return jsonb_build_object('ok',false,'erro','lead_inexistente'); end if;

  select * into v_m from public.f2_momento_config
   where codigo=p_momento_codigo and ativo;
  if p_status='sugestao' and not found then
    return jsonb_build_object('ok',false,'erro','momento_invalido');
  end if;

  select a.id into v_id from public.f2_sara_analise a
   where a.funil_lead_id=p_funil_lead_id and a.context_hash=p_context_hash;
  if v_id is not null then
    return jsonb_build_object('ok',true,'ja_processado',true,'analise_id',v_id,
      'status',(select status from public.f2_sara_analise where id=v_id));
  end if;

  select coalesce(confianca_minima,0.65) into v_min
    from public.f2_sara_config where id;
  v_min:=coalesce(v_min,0.65);
  v_status:=case when p_status='sem_historico' then 'sem_historico'
                 when v_lead.versao<>p_versao then 'obsoleta'
                 when p_confianca is null or p_confianca<v_min then 'revisao_humana'
                 when p_origem='ia' and p_momento_codigo<>'CADENCIA_SEM_RESPOSTA'
                      and jsonb_array_length(coalesce(p_evidencias,'[]'::jsonb))=0
                   then 'revisao_humana'
                 else 'sugerida' end;

  -- A mesma fronteira de conversa usada pela Sara precisa ser usada aqui.
  -- Leads pescados não podem herdar uma resposta anterior ao corte.
  if v_status='sugerida' and p_momento_codigo='CADENCIA_SEM_RESPOSTA'
     and exists(
       select 1 from public.wa_mensagens wm
       join public.wa_conversas cv on cv.id=wm.conversa_id
       left join public.wa_contatos c on c.id=cv.contato_id
       left join public.negocios n on n.id=v_lead.origem_negocio_id
       left join public.f2_historico_vinculo hv
         on hv.funil_lead_id=v_lead.id and hv.contato_id=cv.contato_id
       where wm.direcao='recebida'
         and (c.lead_id=n.lead_id or hv.funil_lead_id is not null)
         and (
           v_lead.historico_completo
           or coalesce(wm.enviado_em,wm.criado_em)>=v_lead.corte_conversa_em
         )
     ) then
    v_status:='revisao_humana';
  end if;

  insert into public.f2_sara_analise(
    funil_lead_id,origem_negocio_id,context_hash,origem,status,
    momento_anterior,momento_sugerido,etapa_sugerida,acao_sugerida,
    acao_rotulo_sugerida,prazo_sugerido,resumo,evidencias,confianca,
    mensagens_consideradas,versao_base,qualidade_nota,qualidade_resumo
  ) values (
    p_funil_lead_id,v_lead.origem_negocio_id,p_context_hash,p_origem,v_status,
    v_lead.momento_codigo,v_m.codigo,v_m.etapa,v_m.acao_codigo,
    v_m.acao_rotulo,p_prazo_sugerido,left(btrim(p_resumo),800),
    coalesce(p_evidencias,'[]'::jsonb),p_confianca,coalesce(p_mensagens,0),
    p_versao,p_qualidade_nota,left(btrim(p_qualidade_resumo),500)
  ) returning id into v_id;

  return jsonb_build_object('ok',true,'analise_id',v_id,'status',v_status,
    'momento_codigo',v_m.codigo,'etapa',v_m.etapa,'acao_codigo',v_m.acao_codigo,
    'acao_rotulo',v_m.acao_rotulo,'prazo_sugerido',p_prazo_sugerido,
    'qualidade_nota',p_qualidade_nota,'versao_base',p_versao);
exception when unique_violation then
  select id,status into v_id,v_status from public.f2_sara_analise
   where funil_lead_id=p_funil_lead_id and context_hash=p_context_hash;
  return jsonb_build_object('ok',true,'ja_processado',true,
    'analise_id',v_id,'status',v_status);
end
$fn$;

revoke all on function public.f2_sara_registrar_sugestao(
  uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz,numeric,text
) from public,anon,authenticated;
grant execute on function public.f2_sara_registrar_sugestao(
  uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz,numeric,text
) to service_role;

commit;
