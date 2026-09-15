-- Onda 6.4 — ressuscitar "Minha Equipe".
--
-- O PROBLEMA: a tela de produtividade do time nunca funcionou. equipe_visao()
-- falhava com:
--   ERROR: 42P01: relation "perf_snapshots" does not exist
-- Ela le `perf_snapshots` para score, vgv_mes e vendas_mes; essa relacao nunca
-- foi criada. (Corrijo aqui um erro meu: eu havia dito que `team_corretores`
-- tambem faltava. Nao falta -- e uma CTE dentro da propria funcao.)
--
-- E o mais frustrante: a materia-prima existe e e rica. Em 15/09/2026:
--   268 mil eventos em perf_eventos, 39 tipos ativos, 4 triggers alimentando,
--   com dados chegando HOJE (16.685 mensagens enviadas nos ultimos 30 dias).
-- Coletado por meses, nunca somado.
--
-- ARMADILHA ENCONTRADA AQUI, que vale registrar: existem DUAS chaves de
-- "corretor" no banco. perf_eventos.corretor_id e bigint -> corretores.id.
-- venda_corretores.corretor_id e uuid -> usuarios.id. A ponte e
-- corretores.usuario_id. Juntar sem perceber isso da "operator does not exist:
-- uuid = bigint", e juntar do jeito errado daria numero silenciosamente errado.
--
-- O QUE E O `score` -- definicao explicita, para nao ser numero magico:
-- pontos de atividade comercial dos ultimos 30 dias, com peso maior para
-- desfecho do que para volume. Nao e nota de 0 a 100 nem curva normalizada: e
-- contagem ponderada, comparavel entre corretores e auditavel evento a evento.
-- A tabela de pesos esta no CASE e existe para ser discutida e ajustada.
--
-- vgv_mes e vendas_mes saem de venda_corretores respeitando a `fracao` de cada
-- corretor na venda -- mesma fonte do ranking do Financeiro, entao os dois
-- numeros nao podem divergir.
--
-- E view, nao tabela: fica sempre viva, sem job para manter. Se um dia o volume
-- pesar, vira materialized view com refresh no cron.

create or replace view public.perf_snapshots
with (security_invoker = true) as
with pontos as (
  select
    e.corretor_id,
    sum(
      case e.tipo
        when 'contrato_assinado' then 40
        when 'proposta_aceita'   then 40
        when 'visita_realizada'  then 25
        when 'proposta_emitida'  then 15
        when 'contrato_enviado'  then 15
        when 'visita_marcada'    then 10
        when 'primeira_resposta' then 5
        when 'followup'          then 3
        when 'bolsao_puxado'     then 3
        when 'reativacao'        then 3
        when 'resposta'          then 1
        when 'ligacao_atendida'  then 1
        when 'mensagem_enviada'  then 0.2
        when 'audio_enviado'     then 0.2
        when 'imagem_enviada'    then 0.2
        when 'video_enviado'     then 0.2
        when 'documento_enviado' then 0.2
        else 0
      end * coalesce(e.quantidade, 1)
    ) as score
  from public.perf_eventos e
  where e.ocorrido_em >= now() - interval '30 days'
    and e.corretor_id is not null
  group by e.corretor_id
),
vendas_mes as (
  -- venda_corretores aponta para usuarios(id); a ponte para corretores(id)
  -- e corretores.usuario_id.
  select
    c.id                                        as corretor_id,
    sum(v.vgv * coalesce(vc.fracao, 1))::numeric as vgv_mes,
    count(distinct v.id)::integer                as vendas_mes
  from public.venda_corretores vc
  join public.vendas v     on v.id = vc.venda_id
  join public.corretores c on c.usuario_id = vc.corretor_id
  where v.data_conclusao is not null
    and date_trunc('month', v.data_conclusao) = date_trunc('month', current_date)
  group by c.id
)
select
  c.id                                 as corretor_id,
  current_date                         as dia,
  coalesce(round(p.score), 0)::integer as score,
  coalesce(vm.vgv_mes, 0)::numeric     as vgv_mes,
  coalesce(vm.vendas_mes, 0)::integer  as vendas_mes
from public.corretores c
left join pontos     p  on p.corretor_id  = c.id
left join vendas_mes vm on vm.corretor_id = c.id
where c.ativo;

comment on view public.perf_snapshots is
  'Onda 6.4: agregacao de perf_eventos (268 mil registros coletados desde julho e nunca usados) que equipe_visao() esperava e nunca existiu. score = pontos de atividade comercial dos ultimos 30 dias, pesos documentados na migracao. vgv_mes/vendas_mes vem de venda_corretores respeitando a fracao -- mesma fonte do ranking do Financeiro. Atencao: perf_eventos.corretor_id e bigint (corretores.id) e venda_corretores.corretor_id e uuid (usuarios.id); a ponte e corretores.usuario_id.';

grant select on public.perf_snapshots to authenticated, service_role;
