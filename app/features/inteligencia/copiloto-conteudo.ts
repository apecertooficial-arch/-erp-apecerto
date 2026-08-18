"use client";

/* CONTEÚDO DO COPILOTO POR TELA — wireframe 32b.
 *
 * Cada aba tem a própria leitura: nada aqui é texto genérico reaproveitado. Os
 * números citados são os mesmos que a página mostra — quando a conexão com o
 * banco entrar, este arquivo passa a ser preenchido pelo agregador e o formato
 * das descobertas não muda.
 *
 * REGRA: sem descoberta acima do limiar de relevância, a lista vem vazia e o
 * resumo diz isso em uma linha — nunca inventa achado para preencher espaço.
 */

export type Achado = {
  titulo: string;
  explicacao: string;
  numero: string;
  impacto: string;
  tag: "impacto alto" | "oportunidade" | "risco" | "atenção" | "contexto" | "referência" | "bloqueio" | "regra";
  alvo: string;
  alvoRotulo: string;
};

export type ConteudoCopiloto = {
  geral: string;
  mudou: string;
  achados: Achado[];
  descartadas?: string;
  riscos: string;
  oportunidades: string;
  causas: string;
  acoes: string[];
  evidencias: string;
  sugestoes: string[];
  resposta: { conclusao: string; evidencia: string; impacto: string; causa: string; recomendacao: string; fonte: string; tabela: [string, string][]; alvo: string; alvoRotulo: string };
};

const A = (titulo: string, explicacao: string, numero: string, impacto: string, tag: Achado["tag"], alvo: string, alvoRotulo: string): Achado => ({ titulo, explicacao, numero, impacto, tag, alvo, alvoRotulo });

