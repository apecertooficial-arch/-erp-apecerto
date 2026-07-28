# 11 — Plano de migração shadow (FASE 2.0 — DESENHO; nada será executado nesta fase)

> ⚠️ **SUPERSEDIDO EM PARTE PELA FASE 2.2.** Onde este documento divergir dos docs 14–20, prevalecem os 14–20. Em especial: `ncrm_estado` **não** guarda `corretor_id` nem `lead_id`; **não** há trigger de sincronização em `negocios`; a RLS lê a **posse atual** em `negocios` (doc 17); invariantes bidirecionais no doc 16; ordem transacional no doc 15; ciclo da proposta no doc 18; draft autoritativo `sql-drafts/DRAFT-FASE-2.2-modelo-persistente.sql`.

Objetivo: colocar o CRM Nova Era em produção SEM tocar o CRM atual, com paridade comprovada
antes de qualquer corte. **Nenhum lead real é migrado nesta fase.** Cada etapa tem critério de
saída e rollback próprio.

| # | Etapa | O que acontece | Critério p/ avançar | Rollback |
|---|---|---|---|---|
| 1 | Estruturas vazias | Migration cria `ncrm_*` (4 tabelas + índices + RLS) — zero linhas, zero leitura pelo app | Migration aplicada em staging + advisors limpos | `DROP` das 4 tabelas (rollback conceitual no draft) — nada mais depende delas |
| 2 | Leads fictícios | Seeds de teste (telefones `000000000xx`, flag `origem='migracao'` nos eventos) exercitam RPCs em staging | 33 regras do protótipo reproduzidas via RPC (mesmos testes, agora contra banco) | `TRUNCATE ncrm_*` em staging |
| 3 | Espelhamento passivo | Hooks de LEITURA de eventos reais (webhook WA, criação de lead, movimentos) passam a REGISTRAR eventos `ncrm_*` em paralelo, sem nenhuma mudança de comportamento do CRM atual (dupla escrita só no lado novo) | 2 semanas de eventos espelhados sem erro; fila de discrepância vazia | desligar os hooks (feature flag); tabelas ficam como log inerte |
| 4 | Comparação | Job diário compara: snapshot recalculado por replay × snapshot armazenado; etapa Nova Era derivada × stage legado (via mapa de stages); contadores × `vw_sla_leads`/`negocio_estagio_historico` | paridade ≥ 99% por 2 semanas; divergências explicadas | continua passivo; nada a reverter |
| 5 | Equipe piloto | Seletor da Fase 1 passa a ler dados REAIS (rota fina do doc 10.D) para 1-2 corretores voluntários; escrita ainda dupla (ações do piloto geram eventos ncrm E as ações equivalentes no CRM atual, para não quebrar gestão) | piloto opera 2+ semanas; feedback incorporado; zero perda de lead auditada | piloto volta ao "Funil atual" (default do seletor) — 1 clique |
| 6 | Reclassificação assistida (Sara) | Sara sugere etapa/temperatura Nova Era p/ carteira do piloto via `ncrm_sara_classificar` (sempre como sugestão; precedência humana do doc 06 §7) | taxa de aceite humano das sugestões medida e aprovada | desabilitar grant da RPC da Sara |
| 7 | Validação humana | Gestor revisa fila de divergência e aprova/edita classificações; tudo vira evento `correcao_manual` | fila zerada para o piloto | — (auditável por natureza) |
| 8 | Migração gradual | Ondas por equipe (corretor a corretor); cada onda repete 5→7; dupla escrita permanece até a última onda | 100% das equipes com paridade mantida | onda volta ao CRM atual; eventos ficam |
| 9 | Rollback global | Documentado e ensaiado: seletor default volta a "Funil atual" para todos + hooks desligados; dados ncrm ficam íntegros para nova tentativa | — | é o próprio passo |
| 10 | Desativação do legado | SOMENTE após estabilidade comprovada (sugestão: 1 ciclo comercial completo sem rollback), remoção gradual: AttentionCenter legado → kanban legado; tabelas legadas permanecem em leitura histórica | decisão de negócio explícita | n/a (irreversível — por isso é o último) |

## Pré-requisitos técnicos que este plano assume (a construir na fase 3)

- Feature flag por corretor (piloto) — pode ser coluna em `ncrm_estado`? Não: flag pertence a
  config/usuário; proposta: lista em `ncrm_workflow_config.payload` ou tabela mínima futura —
  decisão adiada para a fase 3 (não cria tabela agora).
- Job de comparação (SQL de paridade) — esboço no doc 09 §6/replay doc 06 §5.3.
- Mapa stage legado ↔ etapa Nova Era para comparação (tabela temporária de shadow OU CTE fixa —
  decisão 12.2).

## Nota Fase 2.1 — propostas no shadow

Durante todo o shadow, "proposta registrada" grava apenas em `ncrm_proposta` (recomendação C do
doc 13): **nenhuma venda fictícia** é criada em `vendas`, e a Esteira legada não é tocada. A
conversão para `vendas` só ocorre no passo de convergência (pós-shadow) e no aceite/conclusão real.
A leitura unificada da Esteira (proposta + venda) é a recomendação B, faseada — nunca uma segunda
interface de Esteira.

## Invariantes de segurança do plano

1. Em nenhum passo o CRM atual muda de comportamento antes do passo 10.
2. Dupla escrita é sempre "legado comanda, novo espelha" até o passo 8.
3. Nenhum dado real entra em `ncrm_*` antes do passo 3 (e só eventos espelhados).
4. Sara nunca decide sozinha (precedência humana em todos os passos).
5. Registrar proposta nunca cria venda nem marca ganho (proposta ≠ venda).
