# Checkpoint — ERP ApeCerto

## Objetivo e aceite

Reestruturar, publicar e validar o ERP por fatias verificáveis. Até 2026-09-20
18:00 America/Sao_Paulo: fechar baseline canônico, inventário/matriz, backlog e
publicar as jornadas aprovadas, com validação desktop e PWA/aplicativo. Não
declarar o ERP inteiro pronto sem evidência.

## Base

- worktree: `/private/tmp/apecerto-erp-crm-visual`
- remoto: `https://github.com/apecertooficial-arch/-erp-apecerto.git`
- branch: `codex/erp-crm-visual-concept`
- base: `e478030e4eaf33d17562ceb5ac2b3bef34fd677a`
- ambiente: branch isolada enviada ao repositório oficial; usuário autorizou
  publicação de código validado. Merge e deploy ainda não foram executados e
  dependem dos gates do payload, CI e confirmação do SHA implantado
- HEAD funcional validado antes deste checkpoint: `80cf8780`

## Concluído

- Gate 0 confirmou `origin/main` = build publicado = base da worktree em
  `e478030e...`; inventário inicial registrado em
  `docs/erp-reestruturacao/INVENTARIO_TECNICO_BASELINE.md`;
- matriz integral inicial criada em
  `docs/erp-reestruturacao/MATRIZ_INTEGRAL.md`;
- metadados remotos confirmaram projeto saudável, dispatcher em modo worker com
  heartbeat recente e atraso 0, Sara `f2_*` ligada e runner `ncrm_*` aposentado
  desligado; havia 53 Edge Functions remotas contra 26 fontes locais no
  baseline; após reconstrução segura, há 30 slugs locais cobertos;
- trace canônico criado em
  `docs/erp-reestruturacao/TRACE_LEAD_SARA_PROXIMA_ACAO.md`;
- primeiro conflito concreto reproduzido: `/api/funil2` usava status `ncrm_*`
  aposentado para descrever a Sara canônica. A rota, o tipo e a tela foram
  corrigidos localmente para usar apenas `f2_sara_config` e não prometer saúde
  de runtime sem evidência;
- métricas agregadas provaram p50 6,5 s e p95 10,3 s para mensagem → análise
  recente, mas 338/671 cards têm próxima ação vencida;
- P0 operacional novo: a primeira leitura encontrou 690 alertas da Sara
  abertos para só 132 cards; minutos depois já eram 694 (347 para gestão e 347
  para corretores). Há 154 grupos duplicados, um card/público chegou a 35 e 16
  alertas pertencem a cards descartados. A chave produtiva usa `execution_id`,
  portanto o estoque continua crescendo. A correção real precisa ocorrer no
  contrato do banco, não apenas ocultar linhas no frontend;
- contrato SQL aditivo e não destrutivo preparado em
  `docs/erp-reestruturacao/P0_ALERTAS_SARA_DEDUPE_DRAFT.sql`, com rastreio em
  `P0_ALERTAS_SARA_RASTREIO.md`: vínculo direto ao card, índice único por
  card/público, consolidação preservando histórico, resolução por evidência,
  descarte, confirmação ou troca de dono e contadores calculados antes do
  `LIMIT 100`. O draft não é migration e não foi aplicado;
- regressão de autoridade encontrada no construtor: a migration publica a
  automação sistêmica `sara-ciclo-event-trigger`, mas um revert anterior removeu
  esse gatilho do catálogo e da allowlist do editor sem remover o teste. O
  contrato visual foi restaurado localmente com a menor mudança possível;
- execução contínua criada como objetivo ativo da tarefa; o heartbeat de duas
  horas foi pausado para evitar espera artificial, duplicidade e gasto inútil;
- requisitos da conversa matinal consolidados em
  `docs/erp-reestruturacao/REQUISITOS_CANONICOS_OPERACAO.md`;
- divergência visual reproduzida: a tela desktop carregava
  `public/funil-web-sexta.css`, enquanto oito testes e o harness liam
  `app/styles/funil.css`; os arquivos estavam diferentes e parte das correções
  testadas não chegava ao navegador. O artefato público foi sincronizado com a
  fonte, fontes abaixo de 11 px no seletor de horário foram corrigidas e o
  teste de separação desktop/aplicativo deixou de depender de hash obsoleto;
