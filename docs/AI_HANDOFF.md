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
- ambiente: branch isolada enviada ao repositório oficial até `f900d7f8`;
  usuário autorizou publicação de código validado. Os commits locais mais
  recentes ainda não foram enviados por falha do helper Git; merge e deploy
  não foram executados
- HEAD local funcional validado: `714dbfd5`
- HEAD remoto da branch: `f900d7f8`

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
- revalidação às 17:40 encontrou 744 alertas abertos para 135 cards, 168 grupos
  duplicados, máximo de 36 por card/público e os mesmos 16 alertas de cards
  descartados. O crescimento 690 → 694 → 744 comprova produção contínua do
  ruído;
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
- o remoto contém os commits até `f900d7f8`; `deeaeaf8` e `b275e0de` estão
  confirmados localmente e aguardam somente o reparo mínimo da autenticação de
  escrita. Merge e deploy continuam pendentes do gate do payload, CI e
  validação do SHA, não de uma janela de duas horas.

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
- os 27 arquivos locais sem registro pelo mesmo nome foram classificados em
  `MIGRACOES_LOCAIS_SEM_REGISTRO.md`: a maioria é alias, consolidação ou efeito
  já presente; o baseline é para instalação limpa; roleta igualitária e regras
  de valor/m² não estão presentes, e o pacote de alertas está somente parcial.
  Nenhum dos 27 deve ser reaplicado automaticamente;
- advisors oficiais: 47 funções `SECURITY DEFINER` estão executáveis por
  `anon`, 276 por `authenticated`, há 1 search_path mutável, 2 extensões em
  `public` e proteção de senha vazada desabilitada. O P0 anônimo foi catalogado
  em `SEGURANCA_SUPABASE_BASELINE.md`; draft explícito separa 42 operações
  autenticadas, 2 service-only e 3 exceções públicas legadas. Estas exceções
  usam token em texto sem expiração/rate limit comprovados e permanecem P0. O
  contrato está fora de `supabase/migrations`; 9/9 testes direcionados e o gate
  frontend anterior 474/474 passaram, sem aplicar SQL;
- as três exceções públicas foram decompostas: o contrato atual guarda tokens
  em texto, não expira, devolve PII da ficha e permite sobrescrita. A Fase A V2
  está em `P0_PUBLIC_LINKS_HARDENING_DRAFT.sql`: hash, validade, revogação,
  ficha de uso único, auditoria sanitizada, minimização da agenda e rate limit
  persistente; código usa service role apenas no servidor e o canário continua
  desligado. 27/27 direcionados, gate frontend 498/498, typecheck e build
  passaram; lint sem erros. Nenhum SQL foi aplicado;
- o `SaraWidget` deixou de carregar URL/JWT público hardcoded e passou a usar o
  cliente Supabase canônico; a varredura atual não encontra JWT embutido em
  `app/`;
- a única função do advisor `function_search_path_mutable`,
  `public.hoje_operacao()`, é invoker e não lê tabelas. O draft local fixa
  somente `search_path=pg_catalog`, com assert e rollback; 2/2 testes passaram;
- `list_branches` confirmou que não existe branch Supabase isolada: há apenas
  `main`, com estado de migrations `MIGRATIONS_FAILED`. Nenhum ensaio SQL deve
  usar essa branch;
- auditoria semântica inicial das 276 RPCs autenticadas: 148 aparentam escrita,
  81 não possuem marcador de identidade e 32 combinam escrita sem marcador.
  Dez mutações críticas permitem agir em objeto alheio ou devem ser
  service-only; `AUTHENTICATED_SECURITY_DEFINER_AUDIT.md` registra funções,
  chamadores e ordem de correção. A presença de `auth.uid()` sozinha foi
  comprovada insuficiente em `transferir_negocio`;
- o Chat ao Vivo era um chamador real de `transferir_negocio`. A rota local
  agora valida negócio/destino e separa reassociação da gestão de oferta com
  aceite do corretor. `P0_CRM_OWNERSHIP_GUARDS_DRAFT.sql` protege sete RPCs
  humanas e torna `redistribuir_lead` service-only; 7/7 contratos e build
  passaram, mas o SQL segue não aplicado até haver Postgres isolado;
- call graph + Edge/cron reconciliados para Sara/Funil: `funil_mover`,
  `funil_aplicar_sara`, `funil_cascata_tick` e `ia_salvar_avaliacao` podem ser
  service-only sem cortar chamador humano legítimo conhecido. Draft grant-only
  criado, 4/4 contratos; `ncrm_sara_classificar` preservada por usar identidade
  dedicada `app_role=sara`;
- a revisão do draft de alertas impediu uma regressão: ele chamava o gerador
  legado `ncrm_private.notificacoes_sincronizar()` e excluiria gerente/diretor
  pelo uso de `can_manage_all()`. O contrato agora preserva o no-op F2 e usa o
  grupo canônico `gestao`; teste específico cobre os dois invariantes;
- o único erro de lint foi removido da tela de definição de senha sem mudar o
  contrato do token; a inicialização assíncrona evita atualização síncrona de
  estado dentro do efeito;
- metadados agregados: `site_leads` 18 linhas e recibos de financiamento 3, com
  última atividade em 2026-09-08; cache D-API antigo, tabelas Instagram e
  movimentações DataCrazy estão vazios. Isso orienta prioridade, mas não prova
  ausência de chamadores externos.
