/* Regras puras da tela de avisos do celular.
 *
 * Em .ts e não dentro do .tsx porque o runner de teste usa o strip-types do
 * node, que não entende JSX.
 */

export type Aviso = {
  id: number;
  tipo: string;
  prioridade: number;
  titulo: string;
  detalhe: string | null;
  negocio_id: number | null;
  deep_link?: string | null;
  criada_em: string;
  vista_em: string | null;
  resolvida_em: string | null;
  reaberturas?: number;
};

export type CoberturaAvisos = {
  status: "completa" | "parcial";
  exibidos: number;
  total: number;
};

export type Faixa = "agora" | "hoje" | "historico";

/** Ícone redondo por tipo, como no print. Glifo em texto: um ícone por tipo
 *  não justifica cinco SVGs nem uma dependência. */
export const ICONE_POR_TIPO: Record<string, { glifo: string; cor: string }> = {
  cliente_respondeu:           { glifo: "💬", cor: "laranja" },
  primeira_abordagem_pendente: { glifo: "👤", cor: "roxo" },
  acao_vencida:                { glifo: "⚠", cor: "vermelho" },
  visita_proxima:              { glifo: "📅", cor: "verde" },
  visita_feedback_pendente:    { glifo: "📝", cor: "laranja" },
  escalonamento:               { glifo: "⚠", cor: "vermelho" },
  canal_indisponivel:          { glifo: "📵", cor: "vermelho" },
  lead_em_atendimento:         { glifo: "💬", cor: "roxo" },
  lead_quente:                 { glifo: "🔥", cor: "laranja" },
  lead_sem_corretor:           { glifo: "👤", cor: "roxo" },
  padrao:                      { glifo: "•", cor: "cinza" },
};

/** O rótulo diz o que o toque FAZ, não o nome técnico do aviso. */
export const ROTULO_ACAO_AVISO: Record<string, string> = {
  cliente_respondeu:           "Abrir ficha",
  primeira_abordagem_pendente: "Atender agora",
  acao_vencida:                "Ver tarefa",
  visita_proxima:              "Ver visita",
  visita_feedback_pendente:    "Dar feedback",
  escalonamento:               "Ver atendimento",
  canal_indisponivel:          "Corrigir canal",
  lead_em_atendimento:         "Acompanhar lead",
  lead_quente:                 "Priorizar lead",
};

const ROTAS_INTERNAS_AVISO = new Set([
  "/agenda",
  "/configuracoes",
  "/crm",
  "/inicio",
  "/notificacoes",
]);

/**
 * Resolve o destino que realmente cumpre o rótulo mostrado no botão.
 *
 * O servidor já valida deep links, mas a interface repete a barreira: aviso é
 * dado persistido e nunca pode transformar um valor antigo ou corrompido em
 * navegação externa. Tipos operacionais que exigem outro módulo prevalecem
 * sobre o link histórico do negócio.
 */
export function destinoAviso(aviso: Aviso): string | null {
  if (aviso.tipo === "canal_indisponivel") return "/configuracoes?visao=conexoes";
  if (aviso.tipo === "visita_feedback_pendente" || aviso.tipo === "visita_proxima") return "/agenda";

  const link = aviso.deep_link?.trim() ?? "";
  if (/^\/negocio\/[0-9]+(?:\/[a-z-]+)?$/.test(link)) return link;
  if (ROTAS_INTERNAS_AVISO.has(link)) return link;
  if (link === "/meu-dia") return "/inicio";
  if (/^\/gestao\/[a-z-]+$/.test(link)) return "/inteligencia";

  const negocioId = Number(aviso.negocio_id);
  return Number.isSafeInteger(negocioId) && negocioId > 0 ? `/negocio/${negocioId}` : null;
}

/**
 * "há 6 min", "há 1 h", "há 2 d".
 *
 * Sempre relativo: o corretor quer saber há quanto tempo aquilo espera, e não
 * em que horário o servidor gravou a linha.
 */
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const min = Math.max(0, Math.round((agora.getTime() - d.getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

/**
 * Três faixas, como no print.
 *
 * "Agora" é prioridade 1 ainda não resolvida — o que cobra ação hoje, não o
 * que chegou hoje. Um aviso de ontem que ninguém tratou continua em "Agora",
 * porque continua cobrando. Ordenar por chegada esconderia justamente o mais
 * atrasado no fim da lista.
 */
export function agrupar(avisos: Aviso[], agora: Date = new Date()): Record<Faixa, Aviso[]> {
  const vivo = (a: Aviso) => !a.resolvida_em;
  const mesmoDia = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const f = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return f(d) === f(agora);
  };
  const porIdade = (a: Aviso, b: Aviso) =>
    new Date(a.criada_em).getTime() - new Date(b.criada_em).getTime();

  const agoraLista = avisos.filter((a) => vivo(a) && a.prioridade === 1).sort(porIdade);
  const idsAgora = new Set(agoraLista.map((a) => a.id));

  return {
    // Mais antigo primeiro: quem espera há mais tempo aparece em cima.
    agora: agoraLista,
    hoje: avisos.filter((a) => vivo(a) && !idsAgora.has(a.id) && mesmoDia(a.criada_em)).sort(porIdade),
    // Histórico é leitura, não trabalho: mais recente primeiro.
    historico: avisos.filter((a) => !vivo(a) || (!idsAgora.has(a.id) && !mesmoDia(a.criada_em)))
      .sort((a, b) => porIdade(b, a)),
  };
}
