/**
 * CRM Nova Era — motor de regras (FASE 1.1, PROTÓTIPO)
 * ------------------------------------------------------------------
 * Módulo 100% PURO e ISOLADO: sem imports relativos, sem React, sem rede,
 * sem banco, sem Date.now() interno — o "agora" é sempre parâmetro (agoraISO).
 *
 * CONCEITOS CENTRAIS (Fase 1.1):
 *  A. CADÊNCIA DE CONTATO — só existe ANTES da primeira resposta efetiva do
 *     cliente. Tentativa 1→2→3→4 nunca aparece depois que o cliente respondeu.
 *  B. PRÓXIMA AÇÃO COMERCIAL — controla o lead DEPOIS da resposta e durante o
 *     acompanhamento. É armazenada explicitamente no lead (proximaAcaoTipo/
 *     Titulo/Em) — o card e a fila mostram o que está gravado, não um cálculo.
 *  C. SAÍDAS — visita agendada e proposta registrada tiram o lead do quadro e
 *     da fila; ele passa a aparecer nas áreas "Encaminhados para...".
 *     A Esteira de Vendas inicia quando a PROPOSTA É REGISTRADA (não exige
 *     aceite): ela acompanha o processo comercial iniciado pela proposta.
 *
 * Não copia a régua fixa 24/48/72 do ERP atual: severidade configurável.
 */

/* ============================ Modelo de domínio ============================ */

export type ColunaChave =
  | "novo"
  | "tentando_contato"
  | "em_atendimento"
  | "em_acompanhamento";

export type CanalContato = "ligacao" | "whatsapp" | "email" | "presencial";

/** Resultados obrigatórios de uma tentativa/interação (Fase 1.1). */
export type ResultadoTentativa =
  | "nao_respondeu"
  | "respondeu"
  | "telefone_invalido"
  | "pediu_retorno"
  | "sem_interesse"
  | "contato_inadequado";

export interface Tentativa {
  numero: number;
  canal: CanalContato;
  resultado: ResultadoTentativa;
  em: string; // ISO
  observacao?: string;
}

/** Temperatura do lead. NÃO define coluna (temperatura ≠ estágio de relacionamento). */
export type MomentoLead = "frio" | "morno" | "quente" | "negociando";

export const TIPOS_PROXIMA_ACAO = [
  "tentativa_cadencia",     // próxima tentativa da régua (apenas sem resposta)
  "retornar_contato",       // cliente pediu retorno
  "entender_necessidade",
  "enviar_opcoes",
  "confirmar_recebimento",
  "ligar_retorno",
  "solicitar_documentacao",
  "agendar_visita",
  "preparar_proposta",
  "corrigir_cadastro",
  "avaliar_descarte",
  "outro",
] as const;
export type ProximaAcaoTipo = (typeof TIPOS_PROXIMA_ACAO)[number];

export const ACAO_TITULO: Record<ProximaAcaoTipo, string> = {
  tentativa_cadencia: "Próxima tentativa de contato",
  retornar_contato: "Retornar contato",
  entender_necessidade: "Entender necessidade",
  enviar_opcoes: "Enviar opções",
  confirmar_recebimento: "Confirmar recebimento",
  ligar_retorno: "Ligar para retorno",
  solicitar_documentacao: "Solicitar documentação",
  agendar_visita: "Agendar visita",
  preparar_proposta: "Preparar proposta",
  corrigir_cadastro: "Corrigir dados de contato",
  avaliar_descarte: "Avaliar descarte estruturado",
  outro: "Outra ação",
};

/** Ações comerciais oferecidas após resposta (sem tentativa_cadencia). */
export const ACOES_COMERCIAIS: ProximaAcaoTipo[] = [
  "entender_necessidade",
  "enviar_opcoes",
  "confirmar_recebimento",
  "ligar_retorno",
  "solicitar_documentacao",
  "agendar_visita",
  "preparar_proposta",
  "outro",
];

export interface PropostaRegistrada {
  produto: string;
  valor: number;
  data: string; // ISO (data da proposta)
  observacao?: string;
}

export interface LeadNova {
  id: string;
  nome: string;
  telefone: string; // demo: sempre obviamente inválido
  origem: string;
  corretorNome: string;
  coluna: ColunaChave;
  momento: MomentoLead;
  criadoEm: string; // ISO

  /** Cliente já deu resposta efetiva? (encerra a cadência de tentativas) */
  respondeu: boolean;
  /** Cliente respondeu e AGUARDA o corretor (prioridade alta na fila). */
  respostaPendenteCorretor: boolean;
  ultimaInteracaoEm: string | null;

  /** PRÓXIMA AÇÃO EXPLÍCITA — fonte da verdade p/ card e fila. */
  proximaAcaoTipo: ProximaAcaoTipo | null;
  proximaAcaoTitulo: string | null;
  proximaAcaoEm: string | null;

  tentativas: Tentativa[];

  /** Histórico do ACOMPANHAMENTO COMERCIAL (após a resposta) — separado das tentativas. */
  acoesComerciais: AcaoComercialRegistro[];

  /* Automação de entrada (Fase 1.2): o ERP envia a 1ª mensagem de WhatsApp
     automaticamente pela instância do corretor assim que o lead entra. */
  mensagemAutomaticaEnviadaEm: string | null;
  /** Lead novo monitorando a resposta da mensagem automática. */
  aguardandoRespostaAutomacao: boolean;

  /* Saídas (tiram o lead do quadro e da fila) */
  visitaAgendadaEm?: string | null;
  proposta?: PropostaRegistrada | null;
  descartadoMotivo?: string | null;
  /** Nutrição/arquivamento formal (saída válida sem próxima ação). */
  nutricao?: boolean;
}

/** Registro de uma ação do acompanhamento comercial (nunca é "tentativa"). */
export interface AcaoComercialRegistro {
  seq: number;
  acaoPrevista: string | null; // o que estava agendado quando o corretor concluiu
  resultado: ResultadoAcaoComercial;
  em: string; // ISO
  observacao?: string;
}

