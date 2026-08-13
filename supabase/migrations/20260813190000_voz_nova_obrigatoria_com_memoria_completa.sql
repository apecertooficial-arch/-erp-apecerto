-- VOZ NOVA VIRA REGRA, NAO PREFERENCIA
--
-- RECLAMACAO DO FABIANO (13/08): esta recebendo leads que ja trabalhou.
--
-- O QUE A INVESTIGACAO ACHOU, medido e nao suposto:
--   * a regra funciona -- das 204 entregas, so 1 tinha conversa de WhatsApp
--     anterior. As outras 110 "conversas" nasceram DEPOIS da entrega: e o
--     proprio corretor chamando o lead;
--   * mas a regra so enxergava UMA fonte: mensagem de WhatsApp. E o banco de
--     mensagens comeca em 12/07/2026. Tudo que o corretor trabalhou antes
--     disso e invisivel para o sistema. O Fabiano lembra de 2024; o ERP nao
--     tem como lembrar -- nao existe registro anterior em NENHUMA tabela
--     (crm_atividades, atendimento_acoes, visitas, tarefas: todas comecam em
--     20/07/2026, e leads.extras dos leads do Aquario vem vazio);
--   * e quando ninguem sobrava depois da exclusao, a roleta ENTREGAVA ASSIM
--     MESMO, em silencio. Era a decisao errada: entregar um lead repetido
--     custa mais do que segurar o lead por vinte minutos.
--
-- ENTAO ESTE ARQUIVO FAZ TRES COISAS:
--   1. amplia a memoria para toda fonte que existe hoje, em vez de so WhatsApp;
--   2. cria um lugar onde o corretor DECLARA "ja falei com esse" -- a unica
--      forma de ensinar ao sistema o que ele nao viveu;
--   3. torna a regra obrigatoria: sem voz nova disponivel, o lead espera.

-- 1. O QUE O CORRETOR SABE E O BANCO NAO
--
-- Nenhuma tabela do ERP guarda contato anterior a 12/07/2026. Para o historico
-- de anos que o corretor tem na cabeca, a unica fonte possivel e ele mesmo.
-- Isto e o registro dessa declaracao -- e ela vale para sempre, por telefone,
-- independente de o lead ser recriado depois com outro id.
create table if not exists public.f2_voz_nova_bloqueio (
  telefone    text   not null,
  corretor_id bigint not null,
  origem      text   not null default 'declarado_pelo_corretor',
  detalhe     text,
  criado_em   timestamptz not null default now(),
  primary key (telefone, corretor_id)
);
alter table public.f2_voz_nova_bloqueio enable row level security;

comment on table public.f2_voz_nova_bloqueio is
  'Corretor x telefone que nao devem se cruzar de novo. Alimentado pela declaracao do corretor ("ja falei com esse cliente"), que e a unica fonte de historico anterior a 12/07/2026.';

