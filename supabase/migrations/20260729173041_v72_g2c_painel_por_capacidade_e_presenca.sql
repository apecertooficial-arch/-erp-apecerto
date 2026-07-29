-- V7.2 — correções dos itens 3, 4 e 5 do parecer do Codex.
--
-- Reproduzido em produção ANTES desta migration, impersonando os usuários:
--   Tica    -> 1 cartão visível, mas contagens total=10, desconectadas=1, arquivadas=2
--   Claudia -> 2 cartões visíveis, mesmas contagens globais
-- Ou seja: a corretora veria a própria sessão conectada e, ao lado, um alerta
-- sobre a Kapri desconectada. É o mesmo defeito que a V7.2 veio matar ("9/1/2
-- nos cartões e 3 no alerta"), reintroduzido em outra forma. Culpa minha.
--
-- Correção: as contagens passam a ser calculadas SOBRE AS SESSÕES VISÍVEIS ao
-- chamador, e a capacidade vira um campo explícito em vez de ser inferida da
-- existência de registros arquivados.

create or replace function public.wa_v7_painel()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, wa_core as $$
  with cap as (select public.wa_v7_pode_ver_tudo() tudo, public.wa_v7_meu_corretor() meu),
  visiveis as (
    select o.* from wa_core.v_sessao_operacional o, cap
     where o.provider_account_id = 1
       and (cap.tudo
            or o.usuario_operacional_id = (select auth.uid())
            or o.corretor_operacional_id = cap.meu)),
  arq as (
    select s.* from wa_core.sessao s, cap
     where s.provider_account_id = 1 and s.arquivada_em is not null and cap.tudo)
  select jsonb_build_object(
    'pode_ver_tudo', (select tudo from cap),
    'contagens', jsonb_build_object(
      'total',          (select count(*) from visiveis),
      'conectadas',     (select count(*) from visiveis where estado_confirmado='connected'),
      'conectando',     (select count(*) from visiveis where estado_confirmado='connecting'),
      'desconectadas',  (select count(*) from visiveis where estado_confirmado='disconnected'),
      'desconhecidas',  (select count(*) from visiveis where estado_confirmado='desconhecido'),
      'arquivadas',     (select count(*) from arq),
      'em_quarentena',  (select count(*) from visiveis where em_quarentena),
      'sincronizacao_fresca', coalesce((select bool_and(sincronizacao_fresca) from visiveis), false),
      'ultimo_snapshot_completo_em',
        (select max(sn.concluido_em) from wa_core.snapshot sn where sn.provider_account_id=1 and sn.completo)),
    'sessoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'sessao_id', v.sessao_id, 'provider_session_id', v.provider_session_id,
               'nome', v.nome_observado, 'estado', v.estado_confirmado,
               'estado_em', v.estado_confirmado_em, 'sincronizacao_fresca', v.sincronizacao_fresca,
               'em_quarentena', v.em_quarentena, 'corretor_id', v.corretor_operacional_id,
               'corretor_nome', (select k.nome from public.corretores k where k.id=v.corretor_operacional_id),
               'legado_instancia_id', v.legado_instancia_id)
             order by v.nome_observado nulls last, v.provider_session_id)
        from visiveis v), '[]'::jsonb),
    'arquivadas', coalesce((
      select jsonb_agg(jsonb_build_object('provider_session_id', a.provider_session_id,
               'arquivada_em', a.arquivada_em, 'motivo', a.arquivada_motivo,
               'legado_instancia_id', a.legado_instancia_id) order by a.provider_session_id)
        from arq a), '[]'::jsonb),
    'quarentena', case when (select tudo from cap) then coalesce((
        select jsonb_agg(jsonb_build_object('tipo',q.tipo,'chave',q.chave) order by q.id)
          from wa_core.quarentena q where q.resolvido_em is null), '[]'::jsonb) else '[]'::jsonb end,
    'modo', (select modo from wa_core.config where id=1),
    'gerado_em', now()) $$;

comment on function public.wa_v7_painel() is
  'Contagens calculadas sobre as sessoes VISIVEIS ao chamador. `pode_ver_tudo` '
  'e explicito: nao inferir capacidade a partir de contadores.';

revoke all on function public.wa_v7_painel() from public, anon;
grant execute on function public.wa_v7_painel() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Presença: ao cair, reiniciar a janela de confirmação.
--
-- `presenca_derrubar` zerava `aguardando_desde`/`prazo_em` mas NÃO tocava em
-- `ultima_confirmacao`. Como a decisão de reabrir o prompt parte dela, o
-- polling seguinte reabria o modal em cima do aviso de "fora da fila".
-- Quem está fora da distribuição não deve ser cobrado de presença.
-- A regra comercial (quem recebe lead, pesos, fila circular) não muda.
-- ---------------------------------------------------------------------
create or replace function public.presenca_derrubar()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_corretor int;
begin
  select id into v_corretor from corretores where usuario_id = auth.uid();
  if v_corretor is null then return jsonb_build_object('ok', false); end if;
  update corretores set online = false where id = v_corretor;
  insert into presenca_estado(corretor_id, ultima_confirmacao)
       values (v_corretor, now())
  on conflict (corretor_id) do update
     set ultima_confirmacao = now(), aguardando_desde = null, prazo_em = null;
  return jsonb_build_object('ok', true, 'online', false);
end $$;

-- Estado de disponibilidade, para o aviso sobreviver a refresh/novo login.
create or replace function public.wa_v7_minha_presenca()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public as $$
  select coalesce((
    select jsonb_build_object(
      'corretor_id', c.id,
      'na_distribuicao', coalesce(c.online,false),
      'motivo', case when coalesce(c.online,false) then null
                     else 'confirmacao_de_presenca_expirada_ou_saida_manual' end,
      'ultima_presenca', c.ultima_presenca)
    from public.corretores c
   where c.usuario_id = (select auth.uid()) and coalesce(c.ativo,true)
   order by c.id limit 1), jsonb_build_object('corretor_id', null, 'na_distribuicao', true)) $$;
revoke all on function public.wa_v7_minha_presenca() from public, anon;
grant execute on function public.wa_v7_minha_presenca() to authenticated, service_role;
