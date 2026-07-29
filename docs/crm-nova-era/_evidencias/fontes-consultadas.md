# Evidências consultadas — Fase 2.2

Nenhum SQL foi executado em banco algum. O MCP do Supabase esteve conectado na sessão e foi
DELIBERADAMENTE NÃO usado (proibição da fase). Toda evidência é local (repositório) ou lida via
`git show` da branch P0.

| Fonte | Como | Sustenta |
|---|---|---|
| `app/lib/supabase/database.types.ts` | leitura direta | colunas/FKs/identities (doc 05) |
| `app/api/**`, `app/lib/{esteira,permissions}.ts`, `authz.ts` | leitura direta | leitores/escritores; RPCs; realtime (doc 05) |
| Auditoria P0 via `git show chore/fase-0-5-contencao-p0:docs/...` | git show | 127 RPCs anon; classes de função; triggers; volumes; Migration A não aplicada |
| `git ls-tree -r HEAD | grep -i migra` | comando local | schema não versionado (sem migrations no repo) |
| Protótipo `app/features/crm-nova-era/**` (commit 103e773) | leitura direta | mapeamento protótipo→banco; zero rede |

## Verificações que continuam PENDENTES (bloqueios — doc 20)

Não verificáveis dentro das proibições desta fase (exigiriam ler o banco): corpos/segurança dos
helpers de RLS (B1); `FORCE ROW LEVEL SECURITY` em `negocios` (B2); índice `negocios(corretor_id)`
(B3); texto das policies legadas (B4); exposed schemas do PostgREST (B6); extensão `btree_gist`
(B7). Todos listados no doc 20 com a evidência objetiva que os libera.
