# Advisors de segurança e performance (staging)

Os advisors do Supabase são um serviço da plataforma: só rodam contra um projeto real. Como **ainda
não existe projeto de staging**, eles **não puderam ser executados** nesta entrega (produção é
proibida). Assim que o `STAGING_REF` existir e a migration for aplicada, executar:

- `get_advisors(project_id=STAGING_REF, type="security")`
- `get_advisors(project_id=STAGING_REF, type="performance")`

## Regras de correção
- Corrigir **apenas objetos `ncrm_*`**. Não alterar objetos legados sem revisão separada.
- Apresentar cada alerta: **objeto, categoria, severidade, decisão** (corrigir / aceitar / N/A legado).

## Alertas esperados e postura já embutida na migration
Estes pontos já foram tratados no desenho; servem de checklist ao ler o relatório real:

| Advisor típico | Situação nos objetos ncrm_* | Decisão |
|---|---|---|
| `function_search_path_mutable` | Todas as funções `ncrm_*`/`ncrm_private.*` usam `SET search_path = ''` (ou `'public'` nos helpers legados capturados). | Já mitigado; confirmar zero alerta em ncrm_*. |
| `rls_disabled_in_public` | Todas as tabelas `ncrm_*` têm RLS habilitada; escrita só via RPC. | Já mitigado. |
| `security_definer_view` | Não há views SECURITY DEFINER em ncrm_*. | N/A. |
| `policy_exists_rls_disabled` | Policies só onde RLS on. | N/A. |
| Exposed schema `ncrm_private` | Não deve estar em *Exposed schemas*. | Confirmar no dashboard; manter fora. |
| `unindexed_foreign_keys` (perf) | FKs de `ncrm_estado`/`ncrm_evento`/`ncrm_proposta` para `negocios/leads/config`; índices de consulta (`ix_ncrm_*`) já criados. | Avaliar caso o advisor aponte FK sem índice; adicionar índice só em ncrm_*. |
| `unused_index` (perf) | Índices novos podem aparecer como "unused" logo após aplicar (sem tráfego). | Aceitar; reavaliar após uso real em staging. |

## Alertas em objetos legados
Se o advisor apontar algo em `usuarios/negocios/leads/...` (ex.: RLS/policies do legado de staging),
**não corrigir aqui** — registrar e encaminhar para revisão separada do legado. A estrutura legada de
staging é uma réplica mínima para teste, não o alvo desta migration.
