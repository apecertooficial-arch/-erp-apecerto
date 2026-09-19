-- DRAFT NÃO APLICADO — P0: comandos internos da Sara/Funil service-only.
--
-- Evidência canônica em 2026-09-19:
--   * funil_mover é chamada internamente por funil_aplicar_sara,
--     funil_cascata_tick e motor_momento_lead;
--   * funil_aplicar_sara(false, ...) aplica sugestões em lote;
--   * funil_cascata_tick(false) sincroniza D-API e redistribui carteira;
--   * ia_salvar_avaliacao insere avaliação arbitrária e seu Edge worker antigo
--     (ia-avaliar-lote) está implantado como 410/desativado;
--   * runners atuais de Sara usam SUPABASE_SERVICE_ROLE_KEY;
--   * nenhum cron ativo referencia estas quatro funções;
--   * não há chamador direto no aplicativo ou nas Edge Functions inspecionadas.
--
-- Revogar EXECUTE do chamador autenticado não impede uma função SECURITY
-- DEFINER owned by postgres de chamar funil_mover internamente: o chamador
-- interno executa com a identidade do owner. Ainda assim, o conjunto deve ser
-- ensaiado em Postgres isolado antes de virar migration.

begin;

do $contract$
declare
  v_fn regprocedure;
  v_service_only regprocedure[] := array[
    'public.funil_mover(uuid,text,bigint,text,text,jsonb,integer,boolean)'::regprocedure,
    'public.funil_aplicar_sara(boolean,integer)'::regprocedure,
    'public.funil_cascata_tick(boolean)'::regprocedure,
    'public.ia_salvar_avaliacao(bigint,bigint,numeric,jsonb,jsonb)'::regprocedure
  ];
begin
  foreach v_fn in array v_service_only loop
    execute pg_catalog.format(
      'revoke execute on function %s from public, anon, authenticated', v_fn
    );
    execute pg_catalog.format(
      'grant execute on function %s to service_role', v_fn
    );

    if has_function_privilege('anon', v_fn, 'execute')
       or has_function_privilege('authenticated', v_fn, 'execute')
       or not has_function_privilege('service_role', v_fn, 'execute') then
      raise exception 'contrato service-only inválido em %', v_fn;
    end if;
  end loop;

  -- Contrato separado e intencional: o token Sara usa o papel Postgres
  -- authenticated, mas a função exige app_metadata.app_role = 'sara'.
  if not has_function_privilege(
    'authenticated',
    'public.ncrm_sara_classificar(bigint,integer,jsonb,text)'::regprocedure,
    'execute'
  ) then
    raise exception 'ncrm_sara_classificar perdeu o contrato do agente Sara';
  end if;
end;
$contract$;

commit;

-- ROLLBACK DE EMERGÊNCIA (somente para a função comprovadamente afetada):
-- grant execute on function public.<assinatura> to authenticated;
-- Nunca restaurar EXECUTE para PUBLIC.
