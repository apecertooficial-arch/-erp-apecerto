-- A continuidade do dono vale pelo estado comercial atual, não pelo histórico.
-- Visita agendada/confirmada e negociação ativa protegem. Visita realizada,
-- venda encerrada ou a opção antiga "sempre" não travam nova distribuição.

begin;

create or replace function public.motor_resolver_dono_ativo(
  p_lead_id bigint,
  p_lead jsonb default '{}'::jsonb
) returns jsonb
language sql
stable
security definer
set search_path to ''
as $fn$
with seed as (
  select l.*,
         coalesce(
           public.telefone_br_normalizado(l.telefone),
           public.telefone_br_normalizado(p_lead->>'telefone')
         ) telefone_chave,
         lower(nullif(trim(coalesce(nullif(l.email,''),p_lead->>'email')),'')) email_chave
    from public.leads l
   where l.id=p_lead_id
), identidade as materialized (
  select distinct l.*
    from public.leads l
    cross join seed s
   where l.id=s.id
      or (s.datacrazy_lead_id is not null and l.datacrazy_lead_id=s.datacrazy_lead_id)
      or (s.wa_contato_id is not null and l.wa_contato_id=s.wa_contato_id)
      or (s.email_chave is not null and lower(nullif(trim(l.email),''))=s.email_chave)
      or (s.telefone_chave is not null and public.telefone_br_normalizado(l.telefone)=s.telefone_chave)
), negocios_identidade as materialized (
  select n.* from public.negocios n join identidade i on i.id=n.lead_id
), candidatos as (
  select coalesce(
           vi.corretor_id,
           (select n.corretor_id from negocios_identidade n
             where n.id=vi.negocio_id or n.datacrazy_negocio_id=vi.dc_negocio_id
             order by n.ultima_movimentacao desc nulls last,n.id desc limit 1),
           (select i.corretor_id from identidade i
             where i.id=vi.lead_id or i.datacrazy_lead_id=vi.dc_lead_id
             order by i.atualizado_em desc nulls last,i.id desc limit 1)
         ) corretor_id,
         900 prioridade,
         'visitas'::text fonte,
         'visita ativa'::text motivo,
         coalesce(vi.atualizado_em,vi.criado_em) evidencia_em
    from public.visitas vi
   where lower(coalesce(vi.status,'')) in ('agendada','confirmada')
     and exists (
       select 1 from identidade i
        where i.id=vi.lead_id or i.datacrazy_lead_id=vi.dc_lead_id
       union all
       select 1 from negocios_identidade n
        where n.id=vi.negocio_id or n.datacrazy_negocio_id=vi.dc_negocio_id
     )

  union all
  select coalesce(f.corretor_id,n.corretor_id,i.corretor_id),850,
         'f2_visita','visita ativa no Funil 2.0',
         coalesce(fv.atualizado_em,fv.inicio_em,fv.criado_em)
    from public.f2_visita fv
    join public.f2_lead f on f.id=fv.funil_lead_id and f.descartado_em is null
    join negocios_identidade n on n.id=f.origem_negocio_id
    join identidade i on i.id=n.lead_id
   where lower(coalesce(fv.status,'')) in ('agendada','confirmada')

  union all
  select coalesce(f.corretor_id,n.corretor_id,i.corretor_id),800,
         'f2_estado','etapa de visita ativa no Funil 2.0',
         coalesce(f.atualizado_em,n.ultima_movimentacao,n.criado_em)
    from public.f2_lead f
    join negocios_identidade n on n.id=f.origem_negocio_id
    join identidade i on i.id=n.lead_id
   where f.descartado_em is null
     and upper(coalesce(f.momento_codigo,'')) <> 'VISITA_CANCELADA'
     and (
       lower(coalesce(f.etapa,''))='visita'
       or upper(coalesce(f.momento_codigo,'')) in ('VISITA_AGENDADA','REMARCAR_VISITA')
     )

  union all
  select coalesce(n.corretor_id,i.corretor_id),750,
         'pipeline_legado','visita ou negociação ativa no CRM legado',
         coalesce(n.ultima_movimentacao,n.estagio_desde,n.criado_em)
    from negocios_identidade n
    join identidade i on i.id=n.lead_id
    join public.pipeline_stages s on s.id=n.stage_id
   where lower(coalesce(n.status,'aberto')) not in ('ganho','perdido','descartado','cancelado')
     and lower(public.unaccent(
       coalesce(s.nome,'')||' '||coalesce(s.chave,'')||' '||coalesce(s.rotulo,'')
     )) ~ '(visita|negocia|proposta|contrato)'
     and lower(public.unaccent(
       coalesce(s.nome,'')||' '||coalesce(s.chave,'')||' '||coalesce(s.rotulo,'')
     )) !~ 'cancelad'

  union all
  select coalesce(f.corretor_id,n.corretor_id,i.corretor_id),700,
         'f2_negociacao','negociação ativa no Funil 2.0',
         coalesce(fn.atualizado_em,fn.criado_em)
    from public.f2_negociacao fn
    join public.f2_lead f on f.id=fn.funil_lead_id and f.descartado_em is null
    join negocios_identidade n on n.id=f.origem_negocio_id
    join identidade i on i.id=n.lead_id
), validos as (
  select * from candidatos where corretor_id is not null
), topo as (
  select max(prioridade) prioridade from validos
), resumo as (
  select count(distinct v.corretor_id) donos,count(*) evidencias
    from validos v join topo t on t.prioridade=v.prioridade
), escolhido as (
  select v.* from validos v join topo t on t.prioridade=v.prioridade
   order by v.evidencia_em desc nulls last,v.corretor_id,v.fonte
   limit 1
)
select case
  when not exists(select 1 from escolhido) then
    jsonb_build_object('protegido',false,'conflito',false,'evidencias',0)
  when (select donos from resumo)>1 then
    jsonb_build_object(
      'protegido',false,'conflito',true,'fonte',(select fonte from escolhido),
      'motivo','evidências ativas apontam donos diferentes',
      'evidencias',(select evidencias from resumo)
    )
  else jsonb_build_object(
    'protegido',true,'conflito',false,
    'corretor_id',(select corretor_id from escolhido),
    'fonte',(select fonte from escolhido),
    'motivo',(select motivo from escolhido),
    'evidencias',(select evidencias from resumo)
  )
