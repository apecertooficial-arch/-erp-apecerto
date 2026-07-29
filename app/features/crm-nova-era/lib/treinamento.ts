/**
 * Conteúdo da central de treinamento "Como trabalhar no CRM Nova Era".
 * PURO e testável. Linguagem do dia a dia do corretor: sem nomes técnicos,
 * sem dado de negócio fictício e sem dado pessoal em exemplo.
 */
export type Licao = {
  id: string;          // chave curta usada no checklist (2..60 caracteres)
  titulo: string;
  resumo: string;
  passos: string[];
  exemplo?: string;    // exemplo genérico, sem nome, telefone ou valor reais
};

export const LICOES: Licao[] = [
  {
    id: "visao-geral",
    titulo: "Para que serve o CRM Nova Era",
    resumo: "Ele organiza quem você precisa atender agora e o que fazer em cada cliente. Nada some do CRM antigo: os dois convivem durante o piloto.",
    passos: [
      "Ele não substitui a esteira de vendas nem o pipe de visitas: quando o cliente avança, ele sai daqui e segue no lugar de sempre.",
      "Nada é enviado ao cliente automaticamente por aqui. Toda mensagem continua saindo de você.",
      "O objetivo é simples: nenhum cliente ficar sem próxima ação e sem prazo.",
    ],
  },
  {
    id: "rotina-do-dia",
    titulo: "A rotina de um dia",
    resumo: "Abra o Meu dia pela manhã, trabalhe de cima para baixo e registre o que aconteceu logo depois de cada contato.",
    passos: [
      "Abra o Meu dia e comece pelo primeiro grupo.",
      "Abra o chat, fale com o cliente.",
      "Registre o resultado e defina a próxima ação com prazo.",
      "Volte ao Meu dia e siga para o próximo.",
    ],
  },
  {
    id: "meu-dia",
    titulo: "Meu dia e a ordem de prioridade",
    resumo: "A lista já vem ordenada. Quem está esperando resposta sua aparece primeiro; depois vêm os atrasados, os do dia e os novos.",
    passos: [
      "Cliente esperando resposta vem antes de tudo.",
      "Depois, o que passou do prazo.",
      "Depois, o que vence hoje.",
      "Por último, os que ainda têm folga.",
    ],
    exemplo: "Se um cliente mandou mensagem ontem à noite e ninguém respondeu, ele aparece no topo hoje pela manhã.",
  },
  {
    id: "abrir-chat",
    titulo: "Abrir o chat",
    resumo: "O botão Abrir chat leva à mesma conversa de WhatsApp que você já usa. Não existe um segundo chat.",
    passos: [
      "Clique em Abrir chat no cartão do cliente.",
      "Leia o histórico antes de escrever.",
      "Responda normalmente, com suas palavras.",
    ],
  },
  {
    id: "registrar-resultado",
    titulo: "Registrar o resultado",
    resumo: "Depois de falar com o cliente, diga o que aconteceu. É esse registro que mantém a lista confiável.",
    passos: [
      "Escolha o resultado que descreve o contato.",
      "Escreva uma observação curta, se ajudar quem for ler depois.",
      "Salve. O cliente sai da lista de hoje e volta na data que você marcar.",
    ],
  },
  {
    id: "proxima-acao",
    titulo: "Próxima ação e prazo",
    resumo: "Todo cliente ativo precisa de uma próxima ação com data. Sem isso, ele fica sem dono do próximo passo.",
    passos: [
      "Diga o que será feito, em uma frase.",
      "Escolha a data e a hora.",
      "Prefira prazos curtos e realistas a prazos longos que você não vai cumprir.",
    ],
    exemplo: "Ligar para confirmar o horário da visita — amanhã, 10h.",
  },
  {
    id: "cadencia",
    titulo: "Tentativas de contato",
    resumo: "Quando o cliente não responde, existe um número máximo de tentativas e um intervalo entre elas, dentro do horário comercial.",
    passos: [
      "Registre cada tentativa, mesmo quando ninguém atende.",
      "Ao chegar no limite, decida: seguir acompanhando, colocar em nutrição ou descartar com motivo.",
      "Não insista fora do horário comercial.",
    ],
  },
  {
    id: "sara",
    titulo: "A Sara",
    resumo: "A Sara lê a conversa e sugere. Ela nunca envia mensagem, nunca move o cliente e nunca decide por você.",
    passos: [
      "Abra a leitura da Sara para ver a sugestão e a justificativa.",
      "Confira as evidências: são trechos reais da conversa.",
      "Aceite ou recuse. Quando ela não tem base suficiente, ela avisa — e aí vale mais a sua leitura.",
    ],
  },
  {
    id: "visita",
    titulo: "Quando o cliente aceita visitar",
    resumo: "Agende a visita por aqui e o cliente segue para o pipe de visitas, como sempre.",
    passos: [
      "Confirme data, horário e empreendimento com o cliente.",
      "Registre a visita.",
      "A partir daí o acompanhamento é no pipe de visitas.",
    ],
  },
  {
    id: "proposta",
    titulo: "Quando vira proposta",
    resumo: "Registre a proposta e o cliente segue para a esteira de vendas.",
    passos: [
      "Registre a proposta com o produto e o valor combinados.",
      "O cliente sai do Meu dia e passa a ser acompanhado na esteira.",
      "Se a proposta não avançar, o cliente pode voltar para acompanhamento.",
    ],
  },
  {
    id: "nutricao",
    titulo: "Nutrição",
    resumo: "Para quem tem interesse real, mas não é agora. Ele sai da sua lista diária sem ser descartado.",
    passos: [
      "Use quando o cliente pediu para ser procurado mais para frente.",
      "Explique o motivo em uma frase.",
      "Ele volta a aparecer quando fizer sentido retomar.",
    ],
  },
  {
    id: "descarte",
    titulo: "Descarte",
    resumo: "Só com motivo. Descartar sem motivo esconde problema e atrapalha a leitura da equipe.",
    passos: [
      "Escolha o motivo que corresponde à realidade.",
      "Quando escolher Outro, escreva o que aconteceu.",
      "Se o cliente voltar a falar, ele pode ser reativado.",
    ],
  },
  {
    id: "justificativa",
    titulo: "Justificar atraso",
    resumo: "Atraso acontece. O que não pode é atraso sem explicação — é isso que a gestão acompanha.",
    passos: [
      "Ao abrir um cliente atrasado, explique em uma frase o que houve.",
      "Reagende com um prazo que você consiga cumprir.",
    ],
  },
  {
    id: "ajuda",
    titulo: "Onde pedir ajuda",
    resumo: "Se algo parecer errado, não force. Avise a gestão pelo canal de sempre.",
    passos: [
      "Descreva o que você esperava e o que aconteceu.",
      "Diga o nome do cliente e o horário aproximado.",
      "Continue o atendimento pelo CRM antigo enquanto o problema é resolvido.",
    ],
  },
];

/** Percentual concluído (0..100), estável e sem divisão por zero. */
export function progressoTreinamento(concluidos: string[]): number {
  if (LICOES.length === 0) return 0;
  const validos = new Set(LICOES.map((l) => l.id));
  const n = new Set(concluidos.filter((c) => validos.has(c))).size;
  return Math.round((n / LICOES.length) * 100);
}

/** Próxima lição não concluída, para o guia rápido retomar de onde parou. */
export function proximaLicao(concluidos: string[]): Licao | null {
  const feitos = new Set(concluidos);
  return LICOES.find((l) => !feitos.has(l.id)) ?? null;
}
