# Catálogo de métricas de Performance

Este documento converte a especificação executiva fornecida pela direção em um contrato verificável de dados. A regra é simples: a Performance só apresenta uma métrica como fato quando há fonte, vínculo, período e significado confiáveis. Aquário/Bolsão e a etapa Pescado são estoque para pesca, não trabalho atribuído ao corretor, e ficam fora de toda performance individual.

## Disponível na Sala de Comando

| Família | Métricas | Fonte principal | Regra de leitura |
|---|---|---|---|
| Trabalho comprovado | dias com execução, blocos produtivos, tempo produtivo estimado, amplitude diária observada | `perf_eventos` | Um bloco distinto de 5 minutos exige evidência ativa. `online`, login, lead recebido e mensagem recebida não geram produtividade. A amplitude inclui pausas e não é jornada trabalhista. |
| Uso ativo do ERP | minutos ativos, dias ativos e último acesso | `performance_atividade_app` | Heartbeat somente com a página visível e usuário não ocioso. A captura é recente e não reconstrói o passado. |
| WhatsApp/D-API | enviadas, recebidas, textos, áudios, imagens, vídeos, documentos, mensagens/dia, primeira e última mensagem | `wa_mensagens`, `wa_instancias` | Associado à instância do corretor e ao período selecionado. |
| Relacionamento | contatos trabalhados, contatos bilaterais, taxa de resposta do contato | `wa_mensagens` | Contato trabalhado teve envio. Bilateral teve envio e recebimento no período. |
| Velocidade | P50, P75, P90, SLA em 2, 5, 15 e 60 minutos, P50 de resposta do cliente | `wa_mensagens` | Intervalo entre mensagens consecutivas de direções opostas na mesma conversa; sempre acompanhado da amostra. |
| Ações comerciais | ações, tentativas, respostas, mudanças de etapa, transferências e negócios trabalhados | `ncrm_evento` | Evento registrado com o corretor responsável no período. |
| Meu Dia | tarefas criadas, concluídas da coorte, devidas, backlog vencido/futuro | `crm_tarefas` | Como ainda não existe data de conclusão, a taxa usa tarefas criadas no período que atualmente constam concluídas. |
| Funil 2.0 | ações confirmadas, momentos alterados, notas, descartes e leads movimentados | `f2_evento` | Só eventos humanos com `criado_por` associado ao usuário do corretor; ações automáticas da Sara não viram mérito individual. |
| Carteira | ativos, em dia, vencidos, sem próxima ação, movimentados e cobertura no prazo | `f2_lead` | Exclui Pescado. Estado atual e movimento no período são mostrados separadamente. |
| Produção | leads operacionais recebidos, contatos, conversas bilaterais, visitas marcadas/realizadas/canceladas/com feedback, vendas e VGV | `leads`, D-API, `visitas`, `vendas`, `venda_corretores` | Leads associados ao Aquário/Bolsão são excluídos. Venda só conta nos estados pago/concluído. |
| Qualidade de atendimento | nota geral, clareza, cordialidade, personalização, qualificação, condução, objeções e escrita | `ia_notas_atendimento` | Exibe quantidade de avaliações e mensagens analisadas; orienta coaching, não substitui auditoria humana. |
| Econômico | vendas, VGV, pendências, comissão bruta, custos, margem e meta | `vendas`, `metas` | Resultado econômico fica separado de esforço e de qualidade. |
| Confiança | negócio com valor, venda vinculada, visita com feedback, lead com origem, perda com motivo | várias | Cobertura acompanha cada decisão e impede conclusões financeiras sem base. |

## Disponível com cobertura limitada

| Métrica pedida | Limitação atual | Ação de captura |
|---|---|---|
| Horas trabalhadas/login | O sinal histórico `online` permanece ativo e produz durações impossíveis. | Usar somente o heartbeat confiável daqui para frente; nunca reconstruir jornada com presença persistente. |
| Entrega e leitura de mensagens | A maior parte do histórico D-API não tem status de entrega/leitura. | Normalizar webhooks de status e monitorar percentual de cobertura antes de liberar o KPI. |
| Tempo de conclusão de tarefa | `crm_tarefas` não guarda `concluida_em`. | Adicionar timestamp imutável de conclusão e log de reabertura. |
| Primeira abordagem desde o recebimento | Há múltiplos eventos e vínculos legados sem uma chave canônica completa. | Gravar `lead_recebido_em`, primeiro envio humano e canal numa tabela de ciclo do lead. |
| Conversão por origem/coorte | Parte das vendas não está ligada ao negócio e ao lead. | Tornar vínculo venda → negócio → lead obrigatório e preservar origem original. |
| Forecast financeiro | Muitas oportunidades abertas não têm valor. | Tornar valor, probabilidade e data esperada obrigatórios nas etapas quentes. |
| Cancelamento e no-show | Visitas têm status, mas os motivos não são completos. | Tornar motivo estruturado e responsável pelo cancelamento obrigatórios. |
| Auditoria da nota de IA | Há nota automática, mas não amostra humana estratificada. | Criar fila de auditoria cega e medir concordância humano × IA. |

## Ainda sem fonte confiável no ERP

As métricas abaixo fazem parte do contrato desejado, mas não devem aparecer como zero, estimativa ou ranking enquanto a captura não existir:

- mídia: investimento, impressões, cliques, CTR, CPC, CPL, frequência, criativo, campanha e ROI por campanha;
- site: sessões, visitantes, páginas de imóvel, formulários, origem/UTM e conversão web;
- telefonia: chamadas efetuadas, atendidas, duração, gravação e abandono;
- consentimento e privacidade: opt-in, opt-out, base legal e preferência de canal;
- propostas e contratos: criação, envio, aceite, prazo, motivo de recusa e assinatura;
- CSAT, NPS e pesquisas pós-atendimento/pós-visita;
- captação: atividades de prospecção, avaliação, contrato, exclusividade e produtividade do captador;
- inventário: histórico de publicação, preço, disponibilidade, visitas por imóvel, giro e dias de estoque;
- financeiro conciliado: recebimento de comissão, parcelas, inadimplência, estorno e repasse;
- custos completos por corretor, canal, imóvel e venda;
- enriquecimento/qualificação com orçamento, prazo, região e tipo de imóvel estruturados e versionados.

## Ordem de implantação

1. **Operação e atendimento:** consolidar a Sala de Comando atual, iniciar histórico confiável de uso do ERP, status D-API e conclusão de tarefas.
2. **Coorte e forecast:** tornar obrigatórios os vínculos e campos que liberam conversão real, velocidade de primeira abordagem e pipeline financeiro.
3. **Aquisição e produto:** integrar mídia, site, UTMs, captação e inventário.
4. **Receita e experiência:** conciliar comissões/pagamentos e capturar proposta, contrato, CSAT e NPS.

Todo novo indicador deve declarar definição, numerador, denominador, relógio, timezone, exclusões, responsável, cobertura mínima e data a partir da qual é confiável.
