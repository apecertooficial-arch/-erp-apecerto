-- V7.2 GATE 1 — freio do escritor destrutivo + fechamento das superfícies de envio.
--
-- O novo corpo de `motor_envia_abordagem` é derivado do corpo EXATO que está
-- deployado, por substituição mecânica. Nada é transcrito à mão: se o corpo em
-- produção não for o auditado, a migration aborta.
do $mig$
declare
  _src text; _novo text; _md5 text;
  _alvo_update constant text := '      update instancias set conectada=false, status_dapi=''disconnected'' where id=_cand.iid;';
  _alvo_where  constant text := '    where coalesce(i.conectada,false)=true and i.status_dapi=''connected''';
begin
  select prosrc, md5(prosrc) into _src, _md5
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'motor_envia_abordagem';

  if _md5 <> '6411390a39050fda6153b6993b4e59dc' then
    raise exception 'ABORTADO: corpo de motor_envia_abordagem divergente do auditado (md5=%)', _md5;
  end if;
  if position(_alvo_update in _src) = 0 then raise exception 'ABORTADO: escritor destrutivo nao encontrado'; end if;
  if position(_alvo_where  in _src) = 0 then raise exception 'ABORTADO: filtro de candidatos nao encontrado'; end if;

  -- (1) remove a ESCRITA DE ESTADO. A instancia ausente da listagem continua
  --     sendo PULADA nesta execucao: mesma ordem, mesmas tentativas, mesma
  --     latencia. So a escrita some.
  _novo := replace(_src, _alvo_update,
    '      -- V7.2 GATE 1: escrita de estado REMOVIDA. Ausencia numa listagem'||chr(10)||
    '      -- nao e evidencia de desconexao. Quem escreve estado e o'||chr(10)||
    '      -- reconciliador de inventario, apos snapshot completo e valido.');

  -- (2) estreitamento: nunca montar sessionId vazio
  _novo := replace(_novo, _alvo_where,
    _alvo_where || chr(10) || '      and coalesce(i.instancia_dapi,'''') <> ''''');

  if position('conectada=false' in _novo) > 0 then
    raise exception 'ABORTADO: sobrou escrita de conectada=false';
  end if;

  execute format($f$
    create or replace function public.motor_envia_abordagem(
      p_auto bigint, p_nome text, p_bloco text, p_lead jsonb, p_lead_id bigint,
      p_corretor_id bigint, p_produto_id bigint, p_abordagem_ids jsonb)
    returns void language plpgsql security definer
    set search_path = pg_catalog, public, extensions
    as %L $f$, _novo);
end
$mig$;

comment on function public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb) is
  'V7.2 GATE 1 (30/07/2026): o motor de ENVIO nao escreve estado de conexao. '
  'Candidatos, ordem, failover e latencia identicos aos de antes.';

-- ---------------------------------------------------------------------
-- Autorizacao interna dos wrappers hoje abertos a `anon`
-- ---------------------------------------------------------------------
create or replace function public.wa_pode_disparar_abordagem(p_lead bigint)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select
    -- worker/cron: sem usuario, papel de servico
    (select auth.uid()) is null
    -- admin / diretor / gerente
    or exists (select 1 from public.usuarios u
                where u.id = (select auth.uid()) and coalesce(u.ativo,false)
                  and u.role::text in ('admin','diretor','gerente'))
    -- o corretor dono do lead
    or exists (select 1 from public.leads l
                join public.corretores c on c.id = l.corretor_id
               where l.id = p_lead and c.usuario_id = (select auth.uid()))
    or exists (select 1 from public.negocios n
                join public.corretores c on c.id = n.corretor_id
               where n.lead_id = p_lead and c.usuario_id = (select auth.uid()))
$$;
revoke all on function public.wa_pode_disparar_abordagem(bigint) from public, anon;
grant execute on function public.wa_pode_disparar_abordagem(bigint) to authenticated, service_role;

create or replace function public.enviar_abordagem_lead(p_lead bigint)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare v_neg bigint; v_cor bigint; v_leadjson jsonb; v_abids jsonb;
begin
  if not public.wa_pode_disparar_abordagem(p_lead) then
    return jsonb_build_object('ok',false,'error','nao_autorizado');
  end if;
  select id, corretor_id into v_neg, v_cor from negocios where lead_id=p_lead and coalesce(status,'aberto') not in ('ganho','perdido','descartado') order by id desc limit 1;
  if v_cor is null then select corretor_id into v_cor from leads where id=p_lead; end if;
  if v_cor is null then return jsonb_build_object('ok',false,'error','lead_sem_corretor'); end if;
  select jsonb_build_object('nome',nome,'telefone',telefone,'email',email,'primeiro_nome',split_part(nome,' ',1)) into v_leadjson from leads where id=p_lead;
  select coalesce(jsonb_agg(id),'[]'::jsonb) into v_abids from abordagens where coalesce(ativo,true)=true;
  perform motor_envia_abordagem(0,'Abordagem manual (chat)','chat',v_leadjson,p_lead,v_cor,null,v_abids);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.reenviar_abordagem(p_negocio bigint)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare v_lead bigint; v_cor bigint; v_leadjson jsonb; v_abids jsonb;
begin
  select n.lead_id, n.corretor_id into v_lead, v_cor from negocios n where n.id=p_negocio;
  if v_cor is null then return jsonb_build_object('ok',false,'error','sem_corretor'); end if;
  if not public.wa_pode_disparar_abordagem(v_lead) then
    return jsonb_build_object('ok',false,'error','nao_autorizado');
  end if;
  select jsonb_build_object('nome',nome,'telefone',telefone,'email',email,'primeiro_nome',split_part(nome,' ',1)) into v_leadjson from leads where id=v_lead;
  select coalesce(jsonb_agg(id),'[]'::jsonb) into v_abids from abordagens where coalesce(ativo,true)=true;
  perform motor_envia_abordagem(0,'Reenvio manual','reenvio',v_leadjson,v_lead,v_cor,null,v_abids);
  return jsonb_build_object('ok',true);
end $$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on function public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb) to service_role;

revoke all on function public.enviar_abordagem_lead(bigint) from public, anon;
grant execute on function public.enviar_abordagem_lead(bigint) to authenticated, service_role;
revoke all on function public.reenviar_abordagem(bigint) from public, anon;
grant execute on function public.reenviar_abordagem(bigint) to authenticated, service_role;

revoke all on function public.excluir_instancia(bigint) from public, anon;
revoke all on function public.motor_processar_fila() from public, anon, authenticated;
grant execute on function public.motor_processar_fila() to service_role;
