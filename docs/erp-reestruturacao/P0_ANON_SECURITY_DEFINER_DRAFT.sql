-- DRAFT NÃO APLICADO — P0: fechar RPCs SECURITY DEFINER para anon.
--
-- Evidência em 2026-09-19: o advisor oficial 0028 encontrou 47 funções
-- SECURITY DEFINER no schema public executáveis por anon. Todas são owned by
-- postgres. Este contrato remove o grant implícito de PUBLIC, separa endpoints
-- públicos intencionais, operações autenticadas e operações service-only.
--
-- Antes de aplicar:
--   1. ensaiar em Supabase/Postgres isolado;
--   2. provar fluxos autenticados e públicos positivos/negativos;
--   3. confirmar que as assinaturas continuam iguais;
--   4. capturar advisor antes/depois e plano de rollback.

begin;

do $contract$
declare
  v_fn regprocedure;
  v_authenticated regprocedure[] := array[
    'public.agenda_link_regenerar()'::regprocedure,
    'public.agenda_link_token()'::regprocedure,
    'public.agendar_mensagem(text,timestamptz,text,text,text,bigint,text,bigint,text,text)'::regprocedure,
    'public.aprovar_solicitacao(uuid)'::regprocedure,
    'public.atualizar_meu_perfil(text,text,text,text,boolean,boolean,boolean,boolean,text,text,text,text,text,text,text)'::regprocedure,
    'public.can_manage_all()'::regprocedure,
    'public.criar_disparo(text,text,text,text,text,text,bigint,boolean)'::regprocedure,
    'public.crm_etapa_reordenar(bigint,bigint[])'::regprocedure,
    'public.crm_etapa_salvar(bigint,bigint,text,text)'::regprocedure,
    'public.crm_funil_excluir(bigint,bigint)'::regprocedure,
    'public.current_broker_id()'::regprocedure,
    'public.dashboard_kpis()'::regprocedure,
    'public.distribuicao_config_ler()'::regprocedure,
    'public.distribuicao_config_salvar(time,time,time,text,integer,boolean,boolean,boolean,text)'::regprocedure,
    'public.distribuicao_saude()'::regprocedure,
    'public.equipe_visao()'::regprocedure,
    'public.erp_salvar_ips(text[])'::regprocedure,
    'public.erp_toggle_distribuicao(boolean)'::regprocedure,
    'public.funil_motor_ligar(boolean)'::regprocedure,
    'public.has_perm(text,text)'::regprocedure,
    'public.is_equipe()'::regprocedure,
    'public.listar_corretores_transferencia()'::regprocedure,
    'public.manages_broker(bigint)'::regprocedure,
    'public.meu_perfil()'::regprocedure,
    'public.mover_negocio(bigint,bigint,text)'::regprocedure,
    'public.ncrm_agendar_visita_e_encaminhar(bigint,integer,bigint,date,text,uuid,text,boolean,bigint,text,text)'::regprocedure,
    'public.papel_atual()'::regprocedure,
    'public.perf_log_sessao(text)'::regprocedure,
    'public.pj_log(text,text,uuid,uuid)'::regprocedure,
    'public.pode_ver_processo(text)'::regprocedure,
    'public.presenca_config_ler()'::regprocedure,
    'public.presenca_config_salvar(boolean,integer[],time,time,integer,integer,integer[])'::regprocedure,
    'public.presenca_derrubar()'::regprocedure,
    'public.presenca_status()'::regprocedure,
    'public.projeto_visivel(uuid)'::regprocedure,
    'public.recusar_solicitacao(uuid,text)'::regprocedure,
    'public.registrar_acao(bigint,text,text,text,text,integer)'::regprocedure,
    'public.registrar_auditoria(text,text,text,text,jsonb,jsonb,text)'::regprocedure,
    'public.registrar_observacao(bigint,text)'::regprocedure,
    'public.solicitar_venda(bigint,uuid,numeric,text,text)'::regprocedure,
    'public.transferir_negocio(bigint,bigint)'::regprocedure,
    'public.transferir_negocios_massa(bigint,bigint,bigint,bigint)'::regprocedure
  ];
  -- Exceções LEGADAS, não aprovadas como contrato final. Permanecem públicas
  -- apenas para que este primeiro hardening não quebre links já distribuídos.
  -- Tokens estão em texto, sem expiração/rate limit comprovados; a fatia de
  -- hardening público deve substituí-los antes do aceite comercial.
  v_public_legacy_token regprocedure[] := array[
    'public.agenda_publica(text,date,date)'::regprocedure,
    'public.ficha_publica_enviar(text,jsonb)'::regprocedure,
    'public.ficha_publica_obter(text)'::regprocedure
  ];
  v_service_only regprocedure[] := array[
    'public.dc_registrar_movimentacao(jsonb,text)'::regprocedure,
    'public.trg_corretor_desativado_avisa_carteira()'::regprocedure
  ];
begin
  -- Operações de usuário: nunca anônimas; autorização continua obrigatória no
  -- corpo da função e será auditada separadamente para o advisor 0029.
  foreach v_fn in array v_authenticated loop
    execute format('revoke execute on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated, service_role', v_fn);
  end loop;

  -- APIs públicas legadas: removem o grant genérico de PUBLIC e mantêm apenas
  -- papéis explícitos, sem confundir compatibilidade com segurança concluída.
  foreach v_fn in array v_public_legacy_token loop
    execute format('revoke execute on function %s from public', v_fn);
    execute format('grant execute on function %s to anon, authenticated, service_role', v_fn);
  end loop;

  -- Webhook DataCrazy usa service_role na Edge Function implantada. Função de
  -- trigger também não é uma RPC de usuário.
  foreach v_fn in array v_service_only loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_fn);
    execute format('grant execute on function %s to service_role', v_fn);
  end loop;

  -- Prova fail-closed dentro da mesma transação.
  foreach v_fn in array v_authenticated || v_service_only loop
    if has_function_privilege('anon', v_fn, 'execute') then
      raise exception 'anon ainda executa %', v_fn;
    end if;
  end loop;

  foreach v_fn in array v_authenticated loop
    if not has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception 'authenticated perdeu contrato legítimo em %', v_fn;
    end if;
  end loop;

  foreach v_fn in array v_public_legacy_token loop
    if not has_function_privilege('anon', v_fn, 'execute') then
      raise exception 'endpoint público perdeu contrato em %', v_fn;
    end if;
  end loop;

  foreach v_fn in array v_service_only loop
    if has_function_privilege('authenticated', v_fn, 'execute')
       or not has_function_privilege('service_role', v_fn, 'execute') then
      raise exception 'contrato service-only inválido em %', v_fn;
    end if;
  end loop;
end
$contract$;

commit;

-- ROLLBACK DE EMERGÊNCIA (executar separadamente apenas após revisar o motivo):
-- grant execute on function <assinatura> to <papel_anterior>;
-- Não existe rollback genérico seguro para PUBLIC: restaurá-lo reabre a RPC
-- para qualquer papel presente ou futuro.
