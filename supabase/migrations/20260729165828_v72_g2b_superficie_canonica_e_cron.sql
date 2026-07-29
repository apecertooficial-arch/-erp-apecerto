-- V7.2 GATE 2b — superfície pública canônica, cron do inventário e guarda de mídia.
create or replace function public.wa_v7_pode_ver_tudo()
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (select 1 from public.usuarios u where u.id=(select auth.uid())
                  and coalesce(u.ativo,false) and u.role::text in ('admin','diretor','gerente')) $$;
create or replace function public.wa_v7_meu_corretor()
returns bigint language sql stable security definer set search_path = pg_catalog, public as $$
  select c.id from public.corretores c where c.usuario_id=(select auth.uid()) and coalesce(c.ativo,true)
   order by c.id limit 1 $$;
revoke all on function public.wa_v7_pode_ver_tudo() from public, anon, authenticated;
revoke all on function public.wa_v7_meu_corretor()  from public, anon, authenticated;
grant execute on function public.wa_v7_pode_ver_tudo() to service_role;
grant execute on function public.wa_v7_meu_corretor()  to service_role;

-- Painel único: MESMA fonte e MESMA fórmula para cartões, contadores e alerta.
create or replace function public.wa_v7_painel()
returns jsonb language sql stable security definer set search_path = pg_catalog, public, wa_core as $$
  select jsonb_build_object(
    'contagens', (select to_jsonb(c) from wa_core.contagens(1) c),
    'sessoes', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'sessao_id', o.sessao_id, 'provider_session_id', o.provider_session_id,
                 'nome', o.nome_observado, 'estado', o.estado_confirmado,
                 'estado_em', o.estado_confirmado_em, 'sincronizacao_fresca', o.sincronizacao_fresca,
                 'em_quarentena', o.em_quarentena, 'corretor_id', o.corretor_operacional_id,
                 'corretor_nome', (select k.nome from public.corretores k where k.id=o.corretor_operacional_id),
                 'legado_instancia_id', o.legado_instancia_id)
               order by o.nome_observado nulls last, o.provider_session_id)
          from wa_core.v_sessao_operacional o
         where public.wa_v7_pode_ver_tudo()
            or o.usuario_operacional_id=(select auth.uid())
            or o.corretor_operacional_id=public.wa_v7_meu_corretor()), '[]'::jsonb),
    'arquivadas', case when public.wa_v7_pode_ver_tudo() then coalesce((
        select jsonb_agg(jsonb_build_object('provider_session_id',s.provider_session_id,
                 'arquivada_em',s.arquivada_em,'motivo',s.arquivada_motivo,
                 'legado_instancia_id',s.legado_instancia_id) order by s.provider_session_id)
          from wa_core.sessao s where s.arquivada_em is not null), '[]'::jsonb) else '[]'::jsonb end,
    'quarentena', case when public.wa_v7_pode_ver_tudo() then coalesce((
        select jsonb_agg(jsonb_build_object('tipo',q.tipo,'chave',q.chave) order by q.id)
          from wa_core.quarentena q where q.resolvido_em is null), '[]'::jsonb) else '[]'::jsonb end,
    'modo', (select modo from wa_core.config where id=1),
    'gerado_em', now()) $$;
revoke all on function public.wa_v7_painel() from public, anon;
grant execute on function public.wa_v7_painel() to authenticated, service_role;

create or replace function public.wa_v7_bridge_coletar_snapshot(p_account bigint default 1)
returns bigint language sql security definer set search_path = pg_catalog, public, wa_core as $$
  select wa_core.coletar_snapshot(p_account) $$;
revoke all on function public.wa_v7_bridge_coletar_snapshot(bigint) from public, anon, authenticated;
grant execute on function public.wa_v7_bridge_coletar_snapshot(bigint) to service_role;

-- ---------------------------------------------------------------------
-- Guarda de mídia (P0 operacional da Tica): vídeo acima do limite não é
-- publicável enquanto o contrato real do D-API não for comprovado.
-- Os três vídeos atuais têm ~16,2-16,4 MB e recebem HTTP 400.
-- ---------------------------------------------------------------------
create table if not exists wa_core.midia_validacao (
  id bigserial primary key, verificado_em timestamptz not null default now(),
  url text not null, tipo text, http_status int, bytes bigint, mime text,
  aprovado boolean not null, motivo text);
create index if not exists midia_validacao_url_idx on wa_core.midia_validacao (url, verificado_em desc);

create or replace function wa_core.validar_midia(p_url text, p_tipo text default 'video')
returns jsonb language plpgsql set search_path = pg_catalog, wa_core, public, extensions as $fn$
declare _st int; _hdr text; _bytes bigint; _mime text; _lim bigint; _ok boolean; _motivo text;
begin
  select video_max_bytes into _lim from wa_core.config where id=1;
  begin
    begin perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','15000'); exception when others then null; end;
    select h.status, (select value from unnest(h.headers) x where lower(x.field)='content-length'),
           (select value from unnest(h.headers) x where lower(x.field)='content-type')
      into _st, _hdr, _mime
      from extensions.http(('HEAD', p_url, NULL, NULL, NULL)::extensions.http_request) h;
  exception when others then _st := null; end;
  _bytes := nullif(btrim(coalesce(_hdr,'')),'')::bigint;
  if _st is null then _ok := false; _motivo := 'nao_foi_possivel_verificar';
  elsif _st not between 200 and 299 then _ok := false; _motivo := 'url_inacessivel_http_'||_st;
  elsif p_tipo='video' and _bytes is not null and _bytes > _lim then
    _ok := false; _motivo := 'video_acima_do_limite_'||_lim||'_bytes';
  else _ok := true; _motivo := null; end if;
  insert into wa_core.midia_validacao(url,tipo,http_status,bytes,mime,aprovado,motivo)
  values (p_url,p_tipo,_st,_bytes,_mime,_ok,_motivo);
  return jsonb_build_object('aprovado',_ok,'motivo',_motivo,'bytes',_bytes,'mime',_mime,'http',_st,'limite',_lim);
end $fn$;

create or replace function public.wa_v7_validar_midia(p_url text, p_tipo text default 'video')
returns jsonb language sql security definer set search_path = pg_catalog, public, wa_core as $$
  select case when public.wa_v7_pode_ver_tudo() or public.wa_v7_meu_corretor() is not null
              then wa_core.validar_midia(p_url, p_tipo)
              else jsonb_build_object('aprovado', false, 'motivo','nao_autorizado') end $$;
revoke all on function public.wa_v7_validar_midia(text,text) from public, anon;
grant execute on function public.wa_v7_validar_midia(text,text) to authenticated, service_role;

-- cron do inventário canônico (não substitui o legado; roda ao lado)
do $$
begin
  if not exists (select 1 from cron.job where jobname='wa_core_inventario') then
    perform cron.schedule('wa_core_inventario','*/5 * * * *','select wa_core.coletar_snapshot(1);');
  end if;
end $$;
