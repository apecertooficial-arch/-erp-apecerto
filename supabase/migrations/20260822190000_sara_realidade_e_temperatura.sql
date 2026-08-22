-- Sara: etapa, momento e temperatura precisam refletir fatos da conversa.
-- Sem mensagem recebida depois do corte, o card nunca entra em atendimento.

begin;

set local statement_timeout='90s';
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtext('sara_realidade_temperatura'));

alter table public.f2_lead
  add column if not exists temperatura text;
alter table public.f2_sara_analise
  add column if not exists temperatura_sugerida text,
  add column if not exists temperatura_confianca numeric,
  add column if not exists temperatura_evidencias jsonb not null default '[]'::jsonb;

do $constraints$
begin
  if not exists(select 1 from pg_constraint where conname='f2_lead_temperatura_check') then
    alter table public.f2_lead add constraint f2_lead_temperatura_check
      check(temperatura is null or temperatura in ('frio','morno','quente','negociando'));
  end if;
  if not exists(select 1 from pg_constraint where conname='f2_sara_temperatura_check') then
    alter table public.f2_sara_analise add constraint f2_sara_temperatura_check
      check(temperatura_sugerida is null or temperatura_sugerida in ('frio','morno','quente','negociando'));
  end if;
  if not exists(select 1 from pg_constraint where conname='f2_sara_temperatura_confianca_check') then
    alter table public.f2_sara_analise add constraint f2_sara_temperatura_confianca_check
      check(temperatura_confianca is null or temperatura_confianca between 0 and 1);
  end if;
end
$constraints$;

