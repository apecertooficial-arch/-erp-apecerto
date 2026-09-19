-- DRAFT NÃO APLICADO — confirmar ação manual sem forjar evidência D-API.
--
-- A confirmação D-API já é produzida pelo caminho canônico de mensagens e não
-- por esta RPC. O navegador só pode registrar uma ação operacional manual e
-- somente quando a sessão corresponde ao corretor dono do card.

begin;

create unique index if not exists motor_fila_sara_acao_confirmada_uniq
  on public.motor_fila(
    automacao_id,
    (lead->>'__funil_lead_id'),
    (lead->>'__sara_event_type'),
    (lead->>'__sara_source_id')
  )
  where lead->>'__sara_event_type'='lead.action_confirmed';

comment on index public.motor_fila_sara_acao_confirmada_uniq is
  'Uma execução Sara por evento auditável de ação confirmada.';

create or replace function public.f2_confirmar_acao(
  p_id uuid,
  p_versao integer,
  p_fonte text,
  p_observacao text default null::text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_broker_id bigint := public.current_broker_id();
  v_atual public.f2_lead%rowtype;
  v_m public.f2_momento_config%rowtype;
  v_passo smallint;
  v_dias smallint;
  v_prazo timestamptz;
  v_sem_cobranca boolean;
  v_resumo text;
  v_email text := '';
  v_evento_id bigint;
  v_fila_id bigint;
  v_dias_cadencia constant smallint[] := array[1,2,4,6,7];
begin
  if v_uid is null or v_broker_id is null then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;

  -- Um cliente autenticado nunca declara que a evidência veio do D-API.
  -- O webhook canônico grava a confirmação a partir da mensagem persistida.
  if p_fonte <> 'registro_operacional' then
    return jsonb_build_object('ok', false, 'erro', 'confirmacao_dapi_pelo_webhook');
  end if;

  select * into v_atual
    from public.f2_lead
   where id = p_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'lead_inexistente');
  end if;
  if v_atual.corretor_id is distinct from v_broker_id then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  if v_atual.versao <> p_versao then
    return jsonb_build_object('ok', false, 'erro', 'versao_conflito');
  end if;

  select * into v_m
    from public.f2_momento_config
   where codigo = v_atual.momento_codigo;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'momento_invalido');
  end if;
  if v_m.exige_dapi then
    return jsonb_build_object('ok', false, 'erro', 'confirmacao_dapi_obrigatoria');
  end if;

  v_sem_cobranca := coalesce(v_m.cobra_no_meu_dia, true) is false;
  if v_sem_cobranca then
    v_passo := greatest(v_atual.cadencia_passo, 1)::smallint;
    v_prazo := public.f2_sem_prazo();
    v_resumo := 'Ação operacional registrada; o card continua sem prazo até nova evidência.';
  elsif v_atual.momento_codigo = 'CADENCIA_SEM_RESPOSTA' then
    if v_atual.cadencia_passo < 4 then
      v_passo := v_atual.cadencia_passo + 1;
      v_dias := v_dias_cadencia[v_passo + 1] - v_dias_cadencia[v_passo];
      v_prazo := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
        + make_interval(days => v_dias) + interval '9 hours';
      v_resumo := 'A ação foi registrada; a cadência manteve o próximo dia oficial.';
    else
      v_passo := 5;
      v_prazo := now() + interval '24 hours';
      v_resumo := 'A cadência terminou; o lead precisa de nova avaliação.';
    end if;
  else
    v_passo := v_atual.cadencia_passo;
    v_prazo := now() + make_interval(mins => coalesce(v_m.prazo_minutos, 1440));
    v_resumo := 'A ação operacional foi registrada e o próximo prazo foi calculado.';
  end if;

  update public.f2_lead
     set cadencia_passo = v_passo,
         proxima_acao_em = v_prazo,
         ultima_acao_confirmada_em = now(),
         ultima_acao_fonte = 'registro_operacional',
         versao = versao + 1,
         atualizado_em = now(),
         atualizado_por = v_uid
   where id = p_id;

  insert into public.f2_evento(
    funil_lead_id, tipo, titulo, detalhe, payload, criado_por
  ) values (
    p_id, 'acao_confirmada', 'Ação confirmada por registro operacional',
    nullif(left(btrim(coalesce(p_observacao, '')), 500), ''),
    jsonb_build_object(
      'acao', v_atual.acao_codigo,
      'proximo_prazo', case when v_sem_cobranca then null else to_jsonb(v_prazo) end,
      'sem_prazo', v_sem_cobranca,
      'cadencia_passo', v_passo
    ),
    v_uid
  ) returning id into v_evento_id;

  -- A evidência nova substitui o checkpoint antigo. O resultado da Sara só
  -- será marcado depois que a automação 49 realmente analisar e aplicar.
  update public.motor_fila
     set status = 'cancelado', processado_em = now(),
         ultimo_erro = 'checkpoint_substituido_por_acao_confirmada'
   where automacao_id = 49
     and status = 'pendente'
     and lead->>'__sara_checkpoint' = 'true'
     and lead->>'__funil_lead_id' = p_id::text;

  select coalesce(l.email, '') into v_email
    from public.negocios n
    left join public.leads l on l.id = n.lead_id
   where n.id = v_atual.origem_negocio_id;

  v_fila_id := public.motor_enfileirar(49, jsonb_build_object(
    'nome', coalesce(v_atual.nome, 'Lead'),
    'telefone', coalesce(v_atual.telefone, ''),
    'email', coalesce(v_email, ''),
    '__funil_lead_id', p_id,
    '__motor_priority', 0,
    '__motor_evento', 'lead.action_confirmed',
    '__sara_event_type', 'lead.action_confirmed',
    '__sara_source_id', v_evento_id,
    '__sara_proxima_acao', jsonb_build_object(
      'codigo', v_atual.acao_codigo,
      'responsavel', 'corretor_atual',
      'executar_em', v_atual.proxima_acao_em,
      'evidencia', 'evento:' || v_evento_id::text
    )
  ));

  return jsonb_build_object(
    'ok', true,
    'versao', v_atual.versao + 1,
    'prazo', v_prazo,
    'cadencia_passo', v_passo,
    'sem_prazo', v_sem_cobranca,
    'sara_em_fila', true,
    'fila_id', v_fila_id,
    'evento_id', v_evento_id
  );
