-- Blindagem central de continuidade do dono.
--
-- Antes de sortear, resolve vínculos protegidos do mesmo cliente em todas as
-- fontes determinísticas: calendário canônico/legado, Funil 2.0, negociação,
-- venda e etapas antigas de visita. Não usa nome como identidade e falha
-- fechado quando há donos conflitantes ou quando o dono protegido está inativo.

create or replace function public.motor_resolver_dono_protegido(
  p_lead_id bigint,
  p_lead jsonb,
  p_protecao jsonb default '["venda","visita_agendada","visita_realizada"]'::jsonb
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
  select i.corretor_id,1000 prioridade,'protecao_total'::text fonte,
         'protecao total ativada no bloco'::text motivo,
         coalesce(i.atualizado_em,i.criado_em) evidencia_em
    from identidade i
   where coalesce(p_protecao,'[]'::jsonb) ? 'sempre' and i.id=p_lead_id

  union all
  select coalesce(
           vi.corretor_id,
           (select n.corretor_id from negocios_identidade n
             where n.id=vi.negocio_id or n.datacrazy_negocio_id=vi.dc_negocio_id
             order by n.ultima_movimentacao desc nulls last,n.id desc limit 1),
           (select i.corretor_id from identidade i
             where i.id=vi.lead_id or i.datacrazy_lead_id=vi.dc_lead_id
             order by i.atualizado_em desc nulls last,i.id desc limit 1)
         ),
         case when lower(coalesce(vi.status,'')) in ('agendada','confirmada') then 900 else 850 end,
         'visitas','visita '||lower(coalesce(vi.status,'')),
         coalesce(vi.resultado_em,vi.atualizado_em,vi.criado_em)
    from public.visitas vi
   where lower(coalesce(vi.status,'')) in ('agendada','confirmada','realizada')
     and ((lower(coalesce(vi.status,'')) in ('agendada','confirmada')
           and coalesce(p_protecao,'[]'::jsonb) ? 'visita_agendada')
       or (lower(coalesce(vi.status,''))='realizada'
           and coalesce(p_protecao,'[]'::jsonb) ? 'visita_realizada'))
     and exists (
       select 1 from identidade i
        where i.id=vi.lead_id or i.datacrazy_lead_id=vi.dc_lead_id
       union all
       select 1 from negocios_identidade n
        where n.id=vi.negocio_id or n.datacrazy_negocio_id=vi.dc_negocio_id
     )

  union all
  select coalesce(f.corretor_id,n.corretor_id,i.corretor_id),
         case when lower(coalesce(fv.status,'')) in ('agendada','confirmada') then 800 else 750 end,
         'f2_visita','visita Funil 2.0 '||lower(coalesce(fv.status,'')),
         coalesce(fv.atualizado_em,fv.inicio_em,fv.criado_em)
    from public.f2_visita fv
    join public.f2_lead f on f.id=fv.funil_lead_id and f.descartado_em is null
    join negocios_identidade n on n.id=f.origem_negocio_id
    join identidade i on i.id=n.lead_id
   where lower(coalesce(fv.status,'')) in ('agendada','confirmada','realizada')
     and ((lower(coalesce(fv.status,'')) in ('agendada','confirmada')
           and coalesce(p_protecao,'[]'::jsonb) ? 'visita_agendada')
       or (lower(coalesce(fv.status,''))='realizada'
           and coalesce(p_protecao,'[]'::jsonb) ? 'visita_realizada'))

  union all
  select coalesce(f.corretor_id,n.corretor_id,i.corretor_id),700,
         'f2_estado','estado protegido no Funil 2.0',
         coalesce(f.atualizado_em,n.ultima_movimentacao,n.criado_em)
    from public.f2_lead f
    join negocios_identidade n on n.id=f.origem_negocio_id
    join identidade i on i.id=n.lead_id
   where f.descartado_em is null
     and upper(coalesce(f.momento_codigo,'')) <> 'VISITA_CANCELADA'
     and (
       (coalesce(p_protecao,'[]'::jsonb) ? 'visita_agendada'
        and (lower(coalesce(f.etapa,''))='visita'
          or upper(coalesce(f.momento_codigo,'')) in ('VISITA_AGENDADA','REMARCAR_VISITA')))
       or
       (coalesce(p_protecao,'[]'::jsonb) ? 'visita_realizada'
        and (lower(coalesce(f.etapa,''))='pos_visita'
          or upper(coalesce(f.momento_codigo,'')) in
             ('VISITA_REALIZADA','COLETAR_FEEDBACK','ACOMPANHAMENTO_POS_VISITA')))
     )

  union all
  select coalesce(n.corretor_id,i.corretor_id),650,'pipeline_legado',
         'etapa protegida no CRM legado',
         coalesce(n.ultima_movimentacao,n.estagio_desde,n.criado_em)
    from negocios_identidade n
    join identidade i on i.id=n.lead_id
    join public.pipeline_stages s on s.id=n.stage_id
   where lower(public.unaccent(
           coalesce(s.nome,'')||' '||coalesce(s.chave,'')||' '||
           coalesce(s.rotulo,'')||' '||coalesce(s.datacrazy_stage_nome,'')
         )) !~ 'cancelad'
     and (
       (coalesce(p_protecao,'[]'::jsonb) ? 'visita_agendada'
        and lower(public.unaccent(coalesce(s.nome,'')||' '||coalesce(s.chave,'')||' '||coalesce(s.rotulo,''))) ~ 'visita')
       or
       (coalesce(p_protecao,'[]'::jsonb) ? 'venda'
        and lower(public.unaccent(coalesce(s.nome,'')||' '||coalesce(s.chave,'')||' '||coalesce(s.rotulo,''))) ~ '(negocia|proposta|contrato)')
     )

  union all
  select coalesce(n.corretor_id,i.corretor_id),600,'venda',
         'venda ou negócio ganho',coalesce(n.ultima_movimentacao,n.criado_em)
    from negocios_identidade n join identidade i on i.id=n.lead_id
   where coalesce(p_protecao,'[]'::jsonb) ? 'venda'
     and (n.venda_id is not null or lower(coalesce(n.status,''))='ganho')

  union all
  select coalesce(f.corretor_id,n.corretor_id,i.corretor_id),550,
         'f2_negociacao','negociação ativa no Funil 2.0',
         coalesce(fn.atualizado_em,fn.criado_em)
    from public.f2_negociacao fn
    join public.f2_lead f on f.id=fn.funil_lead_id and f.descartado_em is null
    join negocios_identidade n on n.id=f.origem_negocio_id
    join identidade i on i.id=n.lead_id
   where coalesce(p_protecao,'[]'::jsonb) ? 'venda'
), validos as (
  select * from candidatos where corretor_id is not null
), topo as (
  select max(prioridade) prioridade from validos
), resumo as (
  select count(distinct v.corretor_id) donos,
         count(*) evidencias
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
      'motivo','evidências protegidas apontam donos diferentes',
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

revoke all on function public.motor_resolver_dono_protegido(bigint,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.motor_resolver_dono_protegido(bigint,jsonb,jsonb)
  to service_role;

do $patch_motor_roleta$
declare
  v_oid regprocedure := 'public.motor_roleta(bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb)'::regprocedure;
  v_def text;
  v_hash text;
  v_declare_anchor text := 'v_regra jsonb;';
  v_body_anchor text := E'  select l.corretor_id into v_atual\n    from public.leads l where l.id=p_lead_id;\n';
  v_guard text := E'  v_dono_protegido := public.motor_resolver_dono_protegido(p_lead_id,p_lead,p_protecao);\n  if coalesce((v_dono_protegido->>''conflito'')::boolean,false) then\n    insert into public.motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)\n    values(p_auto,p_nome,p_bloco,''distribuicao'',''alerta'',p_lead->>''nome'',v_tel,\n      ''Distribuir BLOQUEADO: evidencias protegidas apontam donos diferentes (''||coalesce(v_dono_protegido->>''fonte'',''origem desconhecida'')||'')'');\n    return null;\n  end if;\n  if coalesce((v_dono_protegido->>''protegido'')::boolean,false) then\n    v_dono_id := nullif(v_dono_protegido->>''corretor_id'','''')::bigint;\n    if v_dono_id is null or not exists(select 1 from public.corretores c where c.id=v_dono_id and coalesce(c.ativo,true)) then\n      insert into public.motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)\n      values(p_auto,p_nome,p_bloco,''distribuicao'',''alerta'',p_lead->>''nome'',v_tel,\n        ''Distribuir BLOQUEADO: dono protegido ausente ou inativo'');\n      return null;\n    end if;\n    select c.nome into v_atual_nome from public.corretores c where c.id=v_dono_id;\n    update public.leads set corretor_id=v_dono_id where id=p_lead_id and corretor_id is distinct from v_dono_id;\n    if p_neg_id is not null then\n      update public.negocios set corretor_id=v_dono_id where id=p_neg_id and corretor_id is distinct from v_dono_id;\n    end if;\n    perform public.motor_sincronizar_dono_f2(p_lead_id,v_dono_id,''roleta_automacao_''||p_auto||''_protegido_v2'');\n    if v_atual is distinct from v_dono_id then\n      insert into public.lead_dono_auditoria(lead_id,de,para,origem,quando)\n      values(p_lead_id,v_atual,v_dono_id,''roleta_automacao_''||p_auto||''_protegido_v2'',now());\n    end if;\n    insert into public.motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)\n    values(p_auto,p_nome,p_bloco,''distribuicao'',''ok'',p_lead->>''nome'',v_tel,\n      ''Lead PROTEGIDO com ''||coalesce(v_atual_nome,''corretor existente'')||'' (''||coalesce(v_dono_protegido->>''motivo'',''continuidade do dono'')||'') - sem redistribuicao'');\n    return v_dono_id;\n  end if;\n';
begin
  v_def:=pg_get_functiondef(v_oid);
  v_hash:=md5(v_def);
  if v_hash<>'5e739041602df5337ee1f10d2b9f8e43'
     or (length(v_def)-length(replace(v_def,v_declare_anchor,'')))/length(v_declare_anchor)<>1
     or (length(v_def)-length(replace(v_def,v_body_anchor,'')))/length(v_body_anchor)<>1 then
    raise exception 'motor_roleta divergiu; blindagem abortada com segurança (hash=%)',v_hash;
  end if;
  v_def:=replace(v_def,v_declare_anchor,
    v_declare_anchor||E'\n  v_dono_protegido jsonb;\n  v_dono_id bigint;');
  v_def:=replace(v_def,v_body_anchor,v_body_anchor||v_guard);
  execute v_def;
end
$patch_motor_roleta$;

revoke all on function public.motor_roleta(
  bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb
) from public,anon,authenticated;
grant execute on function public.motor_roleta(
  bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb
) to service_role;
