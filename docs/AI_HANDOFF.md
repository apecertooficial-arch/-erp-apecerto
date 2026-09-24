# Checkpoint ERP ApeCerto

## Estado verificado em 24/09/2026, 10:52 BRT

- Upload manual entregue pela PR #288 no build
  `ded8798713cd90ba23ffe977978a0d92a37260b6`. A Esteira e a aba de
  documentação abriram no build novo, exibiram os 10 controles de anexo e foram
  fechadas sem selecionar arquivo. Produção preservou zero fixtures e o único
  anexo legado órfão.
- A próxima falha comprovada estava em “Substituir”: o fluxo removia o documento
  antigo antes de confirmar o novo upload, podendo deixar a venda sem comprovante.
- A migration `esteira_anexo_substituicao_atomica` está aplicada. A função
  `esteira_anexo_substituir` é `SECURITY INVOKER`; `authenticated` executa e
  `anon` não. A interface envia o arquivo novo primeiro; só então a RPC atualiza
  o mesmo anexo e grava a trilha na mesma transação. O caminho antigo é limpo do
  Storage depois e pode ser repetido com o mesmo request.
- A prova autenticada substituiu a fixture mantendo o mesmo ID, preservou o
  caminho anterior na trilha, repetiu sem duplicar e bloqueou o request
  conflitante. O `ROLLBACK` deixou zero fixture e zero evento de prova. Advisors
  não citam os objetos novos. Os 1.217 testes, TypeScript, lint sem erros e build
  Vinext passaram; faltam PR/CI, deploy e aceite produtivo sem substituir arquivo.

## Estado verificado em 24/09/2026, 10:38 BRT

- Remoção de anexos entregue pela PR #287 no build
  `e77926eb277c2f62f28cb580e97d9b6fe9d47ea4`. A Esteira e a aba de
  documentação abriram em produção sem erro e foram fechadas sem exclusão. Não
  há anexo legítimo ligado a uma venda para acionar o botão com segurança; o
  único anexo persistido é legado e aponta para um processo inexistente.
- A próxima falha comprovada estava no upload manual: o anexo era inserido antes
  da trilha best-effort, e uma resposta incerta fazia nova tentativa gerar outro
  caminho e outra solicitação.
- A migration `esteira_anexo_upload_atomico` está aplicada. A função
  `esteira_anexo_registrar` é `SECURITY INVOKER`; `authenticated` executa e
  `anon` não. Ela revalida processo, etapa, documento e papel, deriva o negócio
  do processo e registra anexo e trilha na mesma transação. A interface conserva
  request e caminho após o Storage confirmar o upload.
- A prova autenticada criou anexo e trilha, repetiu retornando o mesmo anexo e
  bloqueou o request conflitante. O `ROLLBACK` deixou zero fixture e zero evento
  de prova. Advisors não citam os objetos novos. Os 1.215 testes, TypeScript e
  lint sem erros e build Vinext passaram; o helper best-effort ficou sem uso e
  foi removido. PR/CI, deploy e aceite produtivo sem anexar arquivo real também
  foram concluídos.

## Estado verificado em 24/09/2026, 10:25 BRT

- Upload em lote entregue pela PR #286 no build
  `0d63e64a2cedb5c69c5c1b7a9ddb4650bec47b8d`. A área autenticada “Enviar tudo
  de uma vez” abriu em produção e a ficha foi fechada sem selecionar arquivos.
  Produção preservou zero lotes e zero resíduos de prova.
- A próxima falha comprovada estava na remoção de anexos: banco e trilha eram
  escritos separadamente, e o objeto no Storage nunca era apagado.
- A migration `esteira_anexo_remocao_atomica` está aplicada. A função
  `esteira_anexo_remover` é `SECURITY INVOKER`; `authenticated` executa e `anon`
  não. Ela revalida processo, etapa, documento e papel, remove a linha e grava
  uma trilha preservada na mesma transação. O request estável permite repetir a
  limpeza do Storage sem duplicar a auditoria.
- A prova autenticada removeu a fixture, preservou uma trilha sem FK destrutiva,
  repetiu sem duplicar e bloqueou o request conflitante. O `ROLLBACK` restaurou
  1 anexo real, zero fixture e zero evento de prova. Advisors não citam os
  objetos novos. Os 1.213 testes, TypeScript, lint sem erros e build Vinext
  passaram; PR/CI, deploy e aceite produtivo somente de leitura também foram
  concluídos.

## Estado verificado em 24/09/2026, 10:11 BRT

- Confirmação da triagem entregue pela PR #285 no build
  `5c5476dbddc38275bb00aec475a2493c9b9ca6d1`. A aba autenticada de documentos
  abriu em produção; não havia anexo em triagem e a ficha foi fechada sem
  mutação. Produção preservou 1 anexo real, zero triagens e zero eventos de prova.
- A próxima falha comprovada estava no upload em lote: os anexos eram inseridos
  antes da trilha best-effort e podiam permanecer sem auditoria.
- A migration `esteira_anexo_lote_atomico` está aplicada. A função
  `esteira_anexo_lote_registrar` é `SECURITY INVOKER`; `authenticated` executa e
  `anon` não. Ela revalida acesso, etapa e papel, obtém o negócio pelo processo e
  registra todos os anexos e a trilha na mesma transação. O `loteId` é a chave
  idempotente e o mesmo lote com conteúdo diferente é recusado.
- A prova autenticada pós-migration criou dois anexos e uma trilha, repetiu sem
  duplicar e bloqueou o reuso conflitante. O `ROLLBACK` deixou zero anexo e zero
  evento de prova; a produção continua sem lotes reais. Advisors não citam os
  objetos novos. Os 1.211 testes, TypeScript, lint sem erros e build Vinext
  passaram; PR/CI, deploy e aceite produtivo sem upload real também foram
  concluídos.

## Estado verificado em 24/09/2026, 09:57 BRT

- Criação de etapas entregue pela PR #284 no build
  `4f6d9632aee78cce79b84e6c5c104d4894abf907`. O formulário autenticado abriu
  com a ação desabilitada sem nome e foi fechado por “Cancelar”. Produção
  preservou 10 etapas nas ordens 1–10, zero fixture e zero auditoria de prova.
- A próxima falha reproduzida estava em confirmar a triagem da Sara: o anexo
  chegava a `anexado` antes da trilha best-effort. A prova controlada confirmou
  o anexo com zero evento e terminou em `ROLLBACK`.
- A migration `esteira_triagem_confirmacao_atomica` está aplicada. A função é
  `SECURITY INVOKER`; `authenticated` executa e `anon` não. Ela revalida etapa,
  bloco e papel, confirma/corrige o anexo e registra o evento na mesma transação,
  com UUID estável para retry.
- A prova pós-migration corrigiu a classificação, repetiu o mesmo resultado,
  manteve exatamente um evento e bloqueou o request conflitante. O `ROLLBACK`
  restaurou 1 anexo real, zero fixture e zero evento de prova. Advisors não
  citam os objetos novos. Os 1.209 testes, TypeScript, lint sem erros e build
  Vinext passaram; PR/CI, deploy e aceite produtivo somente de leitura também
  foram concluídos.

## Estado verificado em 24/09/2026, 01:54 BRT