- o CRM desktop passa a abrir por padrão em `Meu Dia`, usando a fila e os dados
  reais já existentes; o Kanban continua acessível em `Negócios`. O teste foi
  escrito antes da mudança e falhou no estado anterior;
- Gate 0 inicial: `/api/build` de produção respondeu
  `e478030e4eaf33d17562ceb5ac2b3bef34fd677a`, exatamente o commit-base da
  worktree visual; a cópia principal local está em outra branch/commit
  (`codex/erp-reestrutura-baseline-20260908`, `b8a9f82a...`) e não foi alterada;
- projetos históricos/plausíveis localizados: CRM, Financeiro, Produtos,
  Visitas/Agenda, Studio, Automações, Site, Tracking e cópias internas; ainda
  precisam ter remoto/branch/finalidade comparados antes de absorver código;
- configuração local e documentação apontam o Supabase operacional
  `diaegvfveqezispcthwk`; reconciliação remota permanece somente leitura;
- direção visual aprovada inicialmente pelo usuário;
- Central de foco V4 e Kanban V5 construídos no harness local;
- 12 testes do harness passaram;
- lint dos componentes alterados passou;
- navegador 1600 × 1000: 5 KPIs, 5 etapas, 13 cards, seleção funcional,
  sem overflow horizontal, warnings ou errors;
- plano vivo: `docs/erp-reestruturacao/PLANO_ACAO_EXECUCAO_ATE_2026-09-20.md`.

## Em andamento

- conceitos visuais ainda estão isolados do CRM canônico;
- Gate 0 confirmou a paridade commit publicado × worktree, mas encontrou deriva
  banco/Edge: 53 funções remotas e migrations aplicadas até 2026-09-18;
- inventário e matriz foram iniciados; ainda precisam de reconciliação remota,
  leitura/escrita por rota e evidência comportamental.
- a execução é contínua; a automação antiga de duas horas permanece pausada e
  não governa nem limita o trabalho;
- a branch contém quatorze commits à frente de `origin/main` e rastreia
  `origin/codex/erp-crm-visual-concept`; merge e deploy continuam pendentes do
  gate do payload, CI e validação do SHA, não de uma janela de duas horas.

## Arquivos alterados/relevantes

- `tests/crm-visual-harness/main.tsx`
- `tests/crm-visual-harness.test.mjs`
- `tests/crm-visual-harness/CrmReimaginedConcept.tsx`
- `tests/crm-visual-harness/reimagined-concept.css`
- `tests/crm-visual-harness/CrmKanbanReimagined.tsx`
- `tests/crm-visual-harness/kanban-reimagined.css`
- conceitos anteriores no mesmo diretório permanecem preservados.

## Evidências

- `crm-reimaginado-v4.jpg`
- `crm-kanban-reimaginado-v5.jpg`
- localizadas fora do repositório em `.codex/visualizations/.../erp-concepts/`.

## Checks

- `node --test tests/crm-visual-harness.test.mjs`: 12/12 passaram;
- ESLint dos componentes do harness: passou;
- `git diff --check`: passou;
- navegador real: seleção Ana → Gabriel atualizou próxima ação; console limpo.
- `node --test tests/funil-2-sara-worker.test.mjs tests/crm-visual-harness.test.mjs`:
  21/21 passaram após demonstrar a falha antes da correção;
- suíte CRM/Funil selecionada: 104/104 passou, incluindo igualdade entre CSS
  fonte e CSS servido, default em `Meu Dia` e contratos Sara; ESLint passou;
- gate amplo do repositório: build completo passou, suíte frontend 426/426
  passou, testes de Produtos terminaram sem falha (34 aprovados e 4 contratos
  marcados explicitamente como pendentes) e typecheck passou após normalizar o
  tipo do logo nos dois conceitos isolados; lint sem erros, com 10 avisos já
  existentes sobre imagens/artefato público;
- navegador local sanitizado: desktop 1600 × 1000 abriu em `Meu Dia`, 50 linhas
  carregadas, sem overflow ou erro/aviso; aplicativo 390 × 844 permaneceu na
  carteira móvel, sem overflow horizontal e sem erro/aviso;
