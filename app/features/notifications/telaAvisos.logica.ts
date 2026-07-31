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
  criada_em: string;
  vista_em: string | null;
  resolvida_em: string | null;
};

export type Faixa = "agora" | "hoje" | "historico";

/** Ícone redondo por tipo, como no print. Glifo em texto: um ícone por tipo
 *  não justifica cinco SVGs nem uma dependência. */
export const ICONE_POR_TIPO: Record<string, { glifo: string; cor: string }> = {
  cliente_respondeu:           { glifo: "💬", cor: "laranja" },
  primeira_abordagem_pendente: { glifo: "👤", cor: "roxo" },
  acao_vencida:                { glifo: "⚠", cor: "vermelho" },
  visita_proxima:              { glifo: "📅", cor: "verde" },
  escalonamento:               { glifo: "⚠", cor: "vermelho" },
  lead_sem_corretor:           { glifo: "👤", cor: "roxo" },
  padrao:                      { glifo: "•", cor: "cinza" },
};

/** O rótulo diz o que o toque FAZ, não o nome técnico do aviso. */
export const ROTULO_ACAO_AVISO: Record<string, string> = {
  cliente_respondeu:           "Abrir ficha",
  primeira_abordagem_pendente: "Atender agora",
  acao_vencida:                "Ver tarefa",
  visita_proxima:              "Ver visita",
  escalonamento:               "Ver atendimento",
};

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