- Reordenação de etapas entregue pela PR #283 no build
  `0350b3c47733c8e6887e58f25ab7da1be82cb05d`. O menu autenticado mostrou os
  controles de ordem coerentes para a primeira etapa e foi fechado sem mover
  nada. Produção preservou 10 etapas nas ordens 1–10, sem duplicidade ou fixture.
- A próxima falha reproduzida estava em criar etapas: duas solicitações podiam
  calcular a mesma próxima ordem fora da escrita. A prova encontrou a colisão na
  ordem 11 e terminou em `ROLLBACK`.
- A migration `esteira_etapa_criar_atomica` está aplicada. A função é `SECURITY
  INVOKER`; `authenticated` executa e `anon` não. Ela usa o mesmo lock da
  reordenação para reservar slug e ordem, insere e audita na mesma transação e
  aceita retry com UUID estável.
- A prova pós-migration criou a ordem 11, repetiu sem duplicar, bloqueou o reuso
  conflitante e criou a ordem 12 com slug reservado. O `ROLLBACK` restaurou as
  10 etapas, ordens 1–10 e zero fixture. Os 1.207 testes, TypeScript, lint sem
  erros e build Vinext passaram; faltam PR/CI, deploy e aceite produtivo somente
  do formulário, sem criar etapa real.

## Estado verificado em 24/09/2026, 01:36 BRT

- Revisão documental entregue pela PR #282 no build
  `67fe189d0ad01b5d8a967287d311c9d273742189`. A aba autenticada exibiu os três
  grupos de documentação e foi fechada sem acionar status. Produção preservou 1
  anexo `anexado`, zero eventos e zero resíduo da prova.
- A próxima falha reproduzida estava em reordenar etapas: a primeira atualização
  linha a linha colidia com o índice único da ordem ativa. A prova encontrou a
  colisão na ordem 2 e terminou em `ROLLBACK`.
- A migration `esteira_etapas_reordenacao_atomica` está aplicada. A função é
  `SECURITY INVOKER`; `authenticated` executa e `anon` não. Ela estaciona a
  sequência em ordens temporárias, aplica todas as posições e audita na mesma
  transação, com UUID estável para retry.
- A prova pós-migration trocou as duas primeiras das 10 etapas, repetiu sem
  duplicar auditoria e bloqueou request conflitante. O `ROLLBACK` restaurou as
  ordens 1–10, sem duplicidade nem fixture. Advisors não citam os objetos novos.
  Os 1.205 testes, TypeScript, lint sem erros e build Vinext passaram; faltam
  PR/CI, deploy e aceite produtivo somente de leitura.

## Estado verificado em 24/09/2026, 01:27 BRT

- Partes da Esteira entregues pela PR #281 no build
  `9c6dfdd6fca34961c25484acf9a470f23d71f309`. A aba autenticada exibiu o
  comprador e o vendedor e foi fechada sem edição. Produção preservou 1 parte,
  zero cônjuges, zero divergência e zero resíduo da prova.
- A próxima lacuna reproduzida estava na revisão de documentos: o status era
  confirmado antes da trilha best-effort. A prova controlada atingiu
  `anexado -> em_analise` com zero evento; a exceção reverteu tudo.
- A migration `esteira_documento_revisao_atomica` está aplicada. A função é
  `SECURITY INVOKER`; `authenticated` executa e `anon` não. Status e trilha agora
  são uma transação com UUID estável até a confirmação.
- A prova pós-migration alterou/repetiu o status, confirmou uma única trilha e
  bloqueou o reuso conflitante do request. O `ROLLBACK` restaurou 1 anexo
  `anexado`, zero eventos e zero fixture. Advisors não citam os objetos novos.
  Os 1.203 testes, TypeScript, lint sem erros e build Vinext passaram; faltam
  PR/CI, deploy e aceite produtivo somente de leitura.

## Estado verificado em 24/09/2026, 01:13 BRT

- Comissão da Esteira entregue pela PR #280 no build
  `893731d6bdb12e0e3a5a8aa396cf641a63413d72`. A aba autenticada exibiu todos os
  campos e foi fechada sem edição. Produção preservou zero comissões, zero
  parcelas, zero ordem duplicada e zero auditoria da prova.
- A próxima lacuna reproduzida estava nas partes da venda: criar um cônjuge e
  ligar a flag que ativa seus documentos eram transações separadas. A prova
  controlada atingiu `conjuge=1, flag_comprador=false`; a exceção reverteu tudo.
- A migration `esteira_partes_atomicas` está aplicada. A função é `SECURITY
  INVOKER`; `authenticated` executa e `anon` não. Salvar, adicionar e remover
  parte agora sincronizam a flag de cônjuge e a auditoria numa transação.
- A prova pós-migration adicionou/repetiu, salvou e removeu/repetiu um cônjuge,
  confirmou a flag em cada estado, três auditorias e bloqueio de request
  conflitante. O `ROLLBACK` restaurou 1 parte, zero cônjuges, zero divergência e
  zero resíduo. Advisors não citam os objetos novos. Testes dirigidos e
  TypeScript passaram; faltam suíte integral, lint, build, PR/CI, deploy e aceite
  produtivo somente de leitura.

## Estado verificado em 24/09/2026, 00:55 BRT

- Devolução ao atendimento entregue pela PR #279 no build
  `f89c24f4ed949483b52d41892fe808d9408fb649`. O modal autenticado exibiu funil,
  etapa e motivo; foi fechado sem envio. Produção preservou 22 processos, 2
  negócios vinculados, zero divergência e zero auditoria da prova.
- A próxima lacuna reproduzida estava em “Salvar comissão”: o cabeçalho era
  confirmado antes de apagar/recriar parcelas. A prova controlada atingiu
  `cabecalho=1, parcelas=0` e a exceção reverteu tudo; produção voltou a zero
  comissões e zero parcelas.
- A migration `esteira_comissao_atomica` está aplicada. A função é `SECURITY
  INVOKER`; `authenticated` executa e `anon` não. Cabeçalho, parcelas e auditoria
  agora são uma transação, com ordem única e UUID estável até confirmação.
- A prova pós-migration gravou 1 cabeçalho e 2 parcelas, repetiu sem duplicar,
  manteve uma auditoria e bloqueou reuso conflitante do request. O `ROLLBACK`
  restaurou zero comissões, zero parcelas e zero auditoria de prova. Advisors não
  citam os objetos novos. Testes dirigidos e TypeScript passaram; faltam suíte
  integral, lint, build, PR/CI, deploy e aceite produtivo somente de leitura.

## Estado verificado em 24/09/2026, 00:40 BRT

- Metas atômicas entregues pela PR #278 no build
  `025db11cf1004d0df9c54bf6e229eb91c1e1bcfd`. A aba autenticada exibiu 13
  metas sem salvar, editar ou apagar; o banco confirmou 13 metas e zero resíduo.
- A próxima lacuna reproduzida estava em “Devolver ao atendimento”: o negócio
  era reaberto antes de o processo ser marcado como devolvido. Uma falha entre
  as chamadas deixava negócio aberto/sem venda e processo ainda aprovado, sem
  auditoria. A prova autenticada reproduziu esse estado e terminou em `ROLLBACK`.
