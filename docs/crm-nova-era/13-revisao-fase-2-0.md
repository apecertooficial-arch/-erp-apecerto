# 13 — Revisão da Fase 2.0 → correções da Fase 2.1

> ⚠️ **SUPERSEDIDO EM PARTE PELA FASE 2.2.** Onde este documento divergir dos docs 14–20, prevalecem os 14–20. Em especial: `ncrm_estado` **não** guarda `corretor_id` nem `lead_id`; **não** há trigger de sincronização em `negocios`; a RLS lê a **posse atual** em `negocios` (doc 17); invariantes bidirecionais no doc 16; ordem transacional no doc 15; ciclo da proposta no doc 18; draft autoritativo `sql-drafts/DRAFT-FASE-2.2-modelo-persistente.sql`.

Registro achado → risco → correção → decisão. Direção arquitetural (snapshot+eventos, estado por
negócio, cadência versionada, optimistic lock, idempotência, shadow, 4 etapas, isolamento do
legado) preservada. Nenhum SQL executado; nenhuma migration criada.

| # | Achado (revisão 2.0) | Risco | Correção (2.1) | Decisão resultante |
|---|---|---|---|---|
| 1 | Saída "proposta" reaproveitava o fluxo legado (`vendas`+`venda_processos`+`status=ganho`) | Proposta viraria venda; inflaria VGV vendido; contradiz Fase 1.1 | Nova entidade `ncrm_proposta` (ciclo registrada→…→convertida); registrar proposta NÃO cria venda, NÃO marca ganho; `venda_id` só na conversão | **Proposta ≠ venda (FECHADA).** Esteira legada intocada no shadow; leitura unificada faseada (recomendação C→B, §Esteira) |
| 2 | CHECK da próxima ação permitia lead ativo sem próximo passo (`... OR proxima_acao_tipo IS NULL OR ...`) | Estado ativo inválido (lead "perdido" sem ação) — o bug que a Fase 1.1 eliminou reapareceria no banco | Dois CHECKs: ativo exige tipo+título+data; saída exige os três NULL. + 8 checks de coerência (automação/resposta/pendente/saídas/descarte) | Invariante correta; `tentativas_feitas ≤ max` fica na RPC (cross-row) |
| 3 | Draft terminava com `COMMIT` apesar de "DO NOT APPLY" | Execução acidental persistiria objetos | Barreira `DO $draft_guard$ ... RAISE EXCEPTION` no topo + **todo DDL comentado** + `ROLLBACK` no fim (sem COMMIT) | Draft tecnicamente inaplicável |
| 4 | "Toda escrita via RPC SECURITY DEFINER em public" sem detalhar segurança | DEFINER como atalho de RLS; confiar em `p_origem`/`p_corretor_id` do cliente; Sara com acesso amplo | Lógica em schema `ncrm_private` (não exposto) + wrapper público mínimo; `search_path=''`; refs qualificadas; origem/ids/permite DERIVADOS no banco; Sara por `app_metadata` (não `user_metadata`), com precedência humana; pseudocódigo completo (doc 10) | Modelo de guarda fechado |
| 5 | `ncrm_evento_imutavel` sem schema/search_path/grants | Endpoint acidental; resolução de search_path | Função em `ncrm_private`, `SET search_path=''`, `REVOKE ... FROM PUBLIC,anon,authenticated`, ownership explícito | — |
| 6 | Integridade da config vinha de `payload.workflow_config_id` | Payload mutável/frágil como fonte de integridade | `ncrm_evento.workflow_config_id` FK NOT NULL; +`corretor_id_no_evento`, `estado_versao_antes/apos` (apos=antes+1); payload CHECK `jsonb_typeof='object'` + `pg_column_size<=8192` (contexto, não documento) | — |
| 7 | `lead_id`/`corretor_id` denormalizados no snapshot | Divergência e vazamento de RLS após transferência | `lead_id` REMOVIDO do snapshot (deriva de `negocios`; JOIN a `leads` já necessário p/ nome); `corretor_id` mantido p/ RLS e **sincronizado por trigger em `negocios` na mesma transação**; ids nunca vêm do cliente; teste de transferência/RLS especificado (doc 08) | `lead_id` fora do snapshot; mantido só em `ncrm_evento` (point-in-time) |
| 8 | Config "não editar" só na doc; banco permitiria UPDATE | Regra publicada alterada silenciosamente | Estados `rascunho/publicada/encerrada`; só rascunho editável (trigger); no máx. 1 publicada vigente (índice único); `ON DELETE RESTRICT` (nunca CASCADE) em passo/estado/evento; vigências não sobrepostas (EXCLUDE, extensão a avaliar) | Config imutável após publicar |
| 9 | RLS e Data API tratadas como uma coisa | Presumir REST automático; policies/grants implícitos | Doc 09 §"RLS × Data API": camadas distintas; não presumir exposição; grants explícitos; views futuras `security_invoker=true` ou schema não exposto; helpers RLS documentados com evidência ou marcados como BLOQUEIO | — |
| 10 | Índices únicos parciais `UNIQUE(negocio_id) WHERE saida=...` | Redundantes (negocio_id já é PK) e não impedem duplicação nas tabelas externas | Removidos; idempotência real em `ncrm_evento.idempotency_key`, `ncrm_proposta` (idem + "viva" única), e contrato transacional que reutiliza visita existente | — |

## Impasse da Esteira atual — comparação e recomendação

A Esteira visual lê `vendas`+`venda_processos`. Para receber propostas sem criar vendas fictícias:

| Opção | O que é | Risco | Quando |
|---|---|---|---|
| **A. Adaptar `venda_processos`** (aceitar `proposta_id`, `venda_id` nullable) | Uma tabela de processo serve proposta E venda | ALTO — muda tabela legada em produção, com triggers (`log_venda_processo_etapa`, `sync_venda_conclusao`) e RLS acopladas | Só após shadow, se realmente necessário |
| **B. Leitura unificada** (view/endpoint que combina `ncrm_proposta` + `vendas`) | Uma consulta apresenta ambos na MESMA Esteira | MÉDIO — sem alterar dados legados; view com `security_invoker` | Fase de convergência (pós-shadow) |
| **C. Processos separados até conversão** | `ncrm_proposta` isolada; converte em `vendas` no aceite | BAIXO — zero toque no legado | **Shadow (agora)** |

**Recomendação (fechada):** **C durante o shadow** (isolamento total do legado) → **B na convergência**
(leitura unificada, sem mutar `venda_processos`) → **A só se B não bastar**. Conversão para `vendas`
ocorre apenas no aceite/conclusão; **uma única interface de Esteira** (nunca uma segunda). O momento
exato da conversão continua **decisão aberta** (doc 12).

## O que a Fase 2.1 NÃO mudou (preservado da 2.0)

snapshot+eventos; PK por `negocio_id`; 4 etapas por CHECK; cadência versionada; optimistic lock;
idempotência; plano de shadow; isolamento do legado. Documentos 05 e 06 §1-5 permanecem válidos com
os ajustes pontuais acima.
