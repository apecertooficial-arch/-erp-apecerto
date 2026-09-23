# Checkpoint ERP ApeCerto

## Estado verificado em 23/09/2026, 14:40 BRT

- PR #252 integrada por squash no commit `5e1555c0689fc3979896965651d956385d8f0956`;
  CI “Frontend — validação” passou e `/api/build` confirmou o mesmo hash.
- Item 6 entregue: a migração `dono_protegido_so_estado_atual` está aplicada em
  produção. A prova agregada preserva o único card em visita/negociação ativa e
  deixa de bloquear cinco cards protegidos apenas por visita encerrada, sem mover
  ou editar os cards.
- `motor_roleta` e o SLA usam a regra nova. As funções auxiliares não podem ser
  executadas por `anon` ou `authenticated`; `service_role` mantém a permissão.
- No construtor publicado, mobile 390×844 e desktop 1440×900 mostram a regra fixa
  de visita/negociação ativas; “visita realizada” e “sempre manter” não aparecem.
- Branch `codex/execucao-30-decisoes-03`, baseada no `origin/main` publicado:
  decisões 7–9 implementadas localmente. O contrato anterior permitia que RPCs
  `SECURITY DEFINER` fossem chamadas sem validar dono/escopo, não validava o
  destinatário no aceite e deixava o card do Funil 2 com o dono antigo.
- A migração nova registra tipo, motivo, fit, solicitante e decisor; corretor
  oferece apenas negócio próprio, gestão exige papel/escopo e somente o destino
  aceita ou recusa. Aplicação alinha negócio, lead e card na mesma transação sem
  alterar etapa, momento, negociação ou visita existente.
- Prova real com `ROLLBACK` passou em sete asserts: terceiro e destino errado
  bloqueados, oferta pendente, aceite correto, três entidades alinhadas, contexto
  preservado e auditoria completa. Nenhuma transferência de teste persistiu.
- 57 testes dirigidos, TypeScript, lint, build e `git diff --check` passaram. Harness
  sanitizado aceito em mobile 390×844 e desktop 1440×900. Falta PR, CI, aplicação
  da migração, confirmação da build e aceite em produção.
- Uso semanal continua em 71%; teto 90%; crédito de reset intacto. Sara segue
  bloqueada por saldo externo. Identidade visual continua reservada para o fim.

## Estado verificado em 23/09/2026, 13:56 BRT

- PR #251 integrada por squash no commit `b560fff861ac0046433c1d95e01e25395d62d524`;
  CI “Frontend — validação” passou e `/api/build` confirmou o mesmo hash.
- Item 5 entregue: em produção mobile 390×844 e desktop 1440×900, o bloco e a
  aba de logs dizem “Aceites D-API”; a própria linha continua informando que
  aguarda `messages.sent`. O envio e o banco não foram alterados nesse recorte.
- Item 6 reproduzido com consultas agregadas sem PII: os seis blocos de
  distribuição ativos carregam a proteção histórica de visita realizada; cinco
  cards estão bloqueados somente por visita encerrada. Um sexto caso permanece
  corretamente protegido porque o pipeline atual está em visita/negociação.
- Correção local na branch `codex/execucao-30-decisoes-02`: a regra central e o
  SLA passam a proteger apenas visita agendada/confirmada ou negociação ativa; o
  construtor mostra a regra como fixa e deixa de publicar “visita realizada” ou
  “sempre”. Nenhum mapa publicado nem cliente foi alterado.
- A migração completa passou duas vezes em transação real com `ROLLBACK`, inclusive
  nos asserts de hash/permissão e na prova agregada acima. 60 testes dirigidos,
  lint dos arquivos tocados, build completo e `git diff --check` passaram.
  Falta CI, publicação, confirmação da build e aceite mobile/desktop.
- Uso semanal continua em 71%; teto 90%; crédito de reset intacto. Sara segue
  bloqueada por saldo externo. Identidade visual continua reservada para o fim.