- A migration `esteira_venda_devolver_atomica` está aplicada. A função é
  `SECURITY INVOKER`; `authenticated` executa e `anon` não. Processo, negócio e
  auditoria agora mudam numa transação; o modal mantém UUID estável por abertura.
- A prova pós-migration devolveu a venda de controle, repetiu o mesmo resultado,
  confirmou uma auditoria e bloqueou reuso do request com outro destino. O
  `ROLLBACK` restaurou 22 processos, 2 negócios vinculados, processo aprovado e
  negócio ganho. Advisors não citam os objetos novos. Os 1.197 testes,
  TypeScript, lint sem erros e build Vinext passaram. Próximo passo: PR/CI, merge
  e aceite pós-deploy somente de leitura.

## Estado verificado em 24/09/2026, 00:27 BRT

- A conexão atômica venda–CRM foi entregue pela PR #277 no build
  `753b5638940881281d6b49400e1582f3330b571b`. A Esteira autenticada carregou
  22 processos; o modal “Conectar venda ao CRM” abriu e fechou sem envio.
  Produção preservou 25 vendas, 2 negócios vinculados, 0 divergência e 0 duplicidade.
- A próxima lacuna reproduzida estava em `/api/metas`: localizar e depois
  inserir/atualizar eram chamadas separadas, e excluir não auditava nem tinha
  chave de retry. A prova autenticada criou, editou e apagou uma fixture sem
  auditoria; o `ROLLBACK` preservou as 13 metas reais.
- A migration `metas_mutacao_atomica` está aplicada. A função é `SECURITY
  INVOKER`; `authenticated` executa e `anon` não. Salvar, editar, apagar e
  auditoria agora formam uma transação, com UUID estável por conteúdo e índice
  único na auditoria que mantém a idempotência mesmo depois da exclusão.
- A prova pós-migration criou/repetiu, editou/repetiu e apagou/repetiu a fixture,
  confirmou exatamente três auditorias e bloqueou o reuso conflitante do request.
  Terminou em `ROLLBACK`: 13 metas, 0 fixture e 0 auditoria de prova. Advisors
  não citam a função ou índice novos. Os 1.195 testes, TypeScript, lint sem erros
  e build Vinext passaram. Próximo passo: PR/CI, merge e aceite pós-deploy somente
  de leitura.

## Estado verificado em 24/09/2026, 00:12 BRT

- Décima segunda fatia da decisão 29 entregue pela PR #276 no build
  `cefff90be3905be56a75104213bfd43f931ed329`. O Financeiro autenticado confirmou
  os botões de exclusão desabilitados para Comissão Paga e Comissão Recebida;
  produção preservou 28 categorias, 16 ativas e 2 estruturais únicas.
- A conexão manual da venda ao CRM ainda criava a venda, depois atualizava o
  negócio e só então inseria o processo. Uma falha intermediária podia deixar
  qualquer subconjunto desse estado persistido e o retry não era idempotente.
- A migration `esteira_venda_criar_atomica` está aplicada. A função é
  `SECURITY INVOKER`; `authenticated` executa e `anon` não. Venda, negócio,
  processo aprovado e auditoria agora nascem numa transação, protegida por UUID
  estável da solicitação e unicidade do negócio no processo.
- A prova pré-migration reproduziu venda e negócio conectados sem processo. A
  prova pós-migration criou o conjunto completo, repetiu os mesmos IDs, auditou
  uma vez e bloqueou request conflitante e segundo vínculo do negócio. Ambas
  terminaram em `ROLLBACK`, sem fixture nem auditoria residual.
- Produção permaneceu com 25 vendas, 22 processos, 2 negócios vinculados, 0
  vínculos divergentes, 0 negócio duplicado e 0 fixture. As 3 vendas sem processo
  e os 20 processos sem negócio são legado preservado, sem inferência. Advisors
  não citam a nova função ou índice. Os 1.194 testes, TypeScript, lint sem erros
  e build Vinext passaram. Próximo passo: PR/CI, merge e aceite pós-deploy somente
  de leitura.

## Estado verificado em 23/09/2026, 23:54 BRT

- Décima primeira fatia da decisão 29 entregue pela PR #275 no build
  `046e363d87513eabc5e08df30a1d0fa1042dd914`. Produção autenticada confirmou o
  arquivo histórico de 08/08 a 04/09, 36 linhas, saldo conferido e 0 pendências.
- Décima segunda lacuna reproduzida: criar, editar e remover categorias ainda
  escrevia direto na tabela, sem auditoria, e permitia desativar as categorias
  estruturais que sustentam comissão recebida e comissão paga.
- A migration `financeiro_categoria_atomica` está aplicada. A função é
  `SECURITY INVOKER`; `authenticated` executa e `anon` não. Criação, reativação,
  edição e remoção são idempotentes e auditadas; as duas naturezas estruturais
  são únicas e não podem ser removidas ou convertidas.
- A prova pré-migration desativou uma categoria estrutural sem auditoria; o
  rollback restaurou o estado. A prova pós-migration criou/repetiu, editou/repetiu
  e removeu/repetiu uma fixture, confirmou três auditorias e todos os bloqueios;
  também terminou em `ROLLBACK`.
- Produção permaneceu com 28 categorias, 16 ativas, 2 estruturais e 0 fixtures ou
  auditorias de prova. Os advisors não citam a nova função ou índice. Os 1.192
  testes, TypeScript, lint sem erros e build Vinext passaram. Próximo passo:
  PR/CI, merge e aceite pós-deploy somente de leitura.

## Estado verificado em 23/09/2026, 23:36 BRT

- Décima fatia da decisão 29 entregue pela PR #274 no build
  `8a0550c5d5146c0196a60b9398d32274e6f1ca09`. Produção autenticada exibiu a
  importação histórica com 36 linhas, saldo conferido e nenhuma decisão pendente.
- Décima primeira lacuna reproduzida: a rota criava o cabeçalho da importação e
  só depois gravava as linhas; falha de contexto ou upsert deixava estado parcial
  e reenvio do arquivo podia criar cabeçalho órfão.
- A migration `financeiro_extrato_importacao_atomica` está aplicada. A função é
  `SECURITY INVOKER`; `authenticated` executa e `anon` não. O SHA-256 do conjunto
  de impressões deduplica retry/reenvio completo e sobreposição parcial é bloqueada.
- Provas pré e pós-migration criaram cabeçalho/linhas/auditoria, repetiram o mesmo
  conteúdo, bloquearam sobreposição parcial e reconheceram a importação histórica
  canônica. Tudo terminou em `ROLLBACK`.
- Produção permaneceu com 1 importação, 36 linhas e 0 fixtures/auditorias de prova;
  o histórico continua com fingerprint nulo, sem backfill. Os advisors não citam
  a função ou índice novos. Os 1.190 testes, TypeScript, lint sem erros e build
  Vinext passaram. Próximo passo: PR/CI, merge e aceite pós-deploy somente de
  leitura.

## Estado verificado em 23/09/2026, 23:23 BRT

- Nona fatia da decisão 29 entregue pela PR #273 no build
  `2f59b3144f1eaa7824db0bf5dfc4e692b9634617`. Produção autenticada confirmou
  os dois repasses pagos da VD-EA33 com destinatário, papel e valor desabilitados.
