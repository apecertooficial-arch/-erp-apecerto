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
| 5 | A primeira abordagem sai somente pela instância do corretor dono. | Aceite do provedor não conta como envio; `messages.sent` confirma e entrega é rastreada. | em prova | O evento real mais recente foi aceito, confirmado e entregue; a correção local passa a nomear o aceite inicial como “Aceites D-API”, ainda pendente de publicação e aceite em produção. |
| 6 | A proteção do dono só vale em visita ou negociação. | Fora desses estados a redistribuição autorizada não é bloqueada por histórico antigo. | não iniciado | — |
| 7 | O corretor pode transferir voluntariamente um cliente. | Transferência explícita muda o dono em todas as entidades e deixa auditoria. | não iniciado | — |
| 8 | A gestão pode transferir clientes. | Perfil autorizado transfere; corretor comum não usa a função gerencial. | não iniciado | — |
| 9 | Transferência por fit comercial é permitida e auditada. | Motivo/fit ficam registrados sem quebrar continuidade de visita/negociação. | não iniciado | — |
| 10 | CRM/Kanban mostra carteira clara e acionável. | Card exibe dono, etapa, momento, temperatura, próxima ação e prazo coerentes. | em prova | O card do evento real mais recente está ativo na carteira; aceite integral ainda pendente. |
| 11 | Pipelines e etapas são configuráveis. | Gestão altera configuração válida sem editar código nem corromper cards existentes. | não iniciado | — |
| 12 | Pipelines se conectam às automações. | Ação de criar/mover negócio usa pipeline/etapa publicados e falha de modo explícito. | não iniciado | — |
| 13 | Sara retorna o momento do cliente. | Resultado persistido aponta evidência real e não regride estado protegido. | bloqueado | Saldo externo da API de IA está esgotado; não pagar nem trocar credencial. |
| 14 | Sara retorna a etapa operacional. | Etapa persistida segue whitelist e autorização do CRM. | bloqueado | Mesmo bloqueio externo do item 13. |
| 15 | Sara retorna a próxima ação. | Próxima ação e prazo chegam ao card e ao Meu Dia no momento correto. | bloqueado | Mesmo bloqueio externo do item 13. |
| 16 | Sara retorna temperatura e qualidade. | Temperatura e nota/resumo de qualidade usam evidência e exibem ausência honestamente. | bloqueado | Mesmo bloqueio externo do item 13. |
| 17 | Gatilhos oportunos atualizam Sara e Meu Dia. | Mensagem/evento agenda uma única reavaliação; resultado atualiza cobrança sem duplicar fila. | bloqueado | Fila foi recuperada; novas análises ainda dependem do saldo externo. |
| 18 | O corretor executa e a IA reavalia depois. | Ação humana confirmada atualiza o CRM antes de nova análise, sem IA executar pelo corretor. | bloqueado | Dependência externa apenas para a etapa de reavaliação. |
| 19 | Visita permite agendar, reagendar e cancelar. | Cada ação persiste, respeita conflito/permissão e atualiza Agenda/CRM. | em prova | Agendamento móvel e local canônico já publicados; ciclo integral ainda não aceito. |
| 20 | Feedback de visita aceita texto e áudio. | Ambos persistem com autoria, visita e acesso corretos. | em prova | Texto/cobrança publicados; áudio ainda exige aceite funcional completo. |
| 21 | Feedback registra acompanhantes, produtos, objeções, intenção e próxima ação. | Campos persistem e a próxima ação atualiza o card sem inventar dados. | em prova | Contrato estruturado existe; falta teste real autorizado ponta a ponta. |
| 22 | Gestão cobra persistentemente o corretor por feedback/pendência. | Cobrança nasce, aparece para ambos, persiste e encerra somente após resultado válido. | em prova | Migração e agenda móvel publicadas; falta aceite integral gerente→corretor. |
| 23 | Cada cliente tem definição explícita no acompanhamento. | Card informa estado, responsável e motivo da próxima ação sem categoria ambígua. | não iniciado | — |
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

## Correção pronta para publicação

O monitor da automação classifica a resposta HTTP “aceita pela D-API; aguardando
confirmação `messages.sent`” como sucesso. O estado canônico em
`motor_mensagem_partes` evolui corretamente para `entregue`, mas a linha inicial
de `motor_execucoes` permanece `ok`. A correção local torna o monitor honesto sem
alterar o envio nem expor dados de clientes; falta publicar e validar no mobile e
no desktop.
