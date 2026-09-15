-- CRM — o SLA existia, estava configurado e NUNCA disparava um alarme sequer.
--
-- O DEFEITO, medido em 15/09/2026:
--   vw_sla_leads .................. 14.160 linhas
--   com alarme_ativo = true ....... 0
--   com sla_situacao preenchida ... 0
--
-- Causa: sla_situacao vem de pipeline_stages.sla_situacao, e essa coluna esta
-- NULL nos 48 estagios. Sem ela, o CASE que calcula min_ativo nao casa com nada,
-- min_ativo fica NULL, sla_cor() nao classifica e alarme_ativo e sempre false.
-- As 8 regras em sla_regras existem, com limiares definidos, e nunca foram
-- usadas por nada.
--
-- E ISSO NAO E UMA VIEW QUALQUER: consomem vw_sla_leads as funcoes
-- central_comando_dashboard, ia_carteira, ia_lead, motor_relogio_central e
-- sara_checagem_diaria, alem das views vw_metricas_corretor e vw_escalonamento.
-- Ou seja, a Central de Comando, a Sara, o motor e o painel por corretor
-- estavam TODOS lendo um SLA morto.
--
-- SEGUNDO DEFEITO, encontrado no caminho: as duas geracoes discordam sobre onde
-- o lead esta. A carteira ativa (1.093) esta espalhada por 8 pipeline_stages
-- antigos -- 743 em "Novo" e 176 em "Aquario" -- enquanto f2_lead.etapa diz
-- 470 legado, 253 em atendimento, 186 tentando contato, 92 pescado, 54 visita.
-- negocios.stage_id simplesmente parou de ser atualizado.
--
-- A CORRECAO: a view passa a ler o Funil 2.0, que e o CRM oficial (decisao de
-- 14/09/2026). sla_situacao passa a ser derivada da etapa real, usando as
-- regras que ja existem em sla_regras -- nenhuma regra nova, nenhum limiar
-- inventado:
--   novo -> lead_novo | tentando_contato, pescado, pos_visita -> followup_atrasado
--   em_atendimento -> atendimento_parado | visita -> agendamento_parado
--   legado -> NULL (carteira antiga fica parqueada, nao se cobra)
--   e, sobrepondo tudo: cliente falou por ultimo -> resposta_humana (o mais urgente)
--
-- prox_venc passa a ser f2_lead.proxima_acao_em, o campo que o Funil 2.0
-- realmente mantem, em vez de crm_tarefas (15 registros na geracao antiga).
--
-- RESULTADO MEDIDO DEPOIS:
--   1.093 linhas | 648 com situacao | 527 alarmes
--   387 pretos | 57 vermelhos | 107 amarelos | 81 clientes esperando resposta
--
-- As duas views dependentes sao recriadas identicas, com um unico ajuste
-- necessario: vw_metricas_corretor filtrava etapa_chave = 'tentando_agend',
-- chave que nao existe no Funil 2.0. O equivalente la e 'visita'.
--
-- TESTADO DEPOIS: central_comando_dashboard, ia_carteira, sara_checagem_diaria,
-- vw_escalonamento e vw_metricas_corretor executam sem erro.

drop view if exists public.vw_escalonamento;
drop view if exists public.vw_metricas_corretor;
drop view if exists public.vw_sla_leads;