- Décima lacuna reproduzida: conciliar extrato ainda criava/vinculava o caixa e
  só depois resolvia a linha. Uma falha intermediária devolvia estado parcial;
  “aceitar todas” também confirmava apenas parte do lote.
- A migration `financeiro_extrato_resolucao_atomica` está aplicada. As funções
  individuais e de lote são `SECURITY INVOKER`; `authenticated` executa,
  `anon` não. A linha é a chave idempotente e um caixa não pode reconciliar duas
  linhas bancárias diferentes.
- Provas pré e pós-migration lançaram, repetiram, bloquearam decisão conflitante,
  ignoraram, vincularam e aceitaram lote; cinco auditorias foram verificadas na
  prova integral. Tudo terminou em `ROLLBACK`.
- Produção permaneceu com 1 importação, 36 linhas já lançadas, 0 pendentes e 368
  caixas, sem fixture nem auditoria residual. Os advisors não apontaram a nova
  migration. Os 1.188 testes, TypeScript, lint sem erros e build Vinext passaram.
  Próximo passo: PR/CI, merge e aceite pós-deploy somente de leitura.

## Estado verificado em 23/09/2026, 23:04 BRT

- Oitava fatia da decisão 29 entregue pela PR #272 no build
  `5dc50773ae0a5f7269c73e05071a20f3c5f7ceb6`. Produção autenticada confirmou
  a comissão com repasse/caixa desabilitada e marcada “movimento vinculado”,
  enquanto três comissões sem movimento da venda de controle seguem editáveis.
- Nona lacuna reproduzida: criação/edição da agenda de repasse ainda escrevia
  direto em `pagamentos_comissao`, aceitava linha sem comissão, não auditava e
  podia duplicar no retry ou ultrapassar a parte distribuída.
- A migration `financeiro_repasse_agenda_atomica` está aplicada. A nova função
  é `SECURITY INVOKER`, `authenticated` executa e `anon` não; ela canoniza o
  vínculo pela venda/destinatário/papel, limita valor e ordem e congela pago.
- Provas pré e pós-migration criaram, repetiram, editaram e excluíram fixture,
  bloquearam ordem duplicada, total excessivo e edição de repasse pago, geraram
  três auditorias na prova integral e terminaram em `ROLLBACK`.
- Produção permaneceu com 3 repasses e 368 caixas, sem fixture nem auditoria
  residual. O repasse sem comissão, a ordem histórica duplicada e o total antigo
  acima da comissão não foram alterados. Os 1.186 testes, TypeScript, lint sem
  erros e build Vinext passaram. Próximo passo: PR/CI, merge e aceite pós-deploy
  somente de leitura.

## Estado verificado em 23/09/2026, 22:47 BRT

- Sétima fatia da decisão 29 entregue pela PR #271 no build
  `85c493af4d79bf995d7230e97621bca603309141`. Produção autenticada confirmou
  valor, data, salvar e excluir desabilitados para parcela baixada; só a
  reabertura permanece disponível.
- Oitava lacuna reproduzida: comissão avulsa era gravada diretamente pela rota,
  podia ultrapassar a comissão bruta, perder vínculo por exclusão e duplicar no
  retry. As novas RPCs serializam a venda, deduplicam criação, auditam e bloqueiam
  edição/exclusão quando há repasse ou caixa vinculado.
- A migration `financeiro_comissao_atomica` está aplicada; as funções são
  `SECURITY INVOKER`, `authenticated` executa e `anon` não. Provas pré e
  pós-migration criaram, repetiram, editaram e excluíram uma fixture, bloquearam
  duplicidade, excesso e comissão movimentada e terminaram em `ROLLBACK`.
- Produção permaneceu com 57 comissões, 3 repasses e 368 caixas, sem fixture nem
  auditoria residual. As 2 vendas historicamente acima da comissão bruta e o
  repasse divergente não foram alterados; a regra permite redução, nunca piora.
- 1.183 testes, TypeScript, lint (0 erros; 9 avisos antigos) e build passaram.
  Próximo passo: PR/CI/merge e aceite visual/pós-deploy somente de leitura.

## Estado verificado em 23/09/2026, 22:27 BRT

- Sexta fatia da decisão 29 entregue pela PR #270 no build
  `bea9f7e24d0b1fa472a12c1494b5407889afef6c`. A migration está aplicada;
  `authenticated` executa, `anon` não e a função preserva RLS como invoker.
  Delete/replay pós-deploy auditaram uma vez em rollback e a divergência histórica
  foi bloqueada, preservando 3 repasses, 368 caixas e zero auditorias residuais.
- O Financeiro autenticado carregou sem alerta; security/performance advisors não
  mencionam `financeiro_excluir_repasse`. Uso semanal em 78% do teto de 90%.
- Sétima lacuna reproduzida: editar parcela recebida deixava o caixa antigo e
  excluir usava FK `SET NULL`, soltando o caixa. As novas RPCs só editam/excluem
  parcelas pendentes, auditam, deduplicam criação por `request_id` e impedem
  aumentar o total acima da comissão bruta sem bloquear redução do legado.
- Prova pré-migration `authenticated` criou/editou/excluiu com retries, gerou
  exatamente três auditorias transitórias e bloqueou total excessivo e duas
  mutações sobre parcela baixada. O rollback restaurou 18 recebimentos, 368 caixas,
  a parcela pendente original e a parcela recebida com seu caixa.
- 1.179 testes, TypeScript, lint (0 erros; 9 avisos antigos), build e diff check
  passaram. Próximo passo: PR/CI/merge, migration e aceite pós-deploy com rollback.

## Estado verificado em 23/09/2026, 22:11 BRT

- Quinta fatia da decisão 29 entregue pela PR #269 no build
  `da5d16031edd00a55e3c2cf65e48eadfeef7816b`. A edição de venda é atômica,
  idempotente e bloqueia estados ou valores incompatíveis com os movimentos;
  prova pós-deploy, permissões, advisors e Financeiro autenticado passaram.
- Sexta lacuna reproduzida: `deletePayout` apagava primeiro o caixa e depois o
  repasse em chamadas REST separadas. A nova RPC trava e valida os dois registros,
  apaga ambos numa transação, audita uma vez e trata retry como idempotente.
- Prova pré-migration `authenticated` excluiu e repetiu um repasse íntegro em
  `BEGIN/ROLLBACK`: dentro da transação houve 2 repasses, 367 caixas e uma única
  auditoria; depois voltaram 3, 368 e zero auditorias de exclusão. A função também
  não persistiu.
- O diagnóstico completo revelou 1 dos 3 repasses pagos históricos com
  `comissao_id` nula enquanto seu caixa aponta para uma comissão. A nova RPC o
  bloqueia como divergente; nenhum vínculo ou valor foi corrigido automaticamente.
  1.176 testes, TypeScript, lint (0 erros; 9 avisos antigos) e build passaram.
  Próximo passo: PR/CI/merge, migration e aceite pós-deploy com rollback.

## Estado verificado em 23/09/2026, 21:55 BRT

- Quarta fatia da decisão 29 entregue pela PR #268 no build
  `9df803559eb01bda786c459c3f0ea94e671574d9`. A migration de baixa direta está
  aplicada; `authenticated` executa, `anon` não, e os advisors não associam
  achado novo à RPC. O Financeiro autenticado carregou sem alerta.
