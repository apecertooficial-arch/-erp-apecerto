-- CRM — higiene de carteira: o que esta na mao de quem nao trabalha mais aqui.
--
-- ENCONTRADO em 15/09/2026, ao abrir o CRM no navegador: o primeiro card da fila
-- mostrava "Corretor - Rogerio Nunes Goncalves", atrasado ha 19 dias. Rogerio
-- esta com ativo = false. Medindo:
--
--   Rogerio Nunes Goncalves (inativo) .... 28 leads, 18 vencidos, pior 19d19h
--   Jacqueline Gomes Bezerra (inativo) ...  4 leads
--   TOTAL .................................. 32 leads parados em carteira morta
--
-- Ninguem vai atender: o dono saiu da empresa. E, como a cobranca e por corretor,
-- esses 32 nunca aparecem para ninguem.
--
-- POR QUE NAO REDISTRIBUO AQUI: escolher quem recebe a carteira de um corretor
-- desligado e decisao de gestao, nao de migracao -- envolve peso, presenca e
-- capacidade de cada um, e o motor de distribuicao ja tem regra propria para
-- isso. Fazer na marra criaria 32 atribuicoes que ninguem combinou.
--
-- O que entrego e a fila para essa decisao ser tomada em 2 minutos, e o alerta
-- para o caso nao se repetir no proximo desligamento.

create or replace view public.crm_carteira_orfa
with (security_invoker = true) as
select
  c.id            as corretor_id,
  c.nome          as corretor,
  c.ativo         as corretor_ativo,
  f.id            as f2_lead_id,
  f.nome          as cliente,
  f.telefone,
  f.etapa,
  f.momento_codigo,
  f.proxima_acao_em,
  case
    when f.proxima_acao_em >= '2999-01-01'::timestamptz then null
    when f.proxima_acao_em < now() then round(extract(epoch from now() - f.proxima_acao_em) / 86400)::int
  end as dias_atrasado,
  f.ultima_interacao_em
from public.f2_lead f
join public.corretores c on c.id = f.corretor_id
where f.descartado_em is null
  and coalesce(c.ativo, true) = false;

comment on view public.crm_carteira_orfa is
  'Onda 5 / CRM: leads ativos cuja carteira pertence a corretor DESATIVADO. Em 15/09/2026: 32 leads (Rogerio 28, Jacqueline 4), 18 vencidos, pior atraso 19 dias. Ninguem atende porque o dono saiu. Redistribuir e decisao de gestao -- esta view existe para ela ser tomada.';

grant select on public.crm_carteira_orfa to authenticated, service_role;

-- Prevencao: ao desativar um corretor, registra na auditoria quantos leads
-- ficaram orfaos. Nao bloqueia a desativacao (travar o admin seria pior), mas
-- o desligamento deixa de ser silencioso.
-- TESTADO com UPDATE real em transacao revertida.
create or replace function public.trg_corretor_desativado_avisa_carteira()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_qtd int;
begin
  if coalesce(old.ativo, true) = true and coalesce(new.ativo, true) = false then
    select count(*) into v_qtd
    from public.f2_lead f
    where f.corretor_id = new.id and f.descartado_em is null;

    if v_qtd > 0 then
      insert into public.erp_auditoria (usuario_nome, acao, modulo, entidade, entidade_id, detalhe, depois)
      values (
        coalesce((select nome from public.usuarios where id = auth.uid()), 'sistema/automação'),
        'desativar_corretor_com_carteira',
        'Usuários',
        'corretor',
        new.id::text,
        format('Corretor %s foi desativado com %s lead(s) ativos na carteira. Redistribuir: ver view crm_carteira_orfa.', new.nome, v_qtd),
        jsonb_build_object('corretor_id', new.id, 'leads_orfaos', v_qtd)
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_corretor_desativado_avisa on public.corretores;
create trigger trg_corretor_desativado_avisa
after update of ativo on public.corretores
for each row execute function public.trg_corretor_desativado_avisa_carteira();
