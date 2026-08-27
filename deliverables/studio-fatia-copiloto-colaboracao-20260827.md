# Evidências — Copilot, colaboração, board e métricas

Data: 27/08/2026. Execução local, sem deploy, publicação ou gasto externo.

## Implementado

- StudioCopilot contextual por campanha/peça, com comandos rápidos, preview/diff, sandbox determinístico quando IA está bloqueada e persistência via `createVariant`.
- Proteção factual: o comando usa snapshot do ERP; sandbox é marcado como não publicável e não altera fatos.
- Colaboração persistida em `social_piece_tasks` e `social_piece_comments`: responsável, revisor, prazo, status, pendência e comentários associados à versão.
- Board do gestor na visão geral: gargalos de revisão, bloqueios, filtros conceituais por campanha/formato/template/período e contagem de snapshots de métricas.
- Estrutura de métricas em `social_metrics_snapshots`, com fonte explícita e estado honesto quando Meta não está conectado.
- RLS e políticas por permissão (`ver`, `editar`, `revisar`) para as três tabelas novas.
- Calendário existente segue com datas reais, status, conflito e aprovação; drag-and-drop visual permanece como próxima etapa de interação avançada.
- Canva continua com exportação JSON baixável e instrução explícita de retorno/importação versionada, sem alegar sincronização.

## Verificações

- Suíte Studio: 55 testes passaram (incluindo contratos de RLS, Copilot, colaboração e métricas).
- Build `vinext`: passou.
- ESLint nos arquivos alterados: passou sem erros.
- Regressão ampla `node --test tests/*.mjs`: não passou por dois contratos preexistentes e não relacionados a esta fatia: seletor visual legado em `tests/crm-organizacao.test.mjs` e revogação de RPC legada em `tests/studio-meta-contract.test.mjs`. O conjunto Studio permaneceu verde.

## Limitações

- Migration `20260827180000_studio_collaboration_metrics.sql` ainda não foi aplicada remotamente por solicitação de não fazer deploy.
- Não foi possível comprovar a nova persistência na sessão autenticada publicada sem publicar esta versão; nenhuma publicação real foi feita.
- Métricas Meta ficam vazias até conexão autorizada; a interface não inventa números.