- Prova pós-deploy baixou, repetiu, reabriu e repetiu uma parcela em transação.
  Somente as duas mudanças reais auditaram; o rollback preservou 368 caixas,
  16 vínculos, zero divergências e os 2 recebimentos legados pendentes.
- Quinta lacuna reproduzida: editar venda ainda atualizava a venda e depois
  baixava parcelas em chamada separada, sem criar caixa. A nova RPC não baixa
  parcelas lateralmente, preserva o trigger de auditoria e bloqueia novo estado
  incompatível com movimentos ou valores dependentes.
- Prova pré-migration `authenticated` confirmou edição/replay idempotente,
  reabertura com `data_conclusao` limpa e os três bloqueios em `BEGIN/ROLLBACK`.
  1.174 testes, TypeScript, lint (0 erros; 9 avisos antigos) e build passaram.
  Próximo passo: PR/CI/merge, migration e aceite pós-deploy.

## Estado verificado em 23/09/2026, 21:38 BRT

- Terceira fatia da decisão 29 entregue pela PR #267 no build
  `6815fedcac01636ffa2a30cb964a829a9dcd4677`. A migration de edição/exclusão
  atômicas está aplicada; prova pós-deploy e tela autenticada passaram sem mutação.
- Quarta lacuna reproduzida: `settleReceipt` mudava somente a parcela e podia
  confirmar recebimento sem caixa nem auditoria. A nova RPC baixa/reabre parcela,
  caixa e auditoria numa transação, preserva RLS e torna retries idempotentes.
- Os 2 recebimentos pendentes de vendas historicamente pagas continuam intactos:
  não há inferência ou backfill. A prova `authenticated` de baixa, replay,
  reabertura e replay terminou em `ROLLBACK`, preservando 368 caixas, 16 vínculos
  e zero divergências.
- 1.172 testes, TypeScript, lint (0 erros; 9 avisos antigos) e build passaram.
  Próximo passo: PR/CI/merge, migration e aceite pós-deploy sem mutação persistente.

## Estado verificado em 23/09/2026, 21:25 BRT

- Segunda fatia da decisão 29 entregue pela PR #266 no build
  `e08eb4812dd45d9ad49718099e811cb0a47df89c`. A migration
  `financeiro_caixa_criar_atomico` está aplicada; prova pós-deploy preservou 368
  caixas, 16 vínculos, zero duplicidade/divergência e terminou em rollback.
- Terceira lacuna reproduzida: edição/exclusão de caixa, auditoria e reabertura da
  parcela ainda eram chamadas separadas; além disso, `ON DELETE SET NULL` permitia
  apagar lateralmente um dos 3 caixas de repasse e deixar o repasse pago sem caixa.
- Novas RPCs em prova editam/sincronizam ou excluem/reabrem numa transação, fazem
  retry idempotente e bloqueiam caixas derivados de repasse. Prova `authenticated`
  com edição, replay, exclusão, replay e bloqueios passou em `BEGIN/ROLLBACK`.
- 1.171 testes, TypeScript, lint (0 erros; 9 avisos antigos) e build passaram.
  Próximo passo: PR/CI/merge, migration e aceite pós-deploy sem mutação persistente.

## Estado verificado em 23/09/2026, 21:13 BRT

- Segunda fatia da decisão 29 em prova. Os 16 lançamentos ligados a recebimento
  são únicos, entradas, da mesma venda e do mesmo valor; não há recebido sem data.
- A nova `financeiro_caixa_criar` reúne lançamento, baixa opcional e auditoria na
  mesma transação, usa `request_id` para retry e impede mais de um caixa por
  recebimento. O modal mantém um UUID estável enquanto a solicitação está aberta.
- Prova pré-migration sob `authenticated` dentro de `BEGIN/ROLLBACK`: criou caixa,
  baixou a parcela, repetiu sem duplicar e recusou nova solicitação para a mesma
  parcela; exatamente um caixa e uma auditoria foram transitórios.
- 1.170 testes, TypeScript, lint (0 erros; 9 avisos antigos) e build passaram.
  Próximo passo: PR/CI/merge, migration aditiva e aceite pós-deploy com rollback.

## Estado verificado em 23/09/2026, 21:08 BRT

- A primeira fatia da decisão 29 foi entregue pela PR #265 no build produtivo
  `2ca85eb238fd9f6d258372082671f2e667148ef4`; CI integral passou.
- A migration `financeiro_repasse_atomico` está aplicada. `authenticated` executa
  a RPC e `anon` não. A prova pós-deploy sob RLS fez replay pago, reabertura,
  replay reaberto, nova baixa e replay final dentro de `BEGIN/ROLLBACK`; somente
  as duas mudanças reais geraram auditoria e nada permaneceu gravado.
- Produção permaneceu com 368 lançamentos, 16 ligados a recebimentos e 3 repasses;
  zero recebimentos recebidos sem caixa e zero repasses divergentes. O Financeiro
  carregou no navegador autenticado sem alerta; nenhuma ação foi acionada.
- Advisors não associaram aviso novo a `financeiro_decidir_repasse`. Uso semanal:
  77%, teto 90%, crédito de reset intacto. Próxima fatia: diagnosticar criação de
  caixa + baixa de recebimento, ainda sem mutação financeira real.

## Estado verificado em 23/09/2026, 21:00 BRT

- Decisão 29 em prova. Diagnóstico agregado de produção: 368 lançamentos de caixa,
  16 ligados a recebimentos e 3 repasses pagos; não há recebimento/repasse divergente
  do lançamento vinculado nos casos verificados. Nenhum valor histórico foi alterado.
- Lacuna reproduzida no código: `settlePayout` fazia caixa e status em chamadas REST
  separadas e sem auditoria. A nova `financeiro_decidir_repasse` usa uma transação,
  trava o repasse e o caixa, preserva RLS por `SECURITY INVOKER`, é idempotente e
  grava uma auditoria somente quando o estado muda.
- Prova produtiva pré-migration executada com o papel `authenticated` dentro de
  `BEGIN/ROLLBACK`: reabrir, repetir, baixar e repetir preservaram a reconciliação e
  produziram exatamente duas auditorias transitórias. Nada permaneceu gravado.
- 1.168 testes, TypeScript, lint (0 erros; 9 avisos preexistentes) e build passaram.
  Próximo passo: commit/PR/CI/merge, aplicar a migration e repetir o aceite pós-deploy.

## Estado verificado em 23/09/2026, 20:47 BRT

- Decisão 28 entregue pela PR #264 no build produtivo
  `dab1a1c98e07e5e515694b8c18c9e009da7ac236`; o CI integral passou.
- A migração `portal_proprietario_futuro_fronteira` está aplicada. RLS permanece
  ativa e `anon`/`authenticated` não leem `public.proprietarios` nem
  `private.unidade_proprietarios` diretamente. O advisor registra a ausência de
  policy na tabela privada como bloqueio intencional; não surgiu nova exposição.
- O contrato futuro existe, mas não há rota, API, conta, convite, associação a
  `auth.users` ou policy de proprietário. Produção confirmou 3/3 produtos de
  terceiros com vínculo canônico, nenhum órfão e 12 unidades legadas sem dado
  privado que continuam sem inferência automática.
