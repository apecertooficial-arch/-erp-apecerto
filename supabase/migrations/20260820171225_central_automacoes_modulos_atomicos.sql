-- Central de Automacoes — modulos atomicos e contratos sem leitura oculta.
--
-- 1. A IA processa exatamente o card pedido e usa o agente selecionado.
-- 2. A distribuicao usa exclusivamente items/onlineOnly do snapshot em execucao.
-- 3. Campo e Acao sao atomicos: erro reverte o bloco e usa a saida de erro.
-- 4. Falta temporaria de corretor/IA usa retry limitado e visivel na fila.

create or replace function public.f2_sara_candidato(p_funil_lead_id uuid)
returns table(
  funil_lead_id uuid, origem_negocio_id bigint, lead_id bigint, versao integer,
  etapa text, momento_codigo text, acao_codigo text, cadencia_passo smallint,
  corte_conversa_em timestamptz, historico_completo boolean,
  ultima_reavaliacao_sara_em timestamptz, ultima_mensagem_em timestamptz
)
language sql stable security definer set search_path to '' as $fn$
  select f.id,f.origem_negocio_id,n.lead_id,f.versao,f.etapa,f.momento_codigo,
         f.acao_codigo,f.cadencia_passo,f.corte_conversa_em,f.historico_completo,
         f.ultima_reavaliacao_sara_em,ult.ultima_mensagem_em
    from public.f2_lead f
    join public.negocios n on n.id=f.origem_negocio_id
    left join lateral (
      select max(coalesce(m.enviado_em,m.criado_em)) as ultima_mensagem_em
        from (
          select c.id from public.wa_contatos c where c.lead_id=n.lead_id
          union
          select h.contato_id from public.f2_historico_vinculo h
           where h.funil_lead_id=f.id
        ) contatos
        join public.wa_conversas v on v.contato_id=contatos.id
        join public.wa_mensagens m on m.conversa_id=v.id
       where f.historico_completo
          or coalesce(m.enviado_em,m.criado_em)>=f.corte_conversa_em
    ) ult on true
   where f.id=p_funil_lead_id
     and f.descartado_em is null
$fn$;

revoke all on function public.f2_sara_candidato(uuid)
  from public,anon,authenticated;
grant execute on function public.f2_sara_candidato(uuid) to service_role;

create or replace function public.motor_sincronizar_dono_f2(
  p_lead_id bigint,
  p_corretor_id bigint,
  p_origem text
) returns integer
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_nome text;
  r record;
  n integer:=0;
  changed integer;
begin
  if p_lead_id is null or p_corretor_id is null then
    raise exception 'sincronizacao de dono exige lead e corretor';
  end if;
  select c.nome into v_nome from public.corretores c
   where c.id=p_corretor_id and coalesce(c.ativo,true);
  if v_nome is null then raise exception 'corretor % invalido ou inativo',p_corretor_id; end if;

  for r in
    select f.id,f.versao,f.corretor_id,f.corretor_nome
      from public.f2_lead f
      join public.negocios ng on ng.id=f.origem_negocio_id
     where ng.lead_id=p_lead_id and f.descartado_em is null
       and (f.corretor_id is distinct from p_corretor_id
         or f.corretor_nome is distinct from v_nome)
     order by f.id
  loop
    perform pg_advisory_xact_lock(hashtext(r.id::text));
    update public.f2_lead
       set corretor_id=p_corretor_id,corretor_nome=v_nome,
           versao=versao+1,atualizado_em=now()
     where id=r.id and versao=r.versao;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'card % mudou durante sincronizacao',r.id; end if;
    insert into public.f2_evento(
      funil_lead_id,tipo,titulo,detalhe,payload
    ) values (
      r.id,'lead_distribuido',
      'Dono sincronizado: '||coalesce(r.corretor_nome,'sem dono')||' -> '||v_nome,
      'Lead, negocio e card alinhados pela Central de Automacoes',
      jsonb_build_object(
        'origem',coalesce(p_origem,'motor_automacao'),
        'corretor_anterior',r.corretor_id,'corretor_novo',p_corretor_id
      )
    );
    n:=n+1;
  end loop;
  return n;
end
$fn$;

revoke all on function public.motor_sincronizar_dono_f2(bigint,bigint,text)
  from public,anon,authenticated;
grant execute on function public.motor_sincronizar_dono_f2(bigint,bigint,text)
  to service_role;

create or replace function public.motor_roleta(
  p_auto bigint,
  p_nome text,
  p_bloco text,
  p_lead jsonb,
  p_lead_id bigint,
  p_neg_id bigint,
  p_items jsonb,
  p_online_only boolean,
  p_tambem_negocio boolean,
  p_protecao jsonb default '["venda","visita_agendada","visita_realizada"]'::jsonb
) returns bigint
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_tel text;
  v_bloco text := coalesce(p_bloco,'_');
  v_atual bigint;
  v_atual_nome text;
  v_proteger boolean := false;
  v_motivo text;
  v_escolhido bigint;
  v_escolhido_nome text;
  v_exige boolean := coalesce(p_online_only,true);
  v_marcados integer := 0;
  v_aptos integer := 0;
  v_total numeric := 0;
