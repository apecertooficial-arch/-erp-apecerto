-- Central de Automacoes: IA observa e devolve; somente uma Acao explicita aplica.
-- O envio usa exclusivamente a instancia do dono e nunca transfere o lead.
-- Sensores podem enfileirar eventos, mas efeitos de negocio nao fazem fan-out
-- enquanto o mapa publicado esta sendo executado.

alter table public.f2_lead
  add column if not exists qualidade_atendimento_nota numeric(4,2),
  add column if not exists qualidade_atendimento_resumo text,
  add column if not exists qualidade_atendimento_em timestamptz;

do $constraints$
begin
  if not exists(
    select 1 from pg_constraint
     where conrelid='public.f2_lead'::regclass
       and conname='f2_lead_qualidade_atendimento_nota_check'
  ) then
    alter table public.f2_lead add constraint f2_lead_qualidade_atendimento_nota_check
      check (qualidade_atendimento_nota is null or
             qualidade_atendimento_nota between 0 and 10);
  end if;
end
$constraints$;

alter table public.f2_sara_analise
  add column if not exists etapa_sugerida text,
  add column if not exists acao_rotulo_sugerida text,
  add column if not exists prazo_sugerido timestamptz,
  add column if not exists qualidade_nota numeric(4,2),
  add column if not exists qualidade_resumo text,
  add column if not exists aplicada_em timestamptz;

do $constraints$
begin
  if not exists(
    select 1 from pg_constraint
     where conrelid='public.f2_sara_analise'::regclass
       and conname='f2_sara_analise_qualidade_nota_check'
  ) then
    alter table public.f2_sara_analise add constraint f2_sara_analise_qualidade_nota_check
      check (qualidade_nota is null or qualidade_nota between 0 and 10);
  end if;
end
$constraints$;

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

