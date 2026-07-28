# Inspeção do ERP ApeCerto — mapa para o "CRM Nova Era" (auditoria SOMENTE-LEITURA)

Repositório: `/root/erp-apecerto` · Next.js 16 (App Router) / React 19 / Tailwind 4 (mas o CSS é quase todo global, ver §3).
Data da inspeção: 2026-07-28. Nenhum arquivo foi modificado.

Regra de ouro para o Nova Era: o app inteiro é um **switch de workspace por estado** dentro de um único
componente cliente (`ProductCatalog`). Não há roteamento de página por módulo. Para inserir um CRM paralelo
sem tocar no atual, o caminho de menor risco é **adicionar um novo `ModuleName` + um novo branch no switch**
(ou um sub-seletor dentro do branch "CRM"), montando um componente `CrmNovaEraWorkspace` isolado. Ver §2 e §11.

---

## 1. Tela/CRM atual — `app/features/crm/CrmWorkspace.tsx`

Arquivo principal: `app/features/crm/CrmWorkspace.tsx` (2145 linhas, um único arquivo com dezenas de
subcomponentes). Existe também `app/features/crm/CrmWorkspace_1.tsx` (448 linhas) — é uma **versão antiga/rascunho
(backup `_1`), NÃO importada por ninguém** (o import ativo é `CrmWorkspace`, ver `ProductCatalog.tsx:17`). Pode ser
ignorada como referência morta ("não confirmado" se tem uso; o grep de imports só encontra `../crm/CrmWorkspace`).

### 1.1 Assinatura e props (evidência: `CrmWorkspace.tsx:173`)
```
export function CrmWorkspace({ accessToken, initialDealId, onInitialDealHandled,
  initialChatDealId, onInitialChatHandled, initialView, initialCreateSale,
  onInitialViewHandled, sessionRole, canReassign, canAssign })
```
- `accessToken: string` — token Supabase; toda chamada usa `authedFetch` (refresh 1x em 401), `CrmWorkspace.tsx:14`.
- `initialDealId` / `initialChatDealId` — abre a ficha ou o chat de um negócio ao entrar (usado pela Central de
  Atenção e por Notificações, ver `ProductCatalog.tsx:293,315,367`).
- `initialView` (`ViewName`) e `initialCreateSale` — entra direto numa aba (ex.: Financeiro manda `"sales"` +
  `initialCreateSale=true`, `ProductCatalog.tsx:303`).
- `sessionRole: "admin" | "gestor" | "corretor"`, `canReassign`, `canAssign` — controlam ações de transferência.

### 1.2 Estado interno (evidência: `CrmWorkspace.tsx:174-209`)
`data` (payload completo do `/api/crm`), `loading`, `error`, `view` (`ViewName`), `query`, filtros
(`pipelineId, stageId, brokerId, origin, dateFrom, dateTo, productFilter, tag, group, overdueOnly`),
`selectedDealId` (ficha aberta), `chatDealId` (chat aberto), `momentoDealId`, `createOpen`, `fishing` (aquário),
`draggingDealId` (drag-and-drop), `bulkMoveOpen`, `brokerPickerDealId`, `stagePickerDealId`, `respToast`.

### 1.3 Abas (views) — `ViewName = "pipeline" | "leads" | "sales" | "analytics" | "agenda" | "atividades"`
Barra de comando em `CrmWorkspace.tsx:435-445`; títulos em `viewHeadings` (`CrmWorkspace.tsx:99-106`).
Render condicional por view em `CrmWorkspace.tsx:460-469`:
- `pipeline` → `PipelineViewEnhanced` (o kanban), dentro de `crm-pipe-layout` com um "rail" lateral de funis.
- `leads` → `LeadsViewEnhanced`; `sales` → `SalesProcessView` (a Esteira, ver §5); `analytics` → `AnalyticsView`;
  `agenda` → `AgendaView`; `atividades` → `ActivitiesView`.

### 1.4 Como o quadro/kanban é montado
- Fonte de dados: `GET /api/crm` (§4) devolve `pipelines, stages, leads, deals, sla, ...`. Um funil = `pipeline`;
  colunas = `pipeline_stages` filtrados por `pipeline_id` (`activeStages`, `CrmWorkspace.tsx:296`).
- `kanbanPipeId = pipelineId ?? primeiro pipeline` — o quadro sempre precisa de UM funil (`CrmWorkspace.tsx:293`).
- Componente do quadro: `PipelineViewEnhanced` (assinatura em `CrmWorkspace.tsx:1263`; render das colunas a partir
  de `CrmWorkspace.tsx:1320`, `<section className="crm-kanban-v2" ref={boardRef}>{stages.map(...)}`).