begin
  v_tel := regexp_replace(coalesce(p_lead->>'telefone',''),'[^0-9]','','g');
  perform pg_advisory_xact_lock(hashtext(coalesce(p_auto,0)::text||':'||v_bloco));

  if p_lead_id is null then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      p_auto,p_nome,p_bloco,'distribuicao','erro',p_lead->>'nome',v_tel,
      'Distribuir: lead ainda nao existe'
    );
    return null;
  end if;

  select l.corretor_id into v_atual
    from public.leads l where l.id=p_lead_id;
  if v_atual is not null and exists(
    select 1 from public.corretores c
     where c.id=v_atual and coalesce(c.ativo,true)
  ) then
    if coalesce(p_protecao,'[]'::jsonb) ? 'sempre' then
      v_proteger := true; v_motivo := 'protecao total ativada no bloco';
    end if;
    if not v_proteger and coalesce(p_protecao,'[]'::jsonb) ? 'venda'
       and exists(
         select 1 from public.negocios n where n.lead_id=p_lead_id
          and (n.venda_id is not null or lower(coalesce(n.status,''))='ganho')
       ) then
      v_proteger := true; v_motivo := 'venda em processo';
    end if;
    if not v_proteger and coalesce(p_protecao,'[]'::jsonb) ? 'visita_agendada'
       and exists(
         select 1 from public.visitas vi
          where (vi.lead_id=p_lead_id or vi.negocio_id in (
                   select id from public.negocios where lead_id=p_lead_id
                 ))
            and vi.status in ('agendada','confirmada')
       ) then
      v_proteger := true; v_motivo := 'visita agendada';
    end if;
    if not v_proteger and coalesce(p_protecao,'[]'::jsonb) ? 'visita_realizada'
       and exists(
         select 1 from public.visitas vi
          where (vi.lead_id=p_lead_id or vi.negocio_id in (
                   select id from public.negocios where lead_id=p_lead_id
                 ))
            and vi.status='realizada'
       ) then
      v_proteger := true; v_motivo := 'visita realizada';
    end if;

    if v_proteger then
      select c.nome into v_atual_nome from public.corretores c where c.id=v_atual;
      if p_tambem_negocio and p_neg_id is not null then
        update public.negocios set corretor_id=v_atual
         where id=p_neg_id and corretor_id is distinct from v_atual;
      end if;
      perform public.motor_sincronizar_dono_f2(
        p_lead_id,v_atual,'roleta_automacao_'||p_auto||'_protegido'
      );
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (
        p_auto,p_nome,p_bloco,'distribuicao','ok',p_lead->>'nome',v_tel,
        'Lead PROTEGIDO com '||coalesce(v_atual_nome,'#'||v_atual)||
        ' ('||v_motivo||') - sem redistribuicao'
      );
      return v_atual;
    end if;
  end if;

  -- O snapshot recebido e a unica fonte da lista e dos pesos deste bloco.
  with configurados as (
    select c.id corretor_id,
           max(coalesce(nullif(i->>'peso','')::numeric,0)) peso
      from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) i
      join public.corretores c
        on public.nome_normalizado(c.nome)=public.nome_normalizado(i->>'corretor')
     where coalesce((i->>'on')::boolean,true)
       and coalesce(nullif(i->>'peso','')::numeric,0)>0
       and coalesce(c.ativo,true)
     group by c.id
  )
  select count(*) into v_marcados from configurados;

  update public.motor_roleta_contadores rc set peso=0
   where rc.automacao_id=p_auto and rc.bloco_id=v_bloco
     and coalesce(rc.peso,0)>0
     and not exists (
       select 1
         from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) i
         join public.corretores c
           on public.nome_normalizado(c.nome)=public.nome_normalizado(i->>'corretor')
        where c.id=rc.corretor_id
          and coalesce((i->>'on')::boolean,true)
          and coalesce(nullif(i->>'peso','')::numeric,0)>0
          and coalesce(c.ativo,true)
     );

  insert into public.motor_roleta_contadores(
    automacao_id,bloco_id,corretor_id,peso
  )
  select p_auto,v_bloco,c.id,
         max(coalesce(nullif(i->>'peso','')::numeric,0))
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) i
    join public.corretores c
      on public.nome_normalizado(c.nome)=public.nome_normalizado(i->>'corretor')
   where coalesce((i->>'on')::boolean,true)
     and coalesce(nullif(i->>'peso','')::numeric,0)>0
     and coalesce(c.ativo,true)
   group by c.id
  on conflict (automacao_id,bloco_id,corretor_id)
  do update set peso=excluded.peso;

  if v_marcados=0 then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      p_auto,p_nome,p_bloco,'distribuicao','erro',p_lead->>'nome',v_tel,
      'Distribuir: nenhum corretor ativo foi resolvido da lista publicada'
    );
    return null;
  end if;

  select count(*),coalesce(sum(rc.peso),0)
    into v_aptos,v_total
    from public.motor_roleta_contadores rc
    join public.corretores c on c.id=rc.corretor_id
   where rc.automacao_id=p_auto and rc.bloco_id=v_bloco
     and coalesce(rc.peso,0)>0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id));

  if v_aptos=0 or v_total<=0 then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      p_auto,p_nome,p_bloco,'distribuicao','alerta',p_lead->>'nome',v_tel,
      case when v_exige
        then 'Distribuir: nenhum dos '||v_marcados||' configurados esta elegivel agora'
        else 'Distribuir: nenhum corretor ativo entre os '||v_marcados||' configurados'
      end
    );
    return null;
  end if;

  update public.motor_roleta_contadores rc
     set credito=rc.credito+rc.peso
    from public.corretores c
   where c.id=rc.corretor_id
     and rc.automacao_id=p_auto and rc.bloco_id=v_bloco
     and coalesce(rc.peso,0)>0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id));

  select rc.corretor_id into v_escolhido
    from public.motor_roleta_contadores rc
    join public.corretores c on c.id=rc.corretor_id
   where rc.automacao_id=p_auto and rc.bloco_id=v_bloco
     and coalesce(rc.peso,0)>0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id))
   order by rc.credito desc,rc.recebidos asc,rc.corretor_id
   limit 1;

  if v_escolhido is null then return null; end if;

  update public.motor_roleta_contadores
     set credito=credito-v_total,recebidos=recebidos+1,atualizado_em=now()
   where automacao_id=p_auto and bloco_id=v_bloco
     and corretor_id=v_escolhido;

  select nome into v_escolhido_nome
    from public.corretores where id=v_escolhido;
  update public.leads set corretor_id=v_escolhido where id=p_lead_id;
  if p_tambem_negocio and p_neg_id is not null then
    update public.negocios set corretor_id=v_escolhido where id=p_neg_id;
  end if;
  perform public.motor_sincronizar_dono_f2(
    p_lead_id,v_escolhido,'roleta_automacao_'||p_auto
  );
  insert into public.lead_dono_auditoria(lead_id,de,para,origem,quando)
  values(p_lead_id,v_atual,v_escolhido,'roleta_automacao_'||p_auto,now());
  insert into public.motor_execucoes(
    automacao_id,automacao_nome,bloco_id,evento,status,
    lead_nome,lead_telefone,detalhe
  ) values (
    p_auto,p_nome,p_bloco,'distribuicao','ok',p_lead->>'nome',v_tel,
    'Lead distribuido para '||coalesce(v_escolhido_nome,'#'||v_escolhido)||
    ' (pesos do snapshot · '||v_marcados||' configurados · '||v_aptos||' elegiveis)'
  );
  return v_escolhido;
exception when others then
  insert into public.motor_execucoes(
    automacao_id,automacao_nome,bloco_id,evento,status,
    lead_nome,lead_telefone,detalhe
  ) values (
    p_auto,p_nome,p_bloco,'distribuicao','erro',p_lead->>'nome',v_tel,
    'Erro na distribuicao: '||left(sqlerrm,120)
  );
  return null;
end
$fn$;

revoke all on function public.motor_roleta(
  bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb
) from public,anon,authenticated;
grant execute on function public.motor_roleta(
  bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb
) to service_role;

-- Repara apenas divergencias em que lead e negocio ja concordam. Se essas duas
-- fontes canonicas divergirem, a migracao para em vez de escolher um dono.
do $repair$
declare r record;
begin
  if exists(
    select 1 from public.f2_lead f
    join public.negocios n on n.id=f.origem_negocio_id
    join public.leads l on l.id=n.lead_id
    where f.descartado_em is null
      and n.corretor_id is distinct from l.corretor_id
  ) then
    raise exception 'lead e negocio divergem; reparo de dono exige decisao humana';
  end if;
  for r in
    select distinct l.id lead_id,l.corretor_id
      from public.f2_lead f
      join public.negocios n on n.id=f.origem_negocio_id
      join public.leads l on l.id=n.lead_id
     where f.descartado_em is null and l.corretor_id is not null
       and f.corretor_id is distinct from l.corretor_id
  loop
    perform public.motor_sincronizar_dono_f2(
      r.lead_id,r.corretor_id,'migracao_correcao_dono_f2'
    );
  end loop;
end
$repair$;