/** Resultados possíveis ao CONCLUIR uma ação comercial (cliente já respondeu). */
export const RESULTADOS_ACAO_COMERCIAL = [
  "acao_concluida",
  "cliente_respondeu",
  "sem_resposta_acompanhamento",
  "pediu_novo_retorno",
  "aguardando_documento",
  "opcoes_enviadas",
  "visita_agendada",
  "proposta_registrada",
  "sem_interesse",
  "outro",
] as const;
export type ResultadoAcaoComercial = (typeof RESULTADOS_ACAO_COMERCIAL)[number];

export const RESULTADO_ACAO_ROTULO: Record<ResultadoAcaoComercial, string> = {
  acao_concluida: "Ação concluída",
  cliente_respondeu: "Cliente respondeu",
  sem_resposta_acompanhamento: "Cliente não respondeu ao acompanhamento",
  pediu_novo_retorno: "Cliente pediu novo retorno",
  aguardando_documento: "Aguardando documento",
  opcoes_enviadas: "Opções enviadas",
  visita_agendada: "Visita agendada",
  proposta_registrada: "Proposta registrada",
  sem_interesse: "Sem interesse",
  outro: "Outro",
};

/* ============================ Configuração ============================ */

export interface CadenciaPasso {
  canal: CanalContato;
  esperaHoras: number;
  rotulo: string;
}

export interface CadenciaPlano {
  maxTentativas: number;
  /**
   * Espera (horas) entre a MENSAGEM AUTOMÁTICA do ERP e a 1ª intervenção
   * humana. A automação já enviou o WhatsApp inicial — o CRM nunca orienta
   * disparar outro imediatamente.
   */
  esperaAposAutomacaoHoras: number;
  passos: CadenciaPasso[];
}

/**
 * Janela operacional para SUGESTÕES de horário (horário de Brasília).
 * Offset fixo UTC-03:00 (o Brasil está sem horário de verão; validar antes
 * da integração real). Feriados NÃO são tratados nesta fase (limitação
 * documentada); todos os dias contam como operacionais.
 */
export interface JanelaOperacional {
  inicioMinutos: number;   // minutos desde 00:00 local
  fimMinutos: number;
  utcOffsetMinutos: number; // Brasília = -180
}

export const JANELA_OPERACIONAL_PADRAO: JanelaOperacional = {
  inicioMinutos: 9 * 60 + 30, // 09:30
  fimMinutos: 18 * 60,        // 18:00
  utcOffsetMinutos: -180,
};

/**
 * Ajusta um horário sugerido para dentro da janela operacional:
 *  - antes de 09:30 (local) → 09:30 do mesmo dia;
 *  - depois de 18:00 (local) → PRÓXIMO dia às 09:30.
 * Só se aplica a SUGESTÕES da régua; horários digitados pelo corretor não
 * são alterados.
 */
export function ajustarParaJanelaOperacional(
  iso: string,
  janela: JanelaOperacional = JANELA_OPERACIONAL_PADRAO,
): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const off = janela.utcOffsetMinutos * 60000;
  const local = new Date(t + off);
  const minutos = local.getUTCHours() * 60 + local.getUTCMinutes();
  if (minutos >= janela.inicioMinutos && minutos <= janela.fimMinutos) return iso;
  const diaExtra = minutos > janela.fimMinutos ? 1 : 0;
  const alvoLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + diaExtra,
    Math.floor(janela.inicioMinutos / 60),
    janela.inicioMinutos % 60,
  );
  return new Date(alvoLocal - off).toISOString();
}

export type NivelSeveridade = "no_prazo" | "atencao" | "atrasado" | "critico";

export interface SeveridadeConfig {
  atencaoHoras: number;
  atrasadoHoras: number;
  criticoHoras: number;
}

/**
 * CONFIGURAÇÃO PROVISÓRIA DO PROTÓTIPO — explícita e fácil de alterar.
 * Os intervalos e canais abaixo NÃO são a cadência definitiva: serão
 * validados com a operação antes de qualquer integração real (nada vai a
 * banco nesta fase). A régua humana começa DEPOIS da mensagem automática.
 */
export const PLANO_CADENCIA_PADRAO: CadenciaPlano = {
  maxTentativas: 4,
  esperaAposAutomacaoHoras: 2,
  passos: [
    { canal: "ligacao", esperaHoras: 2, rotulo: "Primeira intervenção humana" },
    { canal: "whatsapp", esperaHoras: 3, rotulo: "Segunda tentativa" },
    { canal: "ligacao", esperaHoras: 24, rotulo: "Terceira tentativa" },
    { canal: "whatsapp", esperaHoras: 48, rotulo: "Tentativa final" },
  ],
};

export const SEVERIDADE_PADRAO: SeveridadeConfig = {
  atencaoHoras: 0,
  atrasadoHoras: 4,
  criticoHoras: 24,
};

/* ============================ Helpers de tempo (puros) ============================ */

export function minutosEntre(aISO: string, bISO: string): number {
  const a = Date.parse(aISO);
  const b = Date.parse(bISO);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((a - b) / 60000);
}

export function somaHoras(iso: string, horas: number): string {
  return new Date(Date.parse(iso) + horas * 3600000).toISOString();
}

export function mesmoDia(aISO: string, bISO: string): boolean {
  return aISO.slice(0, 10) === bISO.slice(0, 10);
}

/* ============================ Saídas do quadro ============================ */

export type SaidaTipo = "esteira_vendas" | "pipeline_visitas" | "descartado" | "nutricao" | null;

/** Qual saída se aplica ao lead (prioridade: descarte > proposta > visita > nutrição). */
export function saidaDoLead(lead: LeadNova): SaidaTipo {
  if (lead.descartadoMotivo) return "descartado";
  if (lead.proposta) return "esteira_vendas";
  if (lead.visitaAgendadaEm) return "pipeline_visitas";
  if (lead.nutricao) return "nutricao";
  return null;
}

/** Lead pertence às 4 colunas do quadro? (saídas ficam FORA do quadro) */
export function estaNoQuadro(lead: LeadNova): boolean {
  return saidaDoLead(lead) === null;
}

/* ============================ Cadência (só antes da resposta) ============================ */

/** A cadência de tentativas está encerrada? (resposta efetiva OU esgotamento) */
export function cadenciaEncerrada(
  lead: Pick<LeadNova, "respondeu" | "tentativas">,
  plano: CadenciaPlano = PLANO_CADENCIA_PADRAO,
): boolean {
  return lead.respondeu || lead.tentativas.length >= plano.maxTentativas;
}