-- Chamada pelo aplicativo quando o corretor diz que ja falou com o cliente.
-- Devolve o lead para a fila E grava o bloqueio, para que ele nao volte.
create or replace function public.f2_ja_falei_com_esse(p_negocio_id bigint, p_detalhe text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_cor bigint; v_tel text; v_lead bigint; v_card uuid;
begin
  select n.corretor_id, n.lead_id into v_cor, v_lead from negocios n where n.id = p_negocio_id;
  if v_cor is null then return jsonb_build_object('ok', false, 'erro', 'negocio_sem_corretor'); end if;

  select public.telefone_br_normalizado(l.telefone) into v_tel from leads l where l.id = v_lead;
  if v_tel is null then return jsonb_build_object('ok', false, 'erro', 'telefone_invalido'); end if;

  insert into public.f2_voz_nova_bloqueio (telefone, corretor_id, origem, detalhe)
  values (v_tel, v_cor, 'declarado_pelo_corretor', p_detalhe)
  on conflict (telefone, corretor_id) do update set detalhe = coalesce(excluded.detalhe, f2_voz_nova_bloqueio.detalhe);

  -- Solta o lead: ele volta para a fila e a proxima entrega ja respeita o bloqueio.
  update leads    set corretor_id = null where id = v_lead;
  update negocios set corretor_id = null where id = p_negocio_id;

  select f.id into v_card from f2_lead f where f.origem_negocio_id = p_negocio_id and f.descartado_em is null;
  if v_card is not null then
    update f2_lead
       set descartado_em = now(), descarte_motivo = 'Ja falei com este cliente',
           descarte_detalhe = coalesce(p_detalhe, 'O corretor declarou contato anterior. Lead devolvido para a fila e bloqueado para ele.'),
           atualizado_em = now(), versao = versao + 1
     where id = v_card;
    insert into f2_evento(funil_lead_id, tipo, titulo, detalhe, payload)
    values (v_card, 'lead_descartado', 'Devolvido: o corretor ja falou com este cliente',
            'Regra da voz nova. O lead volta para a fila e nao sera entregue a este corretor de novo.',
            jsonb_build_object('corretor_id', v_cor, 'telefone', v_tel));
  end if;

  return jsonb_build_object('ok', true, 'telefone', v_tel, 'corretor_id', v_cor, 'devolvido', true);
end $function$;

grant execute on function public.f2_ja_falei_com_esse(bigint, text) to authenticated;

-- 2. MEMORIA COMPLETA
--
-- Antes olhava so wa_mensagens. Agora olha tudo que liga um corretor a um
-- telefone. Duas escolhas de projeto que valem explicar:
--   * conversa SEM mensagem tambem conta (537 conversas estao assim -- a
--     sincronizacao trouxe a conversa e nao as mensagens). Contar como
--     historico e o lado seguro do erro;
--   * comparacao pelos ultimos 8 digitos, porque o nono digito varia entre as
--     bases e comparar o numero inteiro perderia metade dos casos.
create or replace function public.f2_corretores_com_historico(p_telefone text)
returns setof bigint language sql stable security definer set search_path to 'public'
as $function$
with alvo as (
  select right(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), 8) as ult8
), ids as (
  select l.id from leads l, alvo a
   where length(a.ult8) = 8
     and right(regexp_replace(coalesce(l.telefone,''), '\D', '', 'g'), 8) = a.ult8
), fontes as (
  -- conversa de WhatsApp com mensagem trocada
  select i.corretor_id as cid
    from alvo a
    join wa_contatos ct on right(regexp_replace(coalesce(ct.telefone,''), '\D', '', 'g'), 8) = a.ult8
    join wa_conversas cv on cv.contato_id = ct.id
    join wa_mensagens m  on m.conversa_id = cv.id and not coalesce(m.is_grupo, false)
    join wa_instancias i on i.id = cv.instancia_id
   where length(a.ult8) = 8
  union
  -- conversa aberta mesmo sem mensagem sincronizada
  select i.corretor_id
    from alvo a
    join wa_contatos ct on right(regexp_replace(coalesce(ct.telefone,''), '\D', '', 'g'), 8) = a.ult8
    join wa_conversas cv on cv.contato_id = ct.id
    join wa_instancias i on i.id = cv.instancia_id
   where length(a.ult8) = 8
  union
  -- o corretor declarou que ja falou
  select b.corretor_id from f2_voz_nova_bloqueio b, alvo a
   where length(a.ult8) = 8 and right(regexp_replace(b.telefone, '\D', '', 'g'), 8) = a.ult8
  union
  -- ja foi dono do lead alguma vez
  select d.para from lead_dono_auditoria d where d.lead_id in (select id from ids)
  union
  -- teve card no Funil 2.0, inclusive descartado
  select f.corretor_id from f2_lead f, alvo a
   where length(a.ult8) = 8 and right(regexp_replace(coalesce(f.telefone,''), '\D', '', 'g'), 8) = a.ult8
  union
  -- teve negocio
  select n.corretor_id from negocios n where n.lead_id in (select id from ids)
  union
  select x.corretor_id from crm_atividades x   where x.lead_id in (select id from ids)
  union
  select x.corretor_id from atendimento_acoes x where x.lead_id in (select id from ids)
  union
  select x.corretor_id from crm_tarefas x       where x.lead_id in (select id from ids)
  union
  select x.corretor_id from visitas x           where x.lead_id in (select id from ids)
  union
  select x.corretor_id from lead_momentos x     where x.lead_id in (select id from ids)
  union
  select x.corretor_id from negocio_estagio_historico x where x.lead_id in (select id from ids)
  union
  select x.corretor_id from ia_notas_atendimento x, alvo a
   where x.lead_id in (select id from ids)
      or (length(a.ult8) = 8 and right(regexp_replace(coalesce(x.telefone,''), '\D', '', 'g'), 8) = a.ult8)
)
select distinct cid from fontes where cid is not null;
$function$;