## Estado verificado em 23/09/2026, 13:25 BRT

- Objetivo persistente ativo na nova tarefa: executar as decisões funcionais das
  “30 perguntas” em fatias observáveis, com Ponytail full. Uso semanal no início:
  71%; pausar em 90%, sem consumir o crédito de reset.
- Base canônica: remoto `apecertooficial-arch/-erp-apecerto`, branch
  `codex/execucao-30-decisoes-20260923`, criada limpa em `origin/main`
  `098bc5c603c88b97a954e081302940766ea36c7e`. `/api/build` confirmou o mesmo
  hash. A PR #250 superou o hash `43d8496d` apenas com o checkpoint da recuperação
  Sara. O worktree anterior foi preservado e não foi editado.
- Checklist rastreável consolidado em
  `docs/erp-reestruturacao/EXECUCAO_30_DECISOES.md`. O documento original das 30
  perguntas não foi localizado; não inventar requisitos para preencher lacunas.
- Primeira fatia, mobile primeiro, comprovada com um evento real recente e consultas
  agregadas sem PII: webhook/automação 73 → distribuição → negócio/card → abordagem
  pela instância do dono. A parte mais recente foi aceita, confirmada e entregue;
  lead, negócio e card mantêm o mesmo corretor; o card está ativo e entra no Meu Dia.
- Falha reproduzida e corrigida localmente: o monitor mantinha como “sucesso” a
  linha de aceite HTTP que diz “aguardando confirmação messages.sent”, embora o
  estado canônico depois evolua em `motor_mensagem_partes`. O bloco e seus logs
  agora dizem “Aceites D-API”; o envio não foi alterado. 58 testes dirigidos, lint
  dos arquivos tocados e build completo passaram. Falta publicar e validar o rótulo
  em produção móvel e desktop.
- Produção móvel: Meu Dia carregou com gestão da equipe; CRM carregou 1.136 cards
  ativos e 666 no recorte, sem erro de console. O carregamento inicial levou cerca
  de 16 segundos e merece medição posterior, mas não foi chamado de defeito sem
  orçamento/critério de desempenho acordado.
- IA/Sara continua bloqueada por saldo externo (`credit_balance_exhausted`). Avançar
  nas fatias independentes; não pagar nem alterar credenciais.
- Identidade visual permanece por último e depende de nova conversa com o usuário.

## Estado verificado em 23/09/2026, 12:23 BRT