export interface SugestaoTentativa {
  aplicavel: boolean;       // false se cliente já respondeu ou cadência esgotada
  numeroTentativa: number;  // 0 quando não aplicável
  canal: CanalContato | null;
  quandoISO: string | null; // sugestão (ajustável ao registrar)
  rotulo: string;
}

/**
 * Sugere a PRÓXIMA TENTATIVA da cadência humana. Nunca se aplica após resposta.
 * Fase 1.2:
 *  - A mensagem automática NÃO conta como tentativa humana; a 1ª intervenção
 *    humana nasce somente após `esperaAposAutomacaoHoras` contadas do envio
 *    automático (nunca "WhatsApp imediato" duplicado).
 *  - Toda sugestão é ajustada à janela operacional (09:30–18:00, Brasília).
 */
export function sugerirProximaTentativa(
  lead: Pick<LeadNova, "respondeu" | "tentativas" | "criadoEm" | "mensagemAutomaticaEnviadaEm">,
  plano: CadenciaPlano = PLANO_CADENCIA_PADRAO,
  janela: JanelaOperacional = JANELA_OPERACIONAL_PADRAO,
): SugestaoTentativa {
  if (lead.respondeu) {
    return { aplicavel: false, numeroTentativa: 0, canal: null, quandoISO: null, rotulo: "Cadência encerrada — cliente respondeu" };
  }
  const feitas = lead.tentativas.length;
  if (feitas >= plano.maxTentativas) {
    return { aplicavel: false, numeroTentativa: 0, canal: null, quandoISO: null, rotulo: "Cadência esgotada" };
  }
  const passo = plano.passos[feitas] ?? plano.passos[plano.passos.length - 1];
  let base: string;
  let espera: number;
  if (feitas > 0) {
    base = lead.tentativas[feitas - 1].em;
    espera = passo.esperaHoras;
  } else if (lead.mensagemAutomaticaEnviadaEm) {
    base = lead.mensagemAutomaticaEnviadaEm;
    espera = plano.esperaAposAutomacaoHoras;
  } else {
    base = lead.criadoEm;
    espera = passo.esperaHoras;
  }
  return {
    aplicavel: true,
    numeroTentativa: feitas + 1,
    canal: passo.canal,
    quandoISO: ajustarParaJanelaOperacional(somaHoras(base, espera), janela),
    rotulo: passo.rotulo,
  };
}

/* ============================ Atraso ============================ */

export interface AtrasoInfo {
  temPrazo: boolean;
  atrasadoMin: number;
  nivel: NivelSeveridade;
  rotulo: string;
}

/** Atraso da PRÓXIMA AÇÃO ARMAZENADA (proximaAcaoEm) frente ao "agora". */
export function calcularAtraso(
  lead: Pick<LeadNova, "proximaAcaoEm">,
  agoraISO: string,
  cfg: SeveridadeConfig = SEVERIDADE_PADRAO,
): AtrasoInfo {
  if (!lead.proximaAcaoEm) {
    return { temPrazo: false, atrasadoMin: 0, nivel: "no_prazo", rotulo: "Sem ação agendada" };
  }
  const atrasadoMin = minutosEntre(agoraISO, lead.proximaAcaoEm);
  if (Number.isNaN(atrasadoMin)) {
    return { temPrazo: false, atrasadoMin: 0, nivel: "no_prazo", rotulo: "Data inválida" };
  }
  const h = atrasadoMin / 60;
  let nivel: NivelSeveridade = "no_prazo";
  if (atrasadoMin <= 0) nivel = "no_prazo";
  else if (h >= cfg.criticoHoras) nivel = "critico";
  else if (h >= cfg.atrasadoHoras) nivel = "atrasado";
  else if (h >= cfg.atencaoHoras) nivel = "atencao";
  const rotulo =
    nivel === "no_prazo" ? "No prazo"
      : nivel === "atencao" ? "Atenção — ação vencendo"
        : nivel === "atrasado" ? "Atrasado"
          : "Crítico — resgatar";
  return { temPrazo: true, atrasadoMin, nivel, rotulo };
}

/* ============================ Coluna (estágio de relacionamento) ============================ */

/** Tipos de ação comercial que indicam ACOMPANHAMENTO (necessidade já entendida). */
const TIPOS_ACOMPANHAMENTO: ProximaAcaoTipo[] = [
  "enviar_opcoes",
  "solicitar_documentacao",
  "ligar_retorno",
  "retornar_contato",
  "agendar_visita",
  "preparar_proposta",
];

/**
 * Deriva a coluna sugerida pelo ESTÁGIO DE RELACIONAMENTO.
 * TEMPERATURA NÃO ENTRA NO CÁLCULO (quente/negociando não muda coluna).
 * Visita/proposta/descartado/nutrição NÃO pertencem a nenhuma coluna
 * (para leads em saída, a função devolve a coluna teórica interna, mas o
 * quadro deve filtrá-los via estaNoQuadro()).
 */
export function derivarColuna(
  lead: Pick<LeadNova, "respondeu" | "tentativas" | "proximaAcaoTipo">,
): ColunaChave {
  if (!lead.respondeu) {
    return lead.tentativas.length > 0 ? "tentando_contato" : "novo";
  }
  if (lead.proximaAcaoTipo && TIPOS_ACOMPANHAMENTO.includes(lead.proximaAcaoTipo)) {
    return "em_acompanhamento";
  }
  return "em_atendimento";
}

export const COLUNAS: { chave: ColunaChave; titulo: string; descricao: string }[] = [
  { chave: "novo", titulo: "Novo", descricao: "Nenhuma atuação humana concluída." },
  { chave: "tentando_contato", titulo: "Tentando contato", descricao: "Atuação iniciada, ainda sem resposta efetiva." },
  { chave: "em_atendimento", titulo: "Em atendimento", descricao: "Cliente respondeu; necessidade sendo entendida." },
  { chave: "em_acompanhamento", titulo: "Em acompanhamento", descricao: "Acompanhamento comercial antes de visita ou proposta: enviando opções, aguardando documentos, retorno combinado, alinhando condições." },
];