- gate frontend ampliado após restaurar o contrato do gatilho: 446/446 passou;
- testes direcionados de Sara, push e deduplicação: 33/33 passaram;
- build completo após a correção do construtor: passou;
- P0 da Agenda reproduzido: uma falha da RPC de resultados era convertida em
  lista vazia. API, web e aplicativo agora falham de forma explícita, mantêm a
  agenda utilizável e oferecem nova tentativa; trace em
  `docs/erp-reestruturacao/TRACE_VISITA_FEEDBACK_COBRANCA.md`;
- metadados agregados provaram 53 pendências de agosto ocultas pela consulta
  mensal, contra 8 de setembro. A API local agora usa a janela máxima segura de
  365 dias da RPC e cobre todo o histórico real atual sem depender do mês
  exibido;
- a gestão conseguia abrir o formulário e registrar resultado no lugar do
  corretor. Web e aplicativo agora deixam a gestão somente acompanhar, agrupam
  por responsável e mostram idade; somente pendência própria oferece
  `Responder`;
- as duas APIs de gravação agora confirmam no servidor que o usuário é o
  corretor dono do card; gestor, usuário sem carteira e corretor diferente
  falham fechados. A RPC remota ainda reutiliza `f2_pode_operar_lead` e permite
  admin direto, então a invariável no banco permanece um gate de migration;
- o catálogo remoto mostrou notificações de visita próxima, mas nenhuma
  cobrança pós-visita persistente ligada à visita/card; escalonamento ainda não
  deve ser anunciado como funcional;
- após a barreira nas APIs: 63/63 testes direcionados, 437/437 no gate
  frontend, ESLint e build completo passaram;
- metadados remotos revalidados: a RPC produtiva ainda usa
  `f2_pode_operar_lead`, não usa `current_broker_id`, `ncrm_notificacao` não tem
  `visita_id`, não há cobrança pós-visita aberta e nenhum cron ativo sincroniza
  feedback. Nenhuma linha com PII foi consultada;
- draft aditivo `P0_VISITA_OWNER_COBRANCA_DRAFT.sql` preparado fora de
  migrations: owner-only no banco, FK direta, dedupe visita+público, cron
  in-app, resolução automática e efeitos externos desligados; 6/6 testes do
  draft, 23/23 combinados e 450/450 no gate frontend oficial passaram. Ainda
  não executado em Postgres;
- reconciliação das Edge Functions provou 53 funções remotas contra 26 fontes
  locais no baseline. Depois das reconstruções, há 30 slugs locais cobertos e
  23 somente remotos. Quatro eram dependências diretas do ERP:
  `dapi-qr`, `admin-usuarios`, `cadastro-publico` e `definir-senha`;
- `dapi-qr` foi reconstruída localmente sem copiar o segredo incorporado à
  versão remota: JWT, autorização da instância por `wa_v7_painel`, CORS
  restrito, erros sanitizados e segredo apenas no ambiente. Seis testes
  direcionados e o gate frontend 456/456 passaram; `deno` não está instalado,
  então check/lint Deno e deploy continuam pendentes;
- os outros três slugs diretamente consumidos pelo ERP também foram
  reconstruídos: `admin-usuarios`, `cadastro-publico` e `definir-senha`.
  Convites agora nascem no servidor, persistem somente SHA-256, são reservados
  antes do efeito privilegiado e mantêm compatibilidade temporária com links
  legados. O token é removido da URL e erros internos não chegam ao navegador;
- o navegador real encontrou uma hidratação divergente em `/definir-senha`;
  ela foi corrigida e revalidada, junto de `/cadastro`, em desktop e 390 × 844,
  sem erro de console ou overflow. Nenhuma conta/senha real foi criada;
- fatia de usuários: 12/12 testes direcionados, gate frontend 468/468, build,
  transpile sintático e ESLint sem erro. `deno` continua indisponível. O draft
  `P0_CONVITES_USUARIOS_DRAFT.sql` não foi aplicado;
- as fontes críticas já presentes localmente foram comparadas com seus pacotes
  implantados: `dapi-webhook` é idêntica; `dapi-enviar` só muda o caminho do
  helper no bundle; Sara v32 e `ncrm-web-push` v14 tinham deriva funcional e
  agora correspondem exatamente ao remoto no commit `2ae7e80e`;