- Objetivo: concluir fatias funcionais P0/P1 do ERP com teste, CI e validação em produção; manter identidade visual para a última fase. Teto semanal de uso: 80%; última leitura: 70%.
- Repositório: `apecertooficial-arch/-erp-apecerto`. Base `origin/main` em `43d8496d`; branch atual `codex/progresso-sara-recuperada-20260923`. Nenhum arquivo alheio foi alterado.
- Concluído: PRs [#246](https://github.com/apecertooficial-arch/-erp-apecerto/pull/246) a [#249](https://github.com/apecertooficial-arch/-erp-apecerto/pull/249) integradas; `/api/build` confirmou `43d8496d5ba4c4964b9472f49cfc04e2b6d06898`. Agenda móvel carregou com 66 cobranças e qualidade; Local da visita persiste; conflitos do gerente não expõem dados de clientes alheios.
- Sara: migração remota `20260923151146_dispatcher_recuperar_lote_sara_expirado` aplicada após ensaio com rollback e alinhada no repositório. Um lease colidente foi consolidado; vencidos caíram de 273 para zero, sem leases expirados, e 159 itens tiveram status `ok`. Dos 17 erros novos, 15 vieram de cards já descartados e foram rejeitados pela regra de segurança; 2 são `AI_UNAVAILABLE`. Não reprocessar cards descartados.
- Arquivos desta branch: apenas `app/features/progress/progress-state.ts` e este checkpoint para registrar o estado final verificado. Migração já aplicada; não reaplicar.
- Verificações pendentes: testes da fonte de progresso, TypeScript, lint, build, PR/CI, merge e `/api/build`. Próximo passo exato: fechar esses gates e diagnosticar as duas falhas de IA sem consultar ou expor conteúdo pessoal.
- Risco: saldo da API de IA da Sara já retornou `credit_balance_exhausted`; isso é separado do uso de Codex. Não houve pagamento, rotação de credencial ou criação de visita fictícia em produção.

## Histórico anterior

- Prioridade atual definida pelo usuário: funções observáveis primeiro. Interromper redesign, tokens, shell, gradientes e ajustes estéticos. Identidade visual somente na última fase, após nova conversa e aprovação.
- Estado visual: a prova dos commits `361b5a16` e `591dd749` está em produção; o usuário a rejeitou como "horrível". Não houve reversão nem reset. Não propagar a linguagem visual para outras telas.
- Próxima fatia funcional: rastrear captação e distribuição de um lead até sua presença na carteira do corretor e no Meu Dia; reproduzir uma falha real antes de editar. Depois seguir IA/momento/próxima ação, automações, visitas/feedback/cobrança, negociação/vendas/contratos, imóveis/proprietários, financeiro e app móvel.
- P0 comprovado em 22/09: o dispatcher `apecerto-erp-dispatcher` mantém heartbeat, mas o último claim e o último sucesso são de 21/09. Havia 265 itens vencidos e um item `processando` com lease expirado. O último erro foi `AUTOMATION_RETRY: AI_UNAVAILABLE`. Consulta agregada, sem PII e sem mutação de produção.
- Correção de código: `fcbbda5e` limita a RPC de processamento a 120 s e cancela a requisição; o teste reproduziu uma RPC sem resposta antes da correção. 36 testes direcionados, lint e build passaram. `/api/build` confirmou o deploy.
- Validação após deploy: heartbeat continuou, mas não houve claim novo durante a janela observada; 265 itens permanecem vencidos. Não declarar recuperação. Próximo passo depende de verificar o processo/logs reais no Render e aplicar o runbook operacional controlado; não alterar modo, fila ou schema por SQL sem nova autoridade específica.
- Causa-raiz comprovada nos logs do Render: `motor_dispatcher_claim` falha repetidamente com SQLSTATE `23505` no índice `motor_fila_sara_batch_pendente_uniq`. O lote Sara 36889 está `processando` com lease expirado; o lote 36893 do mesmo card está `pendente`. A recuperação tenta tornar o primeiro pendente e colide com o índice, abortando o claim. Leitura somente de IDs e contagens, sem PII.
- Migração preparada em `20260922203000_dispatcher_recuperar_lote_sara_expirado.sql`: funde arrays e contagem de mensagens, preserva os registros de auditoria no lote pendente e cancela o lease antigo. Para o caso observado, a leitura de produção aponta 2 + 9 = 11 mensagens. A migração não foi aplicada: o objetivo vigente proíbe alteração real de schema/dados de produção sem autoridade específica. Não declarar fila recuperada até observar novo claim e conclusão.
- `a53c4b3f` publicado e confirmado por `/api/build`. A migração segue apenas no repositório; a publicação do app não a executa. 37 testes dirigidos do dispatcher/Sara, lint e build passaram. Na fatia captação/CRM, 55 testes passaram após atualizar uma asserção antiga da conversa para cobrir a validação mais rigorosa já presente no componente (`40c07b4f`). Em produção, o único `f2_lead` criado em 22/09 está atribuído, porém é `pescado` sem prazo e, por contrato, não integra a cobrança do Meu Dia. Nas visitas dos últimos 14 dias, 46 realizadas, 29 canceladas e 2 não comparecimentos têm resultado persistido; não há realizadas sem resultado nesse recorte. Consultas agregadas, sem PII e sem mutação.
- CRM: 1.138 cards ativos, dos quais 579 empatam no prazo sentinela sem cobrança. Duas paginações de 1.000 linhas ordenadas só pelo prazo podem escolher desempates distintos; a reprodução SQL resultou em apenas 1.000 IDs distintos para 1.138 cards. `4f86347c` adicionou `id` como desempate estável no carregamento da carteira. 56 testes direcionados, lint e build passaram; `/api/build` confirmou o deploy. Navegador autenticado: CRM sem alerta, 65 cards visíveis no desktop e app móvel carregado sem alerta nem overflow.
- IA: 39 execuções recentes da Sara com erro trazem `saida.error.code=credit_balance_exhausted` e `type=insufficient_quota`. É saldo da API de IA, independente do uso de Codex (66% do teto semanal de 80%). Não pagar, alterar credenciais ou simular análise. Após recuperar a fila, esse bloqueio ainda poderá impedir novas análises da Sara.
- Financeiro: `49a63ffa` exige linha alterada na baixa de recebimento; `28a7c644` impede auditoria falsa em edição/exclusão de caixa; `d8cf4538` sinaliza resposta parcial quando o lançamento de caixa foi criado, mas a baixa da parcela não foi confirmada. Testes dirigidos, lint e build passaram em cada fatia; `/api/build` confirmou o último deploy. A página Financeiro carregou sem alerta no navegador autenticado. Nenhuma baixa, edição ou exclusão financeira real foi usada como teste. O relatório de reconciliação de 16/09 permanece íntegro: 25 vendas, nenhuma nova desde então, 15 com comissão divergente e 2 sem percentual; correção desses registros exige decisão humana.
- Verificação independente: 48 testes móveis, 43 de produtos/proprietários e 74 de permissões/vendas/financiamento passaram. Produtos e Financeiro carregaram no navegador autenticado sem alerta. Não inferir dessas verificações que todo o produto está concluído.

- Objetivo: seguir pelas falhas P0/P1 comprovadas do CRM, Meu Dia, Agenda e aplicativo.
- Base: `origin/main` em `5840dfc0`; branch `codex/agenda-hoje-sao-paulo`.
- Histórico anterior: prova visual operacional do CRM / Meu Dia em desktop e mobile, usando o shell, tokens e componentes reais; nenhuma interface paralela foi criada. A prova foi rejeitada pelo usuário.
- Decisão: consolidar azul, índigo, violeta, atmosfera e profundidade nas autoridades CSS existentes, mantendo laranja nas ações principais e sem dependência nova.
- Arquivos: autoridades de identidade, shell, Funil desktop e aplicativo móvel; teste estrutural da direção visual e fonte do painel.
- Verificações: CRM e Meu Dia com dados sanitizados no navegador real; desktop e 390×844; carregamento, vazio, erro e acesso negado sem overflow; redução de movimento; console sem warnings ou erros. Gates automatizados e build devem permanecer verdes antes da publicação.
- Produção: `361b5a16`, `591dd749` e `5840dfc0` publicados e confirmados por `/api/build`. CRM desktop com 65 cartões, CRM móvel com 60, sem overflow; shell e sombras computadas ativos. Painel de Progresso com um único `main`, teto de 80% e hash atualizado.
- Risco: baixo a moderado e restrito à apresentação; fluxos, dados e mutações não foram alterados.
- Direção visual: prova rejeitada pelo usuário. Nenhuma nova mudança estética está autorizada nesta fase; a identidade fica por último.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[██████████░░░░░░░░░░] 51/100`
  - CRM / Kanban: `[███████████████░░░░░] 73/100`
  - Identidade visual aprovada: `[░░░░░░░░░░░░░░░░░░░░] 0/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[█████████████░░░░░░░] 66/100`
- Próximo passo: verificar o caminho funcional captação → distribuição → carteira → Meu Dia e corrigir apenas falha reproduzida.
- Continuação: o teto semanal autorizado passou a 80%. O painel de Progresso usa o marco principal do shell e o teste global de acessibilidade voltou a passar.
