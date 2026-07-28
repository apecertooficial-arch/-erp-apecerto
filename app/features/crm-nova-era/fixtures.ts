/**
 * CRM Nova Era — FIXTURES DE DEMONSTRAÇÃO (FASE 1.2)
 * ------------------------------------------------------------------
 * Dados 100% fictícios e em memória. NENHUMA chamada de rede/API/banco.
 * Telefones OBVIAMENTE INVÁLIDOS (000000000xx).
 *
 * "Agora" de referência (determinístico): 2026-07-28T12:00:00Z = 09:00 Brasília.
 * REGRA DA OPERAÇÃO (Fase 1.2): quando o lead entra, a automação do ERP envia
 * imediatamente a 1ª mensagem de WhatsApp — por isso todo lead tem
 * `mensagemAutomaticaEnviadaEm` e a régua HUMANA começa depois do prazo
 * configurado (PLANO_CADENCIA_PADRAO.esperaAposAutomacaoHoras).
 *
 * Cenários (um por lead): 1 novo aguardando automação · 2 primeira intervenção
 * humana atrasada · 3 várias tentativas sem resposta · 4 resposta aguardando
 * corretor · 5 pediu retorno com horário · 6 em qualificação · 7 opções
 * enviadas · 8 ação comercial vencida (crítica) · 9 ação futura · 10 visita
 * agendada (fora do quadro) · 11 proposta registrada (fora do quadro) ·
 * 12 telefone inválido · 13 cadência esgotada · 14 nutrição.
 */
import type { LeadNova, Tentativa } from "./lib/rules";

export const AGORA_DEMO = "2026-07-28T12:00:00.000Z"; // 09:00 em Brasília
/** Corretor "logado" na demonstração (para o filtro Meus leads / Todos). */
export const CORRETOR_ATUAL_DEMO = "Você (demo)";
const OUTRO = "Otávio Corretor (demo)";

const t = (
  numero: number,
  canal: Tentativa["canal"],
  resultado: Tentativa["resultado"],
  em: string,
  observacao?: string,
): Tentativa => ({ numero, canal, resultado, em, observacao });