end
$fn$;

revoke all on function public.motor_resolver_dono_ativo(bigint,jsonb)
  from public,anon,authenticated;
grant execute on function public.motor_resolver_dono_ativo(bigint,jsonb)
  to service_role;

create or replace function public.motor_dono_tem_estado_protegido(p_lead_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $fn$
select
  exists (
    select 1 from public.visitas vi
     where (vi.lead_id=p_lead_id or vi.negocio_id in (
       select n.id from public.negocios n where n.lead_id=p_lead_id
     ))
       and lower(coalesce(vi.status,'')) in ('agendada','confirmada')
  )
  or exists (
    select 1
      from public.f2_lead f
      join public.negocios n on n.id=f.origem_negocio_id
     where n.lead_id=p_lead_id
       and f.descartado_em is null
       and (
         (
           upper(coalesce(f.momento_codigo,'')) <> 'VISITA_CANCELADA'
           and (
             lower(coalesce(f.etapa,''))='visita'
             or upper(coalesce(f.momento_codigo,'')) in ('VISITA_AGENDADA','REMARCAR_VISITA')
           )
         )
         or exists (
           select 1 from public.f2_visita fv
            where fv.funil_lead_id=f.id
              and lower(coalesce(fv.status,'')) in ('agendada','confirmada')
         )
         or exists (select 1 from public.f2_negociacao fn where fn.funil_lead_id=f.id)
       )
  )
  or exists (
    select 1
      from public.negocios n
      join public.pipeline_stages s on s.id=n.stage_id
     where n.lead_id=p_lead_id
       and lower(coalesce(n.status,'aberto')) not in ('ganho','perdido','descartado','cancelado')
       and lower(public.unaccent(
         coalesce(s.nome,'')||' '||coalesce(s.chave,'')||' '||coalesce(s.rotulo,'')
       )) ~ '(visita|negocia|proposta|contrato)'
       and lower(public.unaccent(
         coalesce(s.nome,'')||' '||coalesce(s.chave,'')||' '||coalesce(s.rotulo,'')
       )) !~ 'cancelad'
  )
$fn$;

revoke all on function public.motor_dono_tem_estado_protegido(bigint)
  from public,anon,authenticated;
grant execute on function public.motor_dono_tem_estado_protegido(bigint)
  to service_role;

do $patch_motor_roleta$
declare
  v_oid regprocedure := 'public.motor_roleta(bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb)'::regprocedure;
  v_def text;
  v_old text := '  v_dono_protegido := public.motor_resolver_dono_protegido(p_lead_id,p_lead,p_protecao);';
  v_new text := E'  p_protecao := ''["negociacao","visita_agendada"]''::jsonb;\n  v_dono_protegido := public.motor_resolver_dono_ativo(p_lead_id,p_lead);';
begin
  v_def:=pg_get_functiondef(v_oid);
  if md5(v_def)<>'0827589c4be2c7958a11aaeeb2f5196a'
     or (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old)<>1 then
    raise exception 'motor_roleta divergiu; correção da proteção abortada com segurança (hash=%)',md5(v_def);
  end if;
  execute replace(v_def,v_old,v_new);
end
$patch_motor_roleta$;

do $patch_sla$
declare
  v_oid regprocedure := 'ncrm_private.sla_redistribuir(integer)'::regprocedure;
  v_def text;
  v_old text := E'       AND NOT EXISTS (\n         SELECT 1 FROM public.negocios n2\n          WHERE n2.lead_id = n.lead_id\n            AND (n2.venda_id IS NOT NULL OR lower(coalesce(n2.status,'''')) = ''ganho''))\n       AND NOT EXISTS (\n         SELECT 1 FROM public.visitas vi\n          WHERE (vi.lead_id = n.lead_id\n                 OR vi.negocio_id IN (SELECT id FROM public.negocios WHERE lead_id = n.lead_id))\n            AND vi.status IN (''agendada'',''confirmada'',''realizada''))';
  v_new text := E'       AND NOT public.motor_dono_tem_estado_protegido(n.lead_id)';
begin
  v_def:=pg_get_functiondef(v_oid);
  if md5(v_def)<>'81b8870b2198b3f331b5090124f6cb96'
     or (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old)<>1 then
    raise exception 'sla_redistribuir divergiu; correção da proteção abortada com segurança (hash=%)',md5(v_def);
  end if;
  execute replace(v_def,v_old,v_new);
end
$patch_sla$;

revoke all on function public.motor_roleta(
  bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb
) from public,anon,authenticated;
grant execute on function public.motor_roleta(
  bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb
) to service_role;

revoke all on function ncrm_private.sla_redistribuir(integer)
  from public,anon,authenticated;
grant execute on function ncrm_private.sla_redistribuir(integer)
  to service_role;

do $verify$
declare
  v_roleta text:=pg_get_functiondef(
    'public.motor_roleta(bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb)'::regprocedure
  );
  v_sla text:=pg_get_functiondef('ncrm_private.sla_redistribuir(integer)'::regprocedure);
begin
  if position('motor_resolver_dono_ativo(p_lead_id,p_lead)' in v_roleta)=0
     or position('p_protecao := ''["negociacao","visita_agendada"]''::jsonb' in v_roleta)=0 then
    raise exception 'motor_roleta não adotou a proteção pelo estado atual';
  end if;
  if position('motor_dono_tem_estado_protegido(n.lead_id)' in v_sla)=0
     or position('visita realizada' in lower(v_sla))>0 then
    raise exception 'SLA ainda protege histórico encerrado';
  end if;
end
$verify$;

commit;
