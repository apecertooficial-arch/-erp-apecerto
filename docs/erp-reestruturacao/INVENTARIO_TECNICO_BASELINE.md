# Inventário técnico — baseline inicial do ERP ApeCerto

Atualizado em: 2026-09-19
Método: filesystem e Git locais, mais `/api/build` público; sem escrita externa.

## Veredito canônico inicial

| Evidência | Valor |
|---|---|
| Remoto canônico | `https://github.com/apecertooficial-arch/-erp-apecerto.git` |
| `origin/main` | `e478030e4eaf33d17562ceb5ac2b3bef34fd677a` |
| Build publicado `/api/build` | `e478030e4eaf33d17562ceb5ac2b3bef34fd677a` |
| Worktree de reconstrução | `/private/tmp/apecerto-erp-crm-visual` |
| Branch isolada | `codex/erp-crm-visual-concept` |
| Base da worktree | `e478030e4eaf33d17562ceb5ac2b3bef34fd677a` |
| Supabase referenciado | `diaegvfveqezispcthwk` |

Conclusão: código publicado, `origin/main` e base da worktree coincidem. Esta é
a fonte de verdade inicial do código. O banco e as Edge Functions, porém,
possuem deriva própria e ainda não formam um release reproduzível com esse
commit.

## Produção remota — metadados sanitizados

Consulta somente leitura em 2026-09-19, sem linhas de clientes:

| Evidência | Estado observado |
|---|---|
| projeto | `ACTIVE_HEALTHY`; Postgres 17, região `us-east-1` |
| objetos públicos | 232 tabelas, 37 views/materialized views, 562 funções |
| dispatcher | modo `worker`; heartbeat recente; atraso 0 s |
| fila do motor | 211 pendentes futuros da Sara; 0 vencidos, 0 processando, 0 falhos |
| Sara canônica | `f2_sara_config.enabled=true`, modo `completo` |
| Sara legada | `ncrm` em `observer`, runner desligado e tabelas marcadas como geração aposentada |
| Cron relacionado | nenhum job ativo de Sara/motor/presença; cutover para worker confirmado |
| Edge Functions remotas | 53 ativas contra 26 diretórios locais |
| migrations remotas | histórico segue até 2026-09-18; nomes/versões não coincidem um a um com os arquivos locais |

A divergência Edge/migrations é bloqueio de release reproduzível. Alguns itens
remotos podem ser integrações históricas deliberadas, mas nenhum será excluído
sem localizar chamadores, owner, substituição e rollback.

## Cópias e módulos históricos encontrados

| Caminho | Remoto/branch/commit | Situação inicial |
|---|---|---|
| `Documents/ChatGPT/ERP` | mesmo remoto; `codex/erp-reestrutura-baseline-20260908`; `b8a9f82a...` | 8 mudanças locais; commit ancestral da produção; preservar |
| `apecerto- Produtos/repos/erp-source` | mesmo remoto; `main`; `f0a6a991...` | commit ancestral; 781 mudanças locais; não usar como canônico |
| `ApeCerto - Visitas e agenda/repo` | mesmo remoto; `codex/visitas-agenda-privada-20260829`; `df593e73...` | commit ancestral; 1 mudança local; preservar para comparação |
| `apecerto-automacoes` | mesmo remoto; `agent/sara-tempo-real-eficiente-20260829`; `7cfa0a2f...` | objeto não presente na cópia canônica; 11 mudanças; comparar antes de absorver |
| `apecerto-traqueamento/erp-audit` | mesmo remoto; `codex/meta-site-audit-20260828`; `e897d3e2...` | objeto não presente na cópia canônica; árvore limpa; auditoria histórica |
| `apecerto-CRM` | sem commit e sem remoto | pasta de trabalho/auditoria; não é fonte Git canônica |
| `apecerto-Financeiro` | sem commit e sem remoto | pasta de trabalho/auditoria; não é fonte Git canônica |
| `apecerto- Produtos` | sem commit e sem remoto | contêiner de trabalho; fonte Git está em `repos/erp-source` |
| `ApeCerto - Visitas e agenda` | sem commit e sem remoto | contêiner de trabalho; fonte Git está em `repo` |
| `apecerto-Studio` | sem commit e sem remoto | pasta de trabalho/auditoria; não é fonte Git canônica |

Regra: nenhuma mudança dessas cópias será copiada sem comparar contrato,
histórico, testes e presença equivalente em `origin/main`.

## Contagem estrutural do código canônico

| Superfície | Quantidade |
|---|---:|
| páginas Next | 28 |
| rotas de API | 35 |
| diretórios de feature | 22 |
| migrations SQL locais | 294 |
| Edge Functions | 26 |
| arquivos de worker | 4 |
| arquivos de teste | 91 |
| folhas de estilo em `app/styles` | 35 |

## Páginas

- `/abordagens`
- `/agenda`
- `/agentes-ia`
- `/ajuda`
- `/auditoria`
- `/automacoes`
- `/chat`
- `/configuracoes`
- `/conhecimento`
- `/crm`
- `/disparos`
- `/equipe`
- `/financeiro`
- `/financiamento`
- `/inicio`
- `/inteligencia`
- `/marca-dagua`
- `/negocio/[...caminho]`
- `/notificacoes`
- `/permissoes`
- `/produtos`
- `/tarefas`
- `/usuarios`
- `/agenda/[token]`
- `/cadastro`
- `/definir-senha`
- `/ficha/[token]`
- `/`

