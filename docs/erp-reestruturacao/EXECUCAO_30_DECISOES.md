# Execução funcional das 30 decisões

Este é o checklist rastreável reconstruído das respostas do usuário na tarefa
`E1 — ERP Remap e Reestruturação` e das diretrizes de execução. O documento
original com as 30 perguntas não foi localizado no repositório nem no checkpoint;
por isso nenhum requisito além das respostas recuperadas foi acrescentado.

Estados permitidos: `não iniciado`, `em prova`, `bloqueado`, `entregue`.
`Entregue` exige aceite observável no mobile e desktop, persistência, autorização,
checks do projeto, publicação e confirmação da build.

| # | decisão do usuário | aceite funcional mínimo | estado | evidência |
|---:|---|---|---|---|
| 1 | Entrada Meta/site passa por Make/webhook e chega ao ERP. | Um evento real autorizado é aceito uma vez e aparece na automação correta. | em prova | Em 23/09, a automação 73 registrou webhook real recente; falta provar também as demais origens. |
| 2 | A entrada normaliza campos e evita duplicatas. | Repetição do mesmo identificador não cria segundo lead/negócio/card. | não iniciado | — |
| 3 | Automações comerciais são configuráveis e publicadas com versão. | Rascunho não executa; publicação válida executa exatamente o mapa publicado. | não iniciado | — |
| 4 | A distribuição escolhe corretor elegível e mantém um único dono. | Lead, negócio e card ficam com o mesmo corretor elegível. | em prova | O evento real mais recente da automação 73 terminou com dono consistente nas três entidades. |
| 5 | A primeira abordagem sai somente pela instância do corretor dono. | Aceite do provedor não conta como envio; `messages.sent` confirma e entrega é rastreada. | entregue | PR #251 publicada no hash `b560fff`; mobile e desktop mostram “Aceites D-API”, e o evento real mais recente foi aceito, confirmado e entregue pela instância do dono. |
| 6 | A proteção do dono só vale em visita ou negociação. | Fora desses estados a redistribuição autorizada não é bloqueada por histórico antigo. | entregue | PR #252 publicada no hash `5e1555c`: a regra nova preserva o único estado ativo e libera cinco históricos encerrados; migração, permissões, mobile 390×844 e desktop 1440×900 foram aceitos em produção. |
| 7 | O corretor pode transferir voluntariamente um cliente. | Transferência explícita muda o dono em todas as entidades e deixa auditoria. | em prova | PRs #253/#254 publicadas no hash `b0ade7d`; negócio próprio, aceite do destino, auditoria e alinhamento negócio/lead/card foram provados em transação. Falta uma transferência operacional real autorizada. |
| 8 | A gestão pode transferir clientes. | Perfil autorizado transfere; corretor comum não usa a função gerencial. | em prova | RPC gerencial publicada exige grupo `gestao` e escopo sobre o dono atual; funções legadas passam pela mesma guarda. Falta uma transferência operacional por gestor. |
| 9 | Transferência por fit comercial é permitida e auditada. | Motivo/fit ficam registrados sem quebrar continuidade de visita/negociação. | em prova | Produção mobile e desktop exige motivo/fit e avisa que preserva etapa, momento, negociação e visitas; a prova com rollback confirmou o contrato. Falta operação real autorizada. |
| 10 | CRM/Kanban mostra carteira clara e acionável. | Card exibe dono, etapa, momento, temperatura, próxima ação e prazo coerentes. | entregue | PR #255 publicada no hash `772710a`; 1.136 cards ativos têm dono, etapa, momento, ação e prazo. Produção desktop e 390×844 exibiu “Responsável” em todos os 66 cards carregados, e ausência de temperatura permanece honesta como “Sem leitura”. |
| 11 | Pipelines e etapas são configuráveis. | Gestão altera configuração válida sem editar código nem corromper cards existentes. | em prova | Tela gerencial publicada expõe etapas, momentos e regras. Prova transacional recusou perfil comum, criou etapa/momento com duas auditorias, preservou 1.136 cards e reverteu tudo. Falta uma alteração operacional real autorizada. |
| 12 | Pipelines se conectam às automações. | Ação de criar/mover negócio usa pipeline/etapa publicados e falha de modo explícito. | entregue | PR #256 e migração `automacoes_exigem_pipeline_etapa_validos` publicadas no hash `772710a`. Runtime rejeitou funil/etapa ausentes ou incompatíveis com erro explícito e sem criar lead; ensaio real com `ROLLBACK`, permissões e construtor publicado passaram. |
| 13 | Sara retorna o momento do cliente. | Resultado persistido aponta evidência real e não regride estado protegido. | bloqueado | Saldo externo da API de IA está esgotado; não pagar nem trocar credencial. |
| 14 | Sara retorna a etapa operacional. | Etapa persistida segue whitelist e autorização do CRM. | bloqueado | Mesmo bloqueio externo do item 13. |
| 15 | Sara retorna a próxima ação. | Próxima ação e prazo chegam ao card e ao Meu Dia no momento correto. | bloqueado | Mesmo bloqueio externo do item 13. |
| 16 | Sara retorna temperatura e qualidade. | Temperatura e nota/resumo de qualidade usam evidência e exibem ausência honestamente. | bloqueado | Mesmo bloqueio externo do item 13. |
| 17 | Gatilhos oportunos atualizam Sara e Meu Dia. | Mensagem/evento agenda uma única reavaliação; resultado atualiza cobrança sem duplicar fila. | bloqueado | Fila foi recuperada; novas análises ainda dependem do saldo externo. |
| 18 | O corretor executa e a IA reavalia depois. | Ação humana confirmada atualiza o CRM antes de nova análise, sem IA executar pelo corretor. | bloqueado | Dependência externa apenas para a etapa de reavaliação. |
| 19 | Visita permite agendar, reagendar e cancelar. | Cada ação persiste, respeita conflito/permissão e atualiza Agenda/CRM. | entregue | PR #257 publicada no hash `607766a`: edição exige o card original. Prova integral com `ROLLBACK` sincronizou agendamento, reagendamento e cancelamento entre visita canônica, Agenda e CRM, com autorização, eventos e auditoria. Produção 390×844 e desktop aceita sem alerta. |
| 20 | Feedback de visita aceita texto e áudio. | Ambos persistem com autoria, visita e acesso corretos. | bloqueado | Texto publicado e provado com autoria. Áudio permanece fail-closed: tabela, bucket privado, RPC, função de transcrição, cron e segredos ainda não existem em produção; o saldo externo da IA está esgotado. Habilitar o rascunho agora aceitaria arquivos que não seriam processados. |
| 21 | Feedback registra acompanhantes, produtos, objeções, intenção e próxima ação. | Campos persistem e a próxima ação atualiza o card sem inventar dados. | entregue | Produção no hash `607766a`: prova com `ROLLBACK` obteve nota 10/10, persistiu o envelope versionado com acompanhantes, alternativas/produtos, objeções e intenção, preservou autoria, sincronizou a Agenda e avançou o card para acompanhamento em 24 h. O formulário real passou em 390×844 e desktop sem overflow; nenhum dado artificial permaneceu. |
| 22 | Gestão cobra persistentemente o corretor por feedback/pendência. | Cobrança nasce, aparece para ambos, persiste e encerra somente após resultado válido. | entregue | Produção no hash `607766a`: a prova transacional criou avisos para corretor e gestão, confirmou visibilidade pelas RPCs, idempotência, bloqueio de resposta gerencial e de feedback inválido, e resolveu ambos somente após resultado válido. Push/WhatsApp ficaram desligados, o rollback foi confirmado e a fila publicada já havia sido aceita em mobile e desktop. |
| 23 | Cada cliente tem definição explícita no acompanhamento. | Card informa estado, responsável e motivo da próxima ação sem categoria ambígua. | em prova | Todos os 1.136 cards ativos têm estado, dono e prazo, mas 37 pós-visita usavam “Definir o próximo avanço”. A correção preparada recupera 4 ações do feedback estruturado, marca 33 históricos como “Registrar a próxima ação pós-visita” sem inferência e preserva a frase exata nos novos resultados. Prova produtiva com rollback, 1.148 testes, TypeScript, lint e build passaram; falta publicar e aceitar mobile/desktop. |
| 24 | Métricas de desempenho refletem trabalho real. | Indicadores usam eventos confirmados, recorte e denominador visíveis. | não iniciado | — |
| 25 | Esteira cobre proposta, documentos, contrato, assinatura e pagamento. | Transições autorizadas persistem artefatos/estado e não pulam pré-condições. | não iniciado | — |
| 26 | Captação de imóvel fica vinculada ao proprietário. | Imóvel e proprietário têm vínculo canônico, autoria e privacidade por perfil. | não iniciado | — |
| 27 | Gestor aprova a captação antes da publicação no site. | Reprovação não publica; aprovação publica uma vez e registra decisão. | não iniciado | — |
| 28 | Portal do proprietário fica preparado como fase futura. | Não criar portal especulativo; preservar contrato de dados e fronteira de acesso. | não iniciado | — |
| 29 | Financeiro cobre caixa, despesas, anúncios, impostos, comissões, aportes, sócios e painel do corretor. | Valores reconciliam, mutações são atômicas/auditadas e cada perfil vê somente seu escopo. | em prova | Baixas e auditoria foram endurecidas; reconciliação humana de dados antigos continua pendente. |
| 30 | Apps do corretor/gerente e visão CEO cobrem as ações do papel. | Corretor: Meu Dia, WhatsApp, busca, visitas e feedback. Gestor: agenda/bloqueio, pendências, cobranças e Sara. CEO: visão operacional autorizada. | em prova | Rotas móveis existem; aceite item a item continua pendente. |

## Restrições transversais

- Identidade visual e redesign ficam por último, após nova conversa com o usuário.
- Mobile é validado antes do desktop em cada fatia.
- Privacidade, autorização, estados de loading/vazio/erro e persistência fazem parte
  do aceite de todos os itens.
- Não criar dados fictícios de clientes, fazer pagamentos, excluir registros,
  rotacionar credenciais, migrar para S3 ou realizar cutover.
- Não marcar uma decisão como entregue por existência de rota, botão ou teste
  estrutural.

## Próxima fatia funcional

Publicar e aceitar a correção da decisão 23: a próxima ação do feedback deve
aparecer literalmente no card; históricos sem fonte devem pedir registro humano,
sem inventar conteúdo. Depois avançar na decisão 24. A decisão 20 permanece
bloqueada até existir infraestrutura de áudio capaz de processar o arquivo de ponta
a ponta. Não reconciliar automaticamente as 101 divergências legadas entre
lead/negócio nem as 18 entre card/negócio: elas precisam de triagem humana.
