# Funil 2.0 — contrato da operação unificada

Este documento é a fonte permanente do escopo aprovado para transformar o
Funil 2.0 no único funil operacional da ApêCerto. Uma entrega só é considerada
concluída quando o item correspondente estiver implementado, testado e validado
no ERP em produção.

## 1. Princípio central

- O Funil 2.0 passa a ser o único funil da operação.
- O funil classifica etapa e momento.
- O Meu Dia executa as obrigações ordenadas por prazo.
- A Sara lê a conversa confirmada pelo D-API, fiscaliza a conduta e determina a
  próxima ação dentro de um vocabulário oficial.
- O corretor envia a mensagem pelo WhatsApp do próprio celular. O ERP nunca
  considera o clique como envio: somente o outbound confirmado pelo D-API conta.
- Nenhum lead pode ficar parado ou sem próxima ação.

## 2. Pesca e entrada de lead

- A pesca possui somente: seleção do lead e botão **Pescar lead**.
- O lead pescado entra em **Novo · Primeira abordagem**, com prazo de 5 minutos.
- A interface não pergunta qual cópia substituir.
- O histórico anterior à pesca não pode aparecer no Funil 2.0 nem no aplicativo.
- A conversa do Funil 2.0 começa no instante da pesca. O original permanece
  intacto e auditável, porém os eventos anteriores ficam fora do atendimento novo.
- O lead vindo da roleta segue o mesmo contrato do lead pescado.

## 3. Funil, card e ficha

- Etapa, momento e próxima ação aparecem em blocos coloridos e separados.
- O card deve responder imediatamente:
  1. em qual etapa o lead está;
  2. qual é o momento atual;
  3. o que fazer agora;
  4. quanto tempo resta ou há quanto tempo está atrasado.
- A ficha mantém ações simples e explícitas: WhatsApp, Chat, Atualizar momento,
  Agendar visita, Lançar negociação/venda e Histórico operacional.
- Menus suspensos são usados para atualização de etapa/momento, sem textos ou
  controles técnicos expostos ao corretor.

## 4. Todos os Leads

- Reutilizar a estrutura e a identidade visual da tela **Leads do CRM 3.0**.
- Exibir nome, etapa, momento, próxima ação, prazo, corretor, origem e ações.
- Manter busca e filtros por etapa, momento, atraso, corretor e origem.
- Ações diretas: Chat e Abrir atendimento.

## 5. Esteira de Vendas

- Reutilizar a estrutura funcional e visual da esteira do funil antigo.
- Preservar etapas, cartões, responsáveis, SLA, valores, documentos e filtros.
- A negociação nasce a partir do lead do Funil 2.0 e mantém vínculo único com
  negócio, cliente, imóvel, corretor e histórico.
- Início e Financeiro devem usar a mesma fonte da Esteira do Funil 2.0 para
  indicadores, atrasos, valores, documentos e vendas.

## 6. Visitas

- A visita é um compromisso ligado ao mesmo lead, nunca uma cópia.
- Estados: agendada, realizada, cancelada, reagendada e não compareceu.
- Confirmação nasce 24h antes; se marcada com menos de 24h, vence imediatamente.
- Feedback é obrigatório até 2h depois do término, ou até 10h do próximo dia útil
  quando a visita terminar depois das 18h30.
- Sem feedback vencido, o corretor continua apto; com feedback vencido, não recebe
  nem pesca novos leads até atualizar.

## 7. Distribuição e roleta sem abordagem automática

- O módulo deixa de representar disparo automático e passa a administrar aptidão
  e distribuição manual.
- A primeira abordagem nunca é enviada automaticamente.
- Requisitos para receber ou pescar lead:
  - presença no escritório confirmada nos últimos 15 minutos;
  - instância D-API conectada;
  - nenhuma visita com feedback vencido;
  - nenhuma primeira abordagem ou obrigação crítica vencida;
  - nenhuma suspensão ativa por conduta.