- Uso semanal: 77%; teto 90%; crédito de reset intacto. Próxima fatia: decisão 29,
  diagnóstico financeiro agregado e somente de leitura antes de qualquer edição.

## Estado verificado em 23/09/2026, 20:37 BRT

- Decisão 28 em prova sem portal especulativo. O contrato futuro registra a
  identidade canônica do proprietário, vínculo do imóvel, dados privados de
  unidade, não objetivos desta fase e o gate de identidade/consentimento/RLS.
- A migração `portal_proprietario_futuro_fronteira` somente torna reproduzível a
  contração já ativa: RLS nas duas tabelas de PII e nenhum grant direto para
  `public`, `anon` ou `authenticated`. Não cria tabela, função, policy, usuário,
  convite, rota ou tela de portal.
- Produção confirmou RLS e zero leitura direta para `anon`/`authenticated`;
  3/3 produtos de terceiros têm `proprietario_id`, sem vínculo órfão. Das 40
  unidades captadas, 28 têm dado privado e 12 permanecem legadas sem inferência.
- A migração passou em `BEGIN … ROLLBACK`; 40 testes focados passaram. Próximo
  passo: suíte integral, CI, publicação, migração idempotente e aceite final.

## Estado verificado em 23/09/2026, 20:32 BRT

- Decisão 27 entregue pela PR #263 no build produtivo
  `a3d08072d130d66f6929b372552628cec5d1113c`; o CI integral passou.
- A migração `produto_decisao_captacao_atomica` está aplicada. A RPC existe,
  `authenticated` pode executá-la, `anon` não e o trigger impede decisão direta.
  O aviso do advisor sobre `SECURITY DEFINER` é intencional: a função exige
  `auth.uid()`, usuário ativo e papel gerencial internamente; não houve alerta de
  performance referente à mudança.
- A prova pós-deploy com `ROLLBACK` bloqueou o corretor e a RPC antiga, aprovou e
  publicou uma única vez, repetiu sem nova auditoria, reprovou com motivo fora do
  site e repetiu com o mesmo ID. Depois: 4 pendentes, 0 reprovadas publicadas,
  29 aprovadas publicadas, 7 aprovadas offline e 0 auditorias sintéticas.
- A fila autenticada em produção carregou 6 requisições, mostrou 5 aprovações
  bloqueadas e as ações “Devolver com motivo”/“Aprovar”; o prompt obrigatório foi
  cancelado e nenhuma decisão real foi executada. Próxima fatia: decisão 28,
  preservar contrato e acesso de um portal futuro sem construí-lo.

## Estado verificado em 23/09/2026, 20:13 BRT

- Decisão 27 em prova. Aprovação e reprovação de captação usam a mesma RPC
  gerencial transacional; reprovação exige motivo, aprovação delega à publicação
  canônica e a repetição devolve a auditoria existente sem publicar novamente.
- Um trigger impede mudar a decisão diretamente. O ensaio com `ROLLBACK` confirmou
  que tanto um corretor quanto a RPC antiga não aprovam/reprovam uma captação
  pendente fora do novo caminho oficial.
- A prova gerencial aprovou e publicou uma vez, repetiu a aprovação sem nova
  auditoria, reprovou com motivo mantendo fora do site e repetiu a reprovação com
  o mesmo ID de auditoria. Após o rollback: 4 pendentes, 0 reprovadas publicadas,
  29 aprovadas publicadas, 7 aprovadas offline e 0 auditorias sintéticas.
- Os 36 testes focados e `git diff --check` passaram. Próximo passo: suíte integral,
  CI, publicação, migração aditiva e repetição do aceite em produção.

## Estado verificado em 23/09/2026, 19:50 BRT

- Decisão 26 entregue pela PR #262 no build produtivo
  `3866113eae6e27b4bab9842cc385952fd81159fb`. O CI #1118 concluiu testes,
  contratos de privacidade, TypeScript, lint e build.
- A migração `captacao_proprietario_atomica` está aplicada. As duas RPCs existem,
  `authenticated` pode executá-las e `anon` não. O aviso do advisor sobre
  `SECURITY DEFINER` é intencional: ambas validam `auth.uid()`, usuário ativo,
  captador e ownership internamente; não surgiu alerta de performance específico.
- A prova pós-deploy criou proprietário, imóvel e unidade dentro de transação,
  confirmou autoria, captador e vínculo privado, retomou a mesma captação sem
  acentos, recusou finalização sem foto e preservou o rascunho. O rollback passou
  e a consulta posterior confirmou zero resíduo sintético.
- O inventário legado permaneceu intacto: 40 unidades captadas, nenhuma sem
  captador e 12 sem vínculo privado de proprietário; todas as 12 estão aprovadas
  e 11 publicadas. A correção depende de identificação humana e não foi inferida.
- Próxima fatia: decisão 27, aprovação gerencial única antes da publicação e
  registro auditável da decisão. Decisão 20 continua bloqueada; identidade visual
  permanece por último.

## Estado verificado em 23/09/2026, 19:40 BRT

- Decisão 26 em prova local. `produto_captacao_criar_atomica` agora persiste
  condomínio, proprietário, imóvel, unidades, autoria e captador na mesma
  transação; `produto_captacao_finalizar_atomica` confirma foto e vínculos antes
  de retirar o rascunho. A API deixou de encadear gravações parciais.
- A identidade de duplicidade é normalizada sem depender de extensão, tolera
  acentos e serializa os critérios nome+bairro e endereço+número com dois locks
  transacionais em ordem estável. Uma repetição equivalente retoma somente o
  rascunho completo do mesmo captador.
- A migração e o fluxo sintético foram executados em produção dentro de
  `BEGIN … ROLLBACK`: proprietário privado, produto, unidade, autoria e captador
  foram confirmados; a repetição sem acentos retornou os mesmos IDs; finalizar
  sem foto foi recusado e o rascunho permaneceu intacto. Resíduo sintético: zero.
- Verificações locais: 1.157/1.157 testes, TypeScript, lint com 0 erros e os 9
  avisos preexistentes, build Vinext e `git diff --check` passaram.
- Diagnóstico produtivo somente de leitura encontrou 12 unidades captadas sem
  proprietário completo: 11 aprovadas e 10 publicadas. Esses vínculos exigem
  identificação humana; nenhum proprietário foi inferido nem nenhum registro
  legado foi alterado. Próximo passo: CI, publicação, migração aditiva e aceite.

## Estado verificado em 23/09/2026, 19:12 BRT

- Decisão 25 entregue pela PR #261 no build produtivo
  `77aa25eece289339f8c6812930a5ca7f681c5214`. O CI integral passou em testes,
  contratos de privacidade, TypeScript, lint e build.
- A Esteira exige o papel configurado da etapa, limita o avanço ao próximo marco
  do track e bloqueia enquanto blocos, documentos avulsos ou comprovações
  obrigatórias não estiverem aprovados. Verificação gerencial não ignora mais
  pendências e movimento em lote foi recusado.
- Harness sanitizado aceito primeiro em 390×844 e depois em 1440×900, com
  comprovação, bloqueio e seletor inteiro sem overflow. Em produção, a leitura
  autenticada carregou 22 processos e as etapas de proposta, documentos, contrato,
  assinatura, pagamento e registro; um processo concluído mostrou timeline,
  histórico e bloqueios coerentes. Nenhuma venda foi movida e nenhum pagamento,
  upload ou dado produtivo foi criado.