- P0 novo reproduzido: `f2_confirmar_acao` marcava a Sara como reavaliada sem
  enfileirar nem executar a análise. A correção local separa confirmação D-API
  de ação manual, exige ownership, cria `lead.action_confirmed` auditável e só
  atualiza a leitura quando a automação 49 realmente processar o evento;
- a UI compartilhada desktop/celular exige confirmação explícita nas ações
  manuais e mostra `Confirmação automática` nas ações que dependem do D-API. O
  navegador sanitizado bloqueou o PATCH com 405 e provou ausência de efeito
  externo; rede registrada: dois GETs locais e um PATCH local bloqueado;
- `P0_F2_CONFIRMAR_ACAO_DRAFT.sql` foi preparado fora de migrations e não foi
  aplicado. Ele precisa ser compilado e ensaiado em Postgres isolado;
- gate mais recente: 506/506 testes frontend, 7/7 contratos específicos,
  65/65 testes combinados de Sara/dispatcher, typecheck e build completos;
  lint com zero erros e dez avisos preexistentes de imagens/artefato público;
- segunda fatia retomada: o resultado da visita agora coleta presença,
  acompanhantes, percepção, pontos positivos/negativos, objeções, alternativas,
  definição e próxima ação no mesmo formulário desktop/celular. O envelope
  transitório `FEEDBACK_VISITA_V1` preserva compatibilidade com o texto atual;
- as duas APIs rejeitam texto livre que tente contornar o feedback estruturado,
  e `P0_VISITA_OWNER_COBRANCA_DRAFT.sql` repete essa invariável. O SQL continua
  não aplicado;
- gate mais recente após essa fatia: 510/510 testes frontend, 20/20
  direcionados de visita, typecheck, ESLint direcionado e build aprovados;
  navegador sanitizado validado em desktop e 390 × 844, com PATCH bloqueado;
- áudio de feedback: metadados remotos provaram que `chat-midia` é público e
  inadequado. `P1_VISITA_FEEDBACK_AUDIO_DRAFT.sql` e a Edge local
  `f2-feedback-visita-transcrever` preparam bucket privado, RLS por visita,
  append-only, SHA-256, limite 20 MiB, claim service-only, timeout e retry com
  backoff. A Agenda ganhou upload/consulta autenticados e o mesmo gravador no
  desktop e aplicativo, oculto até a capacidade existir e com confirmação
  humana da transcrição. O draft agora inclui dispatcher cron → Edge → claim,
  lote/lease/retry, service-only, `enabled=false` e três segredos apenas por nome
  no Vault. 8/8 contratos, gate frontend 521/521, typecheck,
  ESLint e build passaram; harness desktop/390 × 844 registrou apenas GETs
  locais e zero erros. Nenhum áudio real foi enviado e nada foi aplicado;
- feedback de visita agora possui rubrica determinística 0–10, mínimo 9 na
  interface/API e mesma barreira no draft de banco. Gate 521/521, 16 contratos
  direcionados, typecheck, ESLint, build e navegador desktop/390 × 844 passaram;
  a validação foi sanitizada e não enviou a mutação;
- gestão de pós-visita ganhou resumo factual com total, responsáveis, casos há
  2+ dias, idade máxima e ausência de dono. Um novo contrato elevou o gate a
  521/521; desktop e aplicativo foram validados com fixtures sanitizadas, sem
  permitir ao gerente responder pelo corretor;
- snapshot sanitizado atual: 675 cards ativos não legados, 375 ações vencidas,
  527 com temperatura, 343 com nota + resumo de qualidade e 561 reavaliados
  pela Sara. Dispatcher em `worker`, heartbeat 6 s, lag 0, último sucesso 79 s,
  193 pendências futuras da Sara e nenhuma pendência vencida.

## Riscos e limites

- árvore isolada contém a reconstrução visual e operacional local; preservar
  integralmente e não misturar com `main`;
- as mudanças estão integradas somente à Agenda desta branch, não à produção;
- o helper Git configurado aponta para um `gh` removido. O chaveiro não
  forneceu credencial utilizável nesta sessão e a integração GitHub confirmou
  leitura, mas recusou escrita com `403 Resource not accessible by integration`.
  Não alterar/rotacionar credenciais sem autoridade; os commits locais
  permanecem recuperáveis e testados;
- migrations reais continuam exigindo confirmação específica; preparar plano
  aditivo, reversível e com rollback quando forem necessárias;
- a fila de cobrança local cobre todo o histórico atual, mas ainda herda da RPC
  um teto de 366 dias. O contrato definitivo precisa remover a expiração com
  paginação e migration aditiva testada isoladamente;
- não há promessa honesta de ERP integralmente vendável até domingo.

## Próximo passo exato

Avançar localmente a visão gerencial de cobrança e qualidade por corretor e,
quando existir Postgres isolado com CLI oficial, ensaiar os contratos de
confirmação, visita, áudio e alertas mantendo o dispatcher desligado. A
fatia `ação → Sara → próxima ação → Meu Dia` está no commit `9ef77038` e o
feedback estruturado de visita está no commit `714dbfd5`; nenhum deles inclui o
symlink `node_modules`. Para publicar os commits locais, reparar somente o
acesso de escrita do GitHub (novo login do `gh` ou helper válido), sem
criar/rotacionar credenciais automaticamente. Não usar `main` do Supabase como
laboratório. Merge/deploy de código e migration permanecem etapas distintas e
verificáveis; nunca agrupar `db push` ao deploy de aplicação.