end;
$function$;

revoke all on function public.f2_confirmar_acao(uuid,integer,text,text)
  from public, anon;
grant execute on function public.f2_confirmar_acao(uuid,integer,text,text)
  to authenticated;

-- Publica uma nova versão imutável da automação 49 aceitando o novo evento.
-- Nenhuma versão histórica é alterada ou apagada.
do $publicar_evento_acao_confirmada$
declare
  v_auto public.automacoes%rowtype;
  v_mapa jsonb;
  v_blocos jsonb;
  v_editor_blocos jsonb;
  v_validacao jsonb;
  v_versao integer;
  v_versao_id bigint;
begin
  select * into strict v_auto
    from public.automacoes
   where id = 49
   for update;
  v_mapa := v_auto.mapa;

  select jsonb_agg(
    case when exists(
      select 1
        from jsonb_array_elements(coalesce(b#>'{options,triggers}', '[]'::jsonb)) t
       where t->>'name' = 'sara-ciclo-event-trigger'
    ) then jsonb_set(
      b,
      '{options,triggers}',
      (
        select jsonb_agg(
          case when t->>'name' = 'sara-ciclo-event-trigger'
                 and not coalesce(t#>'{options,eventTypes}', '[]'::jsonb)
                   @> '["lead.action_confirmed"]'::jsonb
            then jsonb_set(
              t, '{options,eventTypes}',
              coalesce(t#>'{options,eventTypes}', '[]'::jsonb)
                || '["lead.action_confirmed"]'::jsonb,
              true
            )
            else t end
          order by trigger_ord
        )
          from jsonb_array_elements(coalesce(b#>'{options,triggers}', '[]'::jsonb))
            with ordinality as trigger_item(t, trigger_ord)
      ),
      true
    ) else b end
    order by bloco_ord
  ) into v_blocos
    from jsonb_array_elements(v_mapa#>'{automation,blocks}')
      with ordinality as bloco_item(b, bloco_ord);

  select jsonb_agg(
    case when exists(
      select 1
        from jsonb_array_elements(coalesce(b#>'{options,triggers}', '[]'::jsonb)) t
       where t->>'name' = 'sara-ciclo-event-trigger'
    ) then jsonb_set(
      b,
      '{options,triggers}',
      (
        select jsonb_agg(
          case when t->>'name' = 'sara-ciclo-event-trigger'
                 and not coalesce(t#>'{options,eventTypes}', '[]'::jsonb)
                   @> '["lead.action_confirmed"]'::jsonb
            then jsonb_set(
              t, '{options,eventTypes}',
              coalesce(t#>'{options,eventTypes}', '[]'::jsonb)
                || '["lead.action_confirmed"]'::jsonb,
              true
            )
            else t end
          order by trigger_ord
        )
          from jsonb_array_elements(coalesce(b#>'{options,triggers}', '[]'::jsonb))
            with ordinality as trigger_item(t, trigger_ord)
      ),
      true
    ) else b end
    order by bloco_ord
  ) into v_editor_blocos
    from jsonb_array_elements(v_mapa#>'{editor,blocks}')
      with ordinality as bloco_item(b, bloco_ord);

  v_mapa := jsonb_set(v_mapa, '{automation,blocks}', v_blocos, false);
  v_mapa := jsonb_set(v_mapa, '{editor,blocks}', v_editor_blocos, false);
  v_mapa := jsonb_set(
    v_mapa, '{editor,uid}',
    to_jsonb(coalesce((v_mapa#>>'{editor,uid}')::integer, 0) + 1), true
  );

  v_validacao := public.automacao_validar_mapa(v_mapa);
  if coalesce((v_validacao->>'ok')::boolean, false) is not true then
    raise exception 'AUTOMATION_INVALID: %', v_validacao->'erros';
  end if;

  select coalesce(max(versao), 0) + 1 into v_versao
    from public.automacao_versoes
   where automacao_id = 49;

  insert into public.automacao_versoes(
    automacao_id, versao, nome, mapa, observacao, criado_por
  ) values (
    49, v_versao, 'Inteligencia de Conversa', v_mapa,
    'Inclui evento auditavel lead.action_confirmed sem forjar reavaliacao',
    'migration:p0_f2_confirmar_acao'
  ) returning id into v_versao_id;

  update public.automacoes
     set mapa = v_mapa,
         mapa_rascunho = v_mapa,
         versao_publicada_id = v_versao_id,
         status = 'publicado',
         ativa = true,
         arquivada = false,
         publicado_em = now(),
         atualizada_em = now()
   where id = 49;

  if not exists(
    select 1
      from jsonb_array_elements(v_mapa#>'{automation,blocks}') b
      cross join lateral jsonb_array_elements(coalesce(b#>'{options,triggers}', '[]'::jsonb)) t
     where t->>'name' = 'sara-ciclo-event-trigger'
       and t#>'{options,eventTypes}' @> '["lead.action_confirmed"]'::jsonb
  ) then
    raise exception 'VERIFY_FAILED: lead.action_confirmed ausente da automacao 49';
  end if;
end
$publicar_evento_acao_confirmada$;

commit;

-- Rollback: restaurar a definição capturada no baseline somente após ensaio
-- negativo/positivo no banco isolado. Não restaurar EXECUTE para PUBLIC/anon.