create view public.vw_sla_leads
with (security_invoker = true) as
with msg as (
  select lead_id, cliente_ultima, env_ultima, ultima_interacao, qtd_recebidas, qtd_enviadas
  from public.sla_msg_cache
),
acao as (
  select lead_id, max(criado_em) as acao_ultima
  from public.atendimento_acoes group by lead_id
),
base as (
  select
    n.id                                           as negocio_id,
    n.lead_id,
    n.stage_id,
    coalesce(mc.rotulo, f.etapa)                   as etapa,
    f.etapa                                        as etapa_chave,
    null::smallint                                 as grupo,
    case f.etapa
      when 'novo'             then 'lead_novo'
      when 'tentando_contato' then 'followup_atrasado'
      when 'pescado'          then 'followup_atrasado'
      when 'em_atendimento'   then 'atendimento_parado'
      when 'visita'           then 'agendamento_parado'
      when 'pos_visita'       then 'followup_atrasado'
      else null
    end                                            as sla_situacao_etapa,
    (f.etapa <> 'legado')                          as etapa_alarme,
    coalesce(f.cadencia_passo, 0)::integer         as tentativa,
    6::integer                                     as max_tentativas,
    l.nome                                         as cliente,
    coalesce(f.telefone, l.telefone)               as telefone,
    f.corretor_id,
    cor.nome                                       as corretor,
    m.cliente_ultima,
    greatest(m.env_ultima, a.acao_ultima)          as humano_ultima,
    coalesce(m.ultima_interacao, f.ultima_interacao_em) as ultima_interacao,
    coalesce(m.qtd_recebidas, 0::bigint)           as qtd_recebidas,
    coalesce(m.qtd_enviadas, 0::bigint)            as qtd_enviadas,
    (m.cliente_ultima is not null
      and m.cliente_ultima > coalesce(greatest(m.env_ultima, a.acao_ultima), '-infinity'::timestamptz)) as aguardando_humano,
    case when m.cliente_ultima is not null
              and m.cliente_ultima > coalesce(greatest(m.env_ultima, a.acao_ultima), '-infinity'::timestamptz)
         then extract(epoch from now() - m.cliente_ultima) / 60::numeric
    end                                            as min_aguardando,
    f.proxima_acao_em                              as prox_venc,
    case when f.proxima_acao_em is not null and f.proxima_acao_em < now()
         then extract(epoch from now() - f.proxima_acao_em) / 60::numeric
    end                                            as min_tarefa_atraso,
    extract(epoch from now() - coalesce(f.atualizado_em, f.criado_em)) / 60::numeric as min_no_estagio,
    extract(epoch from now() - coalesce(m.ultima_interacao, f.ultima_interacao_em, f.criado_em)) / 60::numeric as min_sem_interacao,
    coalesce(f.atualizado_em, f.criado_em)         as estagio_desde
  from public.f2_lead f
  join public.negocios n on n.id = f.origem_negocio_id
  join public.leads l    on l.id = n.lead_id
  left join public.f2_momento_config mc on mc.codigo = f.momento_codigo
  left join public.corretores cor on cor.id = f.corretor_id
  left join msg  m on m.lead_id = n.lead_id
  left join acao a on a.lead_id = n.lead_id
  where f.descartado_em is null
    and coalesce(n.status, 'aberto') <> all (array['ganho','perdido','descartado'])
),
calc as (
  select b.*,
    case when b.aguardando_humano then 'resposta_humana' else b.sla_situacao_etapa end as sla_situacao
  from base b
),
final as (
  select c.*,
    case c.sla_situacao
      when 'resposta_humana'          then c.min_aguardando
      when 'lead_novo'                then c.min_no_estagio
      when 'erro_abordagem'           then c.min_no_estagio
      when 'atendimento_parado'       then c.min_sem_interacao
      when 'agendamento_parado'       then c.min_no_estagio
      when 'followup_atrasado'        then coalesce(c.min_tarefa_atraso, c.min_no_estagio)
      when 'transferencia_sem_aceite' then c.min_no_estagio
      else null::numeric
    end as min_ativo
  from calc c
)
select
  negocio_id, lead_id, stage_id, etapa, etapa_chave, grupo,
  sla_situacao, etapa_alarme, tentativa, max_tentativas,
  cliente, telefone, corretor_id, corretor,
  cliente_ultima, humano_ultima, ultima_interacao,
  qtd_recebidas, qtd_enviadas, aguardando_humano, min_aguardando,
  prox_venc, min_tarefa_atraso, min_no_estagio, min_sem_interacao, estagio_desde,
  min_ativo,
  round(min_ativo)::integer as min_ativo_int,
  public.sla_cor(sla_situacao, min_ativo) as cor_ativa,
  etapa_alarme and case
    when sla_situacao = 'resposta_humana' then aguardando_humano
    else public.sla_cor(sla_situacao, min_ativo) = any (array['amarelo','vermelho','preto'])
  end as alarme_ativo
from final;

comment on view public.vw_sla_leads is
  'SLA do CRM sobre o Funil 2.0 (CRM oficial). Antes lia pipeline_stages.sla_situacao, que estava NULL nos 48 estagios -- resultado: 0 alarmes em 14.160 linhas, e a Central de Comando, a Sara, o motor e o painel por corretor liam um SLA morto. Agora a situacao e derivada de f2_lead.etapa usando as 8 regras ja existentes em sla_regras.';

create view public.vw_metricas_corretor
with (security_invoker = true) as
 select cor.id as corretor_id,
    cor.nome as corretor,
    count(s.negocio_id) as leads_ativos,
    count(*) filter (where s.aguardando_humano) as aguardando_resposta,
    count(*) filter (where s.alarme_ativo) as em_alarme,
    max(s.min_aguardando)::integer as pior_espera_min,
    count(*) filter (where s.min_tarefa_atraso is not null) as tarefas_vencidas,
    count(*) filter (where s.min_sem_interacao >= 1440::numeric and s.min_sem_interacao < 2880::numeric) as parados_24h,
    count(*) filter (where s.min_sem_interacao >= 2880::numeric and s.min_sem_interacao < 4320::numeric) as parados_48h,
    count(*) filter (where s.min_sem_interacao >= 4320::numeric) as parados_72h,
    count(*) filter (where s.etapa_chave = 'em_atendimento'::text) as em_atendimento,
    -- era 'tentando_agend', chave que nao existe no Funil 2.0; o equivalente e 'visita'
    count(*) filter (where s.etapa_chave = 'visita'::text) as em_agendamento
   from public.corretores cor
     left join public.vw_sla_leads s on s.corretor_id = cor.id
  where coalesce(cor.ativo, true) = true
  group by cor.id, cor.nome
  order by (count(*) filter (where s.alarme_ativo)) desc, (count(*) filter (where s.aguardando_humano)) desc;

grant select on public.vw_metricas_corretor to authenticated, service_role;

create view public.vw_escalonamento
with (security_invoker = true) as
 select negocio_id, lead_id, cliente, telefone, corretor, etapa, sla_situacao,
    min_ativo_int as minutos, cor_ativa
   from public.vw_sla_leads
  where cor_ativa = 'preto'::text
  order by min_ativo_int desc nulls last;

grant select on public.vw_escalonamento to authenticated, service_role;
grant select on public.vw_sla_leads to authenticated, service_role;