- Horários:
  - antes de 9h30: distribui entre os presentes aptos;
  - 9h30–18h30: roleta oficial igualitária entre presentes aptos;
  - após 18h30: enquanto houver alguém no escritório, somente os presentes recebem;
  - depois que o último sair: os leads ficam disponíveis para os corretores que
    compareceram naquele dia chamarem quando quiserem; se não chamarem, ficam para
    o dia seguinte. Não existe aceite ou recusa do lead.
- Após a atribuição no horário oficial, a primeira mensagem deve ser confirmada
  pelo D-API em até 5 minutos; vencido o prazo, o lead pode ser redistribuído.

## 8. Aplicativo

- O aplicativo é o motor móvel da operação e usa exatamente as mesmas etapas,
  momentos, ações, prazos, notificações e permissões do ERP.
- Notifica entrada de lead, prazo de 5 minutos, ação próxima do vencimento, ação
  vencida, nova resposta, visita próxima e feedback de visita vencido.
- O botão abre o WhatsApp do celular; o D-API confirma a mensagem e alimenta a Sara.
- O app não mantém uma taxonomia ou regra paralela.

## 9. Central de atenção e notificações

- O sino deve apresentar uma central elaborada, acionável e agrupada por urgência:
  - agir agora;
  - vencem em até 2 horas;
  - para hoje;
  - novas respostas;
  - novos leads;
  - visitas próximas;
  - feedbacks de visita vencidos;
  - falhas de sincronização/D-API.
- Cada aviso deve mostrar cliente, etapa, momento, ação, prazo e botão para abrir o
  atendimento correto.
- Deve haver deduplicação, leitura individual, marcar todas como lidas e deep-link.

## 10. Performance e consequências

- Performance deve medir a conduta controlável, não apenas venda.
- Índice de execução:
  - 30% primeira abordagem em até 5 minutos;
  - 30% ações dos momentos concluídas no prazo;
  - 20% feedback de visitas no prazo;
  - 10% presença e instância conectada;
  - 10% coerência do momento com a conversa, validada pela Sara.
- Resultado comercial separado: resposta, visita por respondido, visita realizada,
  proposta por visita, venda por proposta/lead e tempos entre marcos.
- Suspensão por disciplina, não por falta de venda:
  - primeira reincidência: 24h sem novos leads;
  - segunda em 30 dias: 48h;
  - terceira: 72h e revisão do gestor.
- Carteira atual permanece acessível durante a suspensão.

## 11. Configurações

- Centralizar e persistir:
  - etapas, momentos, ações e seus prazos;
  - cadência sem resposta;
  - horários da roleta e presença;
  - SLA da primeira abordagem e redistribuição;
  - prazos e bloqueios de feedback de visita;
  - pesos de performance e progressão de suspensão;
  - notificações e lembretes;
  - permissões e rollout.
- Alterações devem ser auditadas, validadas e aplicadas sem criar vocabulário livre
  para a Sara ou para o corretor.

## 12. Permanência, segurança e entrega

- Código, migrations, rollbacks, testes e documentação ficam versionados no Git.
- Nenhuma regra pode existir somente no painel ou apenas no banco de produção.
- Todas as tabelas expostas usam RLS; funções privilegiadas têm autorização interna,
  `search_path` seguro e grants mínimos.
- O CRM antigo permanece intacto até a migração final autorizada.
- Antes da migração completa, o Funil 2.0 continua usando somente as cópias de teste.
- Cada fase exige CI verde, deploy do SHA mergeado, migration versionada e smoke sem
  executar ações comerciais reais.

## 13. Critério de aceite global

O corretor deve abrir o ERP ou o aplicativo e, sem interpretar textos longos, saber
imediatamente **quem atender, em qual etapa e momento, qual ação executar e quanto
tempo resta**. O gestor deve enxergar quem cumpre a conduta, quem perde prazos, onde
os leads param e quais comportamentos produzem respostas, visitas, propostas e vendas.
