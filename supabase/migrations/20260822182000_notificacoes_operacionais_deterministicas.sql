-- Notificacoes operacionais legiveis e produzidas por blocos explicitos da
-- Central. Tambem impede que o relogio de recuperacao concorra com os eventos
-- de conversa em tempo real.

begin;

set local statement_timeout = '60s';
set local lock_timeout = '10s';

select pg_advisory_xact_lock(hashtext('central_notificacoes_operacionais'));

insert into public.ncrm_notificacao_tipos_ativos(tipo,motivo)
values
  ('lead_em_atendimento','A Sara moveu explicitamente o lead para Em atendimento'),
  ('lead_quente','A Central confirmou explicitamente que o lead ficou quente')
on conflict (tipo) do update set motivo=excluded.motivo;

-- Sem resposta do cliente, o lead continua em Tentando contato. Ele somente
-- entra em Em atendimento quando uma conversa recebida sustenta essa mudanca.
update public.f2_momento_config
   set etapa='tentando_contato'
 where codigo='CADENCIA_SEM_RESPOSTA'
   and etapa is distinct from 'tentando_contato';

update public.f2_lead f
   set etapa='tentando_contato',versao=versao+1,
       atualizado_em=now(),atualizado_por=null
 where public.f2_lead_automatico_elegivel(f.id)
   and f.momento_codigo='CADENCIA_SEM_RESPOSTA'
   and f.etapa is distinct from 'tentando_contato';

-- A checagem e recuperacao, nao um segundo consumidor em paralelo. Eventos em
-- tempo real recebem dez minutos para concluir antes de o relogio intervir.
create or replace function public.sara_checagem_diaria(p_limite integer default 12)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $fn$
declare v_n int:=0; r record;
begin
  for r in
    select f.id,f.momento_codigo,coalesce(l.nome,f.nome) nome,
           coalesce(l.telefone,f.telefone) tel,l.email,
           s.ultima_interacao,a.ultima_consulta_em
      from f2_lead f
      left join negocios ng on ng.id=f.origem_negocio_id
      left join leads l on l.id=ng.lead_id
      left join sla_msg_cache s on s.lead_id=ng.lead_id
      left join lateral(
        select sa.ultima_consulta_em from f2_sara_analise sa
         where sa.funil_lead_id=f.id order by sa.ultima_consulta_em desc limit 1
      ) a on true
     where public.f2_lead_automatico_elegivel(f.id)
       and (
         (a.ultima_consulta_em is null
           and coalesce(s.ultima_interacao,f.criado_em)<=now()-interval '10 minutes')
         or (s.ultima_interacao>a.ultima_consulta_em
           and s.ultima_interacao<=now()-interval '10 minutes')
         or a.ultima_consulta_em<=now()-interval '24 hours'
       )
     order by (s.ultima_interacao>a.ultima_consulta_em) desc nulls last,
              a.ultima_consulta_em nulls first,f.criado_em
     limit greatest(1,least(coalesce(p_limite,12),50))
  loop
    v_n:=v_n+motor_evento_disparar('checagem-diaria-trigger',
      jsonb_build_object(
        'nome',r.nome,'telefone',coalesce(r.tel,''),'email',coalesce(r.email,''),
        '__funil_lead_id',r.id,'__motor_priority',20,
        '__motor_evento','checagem_diaria'
      ),r.momento_codigo);
  end loop;
  return jsonb_build_object('ok',true,'disparos_na_central',v_n);
end
$fn$;

revoke all on function public.sara_checagem_diaria(integer)
  from public,anon,authenticated;
grant execute on function public.sara_checagem_diaria(integer) to service_role;