create or replace function public.motor_agente(
  p_auto bigint,
  p_nome text,
  p_bloco text,
  p_lead jsonb,
  p_lead_id bigint,
  p_agente_id bigint,
  p_funcao text
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $fn$
declare
  v_ag record;
  v_card uuid;
  v_tel text;
  v_http_status integer;
  v_http_body text;
  v_res jsonb;
  v_item jsonb;
  v_momento text;
  v_status text;
  v_log_status text;
begin
  v_tel := regexp_replace(coalesce(p_lead->>'telefone',''),'\D','','g');
  select a.id,a.nome,a.slug,coalesce(a.ativo,false) ativo
    into v_ag from public.agentes_ia a where a.id=p_agente_id;
  if v_ag.id is null then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      p_auto,p_nome,p_bloco,'agente','erro',p_lead->>'nome',v_tel,
      'Agente nao encontrado (id '||coalesce(p_agente_id::text,'vazio')||')'
    );
    return jsonb_build_object('ok',false,'erro','agente_nao_encontrado');
  end if;
  if not v_ag.ativo then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      p_auto,p_nome,p_bloco,'agente','erro',p_lead->>'nome',v_tel,
      'Agente "'||v_ag.nome||'" esta desligado'
    );
    return jsonb_build_object('ok',false,'erro','agente_desligado');
  end if;

  select f.id into v_card
    from public.f2_lead f
    join public.negocios n on n.id=f.origem_negocio_id
   where n.lead_id=p_lead_id and f.descartado_em is null
   order by f.criado_em desc limit 1;
  if v_card is null then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      p_auto,p_nome,p_bloco,'agente','erro',p_lead->>'nome',v_tel,
      'Lead ainda nao esta no Funil 2.0'
    );
    return jsonb_build_object('ok',false,'erro','lead_fora_do_funil');
  end if;

  if p_funcao<>'atualizar_momento' then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      p_auto,p_nome,p_bloco,'agente','erro',p_lead->>'nome',v_tel,
      'Funcao "'||coalesce(nullif(p_funcao,''),'(vazia)')||'" nao implementada'
    );
    return jsonb_build_object('ok',false,'erro','funcao_desconhecida');
  end if;

  begin perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','28000');
  exception when others then null; end;
  begin
    select h.status,left(h.content,4000)
      into v_http_status,v_http_body
      from extensions.http((
        'POST',
        'https://diaegvfveqezispcthwk.supabase.co/functions/v1/f2-sara-reclassificar',
        array[extensions.http_header(
          'x-cron-secret',
          (select decrypted_secret from vault.decrypted_secrets
            where name='ncrm_sara_cron_secret')
        )],
        'application/json',
        jsonb_build_object(
          'funil_lead_id',v_card,
          'agente_slug',v_ag.slug
        )::text
      )::extensions.http_request) h;
  exception when others then
    v_http_status := null;
    v_http_body := 'falha_http: '||left(coalesce(sqlerrm,''),160);
  end;

  begin v_res := v_http_body::jsonb;
  exception when others then v_res := null; end;
  v_item := v_res#>'{resultados,0}';
  v_momento := v_item->>'momento_codigo';
  v_status := coalesce(v_item->>'status','concluida');

  if coalesce(v_http_status,0)=200
     and coalesce((v_res->>'ok')::boolean,false)
     and coalesce((v_res->>'erros')::integer,0)=0
     and v_item->>'id'=v_card::text
     and v_res->>'agente_slug'=v_ag.slug then
    v_log_status := case when v_status in ('aplicada','mantida') then 'ok' else 'alerta' end;
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,
      lead_nome,lead_telefone,detalhe
    ) values (
      p_auto,p_nome,p_bloco,'agente',v_log_status,p_lead->>'nome',v_tel,
      'Agente "'||v_ag.nome||'" processou o card exato · momento: '||
      coalesce(v_momento,'(sem mudanca)')||' ['||v_status||']'
    );
    return jsonb_build_object(
      'ok',true,'card',v_card,'agente',v_ag.nome,'agente_slug',v_ag.slug,
      'momento',v_momento,'status',v_status,
      'aplicado',v_status in ('aplicada','mantida')
    );
  end if;

  insert into public.motor_execucoes(
    automacao_id,automacao_nome,bloco_id,evento,status,
    lead_nome,lead_telefone,detalhe
  ) values (
    p_auto,p_nome,p_bloco,'agente','erro',p_lead->>'nome',v_tel,
    'IA nao concluiu o card exato (HTTP '||coalesce(v_http_status::text,'-')||'): '||
    left(coalesce(v_http_body,''),160)
  );
  return jsonb_build_object(
    'ok',false,'erro','ia_indisponivel','http',v_http_status,'card',v_card
  );
end
$fn$;

revoke all on function public.motor_agente(bigint,text,text,jsonb,bigint,bigint,text)
  from public,anon,authenticated;
grant execute on function public.motor_agente(bigint,text,text,jsonb,bigint,bigint,text)
  to service_role;

