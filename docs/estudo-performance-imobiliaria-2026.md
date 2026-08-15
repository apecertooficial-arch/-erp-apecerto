# Estudo para a Sala de Comando de Performance

Data do estudo: 15 de agosto de 2026.

## Tese executiva

Uma imobiliária não deve avaliar corretores por presença, quantidade bruta de mensagens ou posse de leads. A gestão precisa separar cinco perguntas:

1. **Resultado:** vendeu, gerou VGV, comissão e margem?
2. **Jornada:** respondeu, criou compromisso, realizou visita e avançou o cliente?
3. **Capacidade:** a carteira cabe na capacidade do corretor e está com próximas ações em dia?
4. **Experiência:** o cliente foi bem atendido e a visita teve conclusão documentada?
5. **Confiança:** o dado permite atribuir o resultado sem inventar causalidade?

A nota única deixou de ser o centro do produto. Ela escondia diferenças entre resultado, esforço, risco e cobertura de dados.

## O que operações de referência acompanham

- A Zillow organiza performance de equipes imobiliárias em taxa de atendimento, pedido de agendamento, visita, conversão, satisfação do cliente e uso disciplinado do CRM. Também recomenda observar capacidade antes de distribuir mais conexões.
- A NAR mostra que responsividade, conhecimento do processo, comunicação e negociação estão entre as qualidades mais importantes para compradores. O relatório de firmas também trata volume de transações, volume vendido e comissão como resultados empresariais centrais.
- A RD Station recomenda acompanhar conversão entre etapas, ciclo de venda, tempo de primeira resposta, receita por vendedor, meta, origem, CAC/ROI e motivos de perda. A própria recomendação de RevOps exige rastrear o lead do clique ao fechamento.

Esses benchmarks são usados como estrutura de gestão, não como meta numérica importada. As metas devem nascer do histórico e da capacidade da apêcerto.

## Natureza comprovada da operação da apêcerto

- A operação possui um estoque central de **11.701 leads no Aquário/Bolsão**. Esse estoque é matéria-prima para pesca, não performance individual.
- O WhatsApp/D-API é a melhor evidência histórica de execução: há mais de 144 mil mensagens registradas desde novembro de 2025.
- O Funil 2 é o sistema operacional da carteira depois da pesca. No retrato auditado, havia 570 carteiras ativas fora de `Pescado`, com 504 próximas ações vencidas.
- Quatro corretores estavam acima do limite configurado de 55 carteiras. Sobrecarga e conversão precisam ser analisadas juntas.
- Há 174 visitas registradas, sendo 79 realizadas e 35 canceladas. Nenhuma das 79 realizadas possuía feedback final no momento da auditoria.
- Há 24 vendas e R$ 10,675 milhões de VGV fechado no histórico financeiro. Porém, 22 vendas não estavam ligadas ao negócio que as originou.
- Apenas 5 de 2.158 negócios operacionais possuíam valor informado. Isso impede um forecast monetário confiável.
- Apenas 1.088 de 1.852 leads operacionais possuíam origem preenchida. Sem custo de aquisição e ligação da venda ao negócio, CAC e ROI por canal não podem ser calculados.

## As decisões que o painel deve permitir

### Diariamente

- Quem está sem execução comprovada?
- Quem está sobrecarregado e deve parar de receber leads?
- Onde há ações vencidas, visitas sem feedback ou cancelamentos anormais?
- Quais oportunidades em visita/negociação precisam de intervenção hoje?

### Semanalmente

- Quem está transformando conversas em compromissos e visitas?
- Quem precisa de coaching de primeira resposta, atendimento ou pós-visita?
- Quais motivos de perda se repetem?
- A distribuição está compatível com a capacidade e a qualidade de cada corretor?

### Mensalmente

- VGV e vendas contra meta.
- Comissão bruta, custos vinculados e margem de contribuição.
- Tendência contra o período anterior.
- Conversão por coorte e origem — somente quando a ligação ponta a ponta estiver confiável.
- Produtividade e rentabilidade por corretor, canal, produto e faixa de preço.

## Contrato das métricas

- **VGV realizado:** somente vendas `pago` ou `concluido` no financeiro.
- **Margem de contribuição:** comissão bruta menos custos vinculados à venda. Não é lucro líquido, pois não inclui OPEX fixo.
- **Carteira ativa:** Funil 2 não descartado e fora de `Pescado`.
- **Ação vencida:** carteira ativa com `proxima_acao_em` anterior ao momento atual.
- **Conversa:** conversa distinta na fonte bruta do D-API.
- **Uso ativo do ERP:** blocos visíveis de até cinco minutos, sem duplicar múltiplas abas. É evidência auxiliar de uso do sistema, não jornada de trabalho nem produtividade.
- **Primeira resposta:** amostra derivada de evento com horário e valor medidos; sem amostra não vira zero.
- **Visita realizada:** visita com status `realizada`; feedback é medido separadamente.
- **Pipeline quente:** negócio aberto em visita, negociação, compra ou fechamento. O valor só é exibido quando informado.
- **Bolsão/Aquário:** nunca conta como lead recebido, carteira, qualificação ou mérito individual.
- **Pesca:** não conta como trabalho. Mensagem, ação, visita ou venda posterior continuam sendo fatos reais.

## Indicadores bloqueados até corrigir a captura

- Forecast ponderado em reais.
- ROI, CAC e taxa de venda por origem.
- Conversão de coorte completa da entrada até a venda.
- Qualidade e resultado da visita.

O painel mostra a cobertura que bloqueia cada indicador. Isso evita decisões baseadas em precisão falsa.

## Fontes externas

- [Zillow — métricas de performance de agentes](https://www.zillow.com/premier-agent/best-of-zillow/)
- [Zillow — acompanhamento de leads, experiência, ROI e equipe](https://www.zillow.com/agents/track-your-real-estate-lead-performance/)
- [Zillow — capacidade recomendada e conversão de equipes](https://www.zillow.com/premier-agent/operational-blueprint/)
- [NAR — 2025 Profile of Real Estate Firms](https://cms.nar.realtor/sites/default/files/2025-11/2025-profile-of-real-estate-firms-11-19-2025.pdf)
- [NAR — 2025 Home Buyers and Sellers Generational Trends](https://www.nar.realtor/sites/default/files/2025-03/2025-home-buyers-and-sellers-generational-trends-report-04-01-2025.pdf)
- [RD Station — métricas de vendas](https://www.rdstation.com/blog/vendas/metricas-de-vendas/)
- [RD Station — primeiro contato com o lead](https://www.rdstation.com/blog/vendas/primeiro-contato-com-lead/)
- [RD Station — RevOps e rastreamento ponta a ponta](https://www.rdstation.com/blog/vendas/revops-na-pratica/)