create or replace function public.f2_sara_aplicar_analise(
  p_analise_id bigint,
  p_aplicar_momento boolean default true,
  p_aplicar_etapa boolean default true,
  p_aplicar_acao boolean default true,
  p_aplicar_qualidade boolean default true
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_a public.f2_sara_analise%rowtype;
  v_f public.f2_lead%rowtype;
  v_m public.f2_momento_config%rowtype;
  v_prazo timestamptz;
begin
  if not coalesce(p_aplicar_momento,false)
     and not coalesce(p_aplicar_etapa,false)
     and not coalesce(p_aplicar_acao,false)
     and not coalesce(p_aplicar_qualidade,false) then
    return jsonb_build_object('ok',false,'erro','nenhum_campo_selecionado');
  end if;

  select * into v_a from public.f2_sara_analise
   where id=p_analise_id for update;
  if not found then return jsonb_build_object('ok',false,'erro','analise_inexistente'); end if;
  if v_a.status in ('aplicada','mantida') then
    return jsonb_build_object('ok',true,'idempotente',true,'analise_id',v_a.id);
  end if;
  if v_a.status<>'sugerida' then
    return jsonb_build_object('ok',false,'erro','analise_nao_aplicavel','status',v_a.status);
  end if;

  select * into v_f from public.f2_lead where id=v_a.funil_lead_id for update;
  if not found then return jsonb_build_object('ok',false,'erro','lead_inexistente'); end if;
  if v_f.versao<>v_a.versao_base then
    update public.f2_sara_analise set status='obsoleta' where id=v_a.id;
    return jsonb_build_object('ok',false,'erro','analise_obsoleta');
  end if;

  select * into v_m from public.f2_momento_config
   where codigo=v_a.momento_sugerido and ativo;
  if not found then return jsonb_build_object('ok',false,'erro','momento_invalido'); end if;
  v_prazo:=case
    when v_m.codigo='RETORNO_PROGRAMADO' and v_a.prazo_sugerido>now()
      and v_a.prazo_sugerido<=now()+interval '30 days' then v_a.prazo_sugerido
    else now()+make_interval(mins=>coalesce(v_m.prazo_minutos,1440)) end;

  update public.f2_lead set
    momento_codigo=case when p_aplicar_momento then v_m.codigo else momento_codigo end,
    etapa=case when p_aplicar_etapa then v_m.etapa else etapa end,
    acao_codigo=case when p_aplicar_acao then v_m.acao_codigo else acao_codigo end,
    acao_rotulo=case when p_aplicar_acao then v_m.acao_rotulo else acao_rotulo end,
    proxima_acao_em=case when p_aplicar_acao then v_prazo else proxima_acao_em end,
    qualidade_atendimento_nota=case
      when p_aplicar_qualidade and v_a.qualidade_nota is not null
        then v_a.qualidade_nota else qualidade_atendimento_nota end,
    qualidade_atendimento_resumo=case
      when p_aplicar_qualidade and v_a.qualidade_nota is not null
        then v_a.qualidade_resumo else qualidade_atendimento_resumo end,
    qualidade_atendimento_em=case
      when p_aplicar_qualidade and v_a.qualidade_nota is not null
        then now() else qualidade_atendimento_em end,
    ultima_reavaliacao_sara_em=now(),
    ultima_reavaliacao_resumo=v_a.resumo,
    versao=versao+1,atualizado_em=now(),atualizado_por=null
  where id=v_f.id;

  update public.f2_sara_analise
     set status=case
       when v_f.momento_codigo=v_m.codigo then 'mantida' else 'aplicada' end,
         aplicada_em=now()
   where id=v_a.id;

  insert into public.f2_evento(
    funil_lead_id,tipo,titulo,detalhe,payload,criado_por
  ) values (
    v_f.id,'sara_reavaliou','Central aplicou a analise da Sara',
    left(v_a.resumo,500),
    jsonb_build_object('analise_id',v_a.id,'momento_anterior',v_f.momento_codigo,
      'momento_novo',case when p_aplicar_momento then v_m.codigo else v_f.momento_codigo end,
      'etapa_aplicada',p_aplicar_etapa,'acao_aplicada',p_aplicar_acao,
      'qualidade_aplicada',p_aplicar_qualidade and v_a.qualidade_nota is not null),
    null
  );
  return jsonb_build_object('ok',true,'analise_id',v_a.id,
    'momento_codigo',case when p_aplicar_momento then v_m.codigo else v_f.momento_codigo end,
    'versao',v_f.versao+1);
end
$fn$;

revoke all on function public.f2_sara_aplicar_analise(bigint,boolean,boolean,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.f2_sara_aplicar_analise(bigint,boolean,boolean,boolean,boolean)
  to service_role;

create or replace function public.motor_agente(
  p_auto bigint,p_nome text,p_bloco text,p_lead jsonb,p_lead_id bigint,
  p_agente_id bigint,p_funcao text
) returns jsonb
language plpgsql
security definer
set search_path='public','extensions'
as $fn$
declare
  v_ag record; v_card uuid; v_tel text; v_http_status integer; v_http_body text;
  v_res jsonb; v_item jsonb; v_reg jsonb;
begin
  v_tel:=regexp_replace(coalesce(p_lead->>'telefone',''),'\D','','g');
  select id,nome,slug,coalesce(ativo,false) ativo into v_ag
    from public.agentes_ia where id=p_agente_id;
  if v_ag.id is null or not v_ag.ativo then
    return jsonb_build_object('ok',false,'erro',
      case when v_ag.id is null then 'agente_nao_encontrado' else 'agente_desligado' end);
  end if;
  if p_funcao not in ('analisar_atendimento','atualizar_momento') then
    return jsonb_build_object('ok',false,'erro','funcao_desconhecida');
  end if;
  select f.id into v_card from public.f2_lead f
  join public.negocios n on n.id=f.origem_negocio_id
  where n.lead_id=p_lead_id and f.descartado_em is null
  order by f.criado_em desc limit 1;
  if v_card is null then return jsonb_build_object('ok',false,'erro','lead_fora_do_funil'); end if;

  begin perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','28000');
  exception when others then null; end;
  begin
    select h.status,left(h.content,12000) into v_http_status,v_http_body
      from extensions.http((
        'POST','https://diaegvfveqezispcthwk.supabase.co/functions/v1/f2-sara-reclassificar',
        array[extensions.http_header('x-cron-secret',
          (select decrypted_secret from vault.decrypted_secrets
            where name='ncrm_sara_cron_secret'))],
        'application/json',jsonb_build_object(
          'funil_lead_id',v_card,'agente_slug',v_ag.slug
        )::text
      )::extensions.http_request) h;
  exception when others then
    v_http_status:=null; v_http_body:='falha_http';
  end;
  begin v_res:=v_http_body::jsonb; exception when others then v_res:=null; end;
  v_item:=v_res#>'{resultados,0}';
  if coalesce(v_http_status,0)<>200
     or coalesce((v_res->>'ok')::boolean,false) is not true
     or coalesce((v_res->>'somente_analise')::boolean,false) is not true
     or v_item->>'id'<>v_card::text or v_res->>'agente_slug'<>v_ag.slug then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'agente','erro',p_lead->>'nome',v_tel,
      'IA nao devolveu o contrato puro do card exato (HTTP '||
      coalesce(v_http_status::text,'-')||')');
    return jsonb_build_object('ok',false,'erro','ia_indisponivel','http',v_http_status);
  end if;

  v_reg:=public.f2_sara_registrar_sugestao(
    v_card,(v_item->>'versao_base')::integer,v_item->>'context_hash',
    v_item->>'origem',v_item->>'status',v_item->>'momento_codigo',
    v_item->>'resumo',coalesce(v_item->'evidencias','[]'::jsonb),
    nullif(v_item->>'confianca','')::numeric,
    coalesce(nullif(v_item->>'mensagens','')::integer,0),
    nullif(v_item->>'prazo_sugerido','')::timestamptz,
    nullif(v_item->>'qualidade_nota','')::numeric,v_item->>'qualidade_resumo'
  );
  if coalesce((v_reg->>'ok')::boolean,false) is not true
     or v_reg->>'status'<>'sugerida' then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (p_auto,p_nome,p_bloco,'agente','alerta',p_lead->>'nome',v_tel,
      'IA analisou, mas a sugestao nao pode ser aplicada: '||
      coalesce(v_reg->>'status',v_reg->>'erro','contrato_invalido'));
    return jsonb_build_object('ok',false,'erro','analise_nao_aplicavel','output',v_reg);
  end if;

  insert into public.motor_execucoes(
    automacao_id,automacao_nome,bloco_id,evento,status,
    lead_nome,lead_telefone,detalhe
  ) values (p_auto,p_nome,p_bloco,'agente','ok',p_lead->>'nome',v_tel,
    'Agente "'||v_ag.nome||'" devolveu analise #'||(v_reg->>'analise_id')||
    '; nenhum campo do lead foi alterado');
  return jsonb_build_object('ok',true,'card',v_card,'agente',v_ag.nome,
    'output',v_item||jsonb_build_object('analise_id',(v_reg->>'analise_id')::bigint,
      'status',v_reg->>'status'));
end
$fn$;

revoke all on function public.motor_agente(bigint,text,text,jsonb,bigint,bigint,text)
  from public,anon,authenticated;
grant execute on function public.motor_agente(bigint,text,text,jsonb,bigint,bigint,text)
  to service_role;

create or replace function public.motor_aplicar_saida_ia(p_lead jsonb,p_options jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare v_id bigint;
begin
  v_id:=nullif(p_lead->>'__last_ai_analysis_id','')::bigint;
  if v_id is null then return jsonb_build_object('ok',false,'erro','saida_ia_ausente'); end if;
  return public.f2_sara_aplicar_analise(
    v_id,coalesce((p_options->>'aplicarMomento')::boolean,true),
    coalesce((p_options->>'aplicarEtapa')::boolean,true),
    coalesce((p_options->>'aplicarAcao')::boolean,true),
    coalesce((p_options->>'aplicarQualidade')::boolean,true));
end
$fn$;

revoke all on function public.motor_aplicar_saida_ia(jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.motor_aplicar_saida_ia(jsonb,jsonb) to service_role;

-- Injeta a saida do bloco de IA no contexto da propria execucao e ensina o
-- bloco Acao a aplica-la. Os patches exigem as ancoras da migracao anterior.
do $patch$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_rodar_unchecked';
  if position('AUTOMATION_MODULE_FAILED: ai-agent:' in v_def)=0 then
    raise exception 'motor_rodar_unchecked sem hardening atomico anterior';
  end if;
  v_new:=replace(v_def,
    $old$      trace:=trace||'>> Agente'||chr(10); cur:=b#>>'{options,nextBlockId}';$old$,
    $new$      p_lead:=p_lead||jsonb_build_object(
        '__outputs',coalesce(p_lead->'__outputs','{}'::jsonb)||
          jsonb_build_object(cur,coalesce(_res->'output','{}'::jsonb)),
        '__last_ai_analysis_id',_res#>>'{output,analise_id}'
      );
      trace:=trace||'>> Agente (somente saida)'||chr(10);
      cur:=b#>>'{options,nextBlockId}';$new$);
  if v_new=v_def or position('__last_ai_analysis_id' in v_new)=0 then
    raise exception 'patch de saida da IA nao encontrou ancora';
  end if;
  execute v_new;

  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_acoes';
  v_new:=replace(v_def,'v_exist bigint; _f2 jsonb;',
    'v_exist bigint; _f2 jsonb; _ai_apply jsonb;');
  v_new:=replace(v_new,
    $old$    if act_name=any(array[$old$,
    $new$    if act_name='apply-ai-analysis-action' then
      _ai_apply:=public.motor_aplicar_saida_ia(p_lead,ao);
      insert into motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (
        p_auto,p_nome,p_bloco,'acao',
        case when coalesce((_ai_apply->>'ok')::boolean,false) then 'ok' else 'erro' end,
        p_lead->>'nome',v_tel,
        case when coalesce((_ai_apply->>'ok')::boolean,false)
          then 'Analise da IA aplicada explicitamente #'||coalesce(p_lead->>'__last_ai_analysis_id','?')
          else 'Analise da IA nao aplicada: '||coalesce(_ai_apply->>'erro','erro') end
      );
      continue;
    end if;

    if act_name=any(array[$new$);
  if v_new=v_def or position('apply-ai-analysis-action' in v_new)=0
     or position('_ai_apply jsonb' in v_new)=0 then
    raise exception 'patch da Acao de IA nao encontrou ancoras';
  end if;
  execute v_new;
end
$patch$;

-- Enquanto o motor executa um mapa, mudancas feitas por um bloco nao podem
-- acordar outra automacao. Encadeamento entre fluxos exige a Acao explicita.
create or replace function public.motor_evento_momento()
returns trigger language plpgsql security definer set search_path='public'
as $fn$
declare lead_rec record; lead_json jsonb;
begin
  if coalesce(current_setting('motor.suppress',true),'')='1' then return new; end if;
  if not exists(select 1 from motor_flags where nome='eventos' and ativo) then return new; end if;
  if new.momento_codigo is not distinct from old.momento_codigo
     or new.descartado_em is not null then return new; end if;
  select l.nome,l.telefone,l.email into lead_rec from negocios ng
  join leads l on l.id=ng.lead_id where ng.id=new.origem_negocio_id;
  lead_json:=jsonb_build_object('nome',coalesce(lead_rec.nome,new.nome,'Lead'),
    'telefone',coalesce(lead_rec.telefone,new.telefone,''),
    'email',coalesce(lead_rec.email,''));
  perform motor_evento_disparar('lead-entrou-momento-trigger',lead_json,new.momento_codigo);
  return new;
end
$fn$;

create or replace function public.motor_evento_lead_distribuido()
returns trigger language plpgsql security definer set search_path='public'
as $fn$
declare lead_rec record; lead_json jsonb;
begin
  if coalesce(current_setting('motor.suppress',true),'')='1' then return new; end if;
  if not exists(select 1 from motor_flags where nome='eventos' and ativo)
     or new.descartado_em is not null then return new; end if;
  select l.nome,l.telefone,l.email into lead_rec from negocios ng
  join leads l on l.id=ng.lead_id where ng.id=new.origem_negocio_id;
  lead_json:=jsonb_build_object('nome',coalesce(lead_rec.nome,new.nome,'Lead'),
    'telefone',coalesce(lead_rec.telefone,new.telefone,''),
    'email',coalesce(lead_rec.email,''));
  perform motor_evento_disparar('lead-distribuido-trigger',lead_json,new.momento_codigo);
  return new;
end
$fn$;

-- Resposta do WhatsApp deixa de mover negocio por trigger. O evento continua
-- sendo detectado pelo relogio e somente uma automacao publicada decide o efeito.
drop trigger if exists wa_msg_respondeu on public.wa_mensagens;
drop trigger if exists trg_f2_sara_tempo_real on public.wa_mensagens;

-- Dois crons faziam contato/varredura fora da Central. Desativacao reversivel.
do $cron$
declare r record;
begin
  for r in select jobid from cron.job
    where jobname in ('wa-varredura-continua','wa-agenda-do-corretor') and active
  loop
    perform cron.alter_job(r.jobid,active=>false);
  end loop;
end
$cron$;

comment on function public.f2_sara_registrar_classificacao(
  uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz
) is 'LEGADO: aplica classificacao diretamente. A Central usa f2_sara_registrar_sugestao + bloco apply-ai-analysis-action.';

revoke all on function public.f2_sara_registrar_classificacao(
  uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz
) from public,anon,authenticated;
revoke execute on function public.f2_sara_registrar_classificacao(
  uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz
) from service_role;

revoke execute on function public.wa_move_respondeu(bigint) from service_role;

-- Converte versoes ativas que ainda usavam o antigo "IA atualiza" em um mapa
-- visivel IA -> Acao. O historico publicado permanece imutavel: uma nova versao
-- e criada e publicada pelo mesmo mecanismo do construtor.
do $migrate_maps$
declare
  r record; b jsonb; v_blocks jsonb; v_map jsonb; v_apply_id text;
  v_old_next text; v_err_next text; v_x numeric; v_y numeric; v_validation jsonb;
  v_version integer;
begin
  for r in
    select a.id,a.nome,a.mapa
      from public.automacoes a
     where a.ativa is true and a.status='publicado'
       and not coalesce(a.arquivada,false)
       and exists(
         select 1 from jsonb_array_elements(a.mapa->'automation'->'blocks') x
          where x->>'type'='ai-agent'
            and coalesce(x#>>'{options,funcao}','')='atualizar_momento'
       )
       and not exists(
         select 1 from jsonb_array_elements(a.mapa->'automation'->'blocks') x,
           lateral jsonb_array_elements(coalesce(x#>'{options,actions}','[]'::jsonb)) ac
          where ac->>'name'='apply-ai-analysis-action'
       )
  loop
    v_blocks:='[]'::jsonb;
    for b in select value from jsonb_array_elements(r.mapa->'automation'->'blocks')
    loop
      if b->>'type'='ai-agent'
         and coalesce(b#>>'{options,funcao}','')='atualizar_momento' then
        v_apply_id:='ai_apply_'||substr(md5(r.id::text||':'||(b->>'id')),1,12);
        v_old_next:=coalesce(b#>>'{options,nextBlockId}','');
        v_err_next:=coalesce(b#>>'{options,errorNextBlockId}','');
        begin v_x:=coalesce((b#>>'{presentation,x}')::numeric,0)+420;
        exception when others then v_x:=420; end;
        begin v_y:=coalesce((b#>>'{presentation,y}')::numeric,0);
        exception when others then v_y:=0; end;
        b:=jsonb_set(b,'{options,funcao}',to_jsonb('analisar_atendimento'::text),true);
        b:=jsonb_set(b,'{options,nextBlockId}',to_jsonb(v_apply_id),true);
        v_blocks:=v_blocks||jsonb_build_array(b)||jsonb_build_array(
          jsonb_build_object(
            'id',v_apply_id,'type','action','sourceBlockId',gen_random_uuid()::text,
            'presentation',jsonb_build_object('x',v_x,'y',v_y),
            'options',jsonb_build_object(
              'actions',jsonb_build_array(jsonb_build_object(
                'name','apply-ai-analysis-action','group','lead','options',
                jsonb_build_object('aplicarMomento',true,'aplicarEtapa',true,
                  'aplicarAcao',true,'aplicarQualidade',true)
              )),
              'nextBlockId',v_old_next,'errorNextBlockId',v_err_next
            )
          )
        );
      else
        v_blocks:=v_blocks||jsonb_build_array(b);
      end if;
    end loop;
    v_map:=jsonb_set(r.mapa,'{automation,blocks}',v_blocks,false);
    -- O construtor reconstrói nós e fios a partir do contrato executável quando
    -- estes dois caches editoriais estão vazios.
    v_map:=jsonb_set(v_map,'{editor,blocks}','{}'::jsonb,true);
    v_map:=jsonb_set(v_map,'{editor,wires}','[]'::jsonb,true);
    v_validation:=public.automacao_validar_mapa(v_map);
    if coalesce((v_validation->>'ok')::boolean,false) is not true then
      raise exception 'nao foi possivel migrar a automacao %: %',r.id,v_validation;
    end if;
    select coalesce(max(versao),0)+1 into v_version
      from public.automacao_versoes where automacao_id=r.id;
    insert into public.automacao_versoes(
      automacao_id,versao,nome,mapa,observacao,criado_por
    ) values (
      r.id,v_version,r.nome,v_map,
      'Migracao: IA somente analisa; Acao explicita aplica o resultado',
      'construtor'
    );
  end loop;
end
$migrate_maps$;