/* ============================ Validação de tentativa ============================ */

export interface EntradaTentativa {
  canal?: CanalContato | null;
  resultado?: ResultadoTentativa | null;
  em?: string | null;
  observacao?: string | null;
  /** Próxima ação aprovada pelo corretor (exigida conforme o resultado). */
  proximaAcaoTipo?: ProximaAcaoTipo | null;
  proximaAcaoEm?: string | null;
  /** Encaminhar direto para descarte (telefone_invalido / contato_inadequado). */
  encaminharDescarte?: boolean;
}

export interface ResultadoValidacao {
  ok: boolean;
  erros: string[];
}

const CANAIS_VALIDOS: CanalContato[] = ["ligacao", "whatsapp", "email", "presencial"];
const RESULTADOS_VALIDOS: ResultadoTentativa[] = [
  "nao_respondeu", "respondeu", "telefone_invalido", "pediu_retorno", "sem_interesse", "contato_inadequado",
];

function dataValida(iso: string | null | undefined): boolean {
  return !!iso && !Number.isNaN(Date.parse(iso));
}

/**
 * Valida o registro de uma tentativa/interação (puro; não grava nada).
 * Nenhuma conclusão pode deixar o lead sem próximo passo — exceto visita,
 * proposta, descarte e nutrição (tratadas como ações próprias).
 */
export function validarConclusaoTentativa(entrada: EntradaTentativa): ResultadoValidacao {
  const erros: string[] = [];
  if (!entrada.canal || !CANAIS_VALIDOS.includes(entrada.canal)) {
    erros.push("Selecione um canal de contato válido.");
  }
  if (!entrada.resultado || !RESULTADOS_VALIDOS.includes(entrada.resultado)) {
    erros.push("Selecione o resultado da tentativa.");
    return { ok: false, erros };
  }
  if (!dataValida(entrada.em)) {
    erros.push("Data/hora da tentativa é obrigatória e deve ser válida.");
  }
  switch (entrada.resultado) {
    case "respondeu":
      if (!entrada.proximaAcaoTipo || !ACOES_COMERCIAIS.includes(entrada.proximaAcaoTipo)) {
        erros.push("Cliente respondeu: escolha a próxima ação comercial.");
      }
      if (!dataValida(entrada.proximaAcaoEm)) {
        erros.push("Cliente respondeu: informe data e hora da próxima ação.");
      }
      break;
    case "pediu_retorno":
      if (!dataValida(entrada.proximaAcaoEm)) {
        erros.push("Pediu retorno: informe data e hora combinadas para retornar.");
      }
      break;
    case "sem_interesse":
      if (!(entrada.observacao && entrada.observacao.trim())) {
        erros.push("Sem interesse: descreva o motivo em observação.");
      }
      break;
    case "contato_inadequado":
      if (!(entrada.observacao && entrada.observacao.trim())) {
        erros.push("Contato inadequado: descreva o ocorrido em observação.");
      }
      if (!entrada.encaminharDescarte && !dataValida(entrada.proximaAcaoEm)) {
        erros.push("Contato inadequado: reagende (data/hora) ou encaminhe para descarte.");
      }
      break;
    case "telefone_invalido":
      if (!entrada.encaminharDescarte && !dataValida(entrada.proximaAcaoEm)) {
        erros.push("Telefone inválido: agende a correção cadastral (data/hora) ou encaminhe para descarte.");
      }
      break;
    case "nao_respondeu":
      // próxima tentativa é sugerida pela cadência; data ajustável (opcional aqui).
      break;
  }
  return { ok: erros.length === 0, erros };
}

/* ============================ Transição de estado (pura) ============================ */

/** Entrada de tentativa já validada (canal/resultado/em garantidos). */
export interface TentativaAprovada {
  canal: CanalContato;
  resultado: ResultadoTentativa;
  em: string;
  observacao?: string | null;
  proximaAcaoTipo?: ProximaAcaoTipo | null;
  proximaAcaoEm?: string | null;
  encaminharDescarte?: boolean;
}

/**
 * Aplica uma tentativa VALIDADA ao lead e devolve o NOVO estado (imutável).
 * O estado grava explicitamente a próxima ação aprovada — o card e a fila
 * leem daqui, nunca de um recálculo que possa divergir.
 */
export function aplicarTentativa(
  lead: LeadNova,
  entrada: TentativaAprovada,
  plano: CadenciaPlano = PLANO_CADENCIA_PADRAO,
): LeadNova {
  const tentativas = [
    ...lead.tentativas,
    {
      numero: lead.tentativas.length + 1,
      canal: entrada.canal,
      resultado: entrada.resultado,
      em: entrada.em,
      observacao: entrada.observacao || undefined,
    },
  ];
  let next: LeadNova = { ...lead, tentativas, ultimaInteracaoEm: entrada.em, aguardandoRespostaAutomacao: false };

  const setAcao = (tipo: ProximaAcaoTipo, em: string | null, titulo?: string) => {
    next.proximaAcaoTipo = tipo;
    next.proximaAcaoTitulo = titulo ?? ACAO_TITULO[tipo];
    next.proximaAcaoEm = em;
  };

  switch (entrada.resultado) {
    case "respondeu": {
      next.respondeu = true;
      next.respostaPendenteCorretor = false;
      setAcao(entrada.proximaAcaoTipo ?? "entender_necessidade", entrada.proximaAcaoEm ?? null);
      break;
    }
    case "pediu_retorno": {
      next.respondeu = true; // houve resposta efetiva; cadência encerra
      next.respostaPendenteCorretor = false;
      setAcao("retornar_contato", entrada.proximaAcaoEm ?? null);
      break;
    }
    case "nao_respondeu": {
      const sug = sugerirProximaTentativa(next, plano);
      if (sug.aplicavel) {
        setAcao("tentativa_cadencia", entrada.proximaAcaoEm ?? sug.quandoISO, sug.rotulo);
      } else {
        setAcao("avaliar_descarte", entrada.proximaAcaoEm ?? entrada.em);
      }
      break;
    }
    case "telefone_invalido": {
      if (entrada.encaminharDescarte) setAcao("avaliar_descarte", entrada.em);
      else setAcao("corrigir_cadastro", entrada.proximaAcaoEm ?? null);
      break;
    }
    case "sem_interesse": {
      setAcao("avaliar_descarte", entrada.em);
      break;
    }
    case "contato_inadequado": {
      if (entrada.encaminharDescarte) setAcao("avaliar_descarte", entrada.em);
      else setAcao("tentativa_cadencia", entrada.proximaAcaoEm ?? null, "Reagendado após contato inadequado");
      break;
    }
  }
  next = { ...next, coluna: derivarColuna(next) };
  return next;
}