- Card do lead: cada `deal` vira um card; agrupado por `stage_id`. Cores por SLA (24/48/72, ver §8) e por "momento
  do lead" (catálogo do banco, `CrmWorkspace.tsx:68-93`).
- Interação: drag-and-drop entre colunas → `dropDeal` (`CrmWorkspace.tsx:374`) → `mutate({action:"moveDeal"})`.
  Scroll horizontal por roda/arraste do fundo do board (`CrmWorkspace.tsx:1274-1318`). Em "Funil Inteligente"
  (`pipeline.grupo === "crm_inteligente"`) o arraste é **desligado** — a etapa é consequência do momento
  (`kanbanEhInteligente`, `CrmWorkspace.tsx:390,462-463`).

### 1.5 Como abre o painel do lead
- Kanban chama `onOpen(dealId)` → `openDeal` (`CrmWorkspace.tsx:362`): `setSelectedDealId(dealId)` + reconhece
  alerta pendente (`acknowledgeLead`).
- Render do painel: `LeadDrawer` (montado em `CrmWorkspace.tsx:476`, `key={selectedDeal.id}`), recebe
  `accessToken, lead, deal, data, canReassign, canMoveDeals, onClose, onMutate, onReload, setMessage`. É um drawer
  lateral com ficha + histórico + ações. Definição do componente adiante no mesmo arquivo (não confirmado o número
  exato da linha da `function LeadDrawer`, mas é montado em 476).
- O "chatzinho" do lead é outro drawer: `LeadChatDrawer` (`CrmWorkspace.tsx:1514`), aberto por `openChat`
  (`CrmWorkspace.tsx:367`) via `chatDealId`. Ele reusa `MessageMedia` etc. do LiveChat (§7).

### 1.6 Modais auxiliares (todos no mesmo arquivo)
`MomentoModal` (475), `BrokerPickerModal` (1406), `StagePickerModal` (1421), `BulkMoveModal` (1508),
`CreateLeadModal` (montado em 480), `StageConfigModal` (478), `CreateSaleModal` (1198), `VisitEditModal` (1755).
Helpers de UI reaproveitáveis: `RefinedSelect` (1436), `HistoryInstanceSelect` (1463).

---

## 2. Shell e NAVEGAÇÃO / onde o CRM abre

### 2.1 Ponto de entrada (App Router)
- `app/page.tsx` (5 linhas): `export default function Home() { return <ProductCatalog />; }`. Ou seja, a raiz `/`
  renderiza **um único workspace cliente**. Não há `/crm/page.tsx` etc.
- `app/layout.tsx` importa `globals.css` e envolve o app.

### 2.2 O orquestrador real: `app/features/products/ProductCatalog.tsx`
Apesar do nome, este componente é o **shell inteiro do ERP** (login, sessão, e o switch de módulos).
- Estado que controla a aba ativa: `const [activeModule, setActiveModule] = useState<ModuleName>("Início")`
  (`ProductCatalog.tsx:116`).
- Passa para `<AppShell activeItem={activeModule} onNavigate={setActiveModule} ...>` (`ProductCatalog.tsx:288`).
- O switch gigante de módulos → workspaces está em `ProductCatalog.tsx:290-366` (uma cadeia de ternários
  `activeModule === "X" && accessToken ? <XWorkspace/> : ...`). O CRM é o segundo branch:
  `activeModule === "CRM" && accessToken ? <CrmWorkspace .../>` (`ProductCatalog.tsx:292-293`).

### 2.3 Onde o item "CRM" aparece no menu: `app/components/AppShell.tsx`
- Listas de itens por papel (`AppShell.tsx:6-11`): `adminMainItems = ["Início","CRM","Performance","Produtos",
  "Financeiro"]`; idem `brokerMainItems`. "CRM" está no grupo **PRINCIPAL**.
- Ícone do CRM (funil): `AppShell.tsx:16`. Badge fixo "20" hardcoded ao lado do CRM: `AppShell.tsx:46`
  (`{item === "CRM" && <small>20</small>}`) — cosmético.
- Navegação: `NavGroup` renderiza `<button onClick={() => onNavigate(item)}>` (`AppShell.tsx:43`). `onNavigate` é o
  `setActiveModule`.