-- 3. A EXCLUSAO PASSA A SER OBRIGATORIA QUANDO QUEM CHAMA PEDE
--
-- O parametro novo mantem o comportamento antigo para quem ja usava a funcao,
-- e da a carga o direito de dizer "prefiro nao entregar a entregar repetido".
create or replace function public.motor_proximo_sequencial_exceto(
  p_auto bigint, p_bloco text, p_excluir bigint[], p_exclusao_obrigatoria boolean default false)
returns bigint language plpgsql security definer set search_path to 'public'
as $function$
declare v_total numeric; v_id bigint; v_marcados int; v_exige boolean;
        v_ex bigint[] := coalesce(p_excluir, '{}'::bigint[]);
        v_sobra int;
begin
  perform pg_advisory_xact_lock(hashtext(coalesce(p_auto,0)::text||':'||coalesce(p_bloco,'_')));

  v_exige := coalesce(public.distribuicao_exige_apto(p_auto, p_bloco), true);
  select count(*) into v_marcados from public.distribuicao_marcados(p_auto, p_bloco);

  if v_marcados > 0 then
    update motor_roleta_contadores rc set peso = 0
     where rc.automacao_id = p_auto and rc.bloco_id = p_bloco
       and coalesce(rc.peso,0) > 0
       and not exists (select 1 from public.distribuicao_marcados(p_auto, p_bloco) m
                        where m.corretor_id = rc.corretor_id);
    insert into motor_roleta_contadores(automacao_id, bloco_id, corretor_id, peso)
    select p_auto, p_bloco, m.corretor_id, m.peso
      from public.distribuicao_marcados(p_auto, p_bloco) m
    on conflict (automacao_id, bloco_id, corretor_id) do update set peso = excluded.peso;
  end if;

  select count(*) into v_sobra
    from motor_roleta_contadores rc join corretores c on c.id = rc.corretor_id
   where rc.automacao_id = p_auto and rc.bloco_id = p_bloco
     and coalesce(rc.peso,0) > 0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id))
     and not (rc.corretor_id = any(v_ex));

  -- AQUI ESTAVA O FURO. Antes: v_ex := '{}' -- a exclusao caia e o lead ia para
  -- quem ja tinha falado, sem ninguem ficar sabendo. Agora quem chama decide.
  if v_sobra = 0 then
    if p_exclusao_obrigatoria then return null; end if;
    v_ex := '{}'::bigint[];
  end if;

  select sum(rc.peso) into v_total
    from motor_roleta_contadores rc join corretores c on c.id = rc.corretor_id
   where rc.automacao_id = p_auto and rc.bloco_id = p_bloco
     and coalesce(rc.peso,0) > 0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id))
     and not (rc.corretor_id = any(v_ex));
  if coalesce(v_total,0) <= 0 then return null; end if;

  update motor_roleta_contadores rc
     set credito = rc.credito + rc.peso
    from corretores c
   where c.id = rc.corretor_id and rc.automacao_id = p_auto and rc.bloco_id = p_bloco
     and coalesce(rc.peso,0) > 0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id))
     and not (rc.corretor_id = any(v_ex));

  select rc.corretor_id into v_id
    from motor_roleta_contadores rc join corretores c on c.id = rc.corretor_id
   where rc.automacao_id = p_auto and rc.bloco_id = p_bloco
     and coalesce(rc.peso,0) > 0 and coalesce(c.ativo,true)
     and (not v_exige or public.corretor_pode_receber(c.id))
     and not (rc.corretor_id = any(v_ex))
   order by rc.credito desc, rc.recebidos asc, rc.corretor_id asc
   limit 1;
  if v_id is null then return null; end if;

  update motor_roleta_contadores
     set credito = credito - v_total, recebidos = recebidos + 1, atualizado_em = now()
   where automacao_id = p_auto and bloco_id = p_bloco and corretor_id = v_id;

  return v_id;
end $function$;
