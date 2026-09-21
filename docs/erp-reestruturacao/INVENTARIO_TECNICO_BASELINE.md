# Inventário técnico — baseline inicial do ERP ApeCerto

Atualizado em: 2026-09-21
Método: filesystem e Git locais, mais `/api/build` público; sem escrita externa.

## Revalidação da branch ativa — 2026-09-21

Este bloco substitui os SHAs e caminhos históricos nas seções abaixo; elas são
mantidas como trilha da descoberta, não como indicação de deploy atual.

| Evidência | Estado atual |
|---|---|
| `origin/main` e build web publicado | `2e05089c5a3684d00a94402cfaf351d92d727928` |
| worktree ativa | `/private/tmp/apecerto-erp-studio-restore-20260920` |
| branch isolada | `codex/crm-sara-determinismo-20260921` |
| Supabase | `diaegvfveqezispcthwk` |
| Edge `entrada` | versão 23; hash `7513b214a045b69cf1fcfc8c1274f7f98422a096141c846fe5ac922403703ece` |
| árvore rastreada | limpa no último checkpoint; `node_modules` é vínculo local não versionado |

Contagem desta branch: 29 páginas, 36 rotas de API, 23 áreas de feature, 300
migrations locais, 27 Edge Functions, 130 arquivos de teste e 36 folhas de
estilo. Quatro das migrations locais foram recuperadas do histórico remoto da
Sara nesta branch; mesmo assim, 336 migrations observadas no banco ainda não
possuem arquivo local, portanto o banco continua não reproduzível somente pelo
Git.

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

## Baseline promocional atualizado em 2026-09-20

O baseline acima é preservado como evidência do início da reconstrução. Após
as promoções incrementais, o build servido e confirmado em `/api/build` é
`87f4ae24c381217fb56c890d8b88801b981c9e72`. Ele inclui Avisos, Financiamento,
Agentes de IA e leitura fail-closed do Catálogo. A tela `/produtos` foi
revalidada autenticada no desktop e no aplicativo/PWA. Isso atualiza a
referência de código publicado; não elimina a deriva independente de migrations
e Edge Functions registrada neste inventário.

## Revalidação canônica de 2026-09-21

As seções anteriores preservam o ponto de partida. O estado atual comprovado é:

| Evidência | Estado atual |
|---|---|
| `origin/main` | `f935431c61a3a52f7558e5e6f6c76ca0dd677db5` |
| build publicado `/api/build` | `f935431c61a3a52f7558e5e6f6c76ca0dd677db5` |
| worktree de reconstrução | `/private/tmp/apecerto-erp-deploy-verify-stage-20260920` |
| branch isolada | `codex/deploy-verify-stage-20260920` |
| HEAD local | `4191e887e65432248aa200a24281379e8fc80a60` |
| árvore rastreada | limpa; somente o vínculo local `node_modules` permanece não versionado |

Contagem da árvore candidata atual:

| Superfície | Quantidade atual |
|---|---:|
| páginas Next | 29 |
| rotas de API | 36 |
| diretórios de feature | 23 |
| migrations SQL locais | 310, com 310 versões e 310 nomes únicos |
| diretórios locais de Edge Functions, sem `_shared` | 28 |
| testes `*.test.mjs` | 159 |
| folhas de estilo em `app/styles` | 37 |

Catálogo remoto sanitizado, sem leitura de linhas operacionais:

| Objeto/controle | Quantidade atual |
|---|---:|
| tabelas públicas | 232 |
| views públicas | 37 |
| materialized views públicas | 0 |
| sequências públicas | 75 |
| funções públicas | 562 |
| tabelas públicas com RLS habilitada | 232 |
| tabelas públicas com `FORCE RLS` | 0 |
| policies públicas | 342 |
| triggers públicos não internos | 115 |
| índices públicos | 695 |
| extensões | 9 |
| usuários Auth | 15 |
| buckets Storage | 9 |
| objetos Storage | 2.914 |
| bytes declarados nos metadados do Storage | 1.694.451.440 |
| jobs cron | 24, sendo 16 ativos |
| Edge Functions ativas | 53 |
| registros no histórico remoto de migrations | 953 |

O projeto está `ACTIVE_HEALTHY`, mas o registro da branch principal está em
`MIGRATIONS_FAILED`. O cruzamento atual encontrou 953 registros remotos e 310
arquivos locais: 36 versões e 282 nomes coincidem. Esse estado impede tratar a
árvore como banco reproduzível; o gate está detalhado em
`BRANCHING_MIGRATION_DRIFT_2026-09-21.md` na branch candidata.

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
| migrations remotas | 953 registros/952 nomes; 608 registros pós-baseline, dos quais 341 nomes não têm arquivo local |

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
| migrations SQL locais | 294 arquivos/293 nomes distintos |
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
26 fontes locais na leitura inicial e 30 após a reconstrução dos quatro slugs
chamados diretamente pelo ERP. Restam 23 funções apenas remotas. `dapi-qr`,
`admin-usuarios`, `cadastro-publico` e `definir-senha` possuem substituições
locais seguras, ainda sem deploy.

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

## Reconciliação do histórico de migrations

A leitura oficial do histórico remoto em 2026-09-19 confirmou:

- 953 registros remotos e 952 nomes distintos;
- 608 registros/607 nomes a partir do baseline `20260727000000`;
- somente 266 desses nomes pós-baseline possuem arquivo local;
- 341 nomes pós-baseline não têm SQL versionado nesta árvore;
- 27 arquivos locais não aparecem pelo nome no histórico remoto;
- quatro timestamps locais são compartilhados por dois arquivos;
- há um nome local duplicado e um nome remoto duplicado.

Consequência: o código pode ser construído e testado, mas o banco não pode ser
recriado nem atualizado em bloco com segurança a partir desta árvore. O comando
`supabase db push` fica bloqueado até existir reconciliação em ambiente isolado.
O detalhamento vivo está em `supabase/MIGRACOES-FALTANTES.md`; os 27 arquivos
locais sem registro pelo mesmo nome estão classificados em
`docs/erp-reestruturacao/MIGRACOES_LOCAIS_SEM_REGISTRO.md`.

### Estado revalidado em 2026-09-21

As quatro colisões de timestamp e o nome local duplicado foram eliminados no
commit local `4191e887`. Seis fontes recuperadas passaram a usar os timestamps
registrados remotamente, os rollbacks correspondentes foram alinhados e o
placeholder de seis linhas do Funil 2 foi removido. O catálogo local agora tem
310 arquivos, 310 versões e 310 nomes únicos.

O gate permanente passou em 93/93 testes direcionados, 848/848 no catálogo
oficial e 1.144/1.144 na varredura integral. Isso corrige a ambiguidade local;
não repara o histórico remoto nem remove o estado `MIGRATIONS_FAILED`.

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

1. classificar as fontes remotas ainda ausentes e os 28 nomes locais sem registro remoto correspondente;
2. obter o erro oficial do replay e reconciliar o histórico sem reescrever timestamps por inferência;
3. comparar Auth, Storage, buckets, Cron e configurações sem expor segredos;
4. mapear leitura/escrita de cada rota e feature;
5. provar autorização server-side e políticas efetivas;
6. classificar testes pelo comportamento realmente comprovado;
7. escolher uma autoridade por domínio antes de remover legado.