/** Agenda visita: SAÍDA do quadro (Pipeline de Visitas). */
export function aplicarVisitaAgendada(lead: LeadNova, visitaISO: string): LeadNova {
  return {
    ...lead,
    visitaAgendadaEm: visitaISO,
    respostaPendenteCorretor: false,
    proximaAcaoTipo: null,
    proximaAcaoTitulo: null,
    proximaAcaoEm: null,
  };
}

/** Registra proposta: SAÍDA do quadro (Esteira de Vendas). Não exige aceite. */
export function aplicarPropostaRegistrada(lead: LeadNova, proposta: PropostaRegistrada): LeadNova {
  return {
    ...lead,
    proposta,
    respostaPendenteCorretor: false,
    proximaAcaoTipo: null,
    proximaAcaoTitulo: null,
    proximaAcaoEm: null,
  };
}

/* ============================ Ação comercial (cliente que JÁ respondeu) ============================ */

export interface EntradaAcaoComercial {
  resultado?: ResultadoAcaoComercial | null;
  em?: string | null;
  observacao?: string | null;
  /** Próxima ação exigida pelos resultados que continuam o acompanhamento. */
  proximaAcaoTipo?: ProximaAcaoTipo | null;
  proximaAcaoEm?: string | null;
  /** Exigido quando resultado = visita_agendada. */
  visitaEm?: string | null;
  /** Exigido quando resultado = proposta_registrada. */
  proposta?: EntradaProposta | null;
  /** Exigido quando resultado = sem_interesse (descarte estruturado). */
  descarte?: EntradaDescarte | null;
}

/**
 * Valida a conclusão de uma AÇÃO COMERCIAL (fluxo "Concluir ação atual").
 * Nunca envolve cadência: não valida tentativa, não permite tentativa_cadencia
 * nem sugere descarte automático por falta de resposta.
 */
export function validarResultadoAcaoComercial(entrada: EntradaAcaoComercial): ResultadoValidacao {
  const erros: string[] = [];
  if (!entrada.resultado || !RESULTADOS_ACAO_COMERCIAL.includes(entrada.resultado)) {
    erros.push("Selecione o resultado da ação.");
    return { ok: false, erros };
  }
  if (!dataValida(entrada.em)) {
    erros.push("Data/hora da conclusão é obrigatória e deve ser válida.");
  }
  switch (entrada.resultado) {
    case "visita_agendada":
      if (!dataValida(entrada.visitaEm)) erros.push("Visita agendada: informe data e hora da visita.");
      break;
    case "proposta_registrada": {
      const r = validarProposta(entrada.proposta ?? {});
      if (!r.ok) erros.push(...r.erros);
      break;
    }
    case "sem_interesse": {
      const r = validarDescarte(entrada.descarte ?? {});
      if (!r.ok) erros.push("Sem interesse exige descarte estruturado: " + r.erros.join(" "));
      break;
    }
    case "pediu_novo_retorno":
    case "aguardando_documento": {
      // Tipo é FORÇADO pelo motor (retornar_contato / solicitar_documentacao);
      // exige apenas a data/hora combinada.
      if (!dataValida(entrada.proximaAcaoEm)) {
        erros.push("Informe data e hora da próxima ação.");
      }
      break;
    }
    default: {
      // Continua no acompanhamento: exige próxima ação comercial + data/hora.
      const tipo = entrada.proximaAcaoTipo;
      if (!tipo || tipo === "tentativa_cadencia" || tipo === "avaliar_descarte" || !TIPOS_PROXIMA_ACAO.includes(tipo)) {
        erros.push("Defina a próxima ação comercial (a cadência de prospecção não se aplica).");
      }
      if (!dataValida(entrada.proximaAcaoEm)) {
        erros.push("Informe data e hora da próxima ação.");
      }
    }
  }
  return { ok: erros.length === 0, erros };
}

/**
 * Aplica o resultado de uma AÇÃO COMERCIAL validada (fluxo "Concluir ação atual").
 * SEPARADA de aplicarTentativa por regra de negócio:
 *  - NÃO incrementa tentativas de prospecção;
 *  - NÃO reinicia a cadência 1→4 (respondeu permanece true);
 *  - NÃO sugere descarte por ausência de resposta no acompanhamento;
 *  - visita_agendada / proposta_registrada / sem_interesse geram as saídas.
 */