- Visibilidade por permissão: `canSee` (`AppShell.tsx:81-87`) usa `permSlugs` (`AppShell.tsx:63-80`): CRM mapeia
  para slugs `["crm","leads","pipeline"]`. Admin vê tudo; sem mapa de permissões → libera (fail-open).

### 2.4 `ModuleName` — catálogo de módulos: `app/features/system/module-map.ts`
`ModuleName = keyof typeof moduleMap` (`module-map.ts:90`). O módulo `CRM` está em `module-map.ts:6-9` e lista as
tabelas `["leads","negocios","pipelines","pipeline_stages","crm_atividades","crm_tarefas","visitas"]`.

### 2.5 Como inserir o seletor "Funil atual / CRM Nova Era" (recomendação)
Duas opções, ambas sem tocar o CRM atual:
- **(A) Novo módulo no menu.** Adicionar `"CRM Nova Era"` como novo `ModuleName` em `module-map.ts`, incluí-lo em
  `adminMainItems`/`adminToolItems` no `AppShell.tsx`, dar-lhe ícone, e adicionar um branch
  `activeModule === "CRM Nova Era" ? <CrmNovaEraWorkspace .../>` no switch de `ProductCatalog.tsx`. Isolamento
  máximo; o CRM atual fica intocado.
- **(B) Sub-seletor dentro do branch "CRM".** Introduzir um estado local `crmVariant: "atual" | "nova-era"` e, no
  branch CRM do `ProductCatalog.tsx`, renderizar um pequeno toggle no topo que alterna entre `<CrmWorkspace/>` e
  `<CrmNovaEraWorkspace/>`. Requer editar o branch existente (pequena mudança cirúrgica), mas dá o "Funil atual /
  Nova Era" pedido literalmente.
Recomendo (A) para isolamento e (B) só se o cliente exigir o toggle visualmente colado no CRM.

---

## 3. Sistema visual (tokens, classes, padrões reutilizáveis)

### 3.1 Onde mora o estilo
- **NÃO há CSS Modules nem `app/features/**/ui`** (confirmado: `find app -type d -name ui` = vazio; não existe
  `app/features/*/ui`). Todo o visual está em **um único `app/globals.css` (5662 linhas)** com classes globais
  semânticas (BEM-ish). Tailwind 4 está instalado (postcss) mas o código usa classes próprias, não utilitárias.
