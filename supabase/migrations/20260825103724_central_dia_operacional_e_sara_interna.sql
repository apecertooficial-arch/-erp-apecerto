-- A regra de presenca passa a pertencer ao snapshot publicado de cada bloco.
-- Nao existe cron para trocar o periodo: o resultado e calculado com o horario
-- do proprio evento e com o comparecimento materializado pelo app de presenca.

begin;

set local lock_timeout='5s';
set local statement_timeout='120s';

create or replace function public.motor_periodo_distribuicao(
  p_regra jsonb,
  p_agora timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $fn$
declare
  v_timezone text:='America/Sao_Paulo';
  v_inicio time:=time '09:30';
  v_fim time:=time '18:30';
  v_local timestamp;
  v_dia date;
  v_dia_operacional date;
  v_modo text;
begin
  if coalesce(p_regra->>'timezone','')='America/Sao_Paulo' then
    v_timezone:=p_regra->>'timezone';
  end if;
  if coalesce(p_regra->>'inicio','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_inicio:=(p_regra->>'inicio')::time;
  end if;
  if coalesce(p_regra->>'fim','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_fim:=(p_regra->>'fim')::time;
  end if;
  v_modo:=case when p_regra->>'modo' in (
    'dia-operacional','presenca-atual','todos-configurados'
  ) then p_regra->>'modo' else 'presenca-atual' end;
  v_local:=p_agora at time zone v_timezone;
  v_dia:=v_local::date;
  v_dia_operacional:=case when v_local::time<v_inicio then v_dia-1 else v_dia end;
  return jsonb_build_object(
    'modo',v_modo,
    'timezone',v_timezone,
    'inicio',to_char(v_inicio,'HH24:MI'),
    'fim',to_char(v_fim,'HH24:MI'),
    'agora_local',v_local,
    'dia_local',v_dia,
    'dia_operacional',v_dia_operacional,
    'janela_oficial',v_local::time>=v_inicio and v_local::time<v_fim,
    'fim_de_semana',extract(isodow from v_dia) in (6,7),
    'dia_operacional_fim_de_semana',extract(isodow from v_dia_operacional) in (6,7)
  );
end
$fn$;

create or replace function public.motor_corretor_elegibilidade_bloco(
  p_corretor_id bigint,
  p_items jsonb,
  p_regra jsonb,
  p_agora timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $fn$
declare
  c public.corretores%rowtype;
  v_periodo jsonb:=public.motor_periodo_distribuicao(p_regra,p_agora);
  v_validade integer:=public.regra_presenca_validade_min();
  v_presente boolean:=false;
  v_grupo_com_presenca_atual boolean:=false;
  v_compareceu boolean:=false;
  v_suspenso_ate timestamptz;
  v_dia_operacional date;
  v_modo text;
begin
  select * into c from public.corretores where id=p_corretor_id;
  if c.id is null or coalesce(c.ativo,false) is not true then
    return jsonb_build_object('elegivel',false,'motivo','corretor_inativo');
  end if;
  if not exists(
    select 1 from public.instancias i
     where i.corretor_id=c.id and coalesce(i.ativa,true)
       and coalesce(i.conectada,false) and i.status_dapi='connected'
  ) then
    return jsonb_build_object('elegivel',false,'motivo','dapi_desconectada');
  end if;
  select max(s.fim_em) into v_suspenso_ate
    from public.ncrm_corretor_suspensao s
   where s.corretor_id=c.id and s.revogada_em is null
     and s.inicio_em<=p_agora and s.fim_em>p_agora;
  if v_suspenso_ate is not null then
    return jsonb_build_object('elegivel',false,'motivo','suspenso','ate',v_suspenso_ate);
  end if;

  v_modo:=v_periodo->>'modo';
  v_dia_operacional:=(v_periodo->>'dia_operacional')::date;
  v_presente:=coalesce(c.no_escritorio,false)
    and c.ultima_presenca is not null
    and c.ultima_presenca>p_agora-make_interval(mins=>v_validade);

  select exists(
    select 1
      from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) item
      join public.corretores cc
        on public.nome_normalizado(cc.nome)=public.nome_normalizado(item->>'corretor')
     where coalesce((item->>'on')::boolean,true)
       and coalesce(nullif(item->>'peso','')::numeric,0)>0
       and coalesce(cc.ativo,false)
       and coalesce(cc.no_escritorio,false)
       and cc.ultima_presenca is not null
       and cc.ultima_presenca>p_agora-make_interval(mins=>v_validade)
  ) into v_grupo_com_presenca_atual;

  if v_modo='todos-configurados' then
    return v_periodo||jsonb_build_object('elegivel',true,'motivo','todos_configurados');
  end if;
  if v_modo='presenca-atual' then
    return v_periodo||jsonb_build_object(
      'elegivel',v_presente,
      'motivo',case when v_presente then 'presenca_atual' else 'sem_presenca_atual' end
    );
  end if;

  -- Fim de semana real pertence ao rodizio externo; a madrugada de segunda
  -- ainda pertence ao dia operacional de domingo. Presenca atual antecipada
  -- tem prioridade antes dessa liberacao geral.
  if coalesce((v_periodo->>'fim_de_semana')::boolean,false) then
    return v_periodo||jsonb_build_object('elegivel',true,'motivo','fim_de_semana');
  end if;
  if coalesce((v_periodo->>'janela_oficial')::boolean,false) then
    return v_periodo||jsonb_build_object(
      'elegivel',v_presente,
      'motivo',case when v_presente then 'presenca_janela_oficial' else 'fora_do_escritorio' end
    );
  end if;
  if v_grupo_com_presenca_atual then
    return v_periodo||jsonb_build_object(
      'elegivel',v_presente,
      'grupo_com_presenca_atual',true,
      'motivo',case when v_presente then 'presenca_atual_prioritaria' else 'outro_corretor_permanece_presente' end
    );
  end if;
  if coalesce((v_periodo->>'dia_operacional_fim_de_semana')::boolean,false) then
    return v_periodo||jsonb_build_object('elegivel',true,'motivo','fim_de_semana_operacional');
  end if;

  select exists(
    select 1 from public.corretor_presencas cp
     where cp.corretor_id=c.id and cp.dia=v_dia_operacional
  ) into v_compareceu;
  return v_periodo||jsonb_build_object(
    'elegivel',v_compareceu,
    'grupo_com_presenca_atual',false,
    'motivo',case when v_compareceu then 'compareceu_no_dia_operacional' else 'nao_compareceu_no_dia_operacional' end
  );
end
$fn$;

create or replace function public.motor_corretor_pode_receber_bloco(
  p_corretor_id bigint,
  p_items jsonb,
  p_regra jsonb,
  p_agora timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path=''
as $fn$
  select coalesce((public.motor_corretor_elegibilidade_bloco(
    p_corretor_id,p_items,p_regra,p_agora
  )->>'elegivel')::boolean,false)
$fn$;

revoke all on function public.motor_periodo_distribuicao(jsonb,timestamptz) from public,anon;
revoke all on function public.motor_corretor_elegibilidade_bloco(bigint,jsonb,jsonb,timestamptz) from public,anon;
revoke all on function public.motor_corretor_pode_receber_bloco(bigint,jsonb,jsonb,timestamptz) from public,anon;
grant execute on function public.motor_periodo_distribuicao(jsonb,timestamptz) to authenticated,service_role;
grant execute on function public.motor_corretor_elegibilidade_bloco(bigint,jsonb,jsonb,timestamptz) to authenticated,service_role;
grant execute on function public.motor_corretor_pode_receber_bloco(bigint,jsonb,jsonb,timestamptz) to service_role;

-- Injeta a politica do bloco na roleta existente sem duplicar as regras de
-- atribuicao, protecao do dono e sincronizacao do Funil 2.0.
do $patch_roleta$
declare
  v_def text;
  v_ancora text:='(not v_exige or public.corretor_pode_receber(c.id))';
  v_n integer;
begin
  v_def:=pg_get_functiondef(
    'public.motor_roleta(bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb)'::regprocedure
  );
  v_n:=(length(v_def)-length(replace(v_def,v_ancora,'')))/length(v_ancora);
  if v_n<>3 or position('v_total numeric := 0;' in v_def)=0
     or position(E'begin\n  v_tel :=' in v_def)=0 then
    raise exception 'motor_roleta mudou; patch deterministico abortado (% ocorrencias)',v_n;
  end if;
  v_def:=replace(v_def,'v_total numeric := 0;',
    'v_total numeric := 0;'||E'\n  v_regra jsonb;');
  v_def:=replace(v_def,E'begin\n  v_tel :=',E'begin\n  select b#>''{options,distribuicao,regraElegibilidade}'' into v_regra\n    from jsonb_array_elements(public.automacao_mapa_executavel(\n      p_auto,case when coalesce(p_lead->>''__automacao_versao_id'','''') ~ ''^[0-9]+$''\n        then (p_lead->>''__automacao_versao_id'')::bigint else null end\n    )#>''{automation,blocks}'') b\n   where b->>''id''=p_bloco limit 1;\n  v_regra:=coalesce(v_regra,case when coalesce(p_online_only,true)\n    then ''{"modo":"presenca-atual"}''::jsonb\n    else ''{"modo":"todos-configurados"}''::jsonb end);\n  v_tel :=');
  v_def:=replace(v_def,v_ancora,
    '(not v_exige or public.motor_corretor_pode_receber_bloco(c.id,p_items,v_regra,now()))');
  execute v_def;
end
$patch_roleta$;

-- Indisponibilidade de corretor e estado de espera, nao falha terminal. Os
-- demais erros continuam limitados para nao criar loops sem progresso.
create or replace function public.motor_processar_fila()
returns integer
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r record; n integer:=0; claimed integer; v_ok boolean; v_erro text; v_delay integer;
begin
  for r in
    select id,automacao_id,automacao_versao_id,bloco_id,lead,tentativas
      from public.motor_fila
     where status='pendente' and due_at<=now()
     order by case when lead->>'__motor_priority' ~ '^[0-9]+$'
       then (lead->>'__motor_priority')::integer else 10 end,due_at,id
     limit 10 for update skip locked
  loop
    select a.ativa is true and a.status='publicado' and not coalesce(a.arquivada,false)
      into v_ok from public.automacoes a where a.id=r.automacao_id;
    if coalesce(v_ok,false) is not true then
      update public.motor_fila set status='cancelado',processado_em=now(),
        ultimo_erro='AUTOMATION_NOT_RUNNABLE' where id=r.id;
      continue;
    end if;
    update public.motor_fila set status='processando',tentativas=tentativas+1,
      ultimo_erro=null where id=r.id and status='pendente';
    get diagnostics claimed=row_count;
    if claimed=0 then continue; end if;
    begin
      perform public.motor_rodar(r.automacao_id,
        (r.lead-'__automacao_versao_id')||jsonb_build_object(
          '__automacao_versao_id',r.automacao_versao_id),
        nullif(r.bloco_id,'START'),case when r.bloco_id='START' then 0 else 1 end);
      update public.motor_fila set status='ok',processado_em=now(),ultimo_erro=null where id=r.id;
    exception when others then
      v_erro:=left(sqlstate||': '||sqlerrm,1000);
      if sqlerrm like 'AUTOMATION_RETRY: DISTRIBUTION_UNAVAILABLE%' then
        v_delay:=least(300,30+least(r.tentativas,9)*30);
        update public.motor_fila set status='pendente',
          due_at=now()+make_interval(secs=>v_delay),processado_em=null,
          ultimo_erro='WAITING_FOR_ELIGIBLE_BROKER: '||v_erro where id=r.id;
        if r.tentativas=0 or mod(r.tentativas+1,30)=0 then
          insert into public.motor_execucoes(
            automacao_id,automacao_nome,bloco_id,evento,status,
            lead_nome,lead_telefone,detalhe
          ) values(r.automacao_id,(select a.nome from public.automacoes a where a.id=r.automacao_id),
            r.bloco_id,'fila','alerta',r.lead->>'nome',r.lead->>'telefone',
            'Aguardando corretor elegivel; nova avaliacao em '||v_delay||'s');
        end if;
      elsif sqlerrm like 'AUTOMATION_RETRY:%' and r.tentativas<5 then
        v_delay:=least(900,(30*power(2,least(r.tentativas,5)))::integer);
        update public.motor_fila set status='pendente',
          due_at=now()+make_interval(secs=>v_delay),processado_em=null,
          ultimo_erro=v_erro where id=r.id;
      else
        update public.motor_fila set status='erro',processado_em=now(),
          ultimo_erro=v_erro where id=r.id;
        insert into public.motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values(r.automacao_id,(select a.nome from public.automacoes a where a.id=r.automacao_id),
          r.bloco_id,'fila','erro',r.lead->>'nome',r.lead->>'telefone',
          'Execucao encerrada sem presumir sucesso: '||left(v_erro,240));
      end if;
    end;
    n:=n+1;
  end loop;
  return n;
end
$fn$;

revoke all on function public.motor_processar_fila() from public,anon,authenticated;
grant execute on function public.motor_processar_fila() to service_role;

-- Miruna e Adelmo passam a carregar a regra no proprio mapa publicado.
do $publicar_regra$
declare
  r record;
  v_blocks jsonb;
  v_map jsonb;
  v_valid jsonb;
  v_version integer;
  v_version_id bigint;
  v_count integer:=0;
  v_regra jsonb:=jsonb_build_object(
    'modo','dia-operacional','timezone','America/Sao_Paulo',
    'inicio','09:30','fim','18:30','presencaAtualPrioritaria',true,
    'comparecimentoForaDoHorario',true,'fimDeSemana','todos-configurados'
  );
begin
  for r in select * from public.automacoes
    where nome in ('Entrada Adelmo','Entrada Miruna') for update
  loop
    v_count:=v_count+1;
    select jsonb_agg(case when b->>'type'='distribution-simple' then
      jsonb_set(jsonb_set(b,'{options,distribuicao,regraElegibilidade}',v_regra,true),
        '{options,distribuicao,onlineOnly}','true'::jsonb,true)
      else b end order by ord) into v_blocks
      from jsonb_array_elements(r.mapa#>'{automation,blocks}') with ordinality x(b,ord);
    if not exists(select 1 from jsonb_array_elements(v_blocks) b
      where b->>'type'='distribution-simple') then
      raise exception 'Automacao % nao possui distribuicao simples',r.nome;
    end if;
    v_map:=jsonb_set(r.mapa,'{automation,blocks}',v_blocks,true);
    v_valid:=public.automacao_validar_mapa(v_map);
    if coalesce((v_valid->>'ok')::boolean,false) is not true then
      raise exception 'AUTOMATION_INVALID: %: %',r.nome,v_valid->'erros';
    end if;
    select coalesce(max(versao),0)+1 into v_version
      from public.automacao_versoes where automacao_id=r.id;
    insert into public.automacao_versoes(
      automacao_id,versao,nome,mapa,observacao,criado_por
    ) values(r.id,v_version,r.nome,v_map,
      'Elegibilidade deterministica do dia operacional publicada no bloco',
      'migration:20260825103724') returning id into v_version_id;
    update public.automacoes set mapa=v_map,mapa_rascunho=v_map,
      versao_publicada_id=v_version_id,status='publicado',ativa=true,
      publicado_em=now(),atualizada_em=now() where id=r.id;
  end loop;
  if v_count<>2 then raise exception 'Esperadas 2 automacoes de entrada; encontradas %',v_count; end if;
end
$publicar_regra$;

-- Recupera somente falhas de distribuicao ocorridas hoje. O bloco volta a ser
-- executado na versao que acabou de ser publicada; nenhuma mensagem e presumida.
update public.motor_fila f
   set status='pendente',due_at=now(),processado_em=null,tentativas=0,
       ultimo_erro='WAITING_FOR_ELIGIBLE_BROKER: REQUEUED_AFTER_POLICY_PUBLICATION',
       automacao_versao_id=a.versao_publicada_id,
       lead=(f.lead-'__automacao_versao_id')||jsonb_build_object(
         '__automacao_versao_id',a.versao_publicada_id)
  from public.automacoes a
 where a.id=f.automacao_id and a.nome in ('Entrada Adelmo','Entrada Miruna')
   and f.status='erro'
   and coalesce(f.ultimo_erro,'') like '%DISTRIBUTION_UNAVAILABLE%'
   and f.criado_em>=timestamptz '2026-08-25 00:00:00-03';

commit;