-- O resultado do modulo Aplicar analise passa a carregar a transicao exata.
-- O proximo submodulo pode decidir se deve notificar sem reler ou supor estado.
do $patch_sara$
declare v_def text; v_novo text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='f2_sara_aplicar_analise'
     and p.prokind='f' limit 1;
  if md5(v_def)<>'6cab37499651513c76fe16c174c2149e' then
    raise exception 'f2_sara_aplicar_analise mudou: %',md5(v_def);
  end if;
  v_novo:=replace(v_def,
    $old$    'status',v_status_final,
    'momento_codigo',case when p_aplicar_momento then v_m.codigo else v_f.momento_codigo end,
    'versao',v_f.versao+1);$old$,
    $new$    'status',v_status_final,
    'momento_anterior',v_f.momento_codigo,
    'momento_codigo',case when p_aplicar_momento then v_m.codigo else v_f.momento_codigo end,
    'etapa_anterior',v_f.etapa,
    'etapa_nova',case when p_aplicar_etapa then v_m.etapa else v_f.etapa end,
    'versao',v_f.versao+1);$new$);
  if v_novo=v_def then raise exception 'retorno da Sara nao encontrado'; end if;
  execute v_novo;
end
$patch_sara$;

-- O modulo de notificacao recebe o resultado do submodulo anterior, conhece o
-- corretor efetivamente gravado e permite uma condicao explicita de transicao.
do $patch_actions$
declare v_def text; v_novo text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_acoes'
     and p.prokind='f' limit 1;
  if md5(v_def)<>'911b0a653e94a5b781057c48c435d1bd' then
    raise exception 'motor_acoes mudou: %',md5(v_def);
  end if;

  v_novo:=replace(v_def,
    $old$      _ai_apply:=public.motor_aplicar_saida_ia(p_lead,ao);$old$,
    $new$      _ai_apply:=public.motor_aplicar_saida_ia(p_lead,ao);
      p_lead:=p_lead||jsonb_strip_nulls(jsonb_build_object(
        '__ai_aplicado',coalesce((_ai_apply->>'aplicado')::boolean,false),
        '__ai_status',_ai_apply->>'status',
        '__ai_momento_anterior',_ai_apply->>'momento_anterior',
        '__ai_momento_novo',_ai_apply->>'momento_codigo',
        '__ai_etapa_anterior',_ai_apply->>'etapa_anterior',
        '__ai_etapa_nova',_ai_apply->>'etapa_nova'
      ));$new$);

  v_novo:=replace(v_novo,
    $old$        v_cor bigint; v_titulo text; v_detalhe text; v_chave text; v_gravou int; v_tipo text;$old$,
    $new$        v_cor bigint; v_cor_nome text; v_contexto jsonb;
        v_titulo text; v_detalhe text; v_chave text; v_gravou int; v_tipo text;$new$);

  v_novo:=replace(v_novo,
    $old$        v_titulo  := motor_subst(coalesce(nullif(btrim(coalesce(ao->>'titulo','')),''),'Aviso da automacao'), p_lead);
        v_detalhe := motor_subst(coalesce(ao->>'detalhe',''), p_lead);
        if v_lead_id is not null then select corretor_id into v_cor from leads where id = v_lead_id; end if;$old$,
    $new$        if nullif(ao->>'somenteAiEtapaAlteradaPara','') is not null
           and not (
             coalesce((p_lead->>'__ai_aplicado')::boolean,false)
             and p_lead->>'__ai_etapa_nova'=ao->>'somenteAiEtapaAlteradaPara'
             and p_lead->>'__ai_etapa_anterior' is distinct from p_lead->>'__ai_etapa_nova'
           ) then
          insert into motor_execucoes(
            automacao_id,automacao_nome,bloco_id,evento,status,
            lead_nome,lead_telefone,detalhe
          ) values(
            p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',v_tel,
            'Aviso ignorado: a etapa nao mudou para '||ao->>'somenteAiEtapaAlteradaPara'
          );
          continue;
        end if;
        if v_lead_id is not null then
          select l.corretor_id,c.nome into v_cor,v_cor_nome
            from leads l left join corretores c on c.id=l.corretor_id
           where l.id=v_lead_id;
        end if;
        v_contexto:=p_lead||jsonb_build_object(
          'corretor',coalesce(nullif(v_cor_nome,''),'Sem corretor'),
          'lead',coalesce(nullif(p_lead->>'nome',''),'Lead')
        );
        v_titulo  := motor_subst(coalesce(nullif(btrim(coalesce(ao->>'titulo','')),''),'Aviso da automacao'), v_contexto);
        v_detalhe := motor_subst(coalesce(ao->>'detalhe',''), v_contexto);$new$);

  if v_novo=v_def then raise exception 'motor_acoes sem alteracao'; end if;
  execute v_novo;