-- Patch cirurgico do executor legado. O checksum impede aplicar sobre corpo
-- desconhecido e transformar divergencia em comportamento silencioso.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_rodar_unchecked'
     and pg_get_function_identity_arguments(p.oid)=
       'p_auto_id bigint, p_lead jsonb, p_start_block text, p_depth integer';
  if v_def is null then raise exception 'motor_rodar_unchecked ausente'; end if;
  if md5(v_def)<>'c2a25807a0f705c8d07036bde40b483c' then
    raise exception 'motor_rodar_unchecked divergiu: %',md5(v_def);
  end if;

  v_new := replace(v_def,
    $old$  _send_started timestamptz; _send_ok boolean; _send_gate jsonb; _mapa_exec jsonb;$old$,
    $new$  _send_started timestamptz; _send_ok boolean; _send_gate jsonb; _mapa_exec jsonb;
  _module_log_id bigint; _module_failed boolean; _module_error text;$new$);

  v_new := replace(v_new,
    $old$    elsif tipo='field-operation' then
      v_lead_id := motor_campos(p_auto_id, a_nome, cur, p_lead, coalesce(b#>'{options,fieldOperations}', b#>'{options,mapeamento}','[]'::jsonb), v_lead_id, v_negocio_id);
      trace:=trace||E'>> Operacoes de campos\n'; cur:=b#>>'{options,nextBlockId}';
$old$,
    $new$    elsif tipo='field-operation' then
      perform pg_advisory_xact_lock(hashtext('module:'||p_auto_id::text||':'||cur));
      select coalesce(max(id),0) into _module_log_id from motor_execucoes;
      begin
        v_lead_id := motor_campos(p_auto_id,a_nome,cur,p_lead,
          coalesce(b#>'{options,fieldOperations}',b#>'{options,mapeamento}','[]'::jsonb),
          v_lead_id,v_negocio_id);
        select exists(
          select 1 from motor_execucoes me
           where me.automacao_id=p_auto_id and me.bloco_id=cur
             and me.evento='acao' and me.status in ('erro','alerta')
             and me.id>_module_log_id
        ) into _module_failed;
        if _module_failed then raise exception 'mapeamento registrou erro'; end if;
      exception when others then
        _module_error := sqlerrm;
        insert into motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values (
          p_auto_id,a_nome,cur,'campo','erro',p_lead->>'nome',v_tel,
          'Operacoes de campos revertidas: '||left(_module_error,140)
        );
        trace:=trace||E'>> Operacoes de campos falharam\n';
        cur:=nullif(b#>>'{options,errorNextBlockId}','');
        if cur is null then
          raise exception using errcode='P0001',
            message='AUTOMATION_MODULE_FAILED: field-operation';
        end if;
        continue;
      end;
      trace:=trace||E'>> Operacoes de campos\n'; cur:=b#>>'{options,nextBlockId}';
$new$);

  v_new := replace(v_new,
    $old$    elsif tipo='distribution-simple' then
      -- Funil 2.0: distribui e PARA. Sem abordagem automatica, sem reter o
      -- lead esperando resposta. Quem manda a mensagem e o corretor, pelo
      -- celular, e a evidencia e o D-API. tambemNegocio e forcado TRUE:
      -- negocio sem corretor nao entra no Funil 2.0.
      select motor_roleta(p_auto_id, a_nome, cur, p_lead, v_lead_id, v_negocio_id,
        coalesce(b#>'{options,distribuicao,items}','[]'::jsonb),
        coalesce((b#>>'{options,distribuicao,onlineOnly}')::boolean, true),
        true,
        coalesce(b#>'{options,distribuicao,protecao}', '["venda","visita_agendada","visita_realizada"]'::jsonb)) into _dist_cor;
      if _dist_cor is null then
        trace:=trace||E'>> Distribuicao simples (ninguem disponivel)\n';
        cur:=b#>>'{options,errorNextBlockId}';
      else
        trace:=trace||E'>> Distribuicao simples\n';
        cur:=b#>>'{options,nextBlockId}';
      end if;
$old$,
    $new$    elsif tipo='distribution-simple' then
      perform pg_advisory_xact_lock(hashtext('module:'||p_auto_id::text||':'||cur));
      select coalesce(max(id),0) into _module_log_id from motor_execucoes;
      select motor_roleta(p_auto_id,a_nome,cur,p_lead,v_lead_id,v_negocio_id,
        coalesce(b#>'{options,distribuicao,items}','[]'::jsonb),
        coalesce((b#>>'{options,distribuicao,onlineOnly}')::boolean,true),
        true,
        coalesce(b#>'{options,distribuicao,protecao}',
          '["venda","visita_agendada","visita_realizada"]'::jsonb)
      ) into _dist_cor;
      if _dist_cor is null then
        select exists(
          select 1 from motor_execucoes me
           where me.automacao_id=p_auto_id and me.bloco_id=cur
             and me.evento='distribuicao' and me.status='erro'
             and me.id>_module_log_id
        ) into _module_failed;
        trace:=trace||E'>> Distribuicao simples sem elegivel\n';
        cur:=nullif(b#>>'{options,errorNextBlockId}','');
        if cur is null then
          if _module_failed then
            raise exception using errcode='P0001',
              message='AUTOMATION_MODULE_FAILED: distribution-simple';
          end if;
          raise exception using errcode='P0001',
            message='AUTOMATION_RETRY: DISTRIBUTION_UNAVAILABLE';
        end if;
        continue;
      end if;
      trace:=trace||E'>> Distribuicao simples\n';
      cur:=b#>>'{options,nextBlockId}';
$new$);

  v_new := replace(v_new,
    $old$    elsif tipo='action' then
      _res := motor_acoes(p_auto_id, a_nome, cur, p_lead, coalesce(b#>'{options,actions}','[]'::jsonb), v_lead_id, v_negocio_id, p_depth);
      v_lead_id := nullif(_res->>'lead_id','')::bigint; v_negocio_id := nullif(_res->>'negocio_id','')::bigint;
      trace:=trace||E'>> Acoes\n'; cur:=b#>>'{options,nextBlockId}';
$old$,
    $new$    elsif tipo='action' then
      perform pg_advisory_xact_lock(hashtext('module:'||p_auto_id::text||':'||cur));
      select coalesce(max(id),0) into _module_log_id from motor_execucoes;
      begin
        _res := motor_acoes(p_auto_id,a_nome,cur,p_lead,
          coalesce(b#>'{options,actions}','[]'::jsonb),
          v_lead_id,v_negocio_id,p_depth);
        select exists(
          select 1 from motor_execucoes me
           where me.automacao_id=p_auto_id and me.bloco_id=cur
             and me.evento='acao'
             and (
               me.status='erro'
               or (
                 me.status='alerta'
                 and me.detalhe not like 'Lead ja existia #%'
                 and me.detalhe not like 'Negocio ja existia #%reutilizado%'
                 and me.detalhe not like 'Tag ja existia:%'
               )
             )
             and me.id>_module_log_id
        ) into _module_failed;
        if _module_failed then
          raise exception 'acao nao concluiu exatamente o que foi configurado';
        end if;
        v_lead_id:=nullif(_res->>'lead_id','')::bigint;
        v_negocio_id:=nullif(_res->>'negocio_id','')::bigint;
      exception when others then
        _module_error:=sqlerrm;
        insert into motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values (
          p_auto_id,a_nome,cur,'acao','erro',p_lead->>'nome',v_tel,
          'Bloco de acoes revertido: '||left(_module_error,140)
        );
        trace:=trace||E'>> Acoes falharam\n';
        cur:=nullif(b#>>'{options,errorNextBlockId}','');
        if cur is null then
          raise exception using errcode='P0001',
            message='AUTOMATION_MODULE_FAILED: action';
        end if;
        continue;
      end;
      trace:=trace||E'>> Acoes\n'; cur:=b#>>'{options,nextBlockId}';
$new$);

  v_new := replace(v_new,
    $old$    elsif tipo='ai-agent' then
      _res := motor_agente(p_auto_id, a_nome, cur, p_lead, v_lead_id,
                nullif(b#>>'{options,agenteId}','')::bigint,
                coalesce(b#>>'{options,funcao}',''));
      trace:=trace||'>> Agente'||chr(10); cur:=b#>>'{options,nextBlockId}';
$old$,
    $new$    elsif tipo='ai-agent' then
      _res:=motor_agente(p_auto_id,a_nome,cur,p_lead,v_lead_id,
        nullif(b#>>'{options,agenteId}','')::bigint,
        coalesce(b#>>'{options,funcao}',''));
      if coalesce((_res->>'ok')::boolean,false) is not true then
        trace:=trace||'>> Agente falhou'||chr(10);
        cur:=nullif(b#>>'{options,errorNextBlockId}','');
        if cur is null then
          if _res->>'erro'='ia_indisponivel' then
            raise exception using errcode='P0001',
              message='AUTOMATION_RETRY: AI_UNAVAILABLE';
          end if;
          raise exception using errcode='P0001',
            message='AUTOMATION_MODULE_FAILED: ai-agent:'||coalesce(_res->>'erro','erro');
        end if;
        continue;
      end if;
      trace:=trace||'>> Agente'||chr(10); cur:=b#>>'{options,nextBlockId}';
$new$);

  -- O randomizador continua sorteando porque esse e o contrato do modulo,
  -- mas a mesma execucao sempre toma o mesmo ramo em retry/reentrada.
  v_new:=replace(v_new,
    $old$        v_pick := random()*v_total; v_acc := 0; cur := null;$old$,
    $new$        v_pick := (
          (
            hashtextextended(
              p_auto_id::text||':'||cur||':'||
              coalesce(p_lead->>'__motor_execution_id',p_lead::text),0
            ) & 9223372036854775807
          )::numeric / 9223372036854775808::numeric
        )*v_total;
        v_acc := 0; cur := null;$new$);

  v_new := replace(v_new,
    $old$    else
      cur:=b#>>'{options,nextBlockId}';
    end if;
  end loop;
  return trace||E'-- fim --';
$old$,
    $new$    else
      raise exception using errcode='P0001',
        message='AUTOMATION_UNSUPPORTED_BLOCK: '||coalesce(tipo,'NULL');
    end if;
  end loop;
  if guarda>=200 and coalesce(cur,'')<>'' then
    raise exception using errcode='P0001',message='AUTOMATION_LOOP_LIMIT';
  end if;
  if coalesce(cur,'')<>'' then
    raise exception using errcode='P0001',message='AUTOMATION_BROKEN_ROUTE: '||cur;
  end if;
  return trace||E'-- fim --';
$new$);

  if v_new=v_def
     or position('AUTOMATION_RETRY: DISTRIBUTION_UNAVAILABLE' in v_new)=0
     or position('AUTOMATION_MODULE_FAILED: distribution-simple' in v_new)=0
     or position('AUTOMATION_MODULE_FAILED: field-operation' in v_new)=0
     or position('AUTOMATION_MODULE_FAILED: action' in v_new)=0
     or position('AUTOMATION_MODULE_FAILED: ai-agent:' in v_new)=0
     or position('__motor_execution_id' in v_new)=0
     or position('AUTOMATION_LOOP_LIMIT' in v_new)=0 then
    raise exception 'patch atomico do motor nao encontrou todas as ancoras';
  end if;
  execute v_new;
end
$migration$;

-- Toda fila recebe uma identidade interna estavel. Esperas e retries carregam
-- essa identidade, permitindo decisoes reproduziveis no mesmo evento.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_enfileirar'
     and pg_get_function_identity_arguments(p.oid)='p_auto_id bigint, p_lead jsonb';
  if v_def is null then raise exception 'motor_enfileirar ausente'; end if;
  if md5(v_def)<>'0887ac34fe51d7cdcaa71037dc8fdb77' then
    raise exception 'motor_enfileirar divergiu: %',md5(v_def);
  end if;
  v_new:=replace(v_def,
    $old$  returning id into v_id;
  return v_id;$old$,
    $new$  returning id into v_id;
  update public.motor_fila
     set lead=lead||jsonb_build_object('__motor_execution_id',v_id)
   where id=v_id;
  return v_id;$new$);
  if v_new=v_def or position('__motor_execution_id' in v_new)=0 then
    raise exception 'patch de identidade da fila nao encontrou ancora';
  end if;
  execute v_new;
end
$migration$;

-- Acoes de estado nao podem registrar sucesso quando o objeto-alvo nao existe.
-- O patch tambem impede chamar automacao desligada e limpa o motivo ao restaurar.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_acoes'
     and pg_get_function_identity_arguments(p.oid)=
       'p_auto bigint, p_nome text, p_bloco text, p_lead jsonb, p_actions jsonb, p_lead_id bigint, p_neg_id bigint, p_depth integer';
  if v_def is null then raise exception 'motor_acoes ausente'; end if;
  if md5(v_def)<>'ba46b5cffec9d9f9b7613fcd830f15e3' then
    raise exception 'motor_acoes divergiu: %',md5(v_def);
  end if;

  v_new:=replace(v_def,
    $old$    if act_name='f2-add-action' then$old$,
    $new$    if act_name=any(array[
          'business-win-action','business-lose-action','business-restore-action',
          'add-attendant-on-business-action','clean-attendant-on-business-action'
        ]) and v_negocio_id is null then
      insert into motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (
        p_auto,p_nome,p_bloco,'acao','erro',p_lead->>'nome',v_tel,
        'Acao '||act_name||': negocio inexistente'
      );
      continue;
    elsif act_name=any(array[
          'assign-lead-attendant-action','clean-lead-attendant-action',
          'add-tag-action','create-tags-action','remove-tag-action',
          'set-lead-momento-action'
        ]) and v_lead_id is null then
      insert into motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (
        p_auto,p_nome,p_bloco,'acao','erro',p_lead->>'nome',v_tel,
        'Acao '||act_name||': lead inexistente'
      );
      continue;
    end if;

    if act_name='f2-add-action' then$new$);

  v_new:=replace(v_new,
    $old$motivo_perda = case when act_name='business-lose-action' then nullif(ao->>'motivo','') else motivo_perda end,$old$,
    $new$motivo_perda = case when act_name='business-lose-action' then nullif(ao->>'motivo','') else null end,$new$);

  v_new:=replace(v_new,
    $old$select id into v_target from automacoes where nome = ao->>'automacao' limit 1;$old$,
    $new$select id into v_target from automacoes where nome=ao->>'automacao' and ativo is true limit 1;$new$);

  v_new:=replace(v_new,
    $old$          values(p_auto,p_nome,p_bloco,'acao','alerta',p_lead->>'nome',v_tel,
            'Aviso NAO chegou: o tipo "'||coalesce(nullif(ao->>'tipo',''),'automacao')||
            '" nao esta na lista de tipos ativos de notificacao');$old$,
    $new$          values(p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',v_tel,
            'Aviso ja existia (idempotencia): '||left(v_titulo,80));$new$);

  if v_new=v_def
     or position('negocio inexistente' in v_new)=0
     or position('and ativo is true' in v_new)=0
     or position('else null end' in v_new)=0
     or position('Aviso ja existia (idempotencia)' in v_new)=0 then
    raise exception 'patch atomico de motor_acoes nao encontrou todas as ancoras';
  end if;
  execute v_new;
end
$migration$;

-- Condicoes estritas: opcao inexistente, valor invalido ou condicao desconhecida
-- sao erro de configuracao. Nunca viram "verdadeiro" por conveniencia.
do $migration$
declare
  v_def text;
  v_new text;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null then
    if to_regprocedure('public.motor_cond(text,jsonb,jsonb,bigint,bigint)') is null then
      raise exception 'motor_cond ausente no baseline';
    end if;
    return;
  end if;
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_cond'
     and pg_get_function_identity_arguments(p.oid)=
       'p_name text, p_opt jsonb, p_lead jsonb, p_lead_id bigint, p_neg_id bigint';
  if v_def is null then raise exception 'motor_cond ausente'; end if;
  if md5(v_def)<>'7c2e0f64c451f8a18936b8f3446e9e49' then
    raise exception 'motor_cond divergiu: %',md5(v_def);
  end if;

  v_new:=replace(v_def,
    $old$      return p_lead_id is not null and (_tag='' or exists(select 1 from leads l, jsonb_array_elements(case when jsonb_typeof(l.tags)='array' then l.tags else '[]'::jsonb end) e where l.id=p_lead_id and lower(e->>'name')=_tag));$old$,
    $new$      if _tag='' then raise exception 'lead-has-tag sem tag'; end if;
      return p_lead_id is not null and exists(select 1 from leads l, jsonb_array_elements(case when jsonb_typeof(l.tags)='array' then l.tags else '[]'::jsonb end) e where l.id=p_lead_id and lower(e->>'name')=_tag);$new$);

  v_new:=replace(v_new,
    $old$      return p_lead_id is not null and exists(select 1 from negocios where lead_id=p_lead_id and (_pipe is null or pipeline_id=_pipe));$old$,
    $new$      if _pipe is null then raise exception 'pipeline configurada nao existe'; end if;
      return p_lead_id is not null and exists(select 1 from negocios where lead_id=p_lead_id and pipeline_id=_pipe);$new$);

  v_new:=replace(v_new,
    $old$      return p_lead_id is not null and exists(select 1 from negocios where lead_id=p_lead_id and (_stage is null or stage_id=_stage));$old$,
    $new$      if _stage is null then raise exception 'etapa configurada nao existe'; end if;
      return p_lead_id is not null and exists(select 1 from negocios where lead_id=p_lead_id and stage_id=_stage);$new$);

  v_new:=replace(v_new,
    $old$    else return true;
  end case;
exception when others then return true;
end$old$,
    $new$    else raise exception 'condicao nao implementada: %',coalesce(_n,'NULL');
  end case;
end$new$);

  if v_new=v_def
     or position('lead-has-tag sem tag' in v_new)=0
     or position('pipeline configurada nao existe' in v_new)=0
     or position('condicao nao implementada' in v_new)=0
     or position('exception when others then return true' in v_new)>0 then
    raise exception 'patch estrito de motor_cond nao encontrou todas as ancoras';
  end if;
  execute v_new;
end
$migration$;

revoke all on function public.motor_rodar_unchecked(bigint,jsonb,text,integer)
  from public,anon,authenticated;
grant execute on function public.motor_rodar_unchecked(bigint,jsonb,text,integer)
  to service_role;

create or replace function public.motor_processar_fila()
returns integer
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r record;
  n integer:=0;
  claimed integer;
  v_ok boolean;
  v_erro text;
  v_delay integer;
begin
  for r in
    select id,automacao_id,automacao_versao_id,bloco_id,lead,tentativas
      from public.motor_fila
     where status='pendente' and due_at<=now()
     order by due_at,id limit 50
     for update skip locked
  loop
    select a.ativa is true and a.status='publicado'
           and not coalesce(a.arquivada,false)
      into v_ok from public.automacoes a where a.id=r.automacao_id;
    if coalesce(v_ok,false) is not true then
      update public.motor_fila
         set status='cancelado',processado_em=now(),ultimo_erro='AUTOMATION_NOT_RUNNABLE'
       where id=r.id;
      continue;
    end if;

    update public.motor_fila
       set status='processando',tentativas=tentativas+1,ultimo_erro=null
     where id=r.id and status='pendente';
    get diagnostics claimed=row_count;
    if claimed=0 then continue; end if;

    begin
      perform public.motor_rodar(
        r.automacao_id,
        (r.lead-'__automacao_versao_id')||
          jsonb_build_object('__automacao_versao_id',r.automacao_versao_id),
        nullif(r.bloco_id,'START'),
        case when r.bloco_id='START' then 0 else 1 end
      );
      update public.motor_fila
         set status='ok',processado_em=now(),ultimo_erro=null
       where id=r.id;
    exception when others then
      v_erro:=left(sqlstate||': '||sqlerrm,1000);
      if sqlerrm like 'AUTOMATION_RETRY:%' and r.tentativas<5 then
        v_delay:=least(900,(30*power(2,least(r.tentativas,5)))::integer);
        update public.motor_fila
           set status='pendente',due_at=now()+make_interval(secs=>v_delay),
               processado_em=null,ultimo_erro=v_erro
         where id=r.id;
        insert into public.motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values (
          r.automacao_id,
          (select a.nome from public.automacoes a where a.id=r.automacao_id),
          r.bloco_id,'fila','alerta',r.lead->>'nome',r.lead->>'telefone',
          'Retry '||(r.tentativas+1)||'/5 em '||v_delay||'s: '||left(v_erro,180)
        );
      else
        update public.motor_fila
           set status='erro',processado_em=now(),ultimo_erro=v_erro
         where id=r.id;
        insert into public.motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values (
          r.automacao_id,
          (select a.nome from public.automacoes a where a.id=r.automacao_id),
          r.bloco_id,'fila','erro',r.lead->>'nome',r.lead->>'telefone',
          'Execucao encerrada sem presumir sucesso: '||left(v_erro,240)
        );
      end if;
    end;
    n:=n+1;
  end loop;
  return n;
end
$fn$;

revoke all on function public.motor_processar_fila()
  from public,anon,authenticated;
grant execute on function public.motor_processar_fila() to service_role;

-- Pecas internas nunca sao uma API publica. Sem isso, um usuario autenticado
-- consegue chamar Acao/Campo diretamente e contornar o mapa publicado.
revoke all on function public.motor_acoes(bigint,text,text,jsonb,jsonb,bigint,bigint,integer)
  from public,anon,authenticated;
revoke all on function public.motor_campo_valor(text,jsonb,bigint,bigint)
  from public,anon,authenticated;
revoke all on function public.motor_campos(bigint,text,text,jsonb,jsonb,bigint,bigint)
  from public,anon,authenticated;
revoke all on function public.motor_cond(text,jsonb,jsonb,bigint,bigint)
  from public,anon,authenticated;
revoke all on function public.motor_fila_fixar_versao()
  from public,anon,authenticated;
revoke all on function public.motor_momento_lead(bigint,text,text,jsonb,bigint,bigint,text,text)
  from public,anon,authenticated;
revoke all on function public.motor_proximo_sequencial(bigint,text)
  from public,anon,authenticated;
revoke all on function public.motor_proximo_sequencial_exceto(bigint,text,bigint[])
  from public,anon,authenticated;
revoke all on function public.motor_proximo_sequencial_exceto(bigint,text,bigint[],boolean)
  from public,anon,authenticated;
revoke all on function public.motor_resolve_valor(text,jsonb)
  from public,anon,authenticated;
revoke all on function public.motor_subst(text,jsonb)
  from public,anon,authenticated;

grant execute on function public.motor_acoes(bigint,text,text,jsonb,jsonb,bigint,bigint,integer)
  to service_role;
grant execute on function public.motor_campo_valor(text,jsonb,bigint,bigint)
  to service_role;
grant execute on function public.motor_campos(bigint,text,text,jsonb,jsonb,bigint,bigint)
  to service_role;
grant execute on function public.motor_cond(text,jsonb,jsonb,bigint,bigint)
  to service_role;
grant execute on function public.motor_fila_fixar_versao() to service_role;
grant execute on function public.motor_momento_lead(bigint,text,text,jsonb,bigint,bigint,text,text)
  to service_role;
grant execute on function public.motor_proximo_sequencial(bigint,text) to service_role;
grant execute on function public.motor_proximo_sequencial_exceto(bigint,text,bigint[])
  to service_role;
grant execute on function public.motor_proximo_sequencial_exceto(bigint,text,bigint[],boolean)
  to service_role;
grant execute on function public.motor_resolve_valor(text,jsonb) to service_role;
grant execute on function public.motor_subst(text,jsonb) to service_role;

create or replace function public.automacao_validar_mapa(p_mapa jsonb)
returns jsonb
language plpgsql
immutable
set search_path=''
as $fn$
declare
  v_blocks jsonb := coalesce(p_mapa->'automation'->'blocks','[]'::jsonb);
  v_ids text[];
  v_erros jsonb := '[]'::jsonb;
  b jsonb;
  item jsonb;
  ref record;
  v_tipo text;
  v_nome text;
  v_allowed_types constant text[] := array[
    'trigger','field-operation','condition','action','randomizer',
    'distribution-simple','send-approach','time','resposta','ai-agent'
  ];
  v_allowed_triggers constant text[] := array[
    'json-http-request-trigger','site-lead-created-trigger','initiated-by-another-automation-trigger',
    'manually-lead-trigger','tag-added-trigger','lead-entered-stage-trigger',
    'lead-moved-stage-trigger','lead-distribuido-trigger',
    'lead-mensagem-recebida-trigger','momento-prazo-vencido-trigger',
    'retomar-na-data-trigger','lead-entrou-momento-trigger','checagem-diaria-trigger'
  ];
  v_allowed_actions constant text[] := array[
    'create-lead-action','create-business-action','move-business-action',
    'business-win-action','business-restore-action','business-lose-action',
    'add-attendant-on-business-action','clean-attendant-on-business-action',
    'assign-lead-attendant-action','clean-lead-attendant-action',
    'create-tags-action','add-tag-action','remove-tag-action',
    'set-lead-momento-action','apply-ai-analysis-action','send-notification-action',
    'start-another-automation-action'
  ];
  v_allowed_conditions constant text[] := array[
    'business-has-attendants','business-no-attendants','business-won',
    'business-lost','business-pending','lead-exists',
    'lead-has-business-on-pipeline','lead-has-business-on-stage',
    'lead-email-exists','lead-name-exists','lead-phone-exists',
    'lead-cpf-exists','lead-has-tag','lead-has-attendant',
    'time-day-hour','lead-respondeu','field-equals','field-contains',
    'field-has-value','field-between'
  ];
  v_allowed_waits constant text[] := array[
    'wait-seconds','wait-minutes','wait-hours','wait-days'
  ];
  v_allowed_field_ops constant text[] := array[
    'set-field-operation','parse-phone-field-operation'
  ];
  v_allowed_ai constant text[] := array['analisar_atendimento','atualizar_momento'];
begin
  if jsonb_typeof(v_blocks) is distinct from 'array'
     or jsonb_array_length(v_blocks)=0 then
    return jsonb_build_object('ok',false,'erros',jsonb_build_array('AUTOMATION_EMPTY'));
  end if;

  select array_agg(x->>'id') into v_ids from jsonb_array_elements(v_blocks) x;
  if exists(
    select 1 from unnest(v_ids) x group by x
     having x is null or x='' or count(*)>1
  ) then
    v_erros:=v_erros||jsonb_build_array('BLOCK_ID_INVALID_OR_DUPLICATED');
  end if;
  if (select count(*) from jsonb_array_elements(v_blocks) x
       where x->>'type'='trigger')<>1 then
    v_erros:=v_erros||jsonb_build_array('EXACTLY_ONE_TRIGGER_REQUIRED');
  end if;

  for b in select value from jsonb_array_elements(v_blocks)
  loop
    v_tipo:=b->>'type';
    if not coalesce(v_tipo=any(v_allowed_types),false) then
      v_erros:=v_erros||jsonb_build_array('UNSUPPORTED_BLOCK:'||coalesce(v_tipo,'NULL'));
    end if;

    if v_tipo='trigger' then
      if jsonb_array_length(coalesce(b#>'{options,triggers}','[]'::jsonb))<>1 then
        v_erros:=v_erros||jsonb_build_array('EXACTLY_ONE_TRIGGER_CONFIG_REQUIRED:'||(b->>'id'));
      end if;
      for item in select value from jsonb_array_elements(coalesce(b#>'{options,triggers}','[]'::jsonb))
      loop
        v_nome:=item->>'name';
        if not coalesce(v_nome=any(v_allowed_triggers),false) then
          v_erros:=v_erros||jsonb_build_array('UNSUPPORTED_TRIGGER:'||coalesce(v_nome,'NULL'));
        end if;
      end loop;

    elsif v_tipo='field-operation' then
      if jsonb_array_length(coalesce(b#>'{options,fieldOperations}','[]'::jsonb))=0 then
        v_erros:=v_erros||jsonb_build_array('FIELD_OPERATION_EMPTY:'||(b->>'id'));
      end if;
      for item in select value from jsonb_array_elements(coalesce(b#>'{options,fieldOperations}','[]'::jsonb))
      loop
        v_nome:=item->>'name';
        if not coalesce(v_nome=any(v_allowed_field_ops),false) then
          v_erros:=v_erros||jsonb_build_array('UNSUPPORTED_FIELD_OPERATION:'||coalesce(v_nome,'NULL'));
        elsif v_nome='set-field-operation'
          and nullif(item#>>'{options,parameter}','') is null then
          v_erros:=v_erros||jsonb_build_array('FIELD_DESTINATION_REQUIRED:'||(b->>'id'));
        elsif v_nome='parse-phone-field-operation'
          and nullif(item#>>'{options,phone}','') is null then
          v_erros:=v_erros||jsonb_build_array('PHONE_SOURCE_REQUIRED:'||(b->>'id'));
        end if;
      end loop;

    elsif v_tipo='action' then
      if jsonb_array_length(coalesce(b#>'{options,actions}','[]'::jsonb))=0 then
        v_erros:=v_erros||jsonb_build_array('ACTION_BLOCK_EMPTY:'||(b->>'id'));
      end if;
      for item in select value from jsonb_array_elements(coalesce(b#>'{options,actions}','[]'::jsonb))
      loop
        v_nome:=item->>'name';
        if not coalesce(v_nome=any(v_allowed_actions),false) then
          v_erros:=v_erros||jsonb_build_array('UNSUPPORTED_ACTION:'||coalesce(v_nome,'NULL'));
        elsif v_nome in ('create-business-action','move-business-action')
          and (
            nullif(coalesce(item#>>'{options,pipeline_id}',item#>>'{options,pipeline}'),'') is null
            or nullif(coalesce(item#>>'{options,etapa_id}',item#>>'{options,etapa}'),'') is null
          ) then
          v_erros:=v_erros||jsonb_build_array('ACTION_PIPELINE_AND_STAGE_REQUIRED:'||(b->>'id'));
        elsif v_nome in ('add-attendant-on-business-action','assign-lead-attendant-action')
          and nullif(item#>>'{options,corretor}','') is null then
          v_erros:=v_erros||jsonb_build_array('ACTION_ATTENDANT_REQUIRED:'||(b->>'id'));
        elsif v_nome in ('create-tags-action','add-tag-action','remove-tag-action')
          and nullif(item#>>'{options,tag}','') is null then
          v_erros:=v_erros||jsonb_build_array('ACTION_TAG_REQUIRED:'||(b->>'id'));
        elsif v_nome='business-lose-action'
          and nullif(item#>>'{options,motivo}','') is null then
          v_erros:=v_erros||jsonb_build_array('ACTION_LOSS_REASON_REQUIRED:'||(b->>'id'));
        elsif v_nome='set-lead-momento-action'
          and nullif(item#>>'{options,momento}','') is null then
          v_erros:=v_erros||jsonb_build_array('ACTION_MOMENT_REQUIRED:'||(b->>'id'));
        elsif v_nome='start-another-automation-action'
          and nullif(item#>>'{options,automacao}','') is null then
          v_erros:=v_erros||jsonb_build_array('ACTION_AUTOMATION_REQUIRED:'||(b->>'id'));
        end if;
      end loop;

    elsif v_tipo='condition' then
      if jsonb_array_length(coalesce(b#>'{options,conditions}','[]'::jsonb))=0 then
        v_erros:=v_erros||jsonb_build_array('CONDITION_BLOCK_EMPTY:'||(b->>'id'));
      end if;
      if nullif(b#>>'{options,trueNextBlockId}','') is null
         or nullif(b#>>'{options,falseNextBlockId}','') is null then
        v_erros:=v_erros||jsonb_build_array('CONDITION_ROUTES_REQUIRED:'||(b->>'id'));
      end if;
      for item in select value from jsonb_array_elements(coalesce(b#>'{options,conditions}','[]'::jsonb))
      loop
        v_nome:=replace(item->>'name','-condition','');
        if not coalesce(v_nome=any(v_allowed_conditions),false) then
          v_erros:=v_erros||jsonb_build_array('UNSUPPORTED_CONDITION:'||coalesce(v_nome,'NULL'));
        elsif v_nome='lead-has-tag'
          and nullif(item#>>'{options,tag}','') is null then
          v_erros:=v_erros||jsonb_build_array('CONDITION_TAG_REQUIRED:'||(b->>'id'));
        elsif v_nome='lead-has-business-on-pipeline'
          and nullif(item#>>'{options,pipeline}','') is null then
          v_erros:=v_erros||jsonb_build_array('CONDITION_PIPELINE_REQUIRED:'||(b->>'id'));
        elsif v_nome='lead-has-business-on-stage'
          and nullif(item#>>'{options,etapa}','') is null then
          v_erros:=v_erros||jsonb_build_array('CONDITION_STAGE_REQUIRED:'||(b->>'id'));
        elsif v_nome in ('field-equals','field-contains','field-has-value','field-between')
          and nullif(item#>>'{options,campo}','') is null then
          v_erros:=v_erros||jsonb_build_array('CONDITION_FIELD_REQUIRED:'||(b->>'id'));
        elsif v_nome='field-between'
          and nullif(item#>>'{options,min}','') is null
          and nullif(item#>>'{options,max}','') is null then
          v_erros:=v_erros||jsonb_build_array('CONDITION_RANGE_REQUIRED:'||(b->>'id'));
        elsif v_nome='lead-respondeu'
          and coalesce(nullif(item#>>'{options,janela_horas}','')::numeric,0)<=0 then
          v_erros:=v_erros||jsonb_build_array('CONDITION_WINDOW_REQUIRED:'||(b->>'id'));
        end if;
        if nullif(item->>'trueNextBlockId','') is not null
           and not ((item->>'trueNextBlockId')=any(v_ids)) then
          v_erros:=v_erros||jsonb_build_array(
            'BROKEN_ROUTE:'||(b->>'id')||':condition:'||(item->>'trueNextBlockId')
          );
        end if;
      end loop;

    elsif v_tipo='distribution-simple' then
      if not exists(
        select 1 from jsonb_array_elements(coalesce(b#>'{options,distribuicao,items}','[]'::jsonb)) x
         where coalesce((x->>'on')::boolean,true)
           and coalesce(nullif(x->>'peso','')::numeric,0)>0
           and nullif(btrim(x->>'corretor'),'') is not null
      ) then
        v_erros:=v_erros||jsonb_build_array('DISTRIBUTION_MEMBER_REQUIRED:'||(b->>'id'));
      end if;
      if exists(
        select 1
          from jsonb_array_elements(coalesce(b#>'{options,distribuicao,items}','[]'::jsonb)) x
         where coalesce((x->>'on')::boolean,true)
         group by lower(btrim(x->>'corretor'))
        having count(*)>1
      ) then
        v_erros:=v_erros||jsonb_build_array('DISTRIBUTION_MEMBER_DUPLICATED:'||(b->>'id'));
      end if;

    elsif v_tipo='send-approach' then
      if jsonb_array_length(coalesce(b#>'{options,abordagemIds}','[]'::jsonb))<>1 then
        v_erros:=v_erros||jsonb_build_array('APPROACH_REQUIRED:'||(b->>'id'));
      end if;
    elsif v_tipo='resposta' then
      if coalesce(nullif(b#>>'{options,janelaValor}','')::numeric,0)<=0 then
        v_erros:=v_erros||jsonb_build_array('RESPONSE_WINDOW_REQUIRED:'||(b->>'id'));
      end if;
      if nullif(b#>>'{options,respondeuNextBlockId}','') is null
         or nullif(b#>>'{options,naoRespondeuNextBlockId}','') is null then
        v_erros:=v_erros||jsonb_build_array('RESPONSE_ROUTES_REQUIRED:'||(b->>'id'));
      end if;
    elsif v_tipo='time' then
      if not coalesce((b#>>'{options,wait_type}')=any(v_allowed_waits),false)
         or coalesce(nullif(b#>>'{options,valor}','')::numeric,0)<=0 then
        v_erros:=v_erros||jsonb_build_array('WAIT_CONFIG_INVALID:'||(b->>'id'));
      end if;
    elsif v_tipo='ai-agent' then
      if coalesce(nullif(b#>>'{options,agenteId}','')::bigint,0)<=0 then
        v_erros:=v_erros||jsonb_build_array('AI_AGENT_REQUIRED:'||(b->>'id'));
      end if;
      if not coalesce((b#>>'{options,funcao}')=any(v_allowed_ai),false) then
        v_erros:=v_erros||jsonb_build_array('AI_FUNCTION_UNSUPPORTED:'||(b->>'id'));
      end if;
    elsif v_tipo='randomizer' then
      if jsonb_array_length(coalesce(b#>'{options,randomizers}','[]'::jsonb))<2
         or coalesce((
           select sum(coalesce(nullif(x->>'perc','')::numeric,0))
             from jsonb_array_elements(coalesce(b#>'{options,randomizers}','[]'::jsonb)) x
         ),0)<>100 then
        v_erros:=v_erros||jsonb_build_array('RANDOMIZER_MUST_SUM_100:'||(b->>'id'));
      end if;
      for item in select value from jsonb_array_elements(coalesce(b#>'{options,randomizers}','[]'::jsonb))
      loop
        if nullif(item->>'nextBlockId','') is null
           or not ((item->>'nextBlockId')=any(v_ids)) then
          v_erros:=v_erros||jsonb_build_array(
            'BROKEN_ROUTE:'||(b->>'id')||':randomizer:'||coalesce(item->>'nextBlockId','NULL')
          );
        end if;
      end loop;
    end if;

    for ref in
      select key,value#>>'{}' target
        from jsonb_each(coalesce(b->'options','{}'::jsonb))
       where key ilike '%BlockId' and nullif(value#>>'{}','') is not null
    loop
      if not (ref.target=any(v_ids)) then
        v_erros:=v_erros||jsonb_build_array(
          'BROKEN_ROUTE:'||(b->>'id')||':'||ref.key||':'||ref.target
        );
      end if;
    end loop;
  end loop;

  return jsonb_build_object('ok',jsonb_array_length(v_erros)=0,'erros',v_erros);
exception when others then
  return jsonb_build_object(
    'ok',false,'erros',jsonb_build_array('VALIDATION_EXCEPTION:'||sqlerrm)
  );
end
$fn$;

revoke all on function public.automacao_validar_mapa(jsonb) from public,anon;
grant execute on function public.automacao_validar_mapa(jsonb)
  to authenticated,service_role;
