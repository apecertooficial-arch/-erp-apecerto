-- Onda 0.1 — fechar a exposicao de RPCs ao papel `anon`.
--
-- PROBLEMA (verificado em 14/09/2026 no catalogo do Postgres):
-- 103 funcoes SECURITY DEFINER no schema public tinham EXECUTE para `anon`, e
-- 61 delas nao continham NENHUMA verificacao de identidade no corpo (sem
-- auth.uid(), auth.role(), is_admin(), can_manage_all()). SECURITY DEFINER roda
-- com os privilegios do dono e IGNORA o RLS; `anon` e acionado pela chave
-- publicavel, que por definicao e publica (vai no JavaScript do site).
--
-- Exemplo comprovado: admin_dashboard_financeiro() e SQL puro, sem autorizacao,
-- e devolve VGV do mes, VGV total, numero de vendas e soma das comissoes.
-- Entre as 61 havia tambem funcoes de ESCRITA: wa_ingerir (injetar mensagens de
-- WhatsApp), funil_mover, transferir_com_aceite, redistribuir_lead,
-- solicitar_descarte/aprovar_descarte, dapi_set_webhook_all.
--
-- ATENCAO AO DETALHE QUE FEZ A PRIMEIRA TENTATIVA FALHAR:
-- a permissao vinha de PUBLIC (padrao do Postgres para funcoes), nao de um
-- grant direto a `anon`. `revoke ... from anon` so resolveu 6 de 61. O correto
-- e revogar de PUBLIC e regrantear explicitamente a authenticated/service_role.
--
-- EXCECOES mantidas (publicas por desenho, protegidas por token/segredo):
--   agenda_publica(p_token) · ficha_publica_obter(p_token)
--   ficha_publica_enviar(p_token, ...) · dc_registrar_movimentacao(..., p_secret)
--   papel_atual() (devolve so o papel de quem chama)
--
-- VERIFICADO ANTES DE APLICAR: nem o site (apecerto-site) nem as 52 edge
-- functions chamam qualquer funcao revogada com a chave anon. As RPCs do site
-- (site_event_ingest_v2, tracking_delivery_*, sara_site_rate_check, ...) ja nao
-- tinham acesso anon.
--
-- RESULTADO MEDIDO: funcoes SECURITY DEFINER expostas a anon sem guarda
-- 61 -> 4 (as 4 excecoes acima). admin_dashboard_*: anon 4 -> 0,
-- authenticated permanece 4. Testado com `set role anon` (insufficient_privilege)
-- e `set role authenticated` (retorno normal).
--
-- REVERSAO: `grant execute on function public.<nome>(<args>) to public;`

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
      and p.prosrc !~* 'auth\.uid|auth\.role|is_admin|can_manage|current_setting'
      and p.proname not in (
        'agenda_publica',
        'ficha_publica_obter',
        'ficha_publica_enviar',
        'dc_registrar_movimentacao',
        'papel_atual'
      )
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', r.proname, r.args);
    n := n + 1;
  end loop;
  raise notice 'fechadas % funcoes para anon (mantidas para authenticated/service_role)', n;
end $$;