end
$patch_actions$;

-- Miruna e Adelmo: o proprio bloco mostra lead e corretor efetivos. Nenhuma
-- notificacao deriva de previsao da roleta.
do $publish_entry$
declare
  r record; v_mapa jsonb; v_blocks jsonb; v_idx int; v_aidx int;
  v_versao int; v_versao_id bigint; v_esperada bigint;
begin
  for r in select * from public.automacoes where id in (65,66) order by id for update
  loop
    v_esperada:=case r.id when 65 then 101 else 102 end;
    if r.versao_publicada_id is distinct from v_esperada then
      raise exception 'automacao % mudou: versao publicada %',r.id,r.versao_publicada_id;
    end if;
    v_mapa:=r.mapa;

    select ord::int-1 into v_idx
      from jsonb_array_elements(v_mapa#>'{automation,blocks}') with ordinality e(value,ord)
     where value->>'id'='b18';
    v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','actions','0','options','titulo'],
      to_jsonb('Novo lead: {nome}'::text));
    v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','actions','0','options','detalhe'],
      to_jsonb('O lead {nome} foi distribuido para voce.'::text));

    select ord::int-1 into v_idx
      from jsonb_array_elements(v_mapa#>'{automation,blocks}') with ordinality e(value,ord)
     where value->>'id'='b19';
    v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','actions','0','options','titulo'],
      to_jsonb('Novo lead: {nome} → {corretor}'::text));
    v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','actions','0','options','detalhe'],
      to_jsonb('{nome} foi distribuido para {corretor}.'::text));

    select ord::int-1 into v_idx
      from jsonb_array_elements(v_mapa#>'{automation,blocks}') with ordinality e(value,ord)
     where value->>'id'='b20';
    v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','actions','0','options','titulo'],
      to_jsonb('Abordagem nao entregue: {nome}'::text));
    v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','actions','0','options','detalhe'],
      to_jsonb('O lead {nome} foi distribuido para voce, mas o WhatsApp recusou o numero. Confira o telefone no CRM.'::text));
    v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','actions','1','options','titulo'],
      to_jsonb('Falha: {nome} → {corretor}'::text));
    v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','actions','1','options','detalhe'],
      to_jsonb('{nome}, distribuido para {corretor}: o WhatsApp recusou o numero. A distribuicao foi mantida.'::text));

    select coalesce(max(versao),0)+1 into v_versao
      from public.automacao_versoes where automacao_id=r.id;
    insert into public.automacao_versoes(automacao_id,versao,nome,mapa,observacao,criado_por)
    values(r.id,v_versao,r.nome,v_mapa,
      'Notificacoes mostram o lead e o corretor efetivamente gravado','codex')
    returning id into v_versao_id;
    update public.automacoes
       set mapa=v_mapa,mapa_rascunho=v_mapa,versao_publicada_id=v_versao_id,
           atualizada_em=now(),publicado_em=now(),status='publicado',ativa=true
     where id=r.id;
  end loop;
end
$publish_entry$;

-- Cliente respondeu: o aviso e um bloco proprio, antes da Sara. A comprovacao
-- da resposta vem do gatilho de mensagem recebida; a IA nao e usada para isso.
-- Depois, a aplicacao explicita avisa a gestao apenas se a etapa realmente
-- mudou para Em atendimento.
do $publish_reply$
declare
  r public.automacoes%rowtype; v_mapa jsonb; v_blocks jsonb; v_wires jsonb;
  v_idx int; v_apply_idx int; v_versao int; v_versao_id bigint;
