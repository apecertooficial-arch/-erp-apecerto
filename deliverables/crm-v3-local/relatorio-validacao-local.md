# CRM V3 — auditoria final, correções e validação local

Data: 27/08/2026  
Ambiente: local, sem credenciais e sem integração externa  
Rota de validação: `http://localhost:3001/crm-v3`  
Resultado: **aprovado no escopo local; nenhum finding aberto desta auditoria**

## Base confirmada

- Repositório: `https://github.com/apecertooficial-arch/-erp-apecerto.git`
- Cópia canônica: `publish-crm-ficha`
- Branch local: `codex/crm-v3-paralelo-local-20260827`
- Commit base e `origin/main`: `764283c658dad852734d50790dc5f86d054cc470`
- Ambiente classificado como local. Não houve deploy, push, merge ou uso de staging/produção.
- O `origin/main` foi atualizado e permaneceu no mesmo commit antes da comparação final.

## Findings encontrados e corrigidos

| Finding | Risco | Correção | Prova |
|---|---|---|---|
| O reconhecimento do CRM V3 aceitava também `/crm-v3/...` | sessão sanitizada e remoção do shell em caminho mais amplo que o autorizado | correspondência exata `pathname === "/crm-v3"` em runtime, shell e catálogo de rotas | teste específico e `/crm-v3/extra` sem runtime V3 |
| A sessão sanitizada era materializada pelo componente global antes de ser necessária | aumentar a superfície de um bypass estritamente local | sessão movida para `CrmV3LocalRuntime`, montado somente depois do guard exato de desenvolvimento e rota | leitura do runtime + teste de origem |
| O simulador de perfil/estado poderia aparecer em preview com a flag ligada | Corretor poderia simular Gestor/Admin fora do laboratório local | `ValidationBar` agora só existe quando `NODE_ENV === "development"`; preview isolado não expõe simulador | teste específico e build |
| Mutação assíncrona podia usar fotografia antiga ou concluir depois de troca de contexto | contagens, seleção ou histórico inconsistentes; dupla ação | `stateRef`, trava de mutação, contexto invalidável e descarte de resultado obsoleto | teste específico + passagem no navegador |
| `Desfazer` guardava apenas os dados principais | restauração parcial de filtros, seleção e navegação | snapshot integral de estado, perfil, área, pipeline, segmento, busca, seleção e etapa móvel; limpeza ao trocar de contexto | testes de movimento, perfil, navegação e feedback |
| Listeners de teclado de drawer/dialog dependiam de callback instável | churn de listener e possível foco inconsistente | referência estável de fechamento e cleanup explícito | lint + teclado real |
| Temporizador curto do gesto de arrastar não tinha cancelamento no unmount | callback tardio de um cartão removido | timer rastreado e `clearTimeout` no cleanup e no clique consumido | teste específico + lint |
| Flag de montagem não era rearmada no setup do efeito | risco em ciclo de efeito estrito do React | `mounted.current = true` no setup e `false` no cleanup | revisão de código + testes |
| Contatos das fixtures eram plausíveis | risco desnecessário de confusão com dado pessoal | telefones `90000-xxxx` e domínio reservado `fixture.invalid` | busca sanitizada e teste específico |

## Isolamento da autenticação e da flag

- A sessão sanitizada existe somente quando as duas condições são verdadeiras: `NODE_ENV === "development"` e pathname exato `/crm-v3`.
- Query string, cookie, `localStorage`, `sessionStorage`, header ou pathname descendente não ativam a sessão.
- `CRM_V3_LOCAL_VALIDATION` é lida apenas no componente servidor da página e apenas controla se uma preview isolada pode renderizar a rota; ela não cria sessão sanitizada nem aparece no código cliente.
- Em preview com flag explícita, a rota usa a sessão autenticada real e o guard `GuardaModulo modulo="CRM"`; o simulador local não é mostrado.
- Em desenvolvimento, a sessão local possui dados reservados e não contém credencial válida.
- Nenhum arquivo cliente do V3 ou do runtime contém `fetch`, Supabase, RPC, token, header de autorização, cookie, storage, WebSocket, beacon ou endpoint externo.
- Todas as mutações passam por `runLocalValidationMutation`, que opera somente sobre fixtures na memória e declara integrações externas bloqueadas.

## Não regressão do ERP existente