export const conteudoCopiloto: Record<string, ConteudoCopiloto> = {
  empresa: {
    geral: "Seu problema hoje é atendimento, não geração de leads. O volume subiu 9% e a resposta no prazo caiu de 41% para 22%.",
    mudou: "leads 446 → 486 · % no SLA 41% → 22% · 1º contato 8 → 21 min · vendas 19 → 21 · meta 71% → 77%",
    achados: [
      A("Só 22% dos leads são respondidos no prazo", "379 leads passaram de 5 minutos; a equipe Locação responde por 96 dos 147 casos acima de 1 hora.", "22% no SLA", "379 leads", "impacto alto", "atendimento", "Abrir Atendimento e SLA"),
      A("Qualificado → visita perde 52% dos negócios", "É o maior degrau do funil: 128 qualificados viram 96 visitas, com a perda concentrada em Locação.", "−32 negócios", "maior degrau", "impacto alto", "conversao", "Abrir Conversão e CRM"),
      A("Meta Ads converte 72% de lead em negócio", "Melhor canal do período, com 32 leads e 23 negócios. Custo ainda não conectado, então CPL e ROAS seguem vazios.", "72%", "23 negócios", "oportunidade", "aquisicao", "Abrir Aquisição"),
      A("R$ 127,0 mil de comissão pendente", "Duas vendas estão sem percentual definido e travam o cálculo de R$ 1,9 mi.", "R$ 127,0 mil", "8 pessoas", "risco", "financeiro", "Abrir Financeiro"),
      A("Meta do mês em 77% com previsão de 92%", "Faltam R$ 5,6 mi para R$ 24 mi, e R$ 6,2 mi estão em proposta ponderada.", "77%", "R$ 5,6 mi", "risco", "vendas", "Abrir Vendas e previsão"),
    ],
    descartadas: "2 descobertas ficaram abaixo do limiar de relevância (1,2 pp em qualidade e 0,4 pp em ticket médio) e não entraram na lista.",
    riscos: "9 pessoas esperando resposta há mais de 1 h · 2 vendas travadas por percentual ausente · sábado sem cobertura.",
    oportunidades: "Meta Ads com melhor conversão e verba livre · 74 buscas sem estoque em Moema Índios · 6 negócios pod em sair da carteira sobrecarregada.",
    causas: "Sem plantão de sábado · carteira desbalanceada (46 de 40) · follow-up sem próxima ação registrada.",
    acoes: ["Definir plantão de sábado na equipe Locação", "Mover 6 negócios do Carlos para o Pedro", "Preencher o percentual das 2 vendas travadas"],
    evidencias: "leads · negócios · wa_mensagens · comissões · metas · CRM Funil 2.0 · escala/ponto não integrado.",
    sugestoes: ["O que devo fazer hoje?", "Estamos próximos da meta?", "Quem está estourando o SLA?"],
    resposta: {
      conclusao: "Seu principal problema hoje é atendimento, não geração de leads.",
      evidencia: "486 leads (+9%) e apenas 22% respondidos em 5 min; a mediana subiu de 8 para 21 minutos.",
      impacto: "379 leads fora do prazo concentram 26 dos 112 negócios perdidos por “sem resposta”.",
      causa: "Sábado sem plantão (18% no SLA) e uma carteira com 46 de 40 negócios.",
      recomendacao: "Definir plantão de sábado e mover 6 negócios do Carlos para o Pedro. Reavaliar em 7 dias.",
      fonte: "fonte: wa_mensagens, negócios, leads · 30 dias · atualizado 14:28 · confiança alta (n=486)",
      tabela: [["Dentro de 5 min", "107"], ["5 a 15 min", "94"], ["15 a 60 min", "138"], ["Acima de 60 min", "147"]],
      alvo: "atendimento",
      alvoRotulo: "Abrir Atendimento e SLA",
    },
  },

  vendas: {
    geral: "A meta fecha se as propostas em aberto andarem: o assinado cobre 77% e a previsão ponderada chega a 92%.",
    mudou: "VGV assinado R$ 16,1 mi → R$ 18,4 mi · vendas 19 → 21 · cobertura 71% → 77%",
    achados: [
      A("Faltam R$ 5,6 mi para a meta", "R$ 6,2 mi estão em proposta ponderada, com probabilidade média de 48% e fechamento estimado em 8,5 dias.", "R$ 5,6 mi", "6 negócios", "risco", "conversao", "Abrir Conversão e CRM"),
      A("Duas vendas sem valor no negócio", "Campo ausente no CRM tira as duas da previsão. Nada é estimado por média.", "2 negócios", "fora da previsão", "atenção", "financeiro", "Abrir Financeiro"),
      A("Crescimento veio de volume, não de preço", "Ticket médio estável em R$ 876 mil com 21 vendas: a variação não passa do limiar.", "R$ 876 mil", "21 vendas", "contexto", "empresa", "Abrir Visão da empresa"),
    ],
    riscos: "Se as 6 propostas escorregarem uma semana, a meta do mês não fecha.",
    oportunidades: "Duas propostas aguardam apenas documentação — o desbloqueio é operacional, não comercial.",
    causas: "Proposta sem acompanhamento diário e campo de valor em branco em dois negócios.",
    acoes: ["Acompanhar as 6 propostas diariamente", "Preencher o valor dos 2 negócios", "Revisar a previsão na sexta"],
    evidencias: "negócios · propostas · metas cadastradas · pipeline de 14:15.",
    sugestoes: ["O pipeline é suficiente para fechar o mês?", "O que está travando as propostas?", "Estamos próximos da meta?"],
    resposta: {
      conclusao: "A meta fecha, mas depende de seis propostas.",
      evidencia: "R$ 18,4 mi assinados de R$ 24 mi; R$ 6,2 mi em proposta com 48% de probabilidade média.",
      impacto: "Faltam R$ 5,6 mi e a previsão ponderada indica 92% de cobertura.",
      causa: "Propostas sem acompanhamento diário e dois negócios sem valor cadastrado.",
      recomendacao: "Colocar as 6 propostas em rotina diária e preencher os valores hoje.",
      fonte: "fonte: negócios, propostas, metas · pipeline de 14:15 · confiança média",
      tabela: [["Assinado", "R$ 18,4 mi"], ["Proposta ponderada", "R$ 6,2 mi"], ["Falta para a meta", "R$ 5,6 mi"], ["Sem valor no negócio", "2"]],
      alvo: "financeiro",
      alvoRotulo: "Abrir Financeiro",
    },
  },

  financeiro: {
    geral: "Entrou R$ 812,0 mil de receita e sobrou R$ 324,0 mil antes dos custos fixos. O problema é comissão travada por cadastro.",
    mudou: "receita R$ 731,0 mil → R$ 812,0 mil · comissões R$ 442,0 mil → R$ 488,0 mil · pendente R$ 96,0 mil → R$ 127,0 mil",
    achados: [
      A("R$ 127,0 mil de comissão pendente", "Oito participantes aguardando; duas vendas estão bloqueadas por percentual ausente, envolvendo R$ 1,9 mi.", "R$ 127,0 mil", "8 pessoas", "risco", "vendas", "Abrir Vendas e previsão"),
      A("Comissão consome 60% da receita", "R$ 488,0 mil de R$ 812,0 mil. A contribuição para aqui: custos fixos não estão integrados.", "60%", "R$ 324,0 mil", "contexto", "empresa", "Abrir Visão da empresa"),
      A("Um repasse sem data", "Sem data, não entra em nenhum mês — e desaparece do fechamento até ser corrigido.", "1 repasse", "R$ 291,0 mil a receber", "atenção", "alertas", "Abrir Central de alertas"),
    ],
    riscos: "Fechamento com comissão parada e um repasse sem data compromete a confiança no número.",
    oportunidades: "Desbloquear as duas vendas libera o cálculo de R$ 1,9 mi sem nenhum esforço comercial.",
    causas: "Percentual não cadastrado no negócio e repasse lançado sem data.",
    acoes: ["Preencher o percentual das 2 vendas", "Datar o repasse pendente", "Fechar o pagamento das comissões calculadas"],
    evidencias: "contratos · repasses · comissões · custos fixos não integrados.",
    sugestoes: ["Quanto ainda temos de comissão para pagar?", "O que está travando o fechamento?", "Quanto entrou de receita de verdade?"],
    resposta: {
      conclusao: "O fechamento está travado por cadastro, não por caixa.",
      evidencia: "R$ 127,0 mil pendentes e 2 vendas sem percentual, envolvendo R$ 1,9 mi.",
      impacto: "Oito pessoas aguardam pagamento e o VGV dessas vendas fica fora do cálculo.",
      causa: "Percentual não cadastrado e um repasse sem data.",
      recomendacao: "Preencher os percentuais e datar o repasse hoje; comissão nunca é estimada por média.",
      fonte: "fonte: comissões, repasses, contratos · 30 dias · confiança alta",
      tabela: [["Calculadas", "R$ 488,0 mil"], ["Pagas", "R$ 361,0 mil"], ["Pendentes", "R$ 127,0 mil"], ["Sem % definido", "2 vendas"]],
      alvo: "vendas",
      alvoRotulo: "Abrir Vendas e previsão",
    },
  },

  atendimento: {
    geral: "A fila de espera é o problema imediato: 9 pessoas aguardam resposta agora, a mais antiga há 1h52.",
    mudou: "1º contato 8 → 21 min · P90 1h05 → 2h10 · % no SLA 41% → 22% · vencidos 41 → 57",
    achados: [
      A("Sábado derruba o SLA da Locação", "Aos sábados entram 62 leads e 11 recebem resposta no prazo; nos dias úteis a mesma equipe fica em 31%.", "18% no SLA", "51 leads/mês", "impacto alto", "gerentes", "Abrir Gerentes"),
      A("Uma carteira concentra os atrasos", "46 negócios para capacidade de 40, com 12 conversas em que o cliente falou por último há mais de 24 h.", "46 de 40", "12 conversas", "impacto alto", "corretores", "Abrir Corretores"),
      A("12 visitas sem feedback", "Sete passaram de 48 h. Sem feedback registrado, a visita não entra na análise de qualidade.", "12 visitas", "qualidade cega", "atenção", "qualidade", "Abrir Qualidade"),
    ],
    riscos: "9 leads sem primeira resposta · 44 conversas com o cliente falando por último · 21 negócios parados.",
    oportunidades: "Redistribuir 6 negócios deve recuperar cerca de 8 pp de SLA sem contratar ninguém.",
    causas: "Falta de escala de sábado · carteira desbalanceada · 26 negócios sem próxima ação registrada.",
    acoes: ["Chamar os 9 leads sem resposta agora", "Definir plantão de sábado", "Cobrar feedback das 12 visitas"],
    evidencias: "wa_mensagens · leads · negócios · escala/ponto não integrado.",
    sugestoes: ["Quais leads estão sem atendimento?", "Quem está estourando o SLA?", "Qual gerente tem o maior gargalo?"],
    resposta: {
      conclusao: "O atraso não está espalhado: está no sábado e em uma carteira.",
      evidencia: "62 leads entram no sábado e 11 são respondidos no prazo (18%); uma pessoa responde por 12 das 44 conversas sem retorno.",
      impacto: "Cerca de 51 leads por mês entram já fora do prazo.",
      causa: "Não existe plantão de sábado e a distribuição não olha capacidade.",
      recomendacao: "Plantão de sábado com duas pessoas e teto de 40 negócios por corretor.",
      fonte: "fonte: wa_mensagens, negócios · 30 dias · confiança alta",
      tabela: [["Leads no sábado", "62"], ["Atendidos no prazo", "11"], ["Mais antigo na fila", "1h52"], ["Responsável ausente", "3"]],
      alvo: "corretores",
      alvoRotulo: "Abrir Corretores",
    },
  },

  equipe: {
    geral: "As duas equipes convertem parecido, mas a Locação atende muito mais devagar — velocidade é o pilar fraco.",
    mudou: "% no SLA 41% → 22% · qualidade 4,0 → 3,9 · conversão 4,6% → 4,3% · vencidos 41 → 57",
    achados: [
      A("Locação em 14% no SLA contra 31% da Venda", "Mesma régua, times diferentes: 225 leads e 8 locações contra 261 leads e 13 vendas.", "14% vs 31%", "2,2x mais lento", "impacto alto", "gerentes", "Abrir Gerentes"),
      A("Disciplina piorou 39%", "Follow-ups vencidos foram de 41 para 57, concentrados em duas pessoas.", "57 vencidos", "26 sem próxima ação", "atenção", "corretores", "Abrir Corretores"),
      A("O novato fica fora da régua", "Seis atendimentos contra o mínimo de oito: não é classificado nem alertado, por regra de justiça.", "n=6", "sem classificação", "regra", "qualidade", "Abrir Qualidade"),
    ],
    riscos: "A Locação carrega 7 dos 9 leads sem resposta e a maior parte dos negócios parados.",
    oportunidades: "Levar a Locação ao patamar da Venda em velocidade vale cerca de 8 pp de SLA geral.",
    causas: "Cobertura de horário desigual e carga concentrada em duas pessoas.",
    acoes: ["Igualar a escala de sábado entre as equipes", "Redistribuir a carteira sobrecarregada", "Rever a meta de follow-up semanal"],
    evidencias: "negócios · leads · wa_mensagens · avaliações de conversa (n=182).",
    sugestoes: ["Compare esta equipe com o período anterior.", "Quais corretores precisam de ajuda?", "Onde perdemos mais negócio?"],
    resposta: {
      conclusao: "A diferença entre as equipes é velocidade, não talento.",
      evidencia: "Locação em 14% no SLA e Venda em 31%, com volumes parecidos (225 e 261 leads).",
      impacto: "A Locação responde por 7 dos 9 leads sem atendimento agora.",
      causa: "Cobertura de sábado e carga desbalanceada.",
      recomendacao: "Igualar escala e aplicar teto de carteira antes de discutir treinamento.",
      fonte: "fonte: negócios, leads, wa_mensagens · 30 dias · confiança alta",
      tabela: [["Locação · leads", "225"], ["Locação · % SLA", "14%"], ["Venda · leads", "261"], ["Venda · % SLA", "31%"]],
      alvo: "corretores",
      alvoRotulo: "Abrir Corretores",
    },
  },

  gerentes: {
    geral: "Um dos dois gerentes precisa de apoio em dois pontos concretos: cobertura de sábado e carga de uma pessoa.",
    mudou: "SLA da Locação 24% → 14% · carga máxima 41 → 46 · intervenções abertas 2 → 3",
    achados: [
      A("Cobertura de sábado em 18%", "62 leads no sábado e 11 no prazo. Não há plantão definido na equipe de Locação.", "18% no SLA", "51 leads/mês", "impacto alto", "atendimento", "Abrir Atendimento e SLA"),
      A("Uma carteira 15% acima da capacidade", "46 de 40. A régua da casa é comparação com a meta, não entre os dois gerentes.", "46 de 40", "SLA +8 pp se redistribuir", "impacto alto", "corretores", "Abrir Corretores"),
      A("A outra equipe está dentro da meta em velocidade", "Venda em 31% no SLA e 13 vendas, com carga máxima de 38 de 40.", "31% no SLA", "13 vendas", "referência", "equipe", "Abrir Performance da equipe"),
    ],
    descartadas: "A comparação direta entre os dois gerentes foi omitida: com duas pessoas não existe mediana da casa.",
    riscos: "Sem plantão, todo sábado repete o mesmo furo; sobrecarga vira perda de negócio, não só atraso.",
    oportunidades: "Há espaço de carteira em outra pessoa da mesma equipe para absorver 6 negócios agora.",
    causas: "Escala não integrada ao ERP e distribuição sem teto por capacidade.",
    acoes: ["Definir plantão de sábado com o gerente", "Aprovar a redistribuição de 6 negócios", "Registrar a intervenção com prazo de 7 dias"],
    evidencias: "negócios · leads · carga por corretor · escala/ponto não integrado.",
    sugestoes: ["Qual gerente está com maior gargalo?", "O que devo cobrar na reunião de hoje?", "Quem está sobrecarregado?"],
    resposta: {
      conclusao: "O gargalo tem nome: sábado e uma carteira acima da capacidade.",
      evidencia: "Locação em 14% no SLA; sábado em 18%; uma carteira com 46 de 40 negócios.",
      impacto: "Cerca de 51 leads por mês entram fora do prazo.",
      causa: "Sem plantão e sem teto de carteira.",
      recomendacao: "Plantão de sábado e mover 6 negócios, com revisão em 7 dias.",
      fonte: "fonte: negócios, leads, carga · 30 dias · confiança alta",
      tabela: [["Leads da equipe", "225"], ["Locações", "8"], ["Carga máxima", "46 de 40"], ["Sábado no SLA", "18%"]],
      alvo: "atendimento",
      alvoRotulo: "Abrir Atendimento e SLA",
    },
  },

  corretores: {
    geral: "Duas pessoas puxam o tempo de resposta para cima, e por motivos diferentes: uma está sobrecarregada, a outra não.",
    mudou: "melhor 1º contato 7 → 9 min · pior 34 → 41 min · conversão média 8,1% → 7,5%",
    achados: [
      A("41 minutos de primeira resposta no pior caso", "P90 de 3h20 no sábado e 14 follow-ups vencidos, com carteira dentro da capacidade.", "41 min", "38 negócios", "impacto alto", "qualidade", "Abrir Qualidade"),
      A("Outro atraso é por volume, não por ritmo", "14 minutos de mediana com 46 negócios — 15% acima da capacidade combinada.", "46 de 40", "12 conversas sem retorno", "contexto", "gerentes", "Abrir Gerentes"),
      A("Existe uma referência utilizável na casa", "9 minutos de mediana, 52 negócios e 9,6% de conversão — ainda acima da meta de 5 min.", "9 min", "9,6%", "referência", "equipe", "Abrir Performance da equipe"),
    ],
    descartadas: "O novato ficou fora da lista: 6 atendimentos, abaixo da amostra mínima de 8.",
    riscos: "Cobrar quem está sobrecarregado sem tratar a carga gera atrito sem resultado.",
    oportunidades: "Coaching de retomada de proposta tem alvo claro: 14 follow-ups vencidos numa única carteira.",
    causas: "Distribuição sem teto e ausência de rotina de follow-up em dois casos.",
    acoes: ["Abrir coaching de follow-up com quem tem 14 vencidos", "Redistribuir 6 negócios da carteira sobrecarregada", "Manter o novato fora de ranking até 8 atendimentos"],
    evidencias: "negócios · wa_mensagens · avaliações de conversa · uso do ERP não é jornada de trabalho.",
    sugestoes: ["Quais corretores precisam de ajuda?", "Quem está sobrecarregado?", "Quem melhorou desde o período anterior?"],
    resposta: {
      conclusao: "São dois problemas diferentes: um precisa de rotina, o outro de menos carteira.",
      evidencia: "41 min de mediana com 14 follow-ups vencidos num caso; 14 min com 46 de 40 negócios no outro.",
      impacto: "Os dois concentram 68% dos atrasos acima de 1 hora.",
      causa: "Falta de rotina de follow-up em um caso e sobrecarga no outro.",
      recomendacao: "Coaching para um, redistribuição para o outro. Tratar como problemas distintos.",
      fonte: "fonte: negócios, wa_mensagens · 30 dias · confiança alta",
      tabela: [["Pior 1º contato", "41 min"], ["Follow-ups vencidos", "14"], ["Carteira sobrecarregada", "46 de 40"], ["Melhor 1º contato", "9 min"]],
      alvo: "gerentes",
      alvoRotulo: "Abrir Gerentes",
    },
  },

  qualidade: {
    geral: "A conversa é clara, mas trava na objeção de preço — o critério mais fraco e o mais treinável.",
    mudou: "nota geral 4,0 → 3,9 · contorno de objeção 4,0 → 3,8 · pessoas avaliadas 6 → 5",
    achados: [
      A("Contorno de objeção em 3,8", "É o menor dos oito critérios; duas pessoas estão abaixo de 3,5 e há plano aberto com prazo.", "3,8 de 5", "2 pessoas", "impacto alto", "corretores", "Abrir Corretores"),
      A("Qualificação de orçamento em 3,9", "Três pessoas abaixo de 3,5, com plano aberto e prazo de 2 semanas.", "3,9 de 5", "3 pessoas", "atenção", "gerentes", "Abrir Gerentes"),
      A("Um critério sem amostra suficiente", "Cinco conversas avaliadas contra o mínimo de oito: a nota não é exibida e nenhuma conclusão é tirada.", "n=5", "sem nota", "regra", "equipe", "Abrir Performance da equipe"),
    ],
    riscos: "Conversa fora do ERP não é avaliada — o buraco está declarado e não vira nota baixa.",
    oportunidades: "Um único treino, sobre objeção de preço, atinge o critério mais fraco de quase todo o time.",
    causas: "Falta de roteiro de objeção e ausência de revisão pós-proposta.",
    acoes: ["Abrir treino de objeção de preço", "Fechar os 2 planos com prazo vencendo", "Reavaliar quem está sem amostra na próxima semana"],
    evidencias: "avaliações de conversa (n=182) · negócios · conversas fora do ERP não avaliadas.",
    sugestoes: ["O que treinar primeiro?", "Quem está abaixo da régua?", "Compare com o período anterior."],
    resposta: {
      conclusao: "O treino prioritário é objeção de preço.",
      evidencia: "Critério em 3,8, o mais baixo dos oito, e preço é o segundo motivo de perda com 27 casos.",
      impacto: "Duas pessoas abaixo de 3,5 e plano aberto com prazo de 3 semanas.",
      causa: "Sem roteiro de objeção e sem revisão pós-proposta.",
      recomendacao: "Treino de 1 h com casos reais e revisão de 10 conversas por semana.",
      fonte: "fonte: avaliações de conversa (n=182) · 30 dias · confiança média",
      tabela: [["Contorno de objeção", "3,8"], ["Qualificação", "3,9"], ["Clareza", "4,4"], ["Abaixo de 3,5", "3 pessoas"]],
      alvo: "corretores",
      alvoRotulo: "Abrir Corretores",
    },
  },

  conversao: {
    geral: "O funil comercial perde mais entre qualificado e visita do que em qualquer outra etapa.",
    mudou: "lead → negócio 61,7% → 59,9% · taxa de perda 37,5% → 38,5% · 1º atendimento 24 → 18 min",
    achados: [
      A("Qualificado → visita cai 52%", "128 qualificados viram 96 visitas; a perda de 32 concentra-se numa equipe.", "−32", "maior degrau", "impacto alto", "atendimento", "Abrir Atendimento e SLA"),
      A("Sem resposta é o principal motivo de perda", "38 dos 112 negócios perdidos, à frente de preço (27) e concorrência (19).", "38 perdas", "34% do total", "impacto alto", "corretores", "Abrir Corretores"),
      A("9 leads seguem sem primeiro atendimento", "A mediana melhorou 6 minutos, mas a fila aberta continua com 9 pessoas.", "9 leads", "meta 5 min", "risco", "alertas", "Abrir Central de alertas"),
    ],
    riscos: "Perda por silêncio é a mais evitável e a que mais cresceu no período.",
    oportunidades: "Voltar a etapa da visita ao patamar anterior recupera cerca de 11 negócios por mês.",
    causas: "Follow-up sem próxima ação e ausência de rotina pós-qualificação.",
    acoes: ["Atender os 9 leads da fila", "Criar rotina de agendamento pós-qualificação", "Revisar os 38 casos de silêncio"],
    evidencias: "negócios · leads · wa_mensagens · motivos de perda · valor de pipeline ausente no CRM.",
    sugestoes: ["Onde perdemos mais negócio?", "Quais leads estão sem atendimento?", "Por que a conversão caiu?"],
    resposta: {
      conclusao: "A perda está entre qualificar e agendar a visita.",
      evidencia: "128 qualificados → 96 visitas (−32), com a maior parte numa única equipe.",
      impacto: "Cerca de 11 negócios por mês, no ritmo atual de fechamento.",
      causa: "Follow-up registrado sem próxima ação em 26 negócios.",
      recomendacao: "Regra de agendamento obrigatório em até 24 h após qualificar.",
      fonte: "fonte: negócios, leads, wa_mensagens · 30 dias · confiança alta",
      tabela: [["Qualificado", "128"], ["Visita agendada", "96"], ["Perda na etapa", "32"], ["Motivo mais comum", "sem resposta"]],
      alvo: "atendimento",
      alvoRotulo: "Abrir Atendimento e SLA",
    },
  },

  digital: {
    geral: "O site entrega mais gente interessada, mas a conversão de intenção em lead está pior que a mediana histórica.",
    mudou: "visualizações 21.900 → 24.618 · intenção 2.005 → 2.310 · leads 285 → 312 · visitas 100 → 96",
    achados: [
      A("Intenção → lead perde 86,5% das pessoas", "2.310 ações de intenção viraram 312 leads; a mediana histórica dessa etapa é 22%.", "13,5%", "196 leads/mês", "impacto alto", "comportamento", "Abrir Comportamento"),
      A("Instagram orgânico gerou 52 negócios", "41% acima dos 30 dias anteriores, com 84 leads e 5.204 visualizações.", "52 negócios", "+41%", "oportunidade", "aquisicao", "Abrir Aquisição"),
      A("Um anúncio acumula acesso sem lead", "1.240 visualizações, 214 aberturas de galeria e 2 leads em 21 dias anunciado.", "0,16%", "2 leads", "atenção", "imoveis", "Abrir Imóveis"),
    ],
    descartadas: "2 descobertas ficaram abaixo do limiar: sessões GA4 e favoritos.",
    riscos: "Visitas agendadas caíram 4% enquanto o topo cresceu — o gargalo migrou para o meio do funil.",
    oportunidades: "Reforçar Instagram e corrigir duas páginas de alto acesso pode recuperar a etapa de intenção.",
    causas: "Páginas com muito acesso e sem caminho para o imóvel; galeria pouco aberta num anúncio.",
    acoes: ["Colocar CTA de imóvel no guia de Moema", "Revisar as fotos do anúncio com galeria fraca", "Ampliar o que funciona no Instagram"],
    evidencias: "coleta própria · Google Tag · GA4 (31% de consentimento) · CRM Funil 2.0.",
    sugestoes: ["Por que os leads não crescem na mesma proporção?", "Qual campanha trouxe mais negócios?", "Quais imóveis têm acesso e não convertem?"],
    resposta: {
      conclusao: "O topo cresceu; o problema está entre intenção e lead.",
      evidencia: "2.310 ações de intenção geraram 312 leads (13,5%), contra 22% de mediana histórica.",
      impacto: "Voltar à mediana significaria cerca de 196 leads a mais no mês.",
      causa: "Duas páginas de alto acesso sem caminho para o imóvel e uma galeria pouco aberta.",
      recomendacao: "CTA de imóvel no guia de Moema e revisão de fotos antes de subir mídia nova.",
      fonte: "fonte: coleta própria, Google Tag, CRM · 30 dias · confiança alta",
      tabela: [["Visualizações", "24.618"], ["Ações de intenção", "2.310"], ["Leads", "312"], ["Negócios", "187"]],
      alvo: "comportamento",
      alvoRotulo: "Abrir Comportamento",
    },
  },

  aquisicao: {
    geral: "Instagram orgânico é o canal que mais gera negócio; Meta Ads é o que mais converte o lead que traz.",
    mudou: "Instagram 37 → 52 negócios · Meta Ads 18 → 23 · não atribuído 22 → 27",
    achados: [
      A("Meta Ads converte 72% de lead em negócio", "32 leads e 23 negócios numa única campanha — a melhor taxa entre todos os canais.", "72%", "23 negócios", "oportunidade", "conversao", "Abrir Conversão e CRM"),
      A("27 negócios sem origem conhecida", "Sem UTM em 48% dos casos e sem consentimento em 39%. O volume nunca é redistribuído entre canais.", "27 negócios", "11% do total", "atenção", "privacidade", "Abrir Privacidade e tracking"),
      A("Custo por lead segue indisponível", "Google Ads e Meta Ads não estão conectados: CPL e ROAS ficam vazios e nada é estimado.", "sem dado", "decisão às cegas", "bloqueio", "privacidade", "Abrir Privacidade e tracking"),
    ],
    riscos: "Decidir verba sem custo integrado é aposta; a tela avisa em vez de estimar.",
    oportunidades: "A campanha com melhor conversão ainda opera com volume baixo.",
    causas: "Links de anúncio sem UTM e contas de mídia não conectadas.",
    acoes: ["Conectar Google Ads e Meta Ads", "Corrigir UTMs de 3 anúncios ativos", "Ampliar a campanha de melhor conversão"],
    evidencias: "coleta própria · UTMs · CRM Funil 2.0 · custo de mídia não conectado.",
    sugestoes: ["Qual campanha trouxe mais negócios?", "Onde devo colocar mais verba?", "Por que tanto volume fica sem origem?"],
    resposta: {
      conclusao: "Reforçar Meta Ads: é o canal com melhor conversão em negócio.",
      evidencia: "32 leads e 23 negócios (72%), contra 62% do Instagram orgânico.",
      impacto: "Cada 10 leads da campanha viram 7 negócios.",
      causa: "Público e criativo alinhados ao imóvel anunciado.",
      recomendacao: "Ampliar a campanha e conectar as contas de mídia antes de escalar mais.",
      fonte: "fonte: coleta própria, UTMs, CRM · 30 dias · confiança média (custo ausente)",
      tabela: [["Leads", "32"], ["Negócios", "23"], ["Lead → negócio", "72%"], ["CPL · ROAS", "— não conectado"]],
      alvo: "conversao",
      alvoRotulo: "Abrir Conversão e CRM",
    },
  },

  comportamento: {
    geral: "Três páginas concentram acesso alto com conversão baixa — é onde a intenção morre.",
    mudou: "galeria 3.780 → 4.216 interações · WhatsApp 1.150 → 1.294 · formulário iniciado 402 → 371",
    achados: [
      A("Uma página tem 2.180 acessos e 0 lead", "Entrada frequente, sem nenhum CTA de imóvel no corpo do texto. Zero aqui é dado real, não falha de medição.", "2.180 · 0", "maior perda", "impacto alto", "digital", "Abrir Visão do digital"),
      A("Celular converte pior que desktop", "14.464 visualizações e 185 leads no celular contra 8.842 e 118 no desktop, com mais abandono no formulário.", "1,28% vs 1,33%", "31 formulários", "atenção", "conversao", "Abrir Conversão e CRM"),
      A("Clarity sem eventos há 3 h", "Mapas de calor e gravações do período podem estar incompletos; a coleta própria segue de pé.", "3 h", "fonte parcial", "bloqueio", "privacidade", "Abrir Privacidade e tracking"),
    ],
    riscos: "Sem Clarity completo, a leitura de fricção da página fica parcial — e a tela diz isso.",
    oportunidades: "Duas correções de página atingem mais de 3.000 acessos por mês sem custo de mídia.",
    causas: "Conteúdo sem caminho para o imóvel e formulário longo no celular.",
    acoes: ["Adicionar CTA de imóvel nas duas páginas", "Encurtar o formulário no celular", "Verificar a coleta do Clarity"],
    evidencias: "coleta própria · Google Tag · Clarity (parcial) · consentimento Analytics em 31%.",
    sugestoes: ["Quais páginas têm acesso e não convertem?", "Onde as pessoas desistem?", "O celular está pior que o desktop?"],
    resposta: {
      conclusao: "A perda de intenção é de conteúdo, não de tráfego.",
      evidencia: "Uma página com 2.180 acessos e nenhum lead; outra com 934 e 1.",
      impacto: "Mais de 3.000 acessos por mês sem caminho para um imóvel.",
      causa: "Páginas informativas sem CTA de imóvel.",
      recomendacao: "Inserir bloco de imóveis relacionados nas duas páginas e medir por 14 dias.",
      fonte: "fonte: coleta própria, Google Tag · 30 dias · Clarity parcial",
      tabela: [["/blog/guia-moema", "2.180 · 0"], ["Apê Gaivota 402", "1.240 · 2"], ["/sobre", "934 · 1"], ["/imoveis (busca)", "6.912 · 24"]],
      alvo: "imoveis",
      alvoRotulo: "Abrir Imóveis",
    },
  },

  imoveis: {
    geral: "A procura está concentrada em dois anúncios que convertem bem; um terceiro consome acesso e não entrega lead.",
    mudou: "visualizações do topo 1.310 → 1.486 · leads do topo 33 → 38 · buscas sem resultado 118 → 133",
    achados: [
      A("Um anúncio converte 0,16%", "1.240 visualizações e 2 leads, com apenas 214 aberturas de galeria — a menor proporção da lista.", "0,16%", "1.238 acessos", "impacto alto", "comportamento", "Abrir Comportamento"),
      A("74 buscas sem estoque em Moema Índios", "2 dormitórios mobiliado até R$ 6.500/mês: nenhuma das 23 captações do mês atende.", "74 buscas", "demanda perdida", "oportunidade", "proprietarios", "Abrir Proprietários"),
      A("4 leads com intenção e sem atendimento", "Um imóvel tem 4 leads sem primeiro contato, o mais antigo há 26 h.", "4 leads", "26 h", "risco", "conversao", "Abrir Conversão e CRM"),
    ],
    riscos: "Anúncio com acesso alto e conversão baixa queima verba e reputação de busca.",
    oportunidades: "Captação dirigida a Moema Índios tem 74 buscas comprovadas esperando.",
    causas: "Fotos fracas num anúncio e ausência de estoque na faixa mais procurada.",
    acoes: ["Refazer as fotos do anúncio com galeria fraca", "Abrir captação alvo em Moema Índios", "Atender os 4 leads sem contato"],
    evidencias: "coleta própria · cadastro de imóveis · buscas agregadas · 12 imóveis sem código.",
    sugestoes: ["Quais imóveis têm acesso, mas não convertem?", "O que as pessoas procuram e não achamos?", "Onde devo captar agora?"],
    resposta: {
      conclusao: "Um anúncio está queimando acesso.",
      evidencia: "1.240 visualizações, 214 aberturas de galeria e 2 leads em 21 dias.",
      impacto: "É o pior desempenho da carteira, com o segundo maior volume de acesso.",
      causa: "Galeria pouco aberta indica fotos que não sustentam o preço anunciado.",
      recomendacao: "Refazer a produção de fotos e reavaliar em 14 dias, antes de qualquer mídia paga.",
      fonte: "fonte: coleta própria, cadastro · 30 dias · confiança alta",
      tabela: [["Visualizações", "1.240"], ["Galeria", "214"], ["Leads", "2"], ["Imóvel → lead", "0,16%"]],
      alvo: "comportamento",
      alvoRotulo: "Abrir Comportamento",
    },
  },

  proprietarios: {
    geral: "A captação cresceu, mas só 26% do que entra chega a ser publicado.",
    mudou: "captações 18 → 23 · publicados 5 → 6 · tempo até contato 5,1 h → 3,2 h",
    achados: [
      A("Do clique ao anúncio, 6 de 1.108", "1.108 acessos à página geraram 74 cliques, 23 envios e 6 publicações.", "0,5%", "6 anúncios", "impacto alto", "comportamento", "Abrir Comportamento"),
      A("Demanda comprovada sem estoque", "74 buscas por 2 dorms mobiliado até R$ 6.500/mês em Moema Índios, e nenhuma captação do mês atende.", "74 buscas", "alvo nº 1", "oportunidade", "imoveis", "Abrir Imóveis"),
      A("7 captações perdidas", "Três preferiram exclusividade em outra imobiliária e duas discordaram da avaliação.", "7 perdas", "30% do recebido", "atenção", "vendas", "Abrir Vendas e previsão"),
    ],
    riscos: "Sem estoque na faixa mais procurada, o site gera busca que não converte.",
    oportunidades: "Campanha de captação dirigida tem demanda medida esperando, não suposta.",
    causas: "Argumento de avaliação frágil e formulário de captação longo.",
    acoes: ["Abrir captação alvo em Moema Índios", "Revisar o script de avaliação", "Encurtar o formulário de captação"],
    evidencias: "coleta própria · captações do portal · buscas agregadas · custo por captação indisponível.",
    sugestoes: ["Onde devo captar agora?", "Por que perdemos captação?", "O site ajuda a captar?"],
    resposta: {
      conclusao: "Existe demanda medida esperando estoque em Moema Índios.",
      evidencia: "74 buscas por 2 dorms mobiliado até R$ 6.500/mês, sem nenhuma captação compatível no mês.",
      impacto: "É a combinação mais procurada e a com menor cobertura de estoque.",
      causa: "Captação é reativa: não é dirigida pela demanda medida.",
      recomendacao: "Campanha de captação com esse recorte e meta de 5 imóveis em 30 dias.",
      fonte: "fonte: buscas agregadas, captações, CRM · 30 dias · confiança média",
      tabela: [["Captações recebidas", "23"], ["Contatados", "19"], ["Publicados", "6"], ["Buscas sem estoque", "74"]],
      alvo: "imoveis",
      alvoRotulo: "Abrir Imóveis",
    },
  },

  sara: {
    geral: "A Sara responde bem e gera oportunidade, mas perde a pessoa entre ver o imóvel e agir.",
    mudou: "aberturas 1.783 → 2.104 · leads 39 → 47 · buscas sem resultado 118 → 133",
    achados: [
      A("476 pessoas saem entre ver e agir", "864 abriram um imóvel e 388 fizeram alguma ação de intenção dentro da conversa.", "44,9%", "476 pessoas", "impacto alto", "conversao", "Abrir Conversão e CRM"),
      A("133 buscas sem nenhum resultado", "9% do total. Viram demanda sem estoque e alimentam o alvo de captação.", "133 buscas", "9%", "oportunidade", "proprietarios", "Abrir Proprietários"),
      A("21 erros na conversa", "12 timeouts, 6 sem resposta, 3 outros — cada erro é uma conversa interrompida no pico de interesse.", "21 erros", "1% das sessões", "atenção", "privacidade", "Abrir Privacidade e tracking"),
    ],
    riscos: "Timeout acontece justamente quando a pessoa está mais interessada.",
    oportunidades: "Um botão de agendar dentro da conversa atinge as 864 aberturas de imóvel.",
    causas: "Ação de intenção pouco visível no fluxo e latência em 12 sessões.",
    acoes: ["Colocar agendamento dentro da conversa", "Investigar os 12 timeouts", "Mandar as buscas sem resultado para captação"],
    evidencias: "eventos da Sara · coleta própria · CRM · texto digitado não é armazenado.",
    sugestoes: ["Onde a Sara perde a pessoa?", "O que as pessoas pedem e não temos?", "A Sara gera negócio de verdade?"],
    resposta: {
      conclusao: "A Sara não perde na busca: perde na hora de agir.",
      evidencia: "864 pessoas abriram um imóvel e 388 fizeram alguma ação (44,9%).",
      impacto: "476 conversas quentes terminam sem lead.",
      causa: "A ação de intenção fica pouco visível dentro do fluxo da conversa.",
      recomendacao: "Botão de agendar visita dentro da conversa, logo após abrir o imóvel.",
      fonte: "fonte: eventos da Sara, CRM · 30 dias · confiança alta",
      tabela: [["Imóvel aberto", "864"], ["Ação de intenção", "388"], ["Lead gerado", "47"], ["Negócio criado", "28"]],
      alvo: "conversao",
      alvoRotulo: "Abrir Conversão e CRM",
    },
  },

  alertas: {
    geral: "Cinco alertas críticos estão abertos e todos têm dono. Dois vêm do mesmo problema de cobertura.",
    mudou: "críticos 3 → 5 · resolvidos em 30 dias 19 → 23 · reconhecidos 6 → 8",
    achados: [
      A("9 leads sem primeira resposta", "Espera máxima de 1h52. É o alerta com maior custo por hora parada.", "9 leads", "crítico", "impacto alto", "atendimento", "Abrir Atendimento e SLA"),
      A("7 leads sem sincronizar com o CRM", "Desde 14 de agosto: pessoas que pediram contato e ninguém viu.", "7 leads", "crítico", "impacto alto", "privacidade", "Abrir Privacidade e tracking"),
      A("2 vendas sem percentual de comissão", "R$ 1,9 mi com cálculo suspenso, dono Financeiro.", "R$ 1,9 mi", "crítico", "risco", "financeiro", "Abrir Financeiro"),
    ],
    descartadas: "18 alertas de atenção não entraram no resumo: nenhum com prazo estourado.",
    riscos: "Dois críticos dependem do mesmo gerente — risco de fila única.",
    oportunidades: "Resolver a cobertura de sábado fecha dois alertas de uma vez.",
    causas: "Cobertura de escala, fila de sincronização travada e cadastro incompleto.",
    acoes: ["Distribuir e chamar os 9 leads", "Reprocessar a fila de sincronização", "Preencher os percentuais travados"],
    evidencias: "motor de regras · leads · negócios · fila de sincronização · comissões.",
    sugestoes: ["O que exige ação hoje?", "Quais alertas estão sem dono?", "O que foi resolvido nesta semana?"],
    resposta: {
      conclusao: "Comece pelos leads sem resposta: é o único crítico que perde cliente por hora.",
      evidencia: "9 leads na fila com espera máxima de 1h52 e 7 leads presos na sincronização desde 14 ago.",
      impacto: "16 pessoas pediram contato e ainda não foram atendidas.",
      causa: "Cobertura de escala e fila de sincronização travada.",
      recomendacao: "Distribuir os 9 agora e reprocessar a fila; os dois têm dono definido.",
      fonte: "fonte: motor de regras, leads, fila de sincronização · tempo real · 14:32",
      tabela: [["Críticos", "5"], ["Atenção", "18"], ["Reconhecidos", "8"], ["Resolvidos · 30 d", "23"]],
      alvo: "atendimento",
      alvoRotulo: "Abrir Atendimento e SLA",
    },
  },

  privacidade: {
    geral: "Os números do período são confiáveis, com duas ressalvas declaradas: Clarity parado e 7 leads sem sincronizar.",
    mudou: "consentimento Analytics 28% → 31% · leads sem sincronizar 2 → 7 · páginas sem tracking 1 → 2",
    achados: [
      A("7 leads sem sincronizar com o CRM", "Desde 14 de agosto. São pessoas que pediram contato e não apareceram para ninguém.", "7 leads", "crítico", "impacto alto", "alertas", "Abrir Central de alertas"),
      A("Clarity sem eventos há 3 h", "Mapas e gravações do período ficam incompletos. Nenhuma métrica foi preenchida por média.", "3 h", "fonte parcial", "bloqueio", "comportamento", "Abrir Comportamento"),
      A("11% do volume sem atribuição", "Sem UTM em 48% dos casos e sem consentimento em 39%. O volume aparece sempre, nunca é redistribuído.", "11%", "27 negócios", "atenção", "aquisicao", "Abrir Aquisição"),
    ],
    riscos: "Lead que não sincroniza é cliente perdido em silêncio — o pior tipo de erro de dado.",
    oportunidades: "Corrigir UTMs de 3 anúncios recupera a origem de 41 leads por mês.",
    causas: "Fila de sincronização travada, script ausente em 2 páginas e links sem UTM.",
    acoes: ["Reprocessar a fila dos 7 leads", "Verificar a coleta do Clarity", "Corrigir UTMs dos 3 anúncios"],
    evidencias: "coleta própria · Google Tag · Clarity (sem evento há 3 h) · fila de sincronização · registro de consentimento.",
    sugestoes: ["Existem problemas na qualidade dos dados?", "Posso confiar nesses números?", "O que está furando a medição?"],
    resposta: {
      conclusao: "Pode confiar nos números, com duas ressalvas explícitas.",
      evidencia: "7 leads sem sincronizar desde 14 ago e Clarity sem evento há 3 h; as outras fontes responderam.",
      impacto: "Sete pessoas pediram contato e não entraram no funil de ninguém.",
      causa: "Fila de sincronização travada e script do Clarity fora do ar.",
      recomendacao: "Reprocessar a fila hoje e tratar Clarity como fonte parcial até voltar.",
      fonte: "fonte: coleta própria, Google Tag, fila de sincronização · atualizado 14:30",
      tabela: [["Leads sem sincronizar", "7"], ["Páginas sem tracking", "2"], ["Volume não atribuído", "11%"], ["Consentimento Analytics", "31%"]],
      alvo: "alertas",
      alvoRotulo: "Abrir Central de alertas",
    },
  },
};