export function aplicarResultadoAcaoComercial(
  lead: LeadNova,
  entrada: { resultado: ResultadoAcaoComercial; em: string } & EntradaAcaoComercial,
): LeadNova {
  const registro: AcaoComercialRegistro = {
    seq: lead.acoesComerciais.length + 1,
    acaoPrevista: lead.proximaAcaoTitulo,
    resultado: entrada.resultado,
    em: entrada.em,
    observacao: entrada.observacao || undefined,
  };
  let next: LeadNova = {
    ...lead,
    acoesComerciais: [...lead.acoesComerciais, registro],
    ultimaInteracaoEm: entrada.em,
    respostaPendenteCorretor: false,
    aguardandoRespostaAutomacao: false,
  };

  switch (entrada.resultado) {
    case "visita_agendada":
      return aplicarVisitaAgendada(next, entrada.visitaEm as string);
    case "proposta_registrada": {
      const p = entrada.proposta as EntradaProposta;
      return aplicarPropostaRegistrada(next, {
        produto: (p.produto as string).trim(),
        valor: p.valor as number,
        data: p.data as string,
        observacao: p.observacao || undefined,
      });
    }
    case "sem_interesse": {
      const d = entrada.descarte as EntradaDescarte;
      const motivo = d.motivo === "outro" ? `outro: ${d.detalhe}` : (d.motivo as string);
      return {
        ...next,
        descartadoMotivo: motivo,
        proximaAcaoTipo: null,
        proximaAcaoTitulo: null,
        proximaAcaoEm: null,
      };
    }
    case "pediu_novo_retorno": {
      next = {
        ...next,
        proximaAcaoTipo: "retornar_contato",
        proximaAcaoTitulo: ACAO_TITULO.retornar_contato,
        proximaAcaoEm: entrada.proximaAcaoEm ?? null,
      };
      break;
    }
    case "aguardando_documento": {
      next = {
        ...next,
        proximaAcaoTipo: "solicitar_documentacao",
        proximaAcaoTitulo: "Cobrar documentação combinada",
        proximaAcaoEm: entrada.proximaAcaoEm ?? null,
      };
      break;
    }
    default: {
      // acao_concluida | cliente_respondeu | sem_resposta_acompanhamento | opcoes_enviadas | outro
      const tipo = entrada.proximaAcaoTipo as ProximaAcaoTipo;
      next = {
        ...next,
        proximaAcaoTipo: tipo,
        proximaAcaoTitulo: ACAO_TITULO[tipo],
        proximaAcaoEm: entrada.proximaAcaoEm ?? null,
      };
    }
  }
  // respondeu permanece true — o acompanhamento comercial nunca volta à cadência.
  next = { ...next, respondeu: true, coluna: derivarColuna(next) };
  return next;
}

/* ============================ Timeline unificada ============================ */

export type TimelineEventoTipo = "mensagem_automatica" | "tentativa" | "acao_comercial";

export interface TimelineEvento {
  tipo: TimelineEventoTipo;
  em: string;
  titulo: string;
  detalhe?: string;
  observacao?: string;
  /** Nº da tentativa humana (apenas tipo "tentativa"). */
  numero?: number;
  resultado?: string;
}

const TL_CANAL: Record<CanalContato, string> = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  presencial: "Presencial",
};

const TL_RESULTADO_TENTATIVA: Record<ResultadoTentativa, string> = {
  nao_respondeu: "Não respondeu",
  respondeu: "Respondeu",
  telefone_invalido: "Telefone inválido",
  pediu_retorno: "Pediu retorno",
  sem_interesse: "Sem interesse",
  contato_inadequado: "Contato inadequado",
};

/**
 * Monta a trilha unificada do lead:
 * mensagem automática (NÃO conta como tentativa humana) → tentativas humanas
 * numeradas → ações comerciais. Ordenada por data.
 */
export function montarTimeline(lead: LeadNova): TimelineEvento[] {
  const evts: TimelineEvento[] = [];
  if (lead.mensagemAutomaticaEnviadaEm) {
    evts.push({
      tipo: "mensagem_automatica",
      em: lead.mensagemAutomaticaEnviadaEm,
      titulo: "Mensagem automática enviada",
      detalhe: "Disparo do ERP na entrada do lead — não conta como tentativa humana e não gera novo envio.",
    });
  }
  for (const t of lead.tentativas) {
    evts.push({
      tipo: "tentativa",
      em: t.em,
      numero: t.numero,
      resultado: t.resultado,
      titulo: `${TL_CANAL[t.canal]} · ${TL_RESULTADO_TENTATIVA[t.resultado]}`,
      observacao: t.observacao,
    });
  }
  for (const a of lead.acoesComerciais) {
    evts.push({
      tipo: "acao_comercial",
      em: a.em,
      resultado: a.resultado,
      titulo: RESULTADO_ACAO_ROTULO[a.resultado],
      detalhe: a.acaoPrevista ? `Ação prevista: ${a.acaoPrevista}` : undefined,
      observacao: a.observacao,
    });
  }
  evts.sort((x, y) => Date.parse(x.em) - Date.parse(y.em));
  return evts;
}

/* ============================ Validação de proposta ============================ */

export interface EntradaProposta {
  produto?: string | null;
  valor?: number | null;
  data?: string | null;
  observacao?: string | null;
}

export function validarProposta(entrada: EntradaProposta): ResultadoValidacao {
  const erros: string[] = [];
  if (!(entrada.produto && entrada.produto.trim())) erros.push("Informe o empreendimento/produto.");
  if (!(typeof entrada.valor === "number" && entrada.valor > 0)) erros.push("Informe o valor proposto (maior que zero).");
  if (!dataValida(entrada.data)) erros.push("Informe a data da proposta.");
  return { ok: erros.length === 0, erros };
}

/* ============================ Próximo passo válido ============================ */

/**
 * Todo lead precisa de um próximo passo válido, EXCETO quando está em saída:
 * visita agendada, proposta registrada, descarte ou nutrição formal.
 */
export function leadTemProximoPassoValido(lead: LeadNova): boolean {
  if (saidaDoLead(lead) !== null) return true;
  return !!(lead.proximaAcaoTipo && lead.proximaAcaoTitulo && dataValida(lead.proximaAcaoEm));
}

/* ============================ Saídas conceituais ============================ */

export interface SaidaVisitas {
  elegivel: boolean;
  motivo: string;
  payloadConceitual: {
    leadId: string;
    clienteNome: string;
    visitaEm: string | null;
    origem: "crm_nova_era";
  } | null;
}

export function determinarSaidaVisitas(lead: LeadNova): SaidaVisitas {
  if (lead.descartadoMotivo) {
    return { elegivel: false, motivo: "Lead descartado não vai para visitas.", payloadConceitual: null };
  }
  if (!lead.visitaAgendadaEm) {
    return {
      elegivel: false,
      motivo: "Ainda não há visita agendada. Agende uma visita para habilitar a saída.",
      payloadConceitual: null,
    };
  }
  return {
    elegivel: true,
    motivo: "Visita agendada — encaminhado ao Pipeline de Visitas.",
    payloadConceitual: {
      leadId: lead.id,
      clienteNome: lead.nome,
      visitaEm: lead.visitaAgendadaEm,
      origem: "crm_nova_era",
    },
  };
}

export interface SaidaEsteira {
  elegivel: boolean;
  motivo: string;
  payloadConceitual: {
    leadId: string;
    clienteNome: string;
    origem: "crm_nova_era";
    gatilho: "proposta_registrada";
    proposta: PropostaRegistrada;
  } | null;
}