- `/crm` continua importando e renderizando o Funil 2.0 atual (`Funil2Workspace`/`Funil2Mobile`).
- O diff contra `origin/main` é vazio para:
  - `app/(erp)/crm/page.tsx`;
  - `app/features/funil-2/`;
  - `app/api/funil2/`;
  - `app/styles/funil-2.css`;
  - `docs/funil-2/`;
  - `supabase/`.
- A remoção visual do shell global usa igualdade exata e ocorre somente em `/crm-v3`.
- Navegação para `/crm`, `/inicio` e `/produtos` não reteve conteúdo, sessão ou shell do V3. O ambiente local sem configuração pública do Supabase voltou imediatamente ao bootstrap autenticado normal dessas rotas, comprovando que a sessão sanitizada não vazou.
- Novo retorno para `/crm-v3` mostrou exatamente um shell V3 e nenhum shell global duplicado.
- A folha `funil-2-v3.css` está integralmente escopada sob `.crm-v3`; não há seletor global de elemento, `html`, `body` ou `:root`.
- A mudança de `package.json` apenas inclui `tests/crm-v3.test.mjs` no comando `test:frontend`; nenhum comando existente foi removido ou redefinido.

## Produção local simulada com flag desligada

O build final foi iniciado em localhost com `CRM_V3_LOCAL_VALIDATION` removida do ambiente, sem credenciais reais:

| Rota | Resultado |
|---|---|
| `/crm-v3` | `404 Not Found`; corpo simples `Not Found`, sem conteúdo V3 ou sessão local |
| `/crm` | `200` |
| `/inicio` | `200` |
| `/produtos` | `200` |

O build manteve `/crm-v3`, `/crm`, `/inicio`, `/produtos` e as demais rotas no manifesto. A indisponibilidade do V3 com flag desligada acontece pelo guard do servidor, não pela remoção de rotas existentes.

## Segurança de rede e dados

- Busca final no diff: nenhuma chave, token, senha, domínio de e-mail real ou chave privada.
- Fixtures usam `@fixture.invalid` e telefones deliberadamente não plausíveis.
- Sessão limpa no navegador, seguida de abertura da ficha e clique em `Confirmar ação`, manteve a próxima ação e exibiu `Aguardando confirmação do D-API`.
- Console após o fluxo: zero erro e zero aviso da aplicação.
- Trace do servidor durante a passagem limpa: somente `GET /crm-v3` e `GET /api/build`, ambos locais e `200`.
- Não houve `POST`, `PATCH`, `PUT`, `DELETE`, beacon, WebSocket, D-API, WhatsApp, Supabase, RPC ou chamada externa.
- O conector do navegador desta execução não exporta HAR; a prova de rede combina o trace completo do servidor local, ausência de chamadas no código do V3 e console limpo.

## Perfis, estado e navegação

- Corretor: própria carteira, sem Gestão e com acesso negado às áreas gerenciais.
- Gestor: equipe, Painel gerencial e Configurações; sem Matriz exclusiva de Admin.
- Admin: visão completa e Matriz de validação.
- Cada perfil foi validado novamente depois de recarregar a página. O reload retornou ao perfil real sanitizado de Corretor; perfil simulado não persistiu.
- Seleção em massa foi limpa ao navegar.
- Troca de área, perfil, cenário, pipeline ou segmento invalida mutação pendente e limpa `Desfazer`, impedindo restauração cruzada.
- Filtros, contagens, histórico, atividades e visitas são derivados do estado atual já escopado ao perfil.

## Acessibilidade, responsividade e fluxos críticos

- Ficha: foco inicial no fechamento, focus trap por `Tab`/`Shift+Tab`, setas nas sete abas, `Esc` e retorno ao cartão de origem.
- `Desfazer`: 12 segundos ativos; pausa por hover e foco; restauração integral.
- Movimento por menu, arrasto e massa chama o mesmo motor `moveDeals`.
- Ganhar, perder, restaurar, atividade completa, visita, feedback e bloqueio D-API foram executados no navegador com estado local.
- 1440 × 900 e 1280 × 800: documento sem vazamento horizontal; Kanban com rolagem interna intencional.
- 390 × 843: documento sem vazamento horizontal; navegação inferior e chips funcionais; controles operacionais com alvo mínimo de 44 px.
- Offline móvel: banner `Sem conexão — exibindo dados em cache`, conteúdo em cache visível e mutações indisponíveis.

## Matriz função → CRM V3 → evidência