create or replace function public.f2_sara_registrar_sugestao_v2(
  p_funil_lead_id uuid,p_versao integer,p_context_hash text,p_origem text,
  p_status text,p_momento_codigo text,p_resumo text,p_evidencias jsonb,
  p_confianca numeric,p_mensagens integer,p_prazo_sugerido timestamptz,
  p_qualidade_nota numeric,p_qualidade_resumo text,
  p_temperatura text,p_temperatura_confianca numeric,p_temperatura_evidencias jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_lead public.f2_lead%rowtype; v_m public.f2_momento_config%rowtype;
  v_status text; v_id bigint; v_min numeric; v_respondeu boolean:=false;
begin
  if p_context_hash !~ '^[a-f0-9]{64}$'
     or p_origem not in ('ia','deterministica')
     or p_status not in ('sugestao','sem_historico')
     or jsonb_typeof(coalesce(p_evidencias,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_temperatura_evidencias,'[]'::jsonb))<>'array'
     or coalesce(char_length(btrim(p_resumo)),0) not between 3 and 800
     or coalesce(p_mensagens,0) not between 0 and 250
     or (p_qualidade_nota is not null and p_qualidade_nota not between 0 and 10)
     or (p_qualidade_nota is not null and coalesce(char_length(btrim(p_qualidade_resumo)),0) not between 3 and 500)
     or (p_status='sugestao' and p_temperatura not in ('frio','morno','quente','negociando'))
     or (p_temperatura_confianca is not null and p_temperatura_confianca not between 0 and 1) then
    return jsonb_build_object('ok',false,'erro','contrato_invalido');
  end if;

  select * into v_lead from public.f2_lead where id=p_funil_lead_id for update;
  if not found then return jsonb_build_object('ok',false,'erro','lead_inexistente'); end if;
  if not public.f2_lead_automatico_elegivel(v_lead.id) then
    return jsonb_build_object('ok',false,'erro','lead_fora_do_funil');
  end if;
  select * into v_m from public.f2_momento_config where codigo=p_momento_codigo and ativo;
  if p_status='sugestao' and not found then return jsonb_build_object('ok',false,'erro','momento_invalido'); end if;

  select exists(
    select 1 from public.wa_mensagens wm
    join public.wa_conversas cv on cv.id=wm.conversa_id
    left join public.wa_contatos c on c.id=cv.contato_id
    left join public.negocios n on n.id=v_lead.origem_negocio_id
    left join public.f2_historico_vinculo hv on hv.funil_lead_id=v_lead.id and hv.contato_id=cv.contato_id
    where lower(coalesce(wm.direcao,'')) in ('recebida','entrada','in','inbound','received')
      and (c.lead_id=n.lead_id or hv.funil_lead_id is not null)
      and (v_lead.historico_completo or coalesce(wm.enviado_em,wm.criado_em)>=v_lead.corte_conversa_em)
  ) into v_respondeu;

  select a.id into v_id from public.f2_sara_analise a
   where a.funil_lead_id=p_funil_lead_id and a.context_hash=p_context_hash;
  if v_id is not null then
    return jsonb_build_object('ok',true,'ja_processado',true,'analise_id',v_id,
      'status',(select status from public.f2_sara_analise where id=v_id));
  end if;

  select coalesce(confianca_minima,0.65) into v_min from public.f2_sara_config where id;
  v_min:=coalesce(v_min,0.65);
  v_status:=case
    when p_status='sem_historico' then 'sem_historico'
    when v_lead.versao<>p_versao then 'obsoleta'
    when p_confianca is null or p_confianca<v_min then 'revisao_humana'
    when p_origem='ia' and p_momento_codigo<>'CADENCIA_SEM_RESPOSTA'
      and jsonb_array_length(coalesce(p_evidencias,'[]'::jsonb))=0 then 'revisao_humana'
    when v_respondeu and jsonb_array_length(coalesce(p_temperatura_evidencias,'[]'::jsonb))=0 then 'revisao_humana'
    when p_temperatura in ('quente','negociando') and coalesce(p_temperatura_confianca,0)<0.85 then 'revisao_humana'
    when not v_respondeu and (p_momento_codigo<>'CADENCIA_SEM_RESPOSTA' or v_m.etapa<>'tentando_contato' or p_temperatura<>'frio') then 'revisao_humana'
    when v_respondeu and p_momento_codigo='CADENCIA_SEM_RESPOSTA' then 'revisao_humana'
    else 'sugerida' end;

  insert into public.f2_sara_analise(
    funil_lead_id,origem_negocio_id,context_hash,origem,status,
    momento_anterior,momento_sugerido,etapa_sugerida,acao_sugerida,
    acao_rotulo_sugerida,prazo_sugerido,resumo,evidencias,confianca,
    mensagens_consideradas,versao_base,qualidade_nota,qualidade_resumo,
    temperatura_sugerida,temperatura_confianca,temperatura_evidencias
  ) values(
    p_funil_lead_id,v_lead.origem_negocio_id,p_context_hash,p_origem,v_status,
    v_lead.momento_codigo,v_m.codigo,v_m.etapa,v_m.acao_codigo,v_m.acao_rotulo,
    p_prazo_sugerido,left(btrim(p_resumo),800),coalesce(p_evidencias,'[]'::jsonb),
    p_confianca,coalesce(p_mensagens,0),p_versao,p_qualidade_nota,
    left(btrim(p_qualidade_resumo),500),p_temperatura,p_temperatura_confianca,
    coalesce(p_temperatura_evidencias,'[]'::jsonb)
  ) returning id into v_id;
  return jsonb_build_object('ok',true,'analise_id',v_id,'status',v_status,
    'momento_codigo',v_m.codigo,'etapa',v_m.etapa,'acao_codigo',v_m.acao_codigo,
    'acao_rotulo',v_m.acao_rotulo,'prazo_sugerido',p_prazo_sugerido,
    'qualidade_nota',p_qualidade_nota,'temperatura',p_temperatura,
    'temperatura_confianca',p_temperatura_confianca,'versao_base',p_versao);
exception when unique_violation then
  select id,status into v_id,v_status from public.f2_sara_analise
   where funil_lead_id=p_funil_lead_id and context_hash=p_context_hash;
  return jsonb_build_object('ok',true,'ja_processado',true,'analise_id',v_id,'status',v_status);
end
$fn$;

revoke all on function public.f2_sara_registrar_sugestao_v2(
  uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz,numeric,text,text,numeric,jsonb
) from public,anon,authenticated;
grant execute on function public.f2_sara_registrar_sugestao_v2(
  uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz,numeric,text,text,numeric,jsonb
) to service_role;

create or replace function public.f2_sara_aplicar_analise_v2(
  p_analise_id bigint,p_aplicar_momento boolean default true,
  p_aplicar_etapa boolean default true,p_aplicar_acao boolean default true,
  p_aplicar_qualidade boolean default true,p_aplicar_temperatura boolean default true
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_a public.f2_sara_analise%rowtype; v_f public.f2_lead%rowtype;
  v_m public.f2_momento_config%rowtype; v_prazo timestamptz;
  v_status_final text; v_respondeu boolean:=false;
begin
  if not coalesce(p_aplicar_momento,false) and not coalesce(p_aplicar_etapa,false)
     and not coalesce(p_aplicar_acao,false) and not coalesce(p_aplicar_qualidade,false)
     and not coalesce(p_aplicar_temperatura,false) then
    return jsonb_build_object('ok',false,'erro','nenhum_campo_selecionado');
  end if;
  select * into v_a from public.f2_sara_analise where id=p_analise_id for update;
  if not found then return jsonb_build_object('ok',false,'erro','analise_inexistente'); end if;
  if v_a.status in ('aplicada','mantida') then
    return jsonb_build_object('ok',true,'aplicado',true,'idempotente',true,
      'analise_id',v_a.id,'status',v_a.status);
  end if;
  if v_a.status in ('revisao_humana','sem_historico','obsoleta') then
    return jsonb_build_object('ok',true,'aplicado',false,'terminal',true,'analise_id',v_a.id,'status',v_a.status);
  end if;
  if v_a.status<>'sugerida' then return jsonb_build_object('ok',false,'erro','analise_nao_aplicavel','status',v_a.status); end if;
  select * into v_f from public.f2_lead where id=v_a.funil_lead_id for update;
  if not found then return jsonb_build_object('ok',false,'erro','lead_inexistente'); end if;
  if not public.f2_lead_automatico_elegivel(v_f.id) then return jsonb_build_object('ok',false,'erro','lead_fora_do_funil'); end if;
  if v_f.versao<>v_a.versao_base then
    update public.f2_sara_analise set status='obsoleta' where id=v_a.id;
    return jsonb_build_object('ok',true,'aplicado',false,'terminal',true,'analise_id',v_a.id,'status','obsoleta');
  end if;
  select * into v_m from public.f2_momento_config where codigo=v_a.momento_sugerido and ativo;
  if not found then return jsonb_build_object('ok',false,'erro','momento_invalido'); end if;

  select exists(
    select 1 from public.wa_mensagens wm
    join public.wa_conversas cv on cv.id=wm.conversa_id
    left join public.wa_contatos c on c.id=cv.contato_id
    left join public.negocios n on n.id=v_f.origem_negocio_id
    left join public.f2_historico_vinculo hv on hv.funil_lead_id=v_f.id and hv.contato_id=cv.contato_id
    where lower(coalesce(wm.direcao,'')) in ('recebida','entrada','in','inbound','received')
      and (c.lead_id=n.lead_id or hv.funil_lead_id is not null)
      and (v_f.historico_completo or coalesce(wm.enviado_em,wm.criado_em)>=v_f.corte_conversa_em)
  ) into v_respondeu;
  if (not v_respondeu and (v_m.codigo<>'CADENCIA_SEM_RESPOSTA' or v_m.etapa<>'tentando_contato' or v_a.temperatura_sugerida<>'frio'))
     or (v_respondeu and v_m.codigo='CADENCIA_SEM_RESPOSTA') then
    update public.f2_sara_analise set status='revisao_humana' where id=v_a.id;
    return jsonb_build_object('ok',true,'aplicado',false,'terminal',true,'analise_id',v_a.id,'status','revisao_humana','motivo','realidade_da_conversa_divergente');
  end if;

  v_prazo:=case when v_m.codigo='RETORNO_PROGRAMADO' and v_a.prazo_sugerido>now()
    and v_a.prazo_sugerido<=now()+interval '30 days' then v_a.prazo_sugerido
    else now()+make_interval(mins=>coalesce(v_m.prazo_minutos,1440)) end;
  v_status_final:=case when
    (p_aplicar_momento and v_f.momento_codigo is distinct from v_m.codigo)
    or (p_aplicar_etapa and v_f.etapa is distinct from v_m.etapa)
    or (p_aplicar_acao and (v_f.acao_codigo is distinct from v_m.acao_codigo or v_f.acao_rotulo is distinct from v_m.acao_rotulo))
    or (p_aplicar_temperatura and v_f.temperatura is distinct from v_a.temperatura_sugerida)
    then 'aplicada' else 'mantida' end;

  update public.f2_lead set
    momento_codigo=case when p_aplicar_momento then v_m.codigo else momento_codigo end,
    etapa=case when p_aplicar_etapa then v_m.etapa else etapa end,
    acao_codigo=case when p_aplicar_acao then v_m.acao_codigo else acao_codigo end,
    acao_rotulo=case when p_aplicar_acao then v_m.acao_rotulo else acao_rotulo end,
    proxima_acao_em=case when p_aplicar_acao then v_prazo else proxima_acao_em end,
    temperatura=case when p_aplicar_temperatura then v_a.temperatura_sugerida else temperatura end,
    qualidade_atendimento_nota=case when p_aplicar_qualidade and v_a.qualidade_nota is not null then v_a.qualidade_nota else qualidade_atendimento_nota end,
    qualidade_atendimento_resumo=case when p_aplicar_qualidade and v_a.qualidade_nota is not null then v_a.qualidade_resumo else qualidade_atendimento_resumo end,
    qualidade_atendimento_em=case when p_aplicar_qualidade and v_a.qualidade_nota is not null then now() else qualidade_atendimento_em end,
    ultima_reavaliacao_sara_em=now(),ultima_reavaliacao_resumo=v_a.resumo,
    versao=versao+1,atualizado_em=now(),atualizado_por=null
  where id=v_f.id;
  update public.f2_sara_analise set status=v_status_final,aplicada_em=now() where id=v_a.id;
  insert into public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  values(v_f.id,'sara_reavaliou','Central aplicou a analise da Sara',left(v_a.resumo,500),
    jsonb_build_object('analise_id',v_a.id,'momento_anterior',v_f.momento_codigo,'momento_novo',case when p_aplicar_momento then v_m.codigo else v_f.momento_codigo end,
      'etapa_anterior',v_f.etapa,'etapa_nova',case when p_aplicar_etapa then v_m.etapa else v_f.etapa end,
      'temperatura_anterior',v_f.temperatura,'temperatura_nova',case when p_aplicar_temperatura then v_a.temperatura_sugerida else v_f.temperatura end,
      'qualidade_aplicada',p_aplicar_qualidade and v_a.qualidade_nota is not null),null);
  return jsonb_build_object('ok',true,'aplicado',true,'analise_id',v_a.id,'status',v_status_final,
    'momento_anterior',v_f.momento_codigo,'momento_codigo',case when p_aplicar_momento then v_m.codigo else v_f.momento_codigo end,
    'etapa_anterior',v_f.etapa,'etapa_nova',case when p_aplicar_etapa then v_m.etapa else v_f.etapa end,
    'temperatura_anterior',v_f.temperatura,'temperatura_nova',case when p_aplicar_temperatura then v_a.temperatura_sugerida else v_f.temperatura end,
    'versao',v_f.versao+1);
end
$fn$;

revoke all on function public.f2_sara_aplicar_analise_v2(bigint,boolean,boolean,boolean,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.f2_sara_aplicar_analise_v2(bigint,boolean,boolean,boolean,boolean,boolean) to service_role;

create or replace function public.f2_sara_aplicar_analise(
  p_analise_id bigint,p_aplicar_momento boolean default true,p_aplicar_etapa boolean default true,
  p_aplicar_acao boolean default true,p_aplicar_qualidade boolean default true
) returns jsonb language sql security definer set search_path='' as $fn$
  select public.f2_sara_aplicar_analise_v2($1,$2,$3,$4,$5,true);
$fn$;
revoke all on function public.f2_sara_aplicar_analise(bigint,boolean,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.f2_sara_aplicar_analise(bigint,boolean,boolean,boolean,boolean) to service_role;

create or replace function public.motor_aplicar_saida_ia(p_lead jsonb,p_options jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_id bigint;
begin
  v_id:=nullif(p_lead->>'__last_ai_analysis_id','')::bigint;
  if v_id is null then return jsonb_build_object('ok',false,'erro','saida_ia_ausente'); end if;
  return public.f2_sara_aplicar_analise_v2(v_id,
    coalesce((p_options->>'aplicarMomento')::boolean,true),
    coalesce((p_options->>'aplicarEtapa')::boolean,true),
    coalesce((p_options->>'aplicarAcao')::boolean,true),
    coalesce((p_options->>'aplicarQualidade')::boolean,true),
    coalesce((p_options->>'aplicarTemperatura')::boolean,true));
end
$fn$;
revoke all on function public.motor_aplicar_saida_ia(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.motor_aplicar_saida_ia(jsonb,jsonb) to service_role;

do $patch_agent$
declare v_def text; v_novo text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_agente' and p.prokind='f' limit 1;
  if md5(v_def)<>'457f7bcd63424b0c2985674b5cc59669' then raise exception 'motor_agente mudou: %',md5(v_def); end if;
  v_novo:=replace(v_def,$old$v_reg:=public.f2_sara_registrar_sugestao($old$,$new$v_reg:=public.f2_sara_registrar_sugestao_v2($new$);
  v_novo:=replace(v_novo,
    $old$    nullif(v_item->>'qualidade_nota','')::numeric,v_item->>'qualidade_resumo'
  );$old$,
    $new$    nullif(v_item->>'qualidade_nota','')::numeric,v_item->>'qualidade_resumo',
    v_item->>'temperatura',nullif(v_item->>'temperatura_confianca','')::numeric,
    coalesce(v_item->'temperatura_evidencias','[]'::jsonb)
  );$new$);
  if v_novo=v_def then raise exception 'motor_agente sem alteracao'; end if;
  execute v_novo;
end
$patch_agent$;

do $patch_actions$
declare v_def text; v_novo text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_acoes' and p.prokind='f' limit 1;
  if md5(v_def)<>'4123ba74660522b13d45c874e9573c6c' then raise exception 'motor_acoes mudou: %',md5(v_def); end if;
  v_novo:=replace(v_def,
    $old$        '__ai_etapa_anterior',_ai_apply->>'etapa_anterior',
        '__ai_etapa_nova',_ai_apply->>'etapa_nova'$old$,
    $new$        '__ai_etapa_anterior',_ai_apply->>'etapa_anterior',
        '__ai_etapa_nova',_ai_apply->>'etapa_nova',
        '__ai_temperatura_anterior',_ai_apply->>'temperatura_anterior',
        '__ai_temperatura_nova',_ai_apply->>'temperatura_nova'$new$);
  v_novo:=replace(v_novo,
    $old$        if v_lead_id is not null then
          select l.corretor_id,c.nome into v_cor,v_cor_nome$old$,
    $new$        if nullif(ao->>'somenteAiTemperaturaAlteradaPara','') is not null
           and not (
             coalesce((p_lead->>'__ai_aplicado')::boolean,false)
             and p_lead->>'__ai_temperatura_nova'=ao->>'somenteAiTemperaturaAlteradaPara'
             and p_lead->>'__ai_temperatura_anterior' is distinct from p_lead->>'__ai_temperatura_nova'
           ) then
          insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
          values(p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',v_tel,
            'Aviso ignorado: a temperatura nao mudou para '||ao->>'somenteAiTemperaturaAlteradaPara');
          continue;
        end if;
        if v_lead_id is not null then
          select l.corretor_id,c.nome into v_cor,v_cor_nome$new$);
  if v_novo=v_def then raise exception 'motor_acoes sem alteracao'; end if;
  execute v_novo;
end
$patch_actions$;

do $publish$
declare r record; v_mapa jsonb; v_idx int; v_aidx int; v_actions jsonb;
  v_versao int; v_versao_id bigint; v_esperada bigint;
begin
  for r in select * from public.automacoes where id in (49,64,69) order by id for update loop
    v_esperada:=case r.id when 49 then 105 when 64 then 53 else 59 end;
    if r.versao_publicada_id is distinct from v_esperada then
      raise exception 'automacao % mudou: versao publicada %',r.id,r.versao_publicada_id;
    end if;
    v_mapa:=r.mapa;
    select bord::int-1,aord::int-1 into v_idx,v_aidx
      from jsonb_array_elements(v_mapa#>'{automation,blocks}') with ordinality b(value,bord)
      cross join lateral jsonb_array_elements(coalesce(b.value#>'{options,actions}','[]'::jsonb)) with ordinality a(value,aord)
     where a.value->>'name'='apply-ai-analysis-action' limit 1;
    if v_idx is null then raise exception 'automacao % sem aplicar analise',r.id; end if;
    v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','actions',v_aidx::text,'options','aplicarTemperatura'],'true'::jsonb,true);
    if r.id=49 then
      v_actions:=v_mapa#>array['automation','blocks',v_idx::text,'options','actions'];
      v_actions:=v_actions||jsonb_build_array(jsonb_build_object(
        'name','send-notification-action','group','',
        'options',jsonb_build_object(
          'tipo','lead_quente','publico','gestao','prioridade',2,
          'titulo','Lead quente: {nome}',
          'detalhe','{nome} ficou quente com evidencia real do cliente. Responsavel: {corretor}.',
          'somenteAiTemperaturaAlteradaPara','quente'
        )
      ));
      v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','actions'],v_actions);
    end if;
    select coalesce(max(versao),0)+1 into v_versao from public.automacao_versoes where automacao_id=r.id;
    insert into public.automacao_versoes(automacao_id,versao,nome,mapa,observacao,criado_por)
    values(r.id,v_versao,r.nome,v_mapa,'Sara aplica temperatura com evidencia e nunca move sem resposta','codex')
    returning id into v_versao_id;
    update public.automacoes set mapa=v_mapa,mapa_rascunho=v_mapa,
      versao_publicada_id=v_versao_id,atualizada_em=now(),publicado_em=now(),status='publicado',ativa=true
    where id=r.id;
  end loop;
end
$publish$;

-- Correcao factual imediata. Sem entrada do cliente: frio e fora de atendimento.
with cards as (
  select f.id,f.historico_completo,f.corte_conversa_em,n.lead_id
  from public.f2_lead f join public.negocios n on n.id=f.origem_negocio_id
  where public.f2_lead_automatico_elegivel(f.id)
), contatos as (
  select c.id card_id,w.id contato_id from cards c join public.wa_contatos w on w.lead_id=c.lead_id
  union
  select c.id,v.contato_id from cards c join public.f2_historico_vinculo v on v.funil_lead_id=c.id
), conversas as (
  select distinct ct.card_id,cv.id conversa_id
  from contatos ct join public.wa_conversas cv on cv.contato_id=ct.contato_id
), realidade as (
  select c.id,
    count(wm.id) filter(where lower(coalesce(wm.direcao,'')) in ('recebida','entrada','in','inbound','received')
      and (c.historico_completo or coalesce(wm.enviado_em,wm.criado_em)>=c.corte_conversa_em)) inbound,
    count(wm.id) filter(where lower(coalesce(wm.direcao,'')) in ('enviada','saida','out','outbound','sent')
      and (c.historico_completo or coalesce(wm.enviado_em,wm.criado_em)>=c.corte_conversa_em)) outbound
  from cards c left join conversas cv on cv.card_id=c.id
  left join public.wa_mensagens wm on wm.conversa_id=cv.conversa_id
  group by c.id
)
update public.f2_lead f set
  etapa=case when r.outbound>0 then 'tentando_contato' else 'novo' end,
  momento_codigo=case when r.outbound>0 then 'CADENCIA_SEM_RESPOSTA' else 'PRIMEIRA_ABORDAGEM' end,
  temperatura='frio',
  versao=f.versao+1,atualizado_em=now(),atualizado_por=null
from realidade r where r.id=f.id and r.inbound=0
  and (f.etapa is distinct from case when r.outbound>0 then 'tentando_contato' else 'novo' end
    or f.momento_codigo is distinct from case when r.outbound>0 then 'CADENCIA_SEM_RESPOSTA' else 'PRIMEIRA_ABORDAGEM' end
    or f.temperatura is distinct from 'frio');

create or replace function private.f2_reavaliar_temperatura_enfileirar()
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare r record; v_n int:=0;
begin
  for r in
    select f.id,f.momento_codigo,coalesce(l.nome,f.nome) nome,coalesce(l.telefone,f.telefone) telefone,l.email
    from public.f2_lead f join public.negocios n on n.id=f.origem_negocio_id
    left join public.leads l on l.id=n.lead_id
    where public.f2_lead_automatico_elegivel(f.id) and f.temperatura is null
    order by f.atualizado_em desc
  loop
    v_n:=v_n+public.motor_evento_disparar('checagem-diaria-trigger',jsonb_build_object(
      'nome',r.nome,'telefone',coalesce(r.telefone,''),'email',coalesce(r.email,''),
      '__funil_lead_id',r.id,'__motor_priority',5,'__motor_evento','reavaliacao_temperatura'
    ),r.momento_codigo);
  end loop;
  return jsonb_build_object('ok',true,'enfileiradas',v_n);
end
$fn$;
revoke all on function private.f2_reavaliar_temperatura_enfileirar() from public,anon,authenticated;
grant execute on function private.f2_reavaliar_temperatura_enfileirar() to service_role;

comment on column public.f2_lead.temperatura is
  'Temperatura factual aplicada por bloco explicito: frio, morno, quente ou negociando.';
comment on column public.f2_sara_analise.temperatura_evidencias is
  'Falas reais do cliente validadas pela Sara para sustentar a temperatura.';

commit;