/**
 * A Esteira de Vendas inicia quando a PROPOSTA É REGISTRADA/REALIZADA.
 * Não é necessário aceite: a Esteira acompanha o processo comercial iniciado
 * pela proposta.
 */
export function determinarSaidaEsteira(lead: LeadNova): SaidaEsteira {
  if (lead.descartadoMotivo) {
    return { elegivel: false, motivo: "Lead descartado não segue para a Esteira.", payloadConceitual: null };
  }
  if (!lead.proposta) {
    return {
      elegivel: false,
      motivo: "A Esteira de Vendas inicia quando uma proposta é registrada.",
      payloadConceitual: null,
    };
  }
  return {
    elegivel: true,
    motivo: "Proposta registrada — encaminhado à Esteira de Vendas (acompanhamento do processo comercial).",
    payloadConceitual: {
      leadId: lead.id,
      clienteNome: lead.nome,
      origem: "crm_nova_era",
      gatilho: "proposta_registrada",
      proposta: lead.proposta,
    },
  };
}

/* ============================ Descarte estruturado ============================ */

export const MOTIVOS_DESCARTE = [
  "sem_interesse",
  "sem_perfil_financeiro",
  "numero_invalido",
  "ja_comprou_concorrente",
  "duplicado",
  "outro",
] as const;
export type MotivoDescarte = (typeof MOTIVOS_DESCARTE)[number];

export interface EntradaDescarte {
  motivo?: MotivoDescarte | null;
  detalhe?: string | null;
}

export function validarDescarte(entrada: EntradaDescarte): ResultadoValidacao {
  const erros: string[] = [];
  if (!entrada.motivo || !MOTIVOS_DESCARTE.includes(entrada.motivo)) {
    erros.push("Selecione um motivo de descarte.");
  }
  if (entrada.motivo === "outro" && !(entrada.detalhe && entrada.detalhe.trim())) {
    erros.push("Para 'outro', descreva o motivo.");
  }
  return { ok: erros.length === 0, erros };
}

/* ============================ Minha fila de hoje ============================ */

export type CategoriaFila = 1 | 2 | 3 | 4 | 5 | 6;

export const CATEGORIA_ROTULO: Record<CategoriaFila, string> = {
  1: "Ações atrasadas críticas",
  2: "Responderam e aguardam você",
  3: "Ações previstas para agora",
  4: "Novos sem atuação",
  5: "Demais ações do dia",
  6: "Ações futuras",
};

export interface ItemFila {
  lead: LeadNova;
  atraso: AtrasoInfo;
  categoria: CategoriaFila;
}

/** Janela (min) para "previsto para agora". */
const JANELA_AGORA_MIN = 60;

function categoriaDoLead(lead: LeadNova, atraso: AtrasoInfo, agoraISO: string): CategoriaFila {
  if (atraso.nivel === "critico") return 1;
  if (lead.respostaPendenteCorretor) return 2;
  if (atraso.atrasadoMin > 0) return 3; // atrasada (não crítica) = precisa agora
  if (lead.proximaAcaoEm && -minutosEntre(agoraISO, lead.proximaAcaoEm) <= JANELA_AGORA_MIN) return 3; // vence em até 60min
  if (!lead.respondeu && lead.tentativas.length === 0) return 4; // novo sem atuação humana
  if (lead.proximaAcaoEm && mesmoDia(lead.proximaAcaoEm, agoraISO)) return 5;
  return 6;
}

/** Lead entra na fila? Saídas ficam fora; nutrição só com ação para hoje. */
export function deveEstarNaFila(lead: LeadNova, agoraISO: string): boolean {
  const saida = saidaDoLead(lead);
  if (saida === "pipeline_visitas" || saida === "esteira_vendas" || saida === "descartado") return false;
  if (saida === "nutricao") {
    return !!(lead.proximaAcaoEm && mesmoDia(lead.proximaAcaoEm, agoraISO));
  }
  return true;
}

/**
 * Ordena "Minha fila de hoje" na ordem obrigatória:
 * 1 críticas → 2 responderam/aguardam → 3 previstas p/ agora → 4 novos sem
 * atuação → 5 demais do dia → 6 futuras. Dentro da categoria: horário, id.
 */
export function ordenarFilaHoje(
  leads: LeadNova[],
  agoraISO: string,
  cfg: SeveridadeConfig = SEVERIDADE_PADRAO,
): ItemFila[] {
  const itens: ItemFila[] = leads
    .filter((l) => deveEstarNaFila(l, agoraISO))
    .map((lead) => {
      const atraso = calcularAtraso(lead, agoraISO, cfg);
      return { lead, atraso, categoria: categoriaDoLead(lead, atraso, agoraISO) };
    });
  itens.sort((x, y) => {
    if (x.categoria !== y.categoria) return x.categoria - y.categoria;
    const tx = Date.parse(x.lead.proximaAcaoEm ?? x.lead.criadoEm);
    const ty = Date.parse(y.lead.proximaAcaoEm ?? y.lead.criadoEm);
    if (tx !== ty) return tx - ty;
    return x.lead.id < y.lead.id ? -1 : x.lead.id > y.lead.id ? 1 : 0;
  });
  return itens;
}

/* ============================ Indicadores ============================ */

export interface IndicadoresFila {
  vencidas: number;
  respostasAguardando: number;
  novosSemAtuacao: number;
  concluidasHoje: number;
  visitasAgendadas: number;
  propostasRegistradas: number;
}

export function calcularIndicadores(
  leads: LeadNova[],
  agoraISO: string,
  cfg: SeveridadeConfig = SEVERIDADE_PADRAO,
): IndicadoresFila {
  let vencidas = 0, respostasAguardando = 0, novosSemAtuacao = 0, concluidasHoje = 0,
    visitasAgendadas = 0, propostasRegistradas = 0;
  for (const l of leads) {
    const saida = saidaDoLead(l);
    if (saida === "pipeline_visitas") visitasAgendadas++;
    if (saida === "esteira_vendas") propostasRegistradas++;
    for (const t of l.tentativas) if (mesmoDia(t.em, agoraISO)) concluidasHoje++;
    if (saida !== null && saida !== "nutricao") continue;
    if (l.respostaPendenteCorretor) respostasAguardando++;
    if (!l.respondeu && l.tentativas.length === 0) novosSemAtuacao++;
    if (calcularAtraso(l, agoraISO, cfg).atrasadoMin > 0) vencidas++;
  }
  return { vencidas, respostasAguardando, novosSemAtuacao, concluidasHoje, visitasAgendadas, propostasRegistradas };
}