begin
  select * into r from public.automacoes where id=49 for update;
  if r.versao_publicada_id is distinct from 52 then
    raise exception 'automacao 49 mudou: versao publicada %',r.versao_publicada_id;
  end if;
  v_mapa:=r.mapa;
  if exists(select 1 from jsonb_array_elements(v_mapa#>'{automation,blocks}') e where e->>'id'='b3') then
    raise exception 'automacao 49 ja possui b3';
  end if;

  select ord::int-1 into v_idx
    from jsonb_array_elements(v_mapa#>'{automation,blocks}') with ordinality e(value,ord)
   where value->>'id'='b1';
  v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_idx::text,'options','nextBlockId'],to_jsonb('b3'::text));

  select ord::int-1 into v_apply_idx
    from jsonb_array_elements(v_mapa#>'{automation,blocks}') with ordinality e(value,ord)
   where value->>'id'='ai_apply_bf5ca61f9c51';
  v_mapa:=jsonb_set(v_mapa,array['automation','blocks',v_apply_idx::text,'options','actions'],
    (v_mapa#>array['automation','blocks',v_apply_idx::text,'options','actions']) ||
    jsonb_build_array(jsonb_build_object(
      'name','send-notification-action','group','',
      'options',jsonb_build_object(
        'tipo','lead_em_atendimento','publico','gestao','prioridade',2,
        'titulo','Lead em atendimento: {nome}',
        'detalhe','{nome} foi movido para Em atendimento. Responsavel: {corretor}.',
        'somenteAiEtapaAlteradaPara','em_atendimento'
      )
    )));

  v_blocks:=v_mapa#>'{automation,blocks}';
  v_blocks:=v_blocks||jsonb_build_array(jsonb_build_object(
    'id','b3','type','action',
    'options',jsonb_build_object(
      'actions',jsonb_build_array(jsonb_build_object(
        'name','send-notification-action','group','',
        'options',jsonb_build_object(
          'tipo','cliente_respondeu','publico','gestao','prioridade',1,
          'titulo','Lead respondeu: {nome}',
          'detalhe','{nome} respondeu. Responsavel: {corretor}.'
        )
      )),
      'nextBlockId','b2','errorNextBlockId',''
    ),
    'presentation',jsonb_build_object('x',340,'y',200),
    'sourceBlockId',gen_random_uuid()::text
  ));
  v_mapa:=jsonb_set(v_mapa,'{automation,blocks}',v_blocks);
  v_mapa:=jsonb_set(v_mapa,'{editor,blocks,b3}',jsonb_build_object(
    'x',340,'y',200,'id','b3','fam','acao','sub','',
    'note','Aviso explicito: o cliente respondeu','extra','{}'::jsonb,
    'parts','[]'::jsonb,'ramos','[]'::jsonb,'noteOpen',false
  ),true);
  v_wires:=jsonb_build_array(
    jsonb_build_object('from','b1','to','b3','port','out'),
    jsonb_build_object('from','b3','to','b2','port','out'),
    jsonb_build_object('from','b2','to','ai_apply_bf5ca61f9c51','port','out')
  );
  v_mapa:=jsonb_set(v_mapa,'{editor,wires}',v_wires,true);
  v_mapa:=jsonb_set(v_mapa,'{editor,uid}',to_jsonb(coalesce((v_mapa#>>'{editor,uid}')::int,0)+1),true);

  select coalesce(max(versao),0)+1 into v_versao
    from public.automacao_versoes where automacao_id=49;
  insert into public.automacao_versoes(automacao_id,versao,nome,mapa,observacao,criado_por)
  values(49,v_versao,r.nome,v_mapa,
    'Resposta comprovada avisa a gestao; transicao real para atendimento gera aviso proprio','codex')
  returning id into v_versao_id;
  update public.automacoes
     set mapa=v_mapa,mapa_rascunho=v_mapa,versao_publicada_id=v_versao_id,
         atualizada_em=now(),publicado_em=now(),status='publicado',ativa=true
   where id=49;
end
$publish_reply$;

comment on function public.sara_checagem_diaria(integer) is
  'Relogio de recuperacao da Central: so reprocessa eventos nao tratados ha pelo menos dez minutos ou revisoes vencidas em 24 horas.';

commit;