- Diretrizes de marca: `APECERTO_DIRECAO_DESIGN.md` na raiz do repo (ler antes de estilizar — "respeitar o sistema
  visual" = usar as mesmas classes globais e a paleta laranja ApeCerto).

### 3.2 Paleta / tokens observados no código
- Laranja da marca: `#ff7000` (etapa "início" da esteira, `CrmWorkspace.tsx:512`). Gama de cores de etapa em
  `saleStages` (`CrmWorkspace.tsx:511-520`) e paleta de colunas `STAGE_PALETTE` (`CrmWorkspace.tsx:1268`):
  `["#22a35a","#2f9e8f","#3b6fe0","#7c3aed","#d61f69","#d13d3d","#e8620e","#e0a520","#7cb518","#5b6b7c","#8a6a4a","#3f3a36"]`.
- Cores de SLA: verde/amarelo/vermelho/preto (24/48/72h) — ver §8.

### 3.3 Classes reutilizáveis (padrões do sistema)
- **Shell**: `app-shell`, `sidebar`, `nav-group`, `nav-item`, `nav-icon`, `nav-label`, `workspace`, `topbar`,
  `profile` (`AppShell.tsx`).
- **Botões**: `primary-action` / `secondary-action` (topbar Produtos); no CRM `crm-primary` (botão principal dos
  modais, ex. `LiveChatWorkspace.tsx:379`); `crm-filter-trigger`, `crm-bulk-trigger`, `crm-overdue-trigger`,
  `stage-config-trigger` (`CrmWorkspace.tsx:449-452`).
- **Cabeçalho de workspace**: `crm-v2`, `crm-v2-header`, `crm-eyebrow`, `crm-command-bar`, `crm-toolbar-v2`,
  `crm-filter-sheet` (`CrmWorkspace.tsx:429-455`).
- **Kanban**: `crm-kanban-v2`, `crm-pipe-layout`, `crm-pipe-rail`, `crm-pipe-item`, `crm-stage-body` (colunas),
  `crm-toast`, `resp-toast` (`CrmWorkspace.tsx:456-463,1288,1320`).
- **Modais**: `crm-center-modal` (base de modal, usada em LiveChat e CRM, ex. `LiveChatWorkspace.tsx:372,385,404`),
  `quick-action-modal`, `modal-error`, `crm-modal-layer`/`calendar-modal-layer` (Calendário).
- **Chat**: `live-chat`, `conversation-list`, `chat-thread`, `message-stream`, `chat-composer`, `chat-sidebar`,
  `quick-actions`, `wa-audio` (`LiveChatWorkspace.tsx:232-293`).
- **Cards de produto**: `product-grid`, `product-card`, `product-photo`, `product-info` (`ProductCatalog.tsx:351-352`).
- **Chips/badges**: `approval-badge`, `pu-chip`, `nav-badge-pending`, `data-status`.

### 3.4 Como "respeitar o sistema visual" no Nova Era
Reutilizar as classes acima (não inventar novas famílias) e seguir a estrutura `crm-v2 > crm-v2-header +
crm-command-bar + <board>`. Como o CSS é global, **qualquer classe nova do Nova Era deve receber prefixo próprio**
(ex.: `nova-crm-*`) para não colidir nem herdar estilos do CRM atual sem querer. Componentes compartilhados
seguros de reusar: `MoneyInput`/`PercentInput` (`app/components/MoneyInput.tsx`) e os modais exportados do
LiveChat (§7/§10).

---

## 4. `app/api/crm/route.ts` — actions e payloads (referência conceitual; NÃO chamar)

- Auth: Bearer token → `createServerSupabaseClient(token)` + `auth.getUser` (`route.ts:9-16`). `dynamic="force-dynamic"`.
- Autorização por ação: `resolveEffectiveAccess` + `denyIfCannot` sobre pares `(módulo, ação)` — basta um conceder
  (`route.ts:120-121`, ver §9).

### 4.1 `GET` (`route.ts:51-109`)
Faz ~15 consultas em paralelo e devolve um payload gordo: `pipelines, momentoCatalogo (lead_momento_catalogo),
stages (pipeline_stages), leads, deals (negocios), brokers, activities (crm_atividades), historico
(atendimento_acoes), tasks (crm_tarefas), productLinks (lead_produtos), visits (visitas), products
(empreendimentos), sla (view vw_sla_leads), alerts (crm_lead_alertas), leituras (crm_lead_leituras), aquario,
gerentes, role`. Paginação em 1000 linhas via `fetchAll` (`route.ts:40-49`). Leads do "aquário" (sem corretor)
são excluídos do payload — só contador.

### 4.2 `PATCH` — actions (todas em `route.ts`)
| action | linha | efeito |
|---|---|---|
| `updateLead` | 123 | edita `leads` (nome, telefone, email, tags, corretor_id se transferir) |
| `registrarMomento` | 152 | RPC `registrar_momento_lead` — só atributo do lead, **não move card** |
| `moveDeal` | 177 | RPC `mover_negocio(p_negocio_id, p_stage_id)` |
| `bulkMoveStage` | 189 | RPC `transferir_negocios_massa` |
| `createLead` | 206 | insere `leads` + abre `negocios` na 1ª etapa |
| `aquarioPescar` | 238 | RPC `aquario_pescar` |
| `aquarioImportar` | 245 | RPC `aquario_importar` |
| `addNote` | 260 | insere `crm_atividades` tipo `observacao` |
| `createTask` | 272 | insere `crm_tarefas` |
| `toggleTask` | 285 | marca `crm_tarefas.concluida` |
| `updateDeal` | 294 | edita `negocios.valor` |
| `transferDeal` | 305 | RPC `transferir_negocio` |
| `acknowledgeLead` | 316 | baixa `crm_lead_alertas` |
| `markRead` | 323 | upsert `crm_lead_leituras` |
| `acknowledgeResponse` | 330 | RPC `registrar_acao` tipo `resposta` |
| `discardDeal` | 338 | descarta negócio (status perdido, move p/ etapa "perdido") |
| **`createVisit`** | 355 | ver §4.3 |
| `updateVisit` | 398 | edita `visitas` |
| `gerenteDisponibilidade` | 436 | RPC `gerente_conflitos` (checa agenda do gerente) |
| `updateVisitStatus` | 450 | `visitas.status` = agendada/realizada/cancelada |
| `linkProduct`/`unlinkProduct` | 460 | vincula `lead_produtos` |

### 4.3 Como a VISITA é criada — `createVisit` (`route.ts:355-396`)
Payload: `leadId, dealId, date, startTime, endTime, productId, local, observations, participants, reminder,
withManager, gerenteId`. Insere em `visitas` (`route.ts:378-385`) com `created_by, lead_id, negocio_id,
corretor_id (do deal), cliente_nome (do lead), empreendimento_id, produto, data, hora_inicio/fim, local,
observacoes, participantes, lembrete, com_gerente, gerente_id, status:"agendada"`. Efeito colateral (best-effort):
move o negócio para o funil `"Visita ApeCerto"` etapa `"Visita Agendada"` via RPC `mover_negocio`
(`route.ts:387-394`).

### 4.4 Como a PROPOSTA é registrada
- **Via LiveChat** — `POST /api/live-chat` action `proposal` (`app/api/live-chat/route.ts:277-288`): valida
  `value>0`, faz `negocios.update({valor})` e insere `crm_atividades` tipo **`proposta`** com texto
  `"Proposta para <produto>: R$ X. <condições>"`. Não envia mensagem ao cliente.
- **Esteira** — a proposta como VALOR formal entra nas "Condições comerciais" da Esteira, não aqui. A venda em si
  nasce em `POST /api/crm/sales` action `create` (`sales/route.ts:437-458`): cria `vendas` + marca `negocios.status
  = "ganho"` + insere `venda_processos` na etapa `"inicio"`. Corretor entra `aprovacao_status:"pendente"`;
  gestor/admin já `"aprovada"`. Alternativa do corretor: action `solicitar` → RPC `solicitar_venda`
  (`sales/route.ts:459-468`).

---

## 5. `app/lib/esteira.ts` — a Esteira (conceitual)

A Esteira é o **fluxo pós-venda de contrato/documentação**, que começa depois que o negócio é "ganho"/proposta
aprovada (ver §4.4). Regras compartilhadas entre servidor (`/api/crm/sales`) e UI (`SalesProcessView` em
`CrmWorkspace.tsx`). Evidência: `esteira.ts:1-9`.

- **Blocos** (`BlocoEsteira`, `esteira.ts:11-28`): `condicoes`, `comissao`, `partes_comprador`, `docs_comprador`,
  `partes_vendedor`, `docs_vendedor`, `docs_imovel`.
- **Etapas** declaram em `esteira_etapas.libera` quais blocos abrem (cascata). Só avança quando tudo que a etapa
  liberou está completo — `pendenciasParaAvancar` (`esteira.ts:143-151`), `completudeBloco` (`esteira.ts:119-140`).
- Etapas de exemplo (fallback do front, `saleStages`, `CrmWorkspace.tsx:511-520`): Pedido aprovado → Doc comprador
  → Doc vendedor (revenda) → Contrato → Minuta+CNDs → Enviado p/ assinatura → Aguardando pagamento → Venda
  registrada. As etapas reais vêm do banco (`SalesData.stages`, `CrmWorkspace.tsx:493`).
- Documento condicional: `docExigido`/`docVisivel` (`esteira.ts:58-72`) — à vista não pede carta de crédito etc.
- Papéis: `podeEditarEtapa` (`esteira.ts:46-52`), `restrito_a` por etapa.
- Conceitualmente o Nova Era **não precisa** replicar a Esteira; ela é o backoffice jurídico/financeiro. Reusar
  como está (compartilhado) se o Nova Era também gerar vendas.

---

## 6. Calendário e visitas — `app/features/calendar/CalendarWorkspace.tsx`

- Props: só `{ accessToken }` (`CalendarWorkspace.tsx:27`). Lê **o mesmo `GET /api/crm`** (`CalendarWorkspace.tsx:45`)
  e usa `visits` + `tasks` do payload.
- Views: `day | week | month | list` (`CalendarWorkspace.tsx:18,134`). Grid mês/semana/dia, arrastar para criar,
  "＋ mais X" (`CalendarWorkspace.tsx:139-151`).
- Item do calendário = união de `visitas` e `crm_tarefas` com vencimento (`allItems`, `CalendarWorkspace.tsx:51-55`).
- **Como a visita entra**: modal "Agendar visita" → `createVisit()` (`CalendarWorkspace.tsx:87`) → `PATCH /api/crm`
  action `createVisit` (§4.3). Exige um `deal` (negócio aberto) selecionado. Também há "com gerente" com checagem de
  conflito via `gerenteDisponibilidade` (`CalendarWorkspace.tsx:101-114`).
- Editar visita: `saveEdit()` → action `updateVisit`; status via `updateVisitStatus`.

---

## 7. Live chat — `app/features/chat/LiveChatWorkspace.tsx`

- Props: `{ accessToken, initialLeadId, onInitialLeadHandled }` (`LiveChatWorkspace.tsx:35`). Existem backups
  `LiveChatWorkspace_1.tsx` e `_2.tsx` (não importados; o import ativo é `LiveChatWorkspace`,
  `ProductCatalog.tsx:21`).
- Conceito: **conversa (`wa_conversas`) ↔ contato (`wa_contatos`) ↔ lead**; mensagens em `wa_mensagens`. Tipo
  `ChatData` exportado (`LiveChatWorkspace.tsx:11-25`) — reusado pela Central de Atenção e pelo CRM.
- Fonte: `GET /api/live-chat` (lista) e `?conversationId=` (mensagens). Realtime via canal Supabase
  `wa_mensagens` (`LiveChatWorkspace.tsx:96-102`).
- Layout: lista de conversas (filtros: Todas / Sem resposta / Críticas + corretor/etapa/instância/SLA) | thread |
  sidebar com "Ações rápidas" (`LiveChatWorkspace.tsx:242`): Lembrete, Tarefa, Visita, Enviar produto, Proposta,
  Financiamento, Transferir, Observação.
- **Componentes exportados e reusáveis** (importados pelo CRM, `CrmWorkspace.tsx:8`): `MessageMedia`,
  `ProductSendModal`, `QuickActionModal`, `ScheduleModal`, tipos `ChatData`/`QuickAction`. `QuickActionModal`
  (`LiveChatWorkspace.tsx:295`) centraliza os payloads de proposal/visit/financing/etc.

---

## 8. AttentionCenter — `app/components/AttentionCenter.tsx` (lógica de urgência 24/48/72)

- Montado só no módulo CRM: `ProductCatalog.tsx:367` (`activeModule === "CRM" && showsAttentionCenter(email)`),
  gate por `app/lib/uiPrefs.ts` (`showsAttentionCenter`; lista de ocultos vazia = todos veem;
  `isSilentUser` esconde Sara/alertas — o e-mail do usuário atual `comercialromulopedroso@gmail.com` está em
  `SILENT_USERS`, `uiPrefs.ts:6`).
- Props: `{ accessToken, onOpenLead, onOpenChat, onOpenNotifications }` (`AttentionCenter.tsx:117`).
- Dados: combina `GET /api/crm` + `GET /api/live-chat` a cada 30s + realtime (`leads`, `wa_mensagens`,
  `crm_lead_alertas`) (`AttentionCenter.tsx:163-191`).
- **A régua FIXA 24/48/72 que o Nova Era NÃO deve copiar** está em `corPorMinutos` (`AttentionCenter.tsx:28-35`):
  `<24h verde, <48h amarelo, <72h vermelho, senão preto`. Rótulos correspondentes em `kindInfo`
  (`AttentionCenter.tsx:19-26`, "Amarelo · 24–48h" etc.). A mesma régua fixa aparece no card do funil
  (`CrmWorkspace.tsx` usa `alertColorByDays`, `CrmWorkspace.tsx:149`).
- Classificação de etapa (avançada/fria/terminal) por listas hardcoded de nomes de etapa
  (`STAGE_TERMINAL`/`STAGE_AVANCADA`, `AttentionCenter.tsx:39-47`) — também é lógica rígida a evitar.
- Baldes de alerta: `message` (nova msg ≤30min, precede tudo), `new` (lead ≤60min), depois a cor da régua
  (`buildAlerts`, `AttentionCenter.tsx:65-115`). Toca "chime" + notificação desktop para novos pendentes.
- **Para o Nova Era**: fazer um AttentionCenter próprio (isolado) cuja urgência venha de prazos configuráveis
  (ex.: `lead_momento_catalogo.prazo_dias`, já existente no payload, `route.ts:66`) em vez de 24/48/72 fixos.
  Não reaproveitar `corPorMinutos`.

---

## 9. Permissões de CRM/leads/pipeline

- **`app/lib/permissions.ts`** — `MODULE_CAPABILITIES` (`permissions.ts:17-39`):
  - `crm`: `ver, criar, editar, excluir, exportar, visualizar_historico`
  - `leads`: `ver, criar, editar, excluir, importar, exportar, atribuir, atribuir_proprio, transferir, visualizar_historico`
  - `pipeline`: `ver, criar, editar, excluir, mover, reordenar`
  - relacionados: `calendario` (`ver, criar, editar, excluir`), `chat` (`ver, criar`).
  - Níveis de acesso `none/ver/operar/gerenciar` e `canDo` (fail-open sem mapa; admin sempre) (`permissions.ts:80-129`).
- **`app/lib/supabase/authz.ts`** — `resolveEffectiveAccess` (override do usuário > perfil do papel,
  `authz.ts:11-33`), `accessCan`, `denyIfCannot` (aceita lista de pares — basta UM conceder, `authz.ts:45-52`).
- Uso no servidor: `route.ts:32-34` (`canCrm` testa `["crm","leads","pipeline"]`). Uso no cliente: `AppShell`
  `permSlugs.CRM = ["crm","leads","pipeline"]` (`AppShell.tsx:65`) e `ProductCatalog.hasCrmAction`
  (`ProductCatalog.tsx:272-278`).
- **Para o Nova Era**: reutilizar as MESMAS chaves (`crm/leads/pipeline`) é o caminho de menor atrito (herda perfis
  existentes). Se quiser gate separado, precisaria adicionar um módulo novo em `MODULE_CAPABILITIES` (ex.:
  `crm_nova_era`) e semear os perfis — mais trabalho. Recomendo herdar `crm/leads/pipeline` para leitura e decidir
  depois sobre ações específicas.

---

## 10. Tipos atuais (nomes de campos) — `app/lib/supabase/database.types.ts`

Somente os campos das tabelas pedidas (Row):

- **leads** (`database.types.ts:3325`): `id, nome, telefone, email, instagram, corretor_id, pipeline_id, status,
  origem, tags(Json), extras(Json), criado_em, atualizado_em, atendido_em, disparo_optout, momento, momento_atual,
  momento_em, momento_obs, momento_por, momento_atualizado_em, momento_atualizado_por, proxima_acao,
  proxima_acao_em, wa_contato_id, datacrazy_lead_id`.
- **negocios** (`database.types.ts:3913`): `id, lead_id, corretor_id, pipeline_id, stage_id, empreendimento_id,
  unidade_id, valor, status, motivo_perda, descarte_status, descarte_motivo, estagio_desde, ultima_movimentacao,
  criado_em, tentativa, max_tentativas, transferencia_para, transferencia_status, venda_id, raw(Json),
  datacrazy_negocio_id`.
- **pipelines** (`database.types.ts:4566`): `id, nome, grupo, ordem, empreendimento_id`.
- **pipeline_stages** (`database.types.ts:4504`): `id, pipeline_id, nome, rotulo, ordem, cor, tipo, grupo, chave,
  icone, alarme, sla_situacao, visivel_operacao, criado_em, datacrazy_stage_nome`.
- **crm_atividades** (`database.types.ts:1466`): `id, lead_id, negocio_id, corretor_id, tipo, texto, criado_em,
  criado_por`.
- **crm_tarefas** (`database.types.ts:1693`): `id, lead_id, negocio_id, corretor_id, titulo, descricao, vencimento,
  concluida, prioridade, cliente_nome, criado_em, criado_por, dc_lead_id, dc_negocio_id`.
- **visitas** (`database.types.ts:6223`): `id(uuid string), lead_id, negocio_id, corretor_id, created_by,
  cliente_nome, empreendimento_id, produto, unidade, data, hora_inicio, hora_fim, local, observacoes,
  participantes, lembrete, com_gerente, gerente_id, status, motivo_cancelamento, criado_em, atualizado_em,
  dc_lead_id, dc_negocio_id`.

Nota: o `grupo` de `pipelines` (string) distingue funil comum de `"crm_inteligente"` (§1.4). O `grupo` de
`pipeline_stages` é numérico (1..4 = Entrada/Atendimento/Follow-up/Fechamento, `CrmWorkspace.tsx:98`).

---

## 11. Rota interna isolada tipo `/crm/nova-era` — como fazer

### 11.1 Como o roteamento funciona hoje
- **Não há roteamento por query string nem por página para os módulos.** A aba ativa é **estado React**
  (`activeModule` em `ProductCatalog.tsx:116`), trocada por `setActiveModule` via menu. Recarregar a página sempre
  volta para `"Início"` (`useState<ModuleName>("Início")`).
- **App Router pages existentes** (todas fora do fluxo de módulos): `app/page.tsx` (=`/`), `app/original/page.tsx`
  (`/original`, host do ERP legado), `app/cadastro/page.tsx`, `app/definir-senha/page.tsx`,
  `app/agenda/[token]/page.tsx` (agenda pública), `app/ficha/[token]/page.tsx` (ficha pública). Ou seja, o App
  Router é usado só para páginas públicas/isoladas, não para o ERP interno.

### 11.2 Opções para o Nova Era
- **Opção estado (recomendada, consistente com o app):** novo `ModuleName "CRM Nova Era"` + branch no switch
  (§2.5-A). Fica dentro do shell, herda login/sessão/menu. Zero rota nova.
- **Opção página App Router isolada `app/crm/nova-era/page.tsx`:** cria uma URL real `/crm/nova-era`, 100% separada
  do shell. Prós: isolamento total, deep-link. Contras: você reconstrói autenticação/`accessToken`/sidebar (ou
  monta um shell próprio). Viável porque o padrão de auth já existe (`getBrowserSupabaseClient()` +
  `supabase.auth.getSession()`, como em `ProductCatalog.tsx:203-226`). Bom se o cliente quiser um ambiente
  realmente à parte.
- **Opção híbrida:** um branch no switch que renderiza um `CrmNovaEraWorkspace` que internamente tem suas próprias
  sub-abas — dá a sensação de "app dentro do app" sem criar rota.

---

## 12. O que PODE ser reutilizado vs. o que deve ficar 100% isolado

### Pode reutilizar com segurança (baixo acoplamento)
- Auth/sessão: `app/lib/supabase/browser.ts` (`getBrowserSupabaseClient`), padrão `accessToken` + `authedFetch`
  (copiar o helper de `CrmWorkspace.tsx:14`).
- Shell/menu: `AppShell.tsx` (só adicionar item), `module-map.ts`.
- UI base: `app/components/MoneyInput.tsx` (`MoneyInput`/`PercentInput`), classes globais do `globals.css`
  (com prefixo próprio para novas classes), tipos `ChatData`/`QuickAction`, e os modais exportados do LiveChat
  (`MessageMedia`, `QuickActionModal`, `ProductSendModal`, `ScheduleModal`).
- Permissões: `permissions.ts` / `authz.ts` (chaves `crm/leads/pipeline`).
- Lib de regras: `esteira.ts` (se o Nova Era também gerar vendas) — é puro e sem estado.
- APIs de leitura (`GET /api/crm`, `/api/live-chat`, `/api/crm/sales`) — pode LER para popular o Nova Era sem criar
  backend novo (a tarefa pede para não CHAMAR de escrita; leitura conceitualmente reaproveitável).

### Deve ficar 100% isolado (não copiar/alterar)
- **`CrmWorkspace.tsx` inteiro** — não editar; criar `CrmNovaEraWorkspace` novo. O arquivo é monolítico (2145
  linhas) e frágil.
- **Lógica de urgência fixa 24/48/72** (`AttentionCenter.corPorMinutos`, `CrmWorkspace.alertColorByDays`) e as
  listas hardcoded de nomes de etapa (`STAGE_TERMINAL`/`STAGE_AVANCADA`) — reescrever com prazos configuráveis.
- **Classes CSS do CRM atual** (`crm-v2`, `crm-kanban-v2`, `crm-stage-body`…) — se for customizar o visual, usar
  namespace `nova-crm-*` para não herdar/estourar estilos do CRM vigente (CSS é global).
- Estado/props do `ProductCatalog` ligados ao CRM atual (`focusedDealId`, `crmInitialView`, etc.,
  `ProductCatalog.tsx:117-120`) — o Nova Era deve ter os seus.

---

## 13. Itens marcados "não confirmado"
- `CrmWorkspace_1.tsx`, `LiveChatWorkspace_1.tsx`, `LiveChatWorkspace_2.tsx` parecem backups não importados
  (o import ativo aponta para as versões sem sufixo); **não confirmado** se algum é referenciado dinamicamente.
- Linha exata da `function LeadDrawer` no `CrmWorkspace.tsx` **não confirmada** (o componente é montado em 476;
  a definição fica mais abaixo no mesmo arquivo).
- Tailwind 4 está no projeto, mas o uso real de utilitários Tailwind vs. classes globais **não foi exaustivamente
  confirmado** — a evidência aponta para CSS global dominante (`globals.css`, 5662 linhas).
- Semântica exata da view `vw_sla_leads` e das RPCs (`mover_negocio`, `registrar_momento_lead`, etc.) não foi lida
  (são objetos do banco, fora do repo).