/* ============================ Filtros ============================ */

export interface FiltroFila {
  escopo: "meus" | "todos";
  status: "atrasados" | "responderam" | "sem_resposta" | "quentes" | null;
  etapa: ColunaChave | null;
  origem: string | null;
}

export const FILTRO_PADRAO: FiltroFila = { escopo: "todos", status: null, etapa: null, origem: null };

export function filtrarLeads(
  leads: LeadNova[],
  filtro: FiltroFila,
  corretorAtual: string,
  agoraISO: string,
  cfg: SeveridadeConfig = SEVERIDADE_PADRAO,
): LeadNova[] {
  return leads.filter((l) => {
    if (filtro.escopo === "meus" && l.corretorNome !== corretorAtual) return false;
    if (filtro.etapa && l.coluna !== filtro.etapa) return false;
    if (filtro.origem && l.origem !== filtro.origem) return false;
    switch (filtro.status) {
      case "atrasados":
        if (calcularAtraso(l, agoraISO, cfg).atrasadoMin <= 0) return false;
        break;
      case "responderam":
        if (!l.respondeu) return false;
        break;
      case "sem_resposta":
        if (l.respondeu) return false;
        break;
      case "quentes":
        if (l.momento !== "quente" && l.momento !== "negociando") return false;
        break;
    }
    return true;
  });
}

/* ============================ Coach ("Como atender este lead") ============================ */

export interface SugestaoPasso {
  titulo: string;
  detalhe: string;
  acao: "registrar_tentativa" | "executar_acao" | "agendar_visita" | "registrar_proposta" | "descartar" | "acompanhar_saida" | "aguardar_automacao";
}

function horaLocalBrasilia(iso: string): string {
  const t = Date.parse(iso) + JANELA_OPERACIONAL_PADRAO.utcOffsetMinutos * 60000;
  const d = new Date(t);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

export function sugerirProximoPasso(
  lead: LeadNova,
  agoraISO: string,
  plano: CadenciaPlano = PLANO_CADENCIA_PADRAO,
  cfg: SeveridadeConfig = SEVERIDADE_PADRAO,
): SugestaoPasso {
  const saida = saidaDoLead(lead);
  if (saida === "esteira_vendas") {
    return {
      titulo: "Encaminhado à Esteira de Vendas",
      detalhe: "Proposta registrada — o processo comercial segue na Esteira de Vendas.",
      acao: "acompanhar_saida",
    };
  }
  if (saida === "pipeline_visitas") {
    return {
      titulo: "Encaminhado ao Pipeline de Visitas",
      detalhe: "Visita agendada — o acompanhamento sai do CRM de atendimento.",
      acao: "acompanhar_saida",
    };
  }
  if (saida === "descartado") {
    return { titulo: "Lead descartado", detalhe: `Motivo: ${lead.descartadoMotivo}.`, acao: "acompanhar_saida" };
  }
  if (saida === "nutricao") {
    return { titulo: "Em nutrição", detalhe: "Arquivado formalmente para nutrição futura.", acao: "acompanhar_saida" };
  }
  if (lead.respostaPendenteCorretor) {
    return {
      titulo: "Cliente respondeu — responda agora",
      detalhe: "Há uma resposta aguardando você. Registre a interação e defina a próxima ação comercial.",
      acao: "registrar_tentativa",
    };
  }
  const atraso = calcularAtraso(lead, agoraISO, cfg);
  const urg = atraso.nivel === "critico" ? "Prioridade máxima agora. " : atraso.atrasadoMin > 0 ? "Já passou do horário previsto. " : "";
  if (!lead.respondeu) {
    // Lead novo monitorando a mensagem automática: só nasce intervenção humana após o prazo.
    if (
      lead.aguardandoRespostaAutomacao &&
      lead.mensagemAutomaticaEnviadaEm &&
      lead.tentativas.length === 0 &&
      lead.proximaAcaoEm &&
      minutosEntre(agoraISO, lead.proximaAcaoEm) < 0
    ) {
      return {
        titulo: "Aguardando resposta da mensagem automática",
        detalhe: `A automação do ERP enviou o 1º WhatsApp às ${horaLocalBrasilia(lead.mensagemAutomaticaEnviadaEm)} (Brasília). Não enviar outra mensagem agora — verificar/agir a partir de ${horaLocalBrasilia(lead.proximaAcaoEm)}.`,
        acao: "aguardar_automacao",
      };
    }
    const sug = sugerirProximaTentativa(lead, plano);
    if (!sug.aplicavel) {
      return {
        titulo: "Cadência esgotada",
        detalhe: `Todas as ${plano.maxTentativas} tentativas foram feitas sem resposta. Decidir entre nutrir ou descartar.`,
        acao: "descartar",
      };
    }
    return {
      titulo: `Tentativa ${sug.numeroTentativa} de ${plano.maxTentativas} — ${sug.rotulo}`,
      detalhe: `${urg}Canal sugerido: ${sug.canal}.${lead.mensagemAutomaticaEnviadaEm && lead.tentativas.length === 0 ? " A mensagem automática já foi enviada — não disparar WhatsApp duplicado." : ""}`,
      acao: "registrar_tentativa",
    };
  }
  // respondeu: guiar pela AÇÃO COMERCIAL armazenada (nunca "Tentativa N")
  if (lead.proximaAcaoTipo === "avaliar_descarte") {
    return { titulo: "Avaliar descarte", detalhe: "Registrar descarte com motivo estruturado ou reativar com nova ação.", acao: "descartar" };
  }
  return {
    titulo: lead.proximaAcaoTitulo ?? "Definir próxima ação comercial",
    detalhe: `${urg}Acompanhamento comercial — execute a ação combinada e registre o resultado.`,
    acao: "executar_acao",
  };
}