export const LEADS_DEMO: LeadNova[] = [
  // 1) NOVO AGUARDANDO RESPOSTA DA AUTOMAÇÃO — msg automática 08:41 BRT;
  //    1ª intervenção humana nasce às 10:41 BRT (13:41Z), dentro da janela.
  {
    id: "demo-001",
    nome: "Aurora Demonstração",
    telefone: "00000000001",
    origem: "Portal (demo)",
    corretorNome: CORRETOR_ATUAL_DEMO,
    coluna: "novo",
    momento: "morno",
    criadoEm: "2026-07-28T11:40:00.000Z",
    respondeu: false,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: null,
    proximaAcaoTipo: "tentativa_cadencia",
    proximaAcaoTitulo: "Primeira intervenção humana",
    proximaAcaoEm: "2026-07-28T13:41:00.000Z",
    tentativas: [],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-28T11:41:00.000Z",
    aguardandoRespostaAutomacao: true,
  },
  // 2) PRIMEIRA INTERVENÇÃO HUMANA ATRASADA — automação ontem 09:05 BRT;
  //    intervenção prevista ontem 11:05 BRT (14:05Z) → ~22h de atraso.
  {
    id: "demo-002",
    nome: "Bento Fictício",
    telefone: "00000000002",
    origem: "Meta Ads (demo)",
    corretorNome: CORRETOR_ATUAL_DEMO,
    coluna: "novo",
    momento: "quente",
    criadoEm: "2026-07-27T12:00:00.000Z",
    respondeu: false,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: null,
    proximaAcaoTipo: "tentativa_cadencia",
    proximaAcaoTitulo: "Primeira intervenção humana",
    proximaAcaoEm: "2026-07-27T14:05:00.000Z",
    tentativas: [],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-27T12:05:00.000Z",
    aguardandoRespostaAutomacao: true,
  },
  // 3) VÁRIAS TENTATIVAS SEM RESPOSTA — 3ª tentativa prevista 27/07 09:30 BRT
  //    (12:30Z) → 23h30 de atraso (atrasado).
  {
    id: "demo-003",
    nome: "Cecília Exemplo",
    telefone: "00000000003",
    origem: "Portal (demo)",
    corretorNome: OUTRO,
    coluna: "tentando_contato",
    momento: "morno",
    criadoEm: "2026-07-26T09:00:00.000Z",
    respondeu: false,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-26T12:30:00.000Z",
    proximaAcaoTipo: "tentativa_cadencia",
    proximaAcaoTitulo: "Terceira tentativa",
    proximaAcaoEm: "2026-07-27T12:30:00.000Z",
    tentativas: [
      t(1, "ligacao", "nao_respondeu", "2026-07-26T12:45:00.000Z"),
      t(2, "whatsapp", "nao_respondeu", "2026-07-26T16:00:00.000Z", "Visualizou e não respondeu"),
    ],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-26T09:02:00.000Z",
    aguardandoRespostaAutomacao: false,
  },
  // 4) RESPOSTA AGUARDANDO CORRETOR
  {
    id: "demo-004",
    nome: "Danilo Placeholder",
    telefone: "00000000004",
    origem: "Meta Ads (demo)",
    corretorNome: CORRETOR_ATUAL_DEMO,
    coluna: "em_atendimento",
    momento: "quente",
    criadoEm: "2026-07-27T15:00:00.000Z",
    respondeu: true,
    respostaPendenteCorretor: true,
    ultimaInteracaoEm: "2026-07-28T11:35:00.000Z",
    proximaAcaoTipo: "confirmar_recebimento",
    proximaAcaoTitulo: "Confirmar recebimento",
    proximaAcaoEm: "2026-07-28T13:10:00.000Z",
    tentativas: [t(1, "whatsapp", "respondeu", "2026-07-27T17:20:00.000Z", "Respondeu pedindo detalhes de 2 dorm.")],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-27T15:01:00.000Z",
    aguardandoRespostaAutomacao: false,
  },
  // 5) PEDIU RETORNO COM HORÁRIO — retorno hoje 13:00 BRT (16:00Z)
  {
    id: "demo-005",
    nome: "Elisa Amostra",
    telefone: "00000000005",
    origem: "Indicação (demo)",
    corretorNome: CORRETOR_ATUAL_DEMO,
    coluna: "em_acompanhamento",
    momento: "morno",
    criadoEm: "2026-07-27T13:00:00.000Z",
    respondeu: true,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-27T17:00:00.000Z",
    proximaAcaoTipo: "retornar_contato",
    proximaAcaoTitulo: "Retornar contato",
    proximaAcaoEm: "2026-07-28T16:00:00.000Z",
    tentativas: [
      t(1, "ligacao", "pediu_retorno", "2026-07-27T17:00:00.000Z", "Em reunião; pediu retorno amanhã às 13h (Brasília)"),
    ],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-27T13:02:00.000Z",
    aguardandoRespostaAutomacao: false,
  },
  // 6) EM QUALIFICAÇÃO
  {
    id: "demo-006",
    nome: "Fábio Simulado",
    telefone: "00000000006",
    origem: "Google (demo)",
    corretorNome: OUTRO,
    coluna: "em_atendimento",
    momento: "morno",
    criadoEm: "2026-07-26T14:00:00.000Z",
    respondeu: true,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-27T13:30:00.000Z",
    proximaAcaoTipo: "entender_necessidade",
    proximaAcaoTitulo: "Entender necessidade",
    proximaAcaoEm: "2026-07-28T14:00:00.000Z",
    tentativas: [t(1, "whatsapp", "respondeu", "2026-07-27T13:30:00.000Z", "Procura 3 dorm. região central")],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-26T14:03:00.000Z",
    aguardandoRespostaAutomacao: false,
  },
  // 7) OPÇÕES ENVIADAS — ligar p/ retorno hoje 10:00 BRT (13:00Z)
  {
    id: "demo-007",
    nome: "Gustavo Demo",
    telefone: "00000000007",
    origem: "Indicação (demo)",
    corretorNome: CORRETOR_ATUAL_DEMO,
    coluna: "em_acompanhamento",
    momento: "quente",
    criadoEm: "2026-07-25T13:00:00.000Z",
    respondeu: true,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-27T19:00:00.000Z",
    proximaAcaoTipo: "ligar_retorno",
    proximaAcaoTitulo: "Ligar para retorno das opções enviadas",
    proximaAcaoEm: "2026-07-28T13:00:00.000Z",
    tentativas: [t(1, "whatsapp", "respondeu", "2026-07-25T13:10:00.000Z", "Interessado em 2 dorm.")],
    acoesComerciais: [
      { seq: 1, acaoPrevista: "Enviar opções", resultado: "opcoes_enviadas", em: "2026-07-27T19:00:00.000Z", observacao: "Enviadas 3 opções até 500k" },
    ],
    mensagemAutomaticaEnviadaEm: "2026-07-25T13:01:00.000Z",
    aguardandoRespostaAutomacao: false,
  },
  // 8) AÇÃO COMERCIAL VENCIDA (CRÍTICA) — enviar opções previsto 25/07 14:00 BRT
  {
    id: "demo-008",
    nome: "Helena Fictícia",
    telefone: "00000000008",
    origem: "Portal (demo)",
    corretorNome: CORRETOR_ATUAL_DEMO,
    coluna: "em_acompanhamento",
    momento: "negociando",
    criadoEm: "2026-07-24T12:00:00.000Z",
    respondeu: true,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-25T14:00:00.000Z",
    proximaAcaoTipo: "enviar_opcoes",
    proximaAcaoTitulo: "Enviar opções na faixa combinada",
    proximaAcaoEm: "2026-07-25T17:00:00.000Z",
    tentativas: [t(1, "ligacao", "respondeu", "2026-07-25T14:00:00.000Z", "Alinhada faixa de valor")],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-24T12:02:00.000Z",
    aguardandoRespostaAutomacao: false,
  },
  // 9) AÇÃO FUTURA — solicitar documentação amanhã 10:00 BRT (13:00Z)
  {
    id: "demo-009",
    nome: "Ícaro Exemplo",
    telefone: "00000000009",
    origem: "Google (demo)",
    corretorNome: OUTRO,
    coluna: "em_acompanhamento",
    momento: "quente",
    criadoEm: "2026-07-26T13:00:00.000Z",
    respondeu: true,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-27T20:00:00.000Z",
    proximaAcaoTipo: "solicitar_documentacao",
    proximaAcaoTitulo: "Solicitar documentação de renda",
    proximaAcaoEm: "2026-07-29T13:00:00.000Z",
    tentativas: [t(1, "whatsapp", "respondeu", "2026-07-27T20:00:00.000Z", "Vai financiar; docs amanhã")],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-26T13:02:00.000Z",
    aguardandoRespostaAutomacao: false,
  },
  // 10) VISITA AGENDADA — FORA DO QUADRO
  {
    id: "demo-010",
    nome: "Júlia Simulada",
    telefone: "00000000010",
    origem: "Indicação (demo)",
    corretorNome: CORRETOR_ATUAL_DEMO,
    coluna: "em_acompanhamento",
    momento: "negociando",
    criadoEm: "2026-07-20T12:00:00.000Z",
    respondeu: true,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-27T13:00:00.000Z",
    proximaAcaoTipo: null,
    proximaAcaoTitulo: null,
    proximaAcaoEm: null,
    tentativas: [t(1, "whatsapp", "respondeu", "2026-07-20T12:30:00.000Z")],
    acoesComerciais: [
      { seq: 1, acaoPrevista: "Agendar visita", resultado: "visita_agendada", em: "2026-07-27T13:00:00.000Z" },
    ],
    mensagemAutomaticaEnviadaEm: "2026-07-20T12:01:00.000Z",
    aguardandoRespostaAutomacao: false,
    visitaAgendadaEm: "2026-07-30T18:00:00.000Z",
  },
  // 11) PROPOSTA REGISTRADA — FORA DO QUADRO
  {
    id: "demo-011",
    nome: "Kaique Placeholder",
    telefone: "00000000011",
    origem: "Portal (demo)",
    corretorNome: CORRETOR_ATUAL_DEMO,
    coluna: "em_acompanhamento",
    momento: "negociando",
    criadoEm: "2026-07-18T12:00:00.000Z",
    respondeu: true,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-27T18:00:00.000Z",
    proximaAcaoTipo: null,
    proximaAcaoTitulo: null,
    proximaAcaoEm: null,
    tentativas: [
      t(1, "whatsapp", "respondeu", "2026-07-18T13:00:00.000Z"),
      t(2, "presencial", "respondeu", "2026-07-25T17:00:00.000Z", "Visitou e pediu proposta"),
    ],
    acoesComerciais: [
      { seq: 1, acaoPrevista: "Preparar proposta", resultado: "proposta_registrada", em: "2026-07-27T18:00:00.000Z" },
    ],
    mensagemAutomaticaEnviadaEm: "2026-07-18T12:01:00.000Z",
    aguardandoRespostaAutomacao: false,
    proposta: {
      produto: "Residencial Demo Central — un. 302",
      valor: 487000,
      data: "2026-07-27T18:00:00.000Z",
      observacao: "Entrada simulada + financiamento (demonstração)",
    },
  },
  // 12) TELEFONE INVÁLIDO — correção cadastral hoje 12:00 BRT (15:00Z)
  {
    id: "demo-012",
    nome: "Lívia Amostra",
    telefone: "00000000012",
    origem: "Meta Ads (demo)",
    corretorNome: OUTRO,
    coluna: "tentando_contato",
    momento: "frio",
    criadoEm: "2026-07-28T10:00:00.000Z",
    respondeu: false,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-28T10:30:00.000Z",
    proximaAcaoTipo: "corrigir_cadastro",
    proximaAcaoTitulo: "Corrigir dados de contato",
    proximaAcaoEm: "2026-07-28T15:00:00.000Z",
    tentativas: [t(1, "ligacao", "telefone_invalido", "2026-07-28T10:30:00.000Z", "Número não existe")],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-28T10:01:00.000Z",
    aguardandoRespostaAutomacao: false,
  },
  // 13) CADÊNCIA ESGOTADA — avaliar descarte hoje 14:00 BRT (17:00Z)
  {
    id: "demo-013",
    nome: "Murilo Fictício",
    telefone: "00000000013",
    origem: "Google (demo)",
    corretorNome: CORRETOR_ATUAL_DEMO,
    coluna: "tentando_contato",
    momento: "frio",
    criadoEm: "2026-07-22T12:00:00.000Z",
    respondeu: false,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-24T13:00:00.000Z",
    proximaAcaoTipo: "avaliar_descarte",
    proximaAcaoTitulo: "Avaliar descarte estruturado",
    proximaAcaoEm: "2026-07-28T17:00:00.000Z",
    tentativas: [
      t(1, "ligacao", "nao_respondeu", "2026-07-22T14:05:00.000Z"),
      t(2, "whatsapp", "nao_respondeu", "2026-07-22T17:00:00.000Z"),
      t(3, "ligacao", "nao_respondeu", "2026-07-23T13:00:00.000Z"),
      t(4, "whatsapp", "nao_respondeu", "2026-07-24T13:00:00.000Z", "Cadência esgotada"),
    ],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-22T12:01:00.000Z",
    aguardandoRespostaAutomacao: false,
  },
  // 14) NUTRIÇÃO/ARQUIVAMENTO FORMAL — fora do quadro, sem ação para hoje
  {
    id: "demo-014",
    nome: "Natália Demo",
    telefone: "00000000014",
    origem: "Portal (demo)",
    corretorNome: OUTRO,
    coluna: "tentando_contato",
    momento: "frio",
    criadoEm: "2026-07-10T12:00:00.000Z",
    respondeu: true,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: "2026-07-15T13:00:00.000Z",
    proximaAcaoTipo: null,
    proximaAcaoTitulo: null,
    proximaAcaoEm: null,
    tentativas: [t(1, "whatsapp", "respondeu", "2026-07-15T13:00:00.000Z", "Compra só ano que vem")],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: "2026-07-10T12:01:00.000Z",
    aguardandoRespostaAutomacao: false,
    nutricao: true,
  },
];

/** Cópia profunda das fixtures (estado local mutável sem tocar a constante). */
export function clonarLeadsDemo(): LeadNova[] {
  return LEADS_DEMO.map((l) => ({
    ...l,
    tentativas: l.tentativas.map((x) => ({ ...x })),
    acoesComerciais: l.acoesComerciais.map((x) => ({ ...x })),
    proposta: l.proposta ? { ...l.proposta } : l.proposta,
  }));
}
