-- Esteira: reserva slug e próxima ordem na mesma transação, serializada com reordenações.

create unique index if not exists erp_auditoria_esteira_etapa_criar_request_uidx
  on public.erp_auditoria ((depois->>'request_id'))
  where modulo='Esteira' and entidade='esteira_etapas'
    and acao='criar etapa' and depois ? 'request_id';

create or replace function public.esteira_etapa_criar(
  p_nome text,
  p_slug_base text,
  p_cor text,
  p_papel text,
  p_sla_dias integer,
  p_resale boolean,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_nome text:=btrim(coalesce(p_nome,''));
  v_slug_base text:=lower(btrim(coalesce(p_slug_base,'')));
  v_cor text:=btrim(coalesce(p_cor,''));
  v_papel text:=btrim(coalesce(p_papel,''));
  v_slug text;
  v_ordem integer;
  v_etapa_id uuid;
  v_auditoria public.erp_auditoria;
  v_solicitacao jsonb;
  v_resultado jsonb;
begin
  if v_uid is null or not coalesce(public.papel_no_grupo('esteira_config'),false) then
    raise exception 'ESTEIRA_ETAPA_SEM_PERMISSAO: Apenas administradores podem criar etapas.' using errcode='42501';
  end if;
  if p_request_id is null or v_nome='' or length(v_nome)>80
    or v_slug_base !~ '^[a-z0-9][a-z0-9_]{0,39}$'
    or v_cor='' or length(v_cor)>20 or v_papel='' or length(v_papel)>40
    or p_sla_dias is null or p_sla_dias<0 or p_sla_dias>3650 or p_resale is null then
    raise exception 'ESTEIRA_ETAPA_DADOS_INVALIDOS: Revise os dados da nova etapa.';
  end if;

  v_solicitacao:=jsonb_build_object(
    'nome',v_nome,'slug_base',v_slug_base,'cor',v_cor,'papel',v_papel,
    'sla_dias',p_sla_dias,'resale',p_resale
  );
  perform pg_advisory_xact_lock(hashtextextended('esteira_etapas_ordem',0));

  select * into v_auditoria
  from public.erp_auditoria a
  where a.modulo='Esteira' and a.entidade='esteira_etapas' and a.acao='criar etapa'
    and a.depois->>'request_id'=p_request_id::text
  order by a.criado_em desc,a.id desc limit 1;
  if found then
    if v_auditoria.depois->'solicitacao'=v_solicitacao then
      v_resultado:=v_auditoria.depois->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_ETAPA_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outros dados. Atualize a tela.';
  end if;

  v_slug:=v_slug_base;
  if exists(select 1 from public.esteira_etapas where slug=v_slug) then
    v_slug:=left(v_slug_base,31)||'_'||left(replace(p_request_id::text,'-',''),8);
  end if;
  select coalesce(max(ordem),0)+1 into v_ordem from public.esteira_etapas where ativo;

  insert into public.esteira_etapas(nome,slug,cor,papel,sla_dias,resale,ordem,ativo)
  values(v_nome,v_slug,v_cor,v_papel,p_sla_dias,p_resale,v_ordem,true)
  returning id into v_etapa_id;

  v_resultado:=jsonb_build_object('etapa_id',v_etapa_id,'slug',v_slug,'ordem',v_ordem);
  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'criar etapa','Esteira','esteira_etapas',v_etapa_id::text,null,
    jsonb_build_object('request_id',p_request_id,'solicitacao',v_solicitacao,'resultado',v_resultado),
    'Etapa criada com slug e ordem reservados em transação auditada e idempotente.'
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
exception when unique_violation then
  raise exception 'ESTEIRA_ETAPA_CONFLITO: A configuração mudou enquanto você trabalhava. Atualize a tela.';
end
$function$;

comment on function public.esteira_etapa_criar(text,text,text,text,integer,boolean,uuid) is
  'Cria etapa reservando slug e ordem sob o mesmo lock da reordenação, com auditoria e retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_etapa_criar(text,text,text,text,integer,boolean,uuid) from public,anon;
grant execute on function public.esteira_etapa_criar(text,text,text,text,integer,boolean,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