## Rotas de API

- `/api/agenda-publica`
- `/api/agenda`
- `/api/agentes`
- `/api/approaches`
- `/api/automacoes-explicar`
- `/api/automacoes-operacao`
- `/api/campaigns`
- `/api/capture`
- `/api/catalog`
- `/api/central-activity`
- `/api/central-comando`
- `/api/condominiums`
- `/api/connections`
- `/api/crm/sales`
- `/api/dashboard`
- `/api/equipe`
- `/api/ficha-publica`
- `/api/finance`
- `/api/financiamento`
- `/api/funil2/carteira`
- `/api/funil2/clientes`
- `/api/funil2/conversa`
- `/api/funil2`
- `/api/geocode`
- `/api/live-chat`
- `/api/metas`
- `/api/ncrm/push/chave`
- `/api/ncrm/push/registrar`
- `/api/notificacoes`
- `/api/permissions`
- `/api/presenca`
- `/api/product`
- `/api/projects`
- `/api/session`
- `/api/team`

## Features

`agents`, `approaches`, `audit`, `automations`, `calendar`, `campaigns`, `chat`,
`finance`, `funil-2`, `home`, `inteligencia`, `notifications`, `permissions`,
`presence`, `products`, `projects`, `sales`, `settings`, `system`, `tasks`,
`team`, `tools`.

## Edge Functions

A reconciliação remota/local está detalhada em
`docs/erp-reestruturacao/EDGE_FUNCTIONS_RECONCILIACAO.md`: 53 funções remotas,
26 fontes locais na leitura inicial e 27 funções apenas remotas. Quatro dessas
funções são chamadas diretamente pelo ERP; `dapi-qr` já possui substituição
local segura em validação, ainda sem deploy.

`backfill-historico`, `crm-capi`, `dapi-enviar`, `dapi-webhook`,
`distribuir-lead`, `entrada`, `enviar-produto`, `enviar-whatsapp`,
`f2-sara-interpretar`, `f2-sara-reclassificar`, `ia-avaliar-lote`,
`ia-docs-classificar`, `ia-router`, `ia-testes`, `ia-transcrever`, `lead-chat`,
`marketing-ads-read`, `meta-capi`, `ncrm-sara-observer`, `ncrm-web-push`,
`presenca`, `remover-marca-dagua`, `social-meta-oauth`, `social-publisher`,
`wa-agenda-do-corretor`, `wa-varredura-numeros`.

## Workers

- `workers/automations-dispatcher/index.mjs`
- `workers/automations-dispatcher/runtime.mjs`
- `workers/studio-renderer/index.mjs`
- `workers/studio-renderer/render-engine.mjs`

## Catálogo léxico das migrations locais

Contagem de nomes distintos encontrados por análise textual; ainda não prova o
estado remoto e pode incluir objetos posteriormente removidos ou substituídos.

| Objeto | Quantidade local distinta |
|---|---:|
| tabelas criadas | 213 |
| views/materialized views | 18 |
| funções | 439 |
| triggers | 60 |
| policies | 119 |
| índices | 157 |
| comandos `ENABLE ROW LEVEL SECURITY` | 142 ocorrências |
| referências a `auth.*` | 325 ocorrências |
| referências a `storage.*` | 59 ocorrências |
| referências a `cron.*` | 102 ocorrências |

O catálogo remoto anteriormente observado tinha 381 tabelas/relações. A
diferença para as 213 tabelas criadas localmente é um bloqueio de reconciliação,
não evidência de perda: pode incluir tabelas pré-baseline, objetos de extensões,
schemas externos, tabelas removidas ou ausência de migrations locais.

## Autoridades duplicadas já visíveis

### CRM/Sara

- famílias `f2_*`, `ncrm_*`, `motor_*`, tabelas antigas (`leads`, `negocios`,
  `visitas`) e endpoints `/api/funil2` + `/api/crm/sales`;
- funções paralelas de entrada, distribuição, Sara, visita, notificação e ação;
- risco: a interface mostrar uma autoridade enquanto automações consultam outra.

### WhatsApp

- famílias `wa_*`, `wa_core.*`, `dapi-*`, `enviar-whatsapp` e tabelas de
  instâncias/conversas/mensagens;
- risco: duplicidade de envio, status divergente e credencial em autoridade errada.

### Produtos

- `empreendimentos`, `unidades`, `produtos`, `midias`, drafts privados e
  funções de publicação/captação;
- risco: aprovação no frontend não corresponder ao contrato de publicação.

### Financeiro/vendas

- `vendas`, `recebimentos`, `venda_corretores`, `negocios`, `/api/finance`,
  `/api/crm/sales` e rotas de negócio;
- risco: dashboards e lançamentos usarem autoridades diferentes.

## Gates pendentes

1. reconciliar migrations aplicadas e catálogo remoto por metadados;
2. comparar as 53 Edge Functions remotas, versões e hashes com as 26 fontes locais;
3. comparar Auth, Storage, buckets, Cron e configurações sem expor segredos;
4. mapear leitura/escrita de cada rota e feature;
5. provar autorização server-side e políticas efetivas;
6. classificar testes pelo comportamento realmente comprovado;
7. escolher uma autoridade por domínio antes de remover legado.