- Uso semanal: 75%; teto 90%; crédito de reset intacto. Próxima fatia: decisão 26,
  vínculo canônico entre imóvel e proprietário com autoria e privacidade. Decisão
  20 continua bloqueada pela infraestrutura de áudio ausente; identidade visual
  permanece por último.

## Estado verificado em 23/09/2026, 19:00 BRT

- Decisão 25 em prova local. A API da Esteira agora exige o papel configurado da
  etapa, limita o avanço à próxima etapa do track da venda e valida blocos,
  documentos avulsos obrigatórios e comprovações de marco aprovadas. A verificação
  gerencial deixou de ser atalho e só vale na etapa atual completa; movimento em
  lote foi recusado porque não valida cada venda.
- A interface só oferece etapas anteriores, a atual e o próximo avanço, mostra a
  “Comprovação da etapa” configurada e permite anexar/remover apenas no marco atual.
  No harness sanitizado, mobile 390×844 e desktop 1440×900 mostraram a minuta
  pendente, o bloqueio e o seletor inteiro sem overflow. Nenhum pagamento, upload
  ou dado produtivo foi criado.
- Gates locais após a última correção: 29 contratos dirigidos, TypeScript e
  `git diff --check` passaram. A bateria completa de 810 testes, lint sem erros
  (9 avisos preexistentes) e build Vinext já havia passado antes do reforço final
  de autorização; CI fará a confirmação integral. Falta commit, PR, CI, merge,
  `/api/build` e aceite produtivo somente de leitura.
- Uso semanal: 75%; teto 90%; crédito de reset intacto. Depois da publicação,
  avançar na decisão 26. A decisão 20 continua bloqueada pela infraestrutura de
  áudio ausente; identidade visual permanece por último.

## Estado verificado em 23/09/2026, 18:22 BRT

- Decisão 24 entregue no build produtivo `27502c03aa223e635b01a725db02d8286d7ef657`:
  PR #259, migration `metricas_feedback_eventos_confirmados` e `/api/build`
  confirmados. A RPC retorna 74 eventos confirmados, 5 feedbacks estruturados e
  69 legados; mobile 390×844 e desktop 1440×900 mostram recorte, base 5/74 e
  frações absolutas sem overflow.
- O saldo externo de IA voltou. O teste mínimo sanitizado do Laboratório respondeu
  `OK` sem ferramenta nem dado real. Em seguida, 122 contratos dirigidos de Sara,
  automações e Meu Dia passaram.
- Prova produtiva sintética 1: a Sara real usou `gpt-5.6-luna`, evidência literal,
  temperatura e qualidade; duas aplicações explícitas levaram o card de versão 1
  a 3. A segunda mensagem pediu retorno em 30 minutos e produziu
  `RETORNO_PROGRAMADO`/`RETOMAR_NO_COMBINADO`, prazo no mesmo dia e dentro da
  janela de duas horas do Meu Dia. Houve um checkpoint pendente e o anterior foi
  cancelado; nenhuma mensagem ou notificação foi gerada.
- Prova produtiva sintética 2: o enfileirador recebeu a mesma mensagem duas vezes
  e registrou uma execução e uma duplicata, sem segunda fila. Após uma saída
  sintética do corretor, o dispatcher reavaliou, aplicou como `mantida`, incrementou
  a versão e renovou um único checkpoint, sem a IA executar ação humana.
- As duas fixtures foram removidas por IDs e marcadores exatos. Consultas finais
  retornaram zero para leads, cards, mensagens, conversas, análises, execuções de
  IA, filas, eventos, notificações e logs sintéticos. Decisões 13–18 estão
  entregues; a decisão 20 continua bloqueada somente pela infraestrutura de áudio
  ausente, não mais por crédito.
- Uso semanal: 75%; teto 90%; crédito de reset intacto. Próxima fatia: decisão 25,
  sem criar pagamento artificial. Identidade visual permanece por último.

## Estado verificado em 23/09/2026, 17:46 BRT

- Decisão 23 entregue no build produtivo `bea893a`: os 37 cards pós-visita
  deixaram “Definir o próximo avanço”; 4 ações comprovadas foram recuperadas e
  33 históricos passaram a pedir registro humano. Mobile 390×844 e desktop
  foram aceitos sem overflow, e novos resultados preservam a frase exata.
- Decisão 24 reproduzida: o placar de qualidade escondia o recorte de 90 dias e
  o denominador e consultava o estado mutável da visita. Em produção existem
  74 resultados com evento confirmado no recorte, 5 estruturados e 69 legados;
  os 5 estruturados têm evento único e autoria de corretor confirmada.
- A correção preparada deduplica o último evento confirmado por visita, mede o
  tempo a partir desse evento e expõe período, fonte, total confirmado, base
  avaliada e a fração absoluta no prazo. O ensaio produtivo com `ROLLBACK`
  retornou 74/5/69 e a soma por corretor fechou nos 5 avaliados; nada persistiu.
- O painel real passou no harness em 390×844 e 1440×900: período, base 14/14 e
  frações 7/8 e 4/6 ficaram visíveis sem overflow. Gates verdes: 1.151 testes,
  TypeScript, lint sem erros (9 avisos preexistentes) e build Vinext completo.
  Falta commit, PR, CI, migration definitiva, build e aceite produtivos.
- Próxima fatia: publicar a decisão 24 e depois iniciar a decisão 25. Áudio e
  Sara continuam bloqueados pelo saldo externo; identidade visual fica no fim.

## Estado verificado em 23/09/2026, 17:19 BRT

- Decisão 23 reproduzida: os 1.136 cards ativos têm etapa, momento, dono, ação e
  prazo, porém 37 cards em `ACOMPANHAMENTO_POS_VISITA` mostram a categoria ambígua
  “Definir o próximo avanço”.
- Somente 4 desses 37 têm `FEEDBACK_VISITA_V1` com próxima ação extraível. A
  migration preparada recupera exatamente essas 4; os 33 históricos sem fonte
  passam a “Registrar a próxima ação pós-visita”, sem inferência. Novos resultados
  gravam no card a frase exata informada e a repetem no payload auditável.
- A migration inteira passou em produção dentro de transação revertida: categoria
  antiga zerou, 4 ações foram recuperadas, 37 auditorias nasceram e um feedback
  novo persistiu a ação exata. Rollback restaurou função, cards e auditorias e não
  deixou visita artificial.
- Gates verdes: 1.148 testes, TypeScript, lint sem erros (9 avisos preexistentes) e
  build Vinext completo. Falta commit, PR, CI, migration definitiva, confirmação da
  build e aceite visual mobile→desktop.
- Uso semanal: 73%; teto 90%; crédito de reset intacto. O áudio e a Sara seguem
  bloqueados pelo saldo externo; identidade visual continua reservada para o fim.

## Estado verificado em 23/09/2026, 17:07 BRT

- Decisão 21 entregue no build produtivo `607766a`: a prova transacional obteve
  nota 10/10, persistiu acompanhantes, alternativas/produtos, objeções, intenção e
  próxima ação com autoria; visita canônica, espelho, evento, auditoria e prazo de
  24 h passaram. O rollback não deixou dados artificiais.