- a Sara reconciliada preserva temperatura/evidência, normaliza prazo, respeita
  orçamento e evita reanálise sem nova resposta. O push reconciliado usa Vault,
  kill-switch no banco e RPCs públicas de claim/lease restritas ao service role;
- gate da reconciliação: falha demonstrada antes da correção, 96/96 direcionados,
  469/469 no gate frontend, build completo, ESLint e transpile sintático. Não
  houve deploy nem alteração remota;
- após as correções da Agenda: 44/44 testes direcionados, 436/436 no gate
  frontend oficial ampliado, ESLint e build Vinext completo passaram;
- navegador sanitizado validou desktop 1600 × 1000 e móvel 375 × 844 sem
  overflow, agrupamento/idade, separação gestão × corretor, formulário do
  corretor e o estado de erro com calendário preservado;
- a execução indiscriminada de todos os arquivos `tests/*.test.mjs` também
  encontrou falhas preexistentes fora do gate oficial (incluindo fonte Studio
  ausente e expectativas antigas de Automações/CSS). Elas não foram ocultadas
  nem tratadas como regressão desta fatia;
- tentativa de validação visual local da tela `/automacoes`: a rota compilou e
  respondeu 200, mas a árvore não possui a configuração pública local do
  Supabase e o shell encerrou com erro explícito. Nenhum segredo foi criado ou
  copiado; validação autenticada permanece pendente de ambiente adequado;
- ESLint de rota, modelo, workspace e fixture alterados: passou;
- metadados remotos: dispatcher `worker`, heartbeat 4 s, lag 0, nenhuma fila vencida/falha.
- as 23 funções somente remotas foram classificadas: dez tombstones 410, uma
  unificada, seis do produto Site e seis integrações/legados a decidir. Quatro
  fontes do Site são idênticas ao remoto; `site-track` remoto está dois campos
  à frente e `site-lead` não está versionada no repositório do Site;
- `meta-audience-sync` está implantada e ativa, mas as RPCs `prepare`, `claim` e
  `finish` que ela chama não existem no banco. O fluxo foi classificado como
  quebrado, sem tentativa de reativação;
- histórico remoto de migrations recontado por nome: 953 registros/952 nomes;
  608 registros pós-baseline, 607 nomes, somente 266 cobertos localmente e 341
  sem arquivo. Há 27 arquivos locais sem registro remoto, quatro timestamps
  locais duplicados, um nome local duplicado e um nome remoto duplicado. `db
  push` está bloqueado; nenhum SQL foi aplicado;
- metadados agregados: `site_leads` 18 linhas e recibos de financiamento 3, com
  última atividade em 2026-09-08; cache D-API antigo, tabelas Instagram e
  movimentações DataCrazy estão vazios. Isso orienta prioridade, mas não prova
  ausência de chamadores externos.

## Riscos e limites

- árvore contém mudanças locais do trabalho visual; preservar integralmente;
- nenhuma integração à tela canônica foi feita;
- o helper Git configurado aponta para um `gh` removido. Após varredura do
  payload não encontrar candidatos a segredo, a credencial já guardada no
  Keychain foi usada sem expor token e a branch foi enviada com sucesso;
- migrations reais continuam exigindo confirmação específica; preparar plano
  aditivo, reversível e com rollback quando forem necessárias;
- a fila de cobrança local cobre todo o histórico atual, mas ainda herda da RPC
  um teto de 366 dias. O contrato definitivo precisa remover a expiração com
  paginação e migration aditiva testada isoladamente;
- não há promessa honesta de ERP integralmente vendável até domingo.

## Próximo passo exato

Classificar os 27 arquivos locais sem registro remoto e preparar o desenho do
ambiente isolado que possa provar a reconstrução das 341 migrations ausentes,
sem aplicar SQL em produção. Em seguida, continuar no P0 de alertas/cobrança.
Branch já enviada; abrir/validar a mudança, merge/deploy de código e migration
permanecem etapas distintas e verificáveis. Nunca agrupar `db push` ao deploy
de aplicação.
