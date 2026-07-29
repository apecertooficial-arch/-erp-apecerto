# 14 — Revisão final da arquitetura (FASE 2.2)

Correções da revisão da Fase 2.1. Registro achado → risco → correção → decisão. Direção
arquitetural (snapshot+eventos, estado por `negocio_id`, cadência versionada, optimistic lock,
idempotência, shadow, 4 etapas, isolamento do legado, proposta ≠ venda) **preservada**.
Nenhum SQL executado; nenhuma migration criada. DRAFT autoritativo:
`sql-drafts/DRAFT-FASE-2.2-modelo-persistente.sql` (o `DRAFT-FASE-2` anterior foi removido).

| # | Achado (2.1) | Risco | Correção (2.2) | Decisão |
|---|---|---|---|---|
| 1 | `ncrm_estado.corretor_id` denormalizado | Espelho pode divergir de `negocios`; após transferência, corretor antigo continua "dono" no snapshot | **Removido** `corretor_id` (e `lead_id`) do snapshot | Snapshot não guarda posse; ver doc 17 |
| 2 | Trigger `sync_corretor` em `negocios` | Alterar comportamento/latência de uma tabela legada crítica; ponto de falha extra | **Removido** — nenhum trigger sobre `negocios` | Sem sincronização; posse é sempre lida ao vivo |
| 3 | RLS por coluna denormalizada | Vazamento pós-transferência | RLS consulta a **posse ATUAL** em `public.negocios` via helper `ncrm_private.pode_ver_negocio` (DEFINER, STABLE) | Transferência vale imediatamente; doc 17 |
| 4 | Invariantes de saída/resposta só num sentido | Estados incoerentes possíveis (ex.: `visita_id` sem saída de visita; `primeira_resposta_em` sem `respondeu`) | Invariantes **bidirecionais** para próxima-ação/saída, visita, proposta, descarte e resposta | Tabela-verdade no doc 16 |
| 5 | Ordem estado×evento implícita | Corrida podia deixar evento sem estado movido (ou vice-versa) | **Ordem transacional canônica fechada**: trava → valida versão → UPDATE estado → INSERT evento (por último) → idempotência UNIQUE como desempate | doc 15 |
| 6 | Proposta só tinha "feliz caminho" | Sem tratamento de recusa/cancelamento/expiração nem reativação | Ciclo completo (registrada→…→recusada/expirada/cancelada/convertida) + **reativação explícita** que limpa a saída e exige nova ação | doc 18 |
| 7 | "Escrita via DEFINER em public" genérica | DEFINER como atalho de RLS; superfície ampla | Funções **simplificadas e endurecidas**: lógica em `ncrm_private`, wrapper público mínimo, `search_path=''`, refs qualificadas, ids/origem/permissão derivados do banco | doc 15, doc 19 |
| 8 | Matrizes espalhadas | Difícil auditar a superfície de segurança | **Matriz final única** de GRANT × RLS × RPC | doc 19 |
| 9 | Sem veredicto de prontidão | Aplicar sem checar pré-requisitos | **GO/NO-GO explícito** com evidências objetivas e checklist de bloqueios | doc 20 |

## O que decorre de remover a posse do snapshot

A decisão 1-3 é a mudança estrutural desta fase. Consequências:

- **Segurança**: não há mais janela de inconsistência entre transferência no legado e visibilidade;
  a policy relê `negocios` a cada avaliação.
- **Simplicidade**: some um trigger sobre uma tabela crítica e uma coluna a manter em sincronia.
- **Custo**: o escopo por corretor passa a depender de um filtro em `negocios.corretor_id`; se essa
  coluna não estiver indexada, consultas por corretor podem varrer. Como é **proibido alterar
  `negocios`** nesta fase, o índice `negocios(corretor_id)` fica listado como **pré-requisito da
  migration real** (doc 20), não criado agora. Nos volumes atuais do shadow (subconjunto de
  negócios) o impacto é baixo; a mitigação é explícita e agendada.

Este trade — segurança/simplicidade agora, uma dependência de índice legado a agendar — é a razão de
o veredicto do doc 20 ser **NO-GO para aplicação imediata** e **GO condicional** para construir a
migration após limpar os pré-requisitos.