- O formulário real foi renderizado com os estilos publicados em Chrome, 390×844
  e desktop: todos os campos ficaram acessíveis, sem overflow horizontal; após o
  preenchimento a nota foi 10/10 e Salvar resultado ficou habilitado. Nada foi
  enviado. O controle de áudio permaneceu oculto/fail-closed.
- Decisão 22 entregue: o reconciliador criou exatamente um aviso por público
  (corretor e gestão), ambos apareceram nas respectivas RPCs e a segunda execução
  preservou os IDs. Gestão não pôde responder pelo corretor; feedback inválido não
  encerrou a cobrança; feedback válido do dono resolveu os dois avisos. Push e
  WhatsApp permaneceram desligados. Rollback confirmado.
- Próxima fatia: decisão 23, definição explícita de estado, responsável e motivo
  da próxima ação em cada card de acompanhamento.
- Uso semanal: 73%; teto 90%; crédito de reset intacto. O áudio e a Sara seguem
  bloqueados pelo saldo externo; identidade visual continua reservada para o fim.

## Estado verificado em 23/09/2026, 16:54 BRT

- Decisão 21 passou na prova produtiva transacional com `ROLLBACK`: uma visita
  temporária recebeu feedback realizado com nota 10/10, autoria do corretor,
  acompanhantes, alternativas/produtos, objeções, intenção e próxima ação no
  envelope `FEEDBACK_VISITA_V1`. A visita canônica e o espelho da Agenda ficaram
  alinhados; evento, auditoria e prazo de 24 h no card foram confirmados.
- Consulta posterior confirmou ausência da visita, espelho, evento e auditoria
  artificiais. Falta somente aceitar visualmente o formulário publicado antes de
  marcar a decisão 21 como entregue.
- Decisão 20 está objetivamente bloqueada no áudio: produção não possui tabela,
  bucket privado, RPC, Edge Function, cron ou segredos de transcrição, e a API de
  IA está sem saldo. O controle continua oculto/fail-closed; não aplicar o rascunho
  enquanto ele puder aceitar uploads que ficariam sem processamento.
- Próxima fatia: concluir o aceite visual da decisão 21 e provar a cobrança
  persistente gerente→corretor da decisão 22 sem alterar visitas reais.
- Uso semanal: 73%; teto 90%; crédito de reset intacto. Identidade visual continua
  reservada para o fim e nova conversa.

## Estado verificado em 23/09/2026, 16:46 BRT

- PR #257 integrada e publicada no commit
  `607766a4228f571bc149b2d7088b1f1e86539e59`; CI e `/api/build` confirmaram.
  A migração `visita_exige_card_original` está aplicada.
- A falha reproduzida permitia combinar o ID de uma visita com outro card do
  mesmo corretor: a RPC declarava sucesso e avançava o card errado embora a visita
  não mudasse. A prova foi revertida e não deixou eventos nem auditoria artificiais.
- A guarda publicada exige que a visita pertença ao card informado, retorna
  `visita_incompativel` e preserva o card. `anon` continua sem execução; o usuário
  autenticado só opera a própria carteira pela guarda já existente.
- Decisão 19 entregue: prova integral com `ROLLBACK` agendou, reagendou e cancelou,
  confirmando visita canônica, espelho da Agenda, estado do CRM, três eventos e
  três auditorias. Nenhum registro de prova persistiu.
- Produção em 390×844 e desktop carregou a Agenda sem alerta; criação de visita,
  campos de horário/local e opção de gerente ficaram acessíveis. Próxima fatia:
  decisão 20, feedback por texto e áudio sem fabricar visita ou mídia.
- Uso semanal: 73%; teto 90%; crédito de reset intacto. Sara segue bloqueada por
  saldo externo. Identidade visual continua reservada para o fim e nova conversa.

## Estado verificado em 23/09/2026, 16:26 BRT

- PRs #255 e #256 integradas e publicadas no commit
  `772710a61dfe5d4cbd45bef2369729ad6cbe7548`; `/api/build` confirmou o hash.
- Decisão 10 entregue: produção desktop e viewport 390×844 carregaram 66 cards
  visíveis com “Responsável”, além de etapa, momento, temperatura, próxima ação e
  prazo. A ausência de leitura continua aparecendo honestamente como “Sem leitura”.
- Decisão 12 entregue: a migração
  `automacoes_exigem_pipeline_etapa_validos` está aplicada. Apenas `service_role`
  executa o motor; funil/etapa ausentes ou incompatíveis geram erro explícito antes
  de criar lead. A prova transacional foi revertida e não deixou dados artificiais.
- A Central de Automações e o construtor publicado carregaram sem alerta. Uma ação
  foi adicionada somente no estado local de um rascunho para inspeção; a navegação
  descartou a alteração sem salvar ou publicar.
- Branch atual `codex/execucao-30-decisoes-07`, limpa e baseada no `origin/main`
  publicado. Próxima fatia: decisão 19, começando por reproduzir uma falha real no
  ciclo agendar/reagendar/cancelar sem alterar visitas de clientes como teste.
- Uso semanal: 73%; teto 90%; crédito de reset intacto. Sara segue bloqueada por
  saldo externo. Identidade visual continua reservada para o fim e nova conversa.

## Estado verificado em 23/09/2026, 16:11 BRT

- PRs #253 e #254 integradas e publicadas no commit
  `b0ade7d3e0de5cb586d2bd6bced4d5aacd66f0f2`; CI passou e `/api/build` confirmou.
  A migração `transferencias_auditaveis` está aplicada. `anon` não executa as RPCs,
  a tabela de auditoria não tem acesso direto e continua sem linhas artificiais.
- Mobile e desktop abriram o mesmo modal publicado com tipo, motivo, fit e aviso
  de preservação. A prova transacional anterior confirmou aceite exclusivo do
  destino e alinhamento negócio/lead/card sem alterar etapa, momento ou visitas.
  As 101 divergências lead/negócio e 18 card/negócio permanecem intactas para
  triagem humana.
- PR #255 integrada no commit `9638493ea2430024dbf207a77e4867c094fda810`;
  CI verde. Ela torna o responsável explícito nos cards para todos os perfis.
  O deploy ainda não havia substituído `b0ade7d` na última consulta.
- Produção tem 1.136 cards ativos: todos têm dono, etapa, momento, próxima ação e
  prazo; 613 sem leitura de temperatura aparecem honestamente como “Aguardando
  leitura”. Harness sanitizado da PR #255 passou em 390×844 e 1440×900.
- Decisão 11: a tela gerencial publicada oferece etapas, momentos e regras. Uma
  prova com `ROLLBACK` recusou perfil comum, permitiu gestão, criou etapa e momento,
  gravou duas auditorias e preservou todos os cards; nenhum registro de prova ficou.
- Branch atual `codex/execucao-30-decisoes-06`: a decisão 12 corrige o runtime para
  recusar funil/etapa ausentes ou incompatíveis antes de criar/mover negócio. 48
  testes e ensaio real com `ROLLBACK` passaram; a falha foi explícita e nenhum lead
  foi criado. Falta build, PR, CI, migração e aceite em produção.
- Uso semanal: 72%; teto 90%; crédito de reset intacto. Sara segue bloqueada por
  saldo externo. Identidade visual continua reservada para o fim e nova conversa.

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
