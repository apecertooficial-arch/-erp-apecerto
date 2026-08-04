# Funil 2.0 — mapa de implementação e transição

Este mapa impede que a operação seja reconstruída por interpretações diferentes.
O contrato funcional completo está em `00-ESCOPO-OPERACAO-UNIFICADA.md`.

## Entregue no laboratório permanente

| Frente | Implementação versionada |
| --- | --- |
| Funil | Quatro etapas, momentos configuráveis, ação e prazo explícitos |
| Meu Dia | Obrigações em ordem de vencimento, etapa, momento, ação e contador |
| Card e ficha | Blocos coloridos, Chat, WhatsApp, visita, negociação e atualização de momento |
| Sara | Resumo e reavaliação dentro do vocabulário oficial, sem envio automático |
| D-API | Clique não conclui; a confirmação real é a evidência da mensagem |
| Pesca | Um botão, entrada em Novo, prazo de cinco minutos e substituição técnica invisível |
| Privacidade da pesca | A conversa visível começa no instante da entrada no Funil 2.0 |
| Todos os Leads | Lista operacional com filtros de etapa e as mesmas três informações centrais |
| Visitas | Pipe ligado ao mesmo lead, com atualização do estado do compromisso |
| Vendas | Kanban comercial ligado ao lead e visão gerencial de volume e valor |
| Avisos | Central acionável com contagens e os atendimentos prioritários |
| Performance | Execução e resultado comercial separados, com pesos persistidos |
| Configurações | Etapas, momentos, prazos, roleta, avisos, visitas, pesos e suspensões auditáveis |

## Núcleo já existente e reutilizado

A migration `20260810120000_ncrm_momentos_roleta_operacao.sql` já contém o núcleo
da roleta: presença de 15 minutos, D-API conectado, bloqueio por feedback de visita,
suspensão, janelas antes/durante/depois do horário oficial, SLA de cinco minutos no
horário oficial e aptidão compartilhada com o Aquário. A nova interface configura e
explica esse contrato; não cria um segundo motor.

## Integrações que só mudam na virada final

As seguintes telas globais continuam lendo a operação oficial atual até o laboratório
de dois leads ser aceito:

- Início;
- Financeiro;
- Performance global;
- Automação/Distribuição global;
- aplicativo/PWA fora desta árvore de componentes;
- CRM antigo e carteira operacional inteira.

Na virada, elas devem consumir as mesmas fontes oficiais do Funil 2.0. Não se deve
copiar regras para o app nem alterar indicadores antes de a fonte comercial do novo
funil ser promovida. Isso evita números divergentes e preserva o legado durante o teste.

## Sequência de promoção

1. Validar os dois leads no laboratório: pesca/entrada, D-API, Sara, momento, Meu Dia,
   visita, negociação, notificações e configuração.
2. Congelar o vocabulário e os prazos aprovados.
3. Conectar distribuição e aplicativo ao mesmo contrato, sem abordagem automática.
4. Promover as fontes da Esteira para Início, Financeiro e Performance.
5. Migrar a carteira por lote auditável.
6. Tornar o Funil 2.0 o único funil visível; manter rollback do legado.

## Critério de prontidão para a virada

Nenhuma frente é considerada alinhada apenas por aparência. A virada exige teste real
com os dois leads, CI verde, migrations e rollbacks versionados, deploy do mesmo SHA,
e evidência de que ERP e aplicativo mostram a mesma etapa, momento, ação e prazo.
