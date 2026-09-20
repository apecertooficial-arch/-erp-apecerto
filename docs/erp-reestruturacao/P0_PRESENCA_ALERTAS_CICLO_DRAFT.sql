-- DRAFT NAO EXECUTAVEL / NAO APLICADO EM PRODUCAO
--
-- Corrige duas invariantes da presença:
-- 1) uma confirmação real encerra o aviso mesmo fora da janela de criação;
-- 2) manutenção do dispatcher não fica executável por sessões humanas.
--
-- Preserva todo o histórico. Nenhuma linha é apagada ou reaberta.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.presenca_avisar_pendentes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cfg public.presenca_config%rowtype;
  v_local timestamp without time zone;
  v_criadas integer := 0;
  v_resolvidas integer := 0;
begin
  -- Resolver é independente da janela. A versão produtiva retorna antes deste
  -- update à noite/fim de semana e deixa obrigações já cumpridas abertas.
  update public.ncrm_notificacao n
     set resolvida_em = clock_timestamp(),
         resolvida_por = 'automatica'
   where n.resolvida_em is null
     and n.tipo = 'presenca_pendente'
     and not exists (
       select 1
         from public.presenca_estado e
        where e.corretor_id = n.corretor_id
          and e.aguardando_desde is not null
     );
  get diagnostics v_resolvidas = row_count;

  select *
    into v_cfg
    from public.presenca_config
   where id = 1;

  if not found or not v_cfg.ativa then
    return jsonb_build_object(
      'ok', true,
      'inativa', true,
      'avisos_criados', v_criadas,
      'avisos_resolvidos', v_resolvidas
    );
  end if;

  v_local := clock_timestamp() at time zone 'America/Sao_Paulo';
  if not (
    extract(isodow from v_local)::integer = any(v_cfg.dias_semana)
    and v_local::time between v_cfg.hora_inicio and v_cfg.hora_fim
  ) then
    return jsonb_build_object(
      'ok', true,
      'fora_da_janela', true,
      'avisos_criados', v_criadas,
      'avisos_resolvidos', v_resolvidas
    );
  end if;

  insert into public.ncrm_notificacao(
    chave, tipo, publico, prioridade, titulo, detalhe,
    corretor_id, deep_link, criada_em
  )
  select
    'presenca:' || c.id::text || ':' || to_char(e.aguardando_desde, 'YYYYMMDDHH24MI'),
    'presenca_pendente',
    'corretor',
    1,
    'Confirme que voce esta no escritorio',
    'Sem confirmar, voce sai da fila de leads novos.',
    c.id,
    '/meu-dia',
    clock_timestamp()
  from public.corretores c
  join public.presenca_estado e on e.corretor_id = c.id
  where coalesce(c.ativo, true)
    and e.aguardando_desde is not null
    and (v_cfg.corretores is null or c.id = any(v_cfg.corretores))
  on conflict (chave) where resolvida_em is null do nothing;
  get diagnostics v_criadas = row_count;

  if v_criadas > 0 then
    begin
      perform ncrm_private.push_enfileirar(200);
    exception when others then
      raise warning 'push_presenca_falhou: %', sqlerrm;
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'avisos_criados', v_criadas,
    'avisos_resolvidos', v_resolvidas
  );
end
$function$;

revoke all on function public.presenca_avisar_pendentes()
  from public, anon, authenticated;
grant execute on function public.presenca_avisar_pendentes()
  to service_role;

-- As duas rotinas são chamadas somente pelo tick do dispatcher, que já é
-- service-only. Triggers não dependem destes grants de chamada direta.
revoke all on function public.presenca_derrubar_expirados()
  from public, anon, authenticated;
grant execute on function public.presenca_derrubar_expirados()
  to service_role;

revoke all on function public.sla_msg_cache_refresh()
  from public, anon, authenticated;
grant execute on function public.sla_msg_cache_refresh()
  to service_role;

do $verify$
declare
  v_contraditorios integer;
begin
  if has_function_privilege('anon', 'public.presenca_avisar_pendentes()', 'execute')
     or has_function_privilege('authenticated', 'public.presenca_avisar_pendentes()', 'execute')
     or not has_function_privilege('service_role', 'public.presenca_avisar_pendentes()', 'execute') then
    raise exception 'PRESENCA_ALERTAS_GRANT_INVALIDO';
  end if;

  if has_function_privilege('authenticated', 'public.presenca_derrubar_expirados()', 'execute')
     or has_function_privilege('authenticated', 'public.sla_msg_cache_refresh()', 'execute') then
    raise exception 'MANUTENCAO_INTERNA_AINDA_EXPOSTA';
  end if;

  select count(*)
    into v_contraditorios
    from public.ncrm_notificacao n
   where n.resolvida_em is null
     and n.tipo = 'presenca_pendente'
     and not exists (
       select 1
         from public.presenca_estado e
        where e.corretor_id = n.corretor_id
          and e.aguardando_desde is not null
     );

  if v_contraditorios <> 0 then
    raise exception 'PRESENCA_ALERTA_SUPERADO_AINDA_ABERTO: %', v_contraditorios;
  end if;
end
$verify$;

commit;

-- Rollback operacional:
-- 1) restaurar a definição anterior capturada por pg_get_functiondef no
--    preflight da migration;
-- 2) manter as linhas já resolvidas como histórico (não reabrir obrigações
--    superadas);
-- 3) restaurar EXECUTE para authenticated somente se um chamador humano for
--    comprovado, o que não ocorreu no inventário atual.
