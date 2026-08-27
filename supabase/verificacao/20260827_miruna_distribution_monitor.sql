-- CICLO 3 — monitor somente leitura para DISTRIBUTION_UNAVAILABLE.
-- Nenhum DML, reprocessamento ou alteração de disponibilidade.

with waiting as (
  select
    f.id,
    a.id as automacao_id,
    a.nome as automacao,
    f.automacao_versao_id,
    f.bloco_id,
    f.tentativas,
    f.criado_em,
    f.due_at,
    f.ultimo_erro,
    extract(epoch from (now() - f.criado_em)) / 60.0 as age_minutes,
    localtime >= time '09:30' and localtime < time '18:30'
      and extract(isodow from current_date) between 1 and 5 as official_window
  from public.motor_fila f
  join public.automacoes a on a.id = f.automacao_id
  where f.status = 'pendente'
    and coalesce(f.ultimo_erro, '') like 'WAITING_FOR_ELIGIBLE_BROKER:%DISTRIBUTION_UNAVAILABLE%'
), classified as (
  select *,
    case
      when not official_window then 'INFO_FORA_DA_JANELA'
      when age_minutes >= 60 then 'CRITICO_60_MIN'
      when age_minutes >= 15 then 'ALERTA_15_MIN'
      else 'INFO_AGUARDANDO_PRESENCA'
    end as severity
  from waiting
)
select
  automacao_id,
  automacao,
  automacao_versao_id,
  bloco_id,
  severity,
  count(*)::bigint as itens,
  round(min(age_minutes)::numeric, 1) as menor_espera_min,
  round(max(age_minutes)::numeric, 1) as maior_espera_min,
  max(tentativas)::integer as maior_numero_de_tentativas,
  min(due_at) as proxima_avaliacao
from classified
group by automacao_id, automacao, automacao_versao_id, bloco_id, severity
order by
  case severity when 'CRITICO_60_MIN' then 1 when 'ALERTA_15_MIN' then 2 else 3 end,
  maior_espera_min desc;

-- Política operacional proposta:
-- INFO_FORA_DA_JANELA: nenhuma intervenção; a fila reavalia automaticamente.
-- INFO_AGUARDANDO_PRESENCA: acompanhar até 15 min, sem reenfileirar.
-- ALERTA_15_MIN: gerente confirma presença/DAPI dos corretores configurados.
-- CRITICO_60_MIN: gerente escala; não alterar fila até diagnosticar elegibilidade.