| Função/contrato | CRM V3 local | Teste/evidência |
|---|---|---|
| Meu Dia | fila de atividades e feedback | navegador + cinco estados de sistema |
| Funil/pipeline | seletor, segmentos e Kanban | 1440/1280/390 + teste de motor |
| Movimento menu/arrasto/massa | um único `moveDeals` | navegador e teste automatizado |
| Contagens e valores | derivados do estado escopado | movimento, ganho/perda e reload de perfil |
| Atividade obrigatória | bloqueio antes de Visita | teste e navegador |
| Ganhar/perder/restaurar | última posição válida | teste e navegador |
| Desfazer | snapshot integral por 12 s ativos | temporização, pausa e restauração real |
| Lead e negócio | fluxos distintos | teste e navegador |
| Ficha única | drawer com sete áreas | mouse e teclado |
| Atividades | criar, editar, concluir, excluir | ciclo completo e Desfazer |
| Visitas/feedback | objetos vinculados, fila derivada | ciclo completo e reversão exata |
| D-API | clique não conclui | aviso de confirmação ausente e estado intacto |
| Perfis | Corretor/Gestor/Admin | reload entre perfis e acesso negado/permitido |
| Offline | cache e mutações bloqueadas | mobile real |

## Gates finais

| Gate | Resultado final |
|---|---|
| `tests/crm-v3.test.mjs` | 16/16 passaram |
| `test:frontend` completo | 307/307 passaram |
| Lint dos arquivos alterados | passou, sem aviso |
| Build completo | passou |
| `git diff --check` | passou |
| Revisão de sigilos e rede | passou |
| Navegador real | fluxos críticos, perfis, teclado, 1440/1280/390, console e trace aprovados |

### Limitações preexistentes separadas

- `tsc --noEmit` falha exclusivamente em `app/features/products/ProductDetail.tsx`, por nulabilidade já existente. O diff desse arquivo contra `origin/main` é vazio e nenhum erro aponta para CRM V3, runtime, shell ou testes.
- `tests/crm-organizacao.test.mjs` já dependia de uma migration ausente na base. Ela não foi criada nem executada, conforme o limite expresso desta fase.
- Sem credenciais públicas de Supabase no ambiente local, as rotas autenticadas existentes mostram o erro de configuração esperado em vez do shell completo. Isso não foi contornado; o teste de produção local, o manifesto do build, o diff e os testes automatizados comprovam sua preservação.

## Capturas finais

- [Desktop 1440 × 900](./crm-v3-1440.png)
- [Desktop 1280 × 800](./crm-v3-1280.png)
- [Mobile 390 × 843 — normal](./crm-v3-mobile-390-normal.png)
- [Mobile 390 × 843 — sem conexão](./crm-v3-mobile-390-offline.png)

Os tamanhos acima são viewports CSS. As imagens têm densidade física maior devido ao fator de escala do navegador.

## Lista final do diff

Criados:

- `app/(erp)/crm-v3/page.tsx`
- `app/features/funil-2-v3/CrmV3Dialog.tsx`
- `app/features/funil-2-v3/CrmV3Icon.tsx`
- `app/features/funil-2-v3/CrmV3LeadDrawer.tsx`
- `app/features/funil-2-v3/CrmV3Route.tsx`
- `app/features/funil-2-v3/CrmV3Workspace.tsx`
- `app/features/funil-2-v3/engine.ts`
- `app/features/funil-2-v3/fixtures.ts`
- `app/features/funil-2-v3/types.ts`
- `app/features/funil-2-v3/useCrmV3Undo.ts`
- `app/features/funil-2-v3/validationAdapter.ts`
- `app/features/system/ErpRuntime.tsx`
- `app/styles/funil-2-v3.css`
- `tests/crm-v3.test.mjs`
- `deliverables/crm-v3-local/` (relatório e quatro capturas)

Alterados:

- `app/(erp)/layout.tsx`
- `app/features/system/ErpShell.tsx`
- `app/features/system/erp-routes.ts`
- `app/layout.tsx`
- `package.json`

## Confirmação de limites

- Nenhum deploy, push, merge ou publicação.
- Nenhuma migration, schema, RLS, RPC, permissão, banco ou credencial alterados.
- Nenhum dado real lido ou modificado.
- Nenhum WhatsApp, D-API ou efeito externo disparado.
- `/crm` e o Funil 2.0 permanecem intactos.
- A substituição de `/crm` não foi realizada.
