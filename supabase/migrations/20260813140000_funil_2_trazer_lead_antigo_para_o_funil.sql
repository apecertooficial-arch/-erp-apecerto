-- TRAZER UM LEAD DA CARTEIRA ANTIGA PARA O FUNIL 2.0 (ago/2026)
--
-- Complemento de f2_carteira_antiga: aquela funcao deixa o lead PROCURAVEL,
-- esta aqui e a acao explicita de trazer UM lead para o funil, quando o
-- cliente antigo volta e o corretor precisa marcar visita sem sair do 2.0.
--
-- Nao existe versao em massa de proposito. Trazer os 1.515 encheria o Meu Dia
-- de todo mundo com cliente que ninguem vai atender hoje -- e o Meu Dia so
-- vale enquanto tudo que esta nele e para fazer de verdade.
--
-- O CORRETOR ESCOLHE ETAPA E MOMENTO, com uma trava: nao pode entrar como
-- "Lead novo / Primeira abordagem". Cliente que ja conversou nao esta em
-- primeira abordagem; deixar entrar assim faria o Meu Dia cobrar um contato
-- que ja aconteceu e a Sara reavaliar sobre premissa falsa. Como a etapa
-- "novo" so tem esse momento, na pratica a etapa inteira fica fora -- e esta
-- correto: lead que volta nao e lead novo.
--
-- HISTORICO COMPLETO por padrao, ao contrario da pesca do Aquario. La o lead
-- e desconhecido e o corte evita ruido; aqui o valor esta justamente na
-- conversa antiga -- e o que o corretor vai ler antes de ligar.

create or replace function public.f2_trazer_lead_antigo(
  p_lead_id bigint,
  p_etapa text,
  p_momento text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_admin    boolean := public.f2_admin();
  v_corretor bigint := public.f2_corretor_atual();
  v_lead     public.leads%rowtype;
  v_negocio  bigint;
  v_dono     bigint;
  v_dnome    text;
  v_novo     uuid;
  m          public.f2_momento_config%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'erro', 'sem_sessao');
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'lead_nao_encontrado');
  end if;

  -- So o dono ou a gestao. Sem isso, a busca viraria porta para puxar
  -- cliente da carteira alheia.
  if not (v_admin or (v_corretor is not null and v_lead.corretor_id = v_corretor)) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;

  if v_lead.corretor_id is null then
    return jsonb_build_object('ok', false, 'erro', 'lead_sem_dono');
  end if;

  if exists (
    select 1 from public.f2_lead f
     join public.negocios n on n.id = f.origem_negocio_id
    where n.lead_id = p_lead_id
  ) then
    return jsonb_build_object('ok', false, 'erro', 'ja_esta_no_funil');
  end if;

  select * into m from public.f2_momento_config
   where codigo = p_momento and etapa = p_etapa and ativo limit 1;
  if m.codigo is null then
    return jsonb_build_object('ok', false, 'erro', 'etapa_ou_momento_invalido');
  end if;

  -- A trava. Cliente que volta nunca esta em primeira abordagem.
  if m.codigo = 'PRIMEIRA_ABORDAGEM' or p_etapa = 'novo' then
    return jsonb_build_object('ok', false, 'erro', 'primeira_abordagem_nao_permitida',
      'detalhe', 'Este cliente já foi trabalhado. Escolha a etapa que descreve onde a conversa realmente parou.');
  end if;

  -- Negocio de origem: o card do Funil 2.0 se ancora nele. Se o lead antigo
  -- nao tiver nenhum, cria -- senao o historico da conversa nao encontra
  -- caminho de volta ate o card.
  select n.id into v_negocio from public.negocios n
   where n.lead_id = p_lead_id order by n.criado_em desc limit 1;
  if v_negocio is null then
    insert into public.negocios (lead_id, corretor_id, status, criado_em)
    values (p_lead_id, v_lead.corretor_id, 'aberto', now())
    returning id into v_negocio;
  end if;

  v_dono := v_lead.corretor_id;
  select nome into v_dnome from public.corretores where id = v_dono;

  insert into public.f2_lead (
    origem_negocio_id, nome, telefone, corretor_id, corretor_nome,
    etapa, momento_codigo, acao_codigo, acao_rotulo, proxima_acao_em,
    cadencia_passo, ultima_reavaliacao_resumo, corte_conversa_em,
    historico_completo, atualizado_por
  ) values (
    v_negocio, v_lead.nome, v_lead.telefone, v_dono, v_dnome,
    m.etapa, m.codigo, m.acao_codigo, m.acao_rotulo,
    now() + make_interval(mins => coalesce(m.prazo_minutos, 60)),
    0, 'Trazido da carteira antiga pelo corretor; a Sara ainda nao releu.',
    v_lead.criado_em, true, v_uid
  )
  returning id into v_novo;

  insert into public.f2_evento (funil_lead_id, tipo, titulo, detalhe, payload, criado_por)
  values (v_novo, 'momento_alterado', 'Lead trazido da carteira antiga',
    'Entrou em ' || m.etapa || ' / ' || m.rotulo || ', com o historico completo da conversa visivel.',
    jsonb_build_object('lead_id', p_lead_id, 'negocio_id', v_negocio,
                       'etapa', m.etapa, 'momento', m.codigo, 'corretor_id', v_dono), v_uid);

  insert into public.f2_config_audit (tipo, chave, acao, depois, criado_por)
  values ('carteira_antiga', p_lead_id::text, 'trazer_para_o_funil',
          jsonb_build_object('novo_id', v_novo, 'negocio_id', v_negocio,
                             'etapa', m.etapa, 'momento', m.codigo, 'corretor_id', v_dono), v_uid);

  return jsonb_build_object('ok', true, 'id', v_novo, 'etapa', m.etapa, 'momento', m.codigo);
end;
$$;

comment on function public.f2_trazer_lead_antigo(bigint, text, text) is
  'Cria o card do Funil 2.0 para UM lead da carteira antiga, na etapa/momento escolhidos. Bloqueia Lead novo / Primeira abordagem: cliente que volta nao esta em primeira abordagem.';

grant execute on function public.f2_trazer_lead_antigo(bigint, text, text) to authenticated;
