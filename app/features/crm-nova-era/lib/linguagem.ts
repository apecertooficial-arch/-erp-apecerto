/**
 * LINGUAGEM DO CORRETOR (Fase 5.1). PURO e testável.
 * ------------------------------------------------------------------
 * Traduz jargão técnico para o vocabulário comercial. Termos técnicos
 * (nomes de tabelas/RPCs, context hash) NUNCA são exibidos ao corretor —
 * detalhes técnicos ficam apenas no painel administrativo.
 */

const DICIONARIO: Record<string, string> = {
  ingest: "Entrada de novos atendimentos",
  runner: "Análise automática da Sara",
  observer: "Sara apenas sugerindo",
  ncrm_estado: "atendimento",
  estado: "atendimento",
  checkpoint: "última atualização",
  noop: "ignorado sem alteração",
  sla: "tempo esperado de atendimento",
};

/** Termos que jamais podem aparecer na interface do corretor. */
const PROIBIDOS = [/context[_ ]?hash/i, /\bncrm_[a-z_]+/i, /\brpc\b/i, /\bsupabase\b/i];

export function termoCorretor(tecnico: string): string {
  return DICIONARIO[tecnico.trim().toLowerCase()] ?? tecnico;
}

/** true quando o texto contém jargão que não pode ser mostrado ao corretor. */
export function contemTermoTecnico(texto: string): boolean {
  return PROIBIDOS.some((re) => re.test(texto));
}

/** Rótulo do estado do piloto em linguagem do corretor. */
export function rotuloIngest(ativo: boolean | null): string {
  if (ativo == null) return "Entrada de novos atendimentos: —";
  return ativo ? "Entrada de novos atendimentos: ligada" : "Entrada de novos atendimentos: desligada";
}

export function rotuloSara(modo: string | null): string {
  if (modo === "observer") return "Sara apenas sugerindo";
  if (modo === "suggest") return "Sara sugerindo";
  if (modo === "off") return "Sara desligada";
  return "Sara: —";
}

export function rotuloRunner(ligado: boolean | null): string {
  if (ligado == null) return "Análise automática da Sara: —";
  return ligado ? "Análise automática da Sara: ligada" : "Análise automática da Sara: desligada";
}

/* ------------------------- Agrupamento do Meu dia ------------------------- */
export type GrupoMeuDia = "atenda_agora" | "faca_hoje" | "agendados" | "aguardando_cliente";

export const GRUPO_ROTULO: Record<GrupoMeuDia, string> = {
  atenda_agora: "Atenda agora",
  faca_hoje: "Faça hoje",
  agendados: "Agendados",
  aguardando_cliente: "Aguardando cliente",
};

export const GRUPO_ORDEM: GrupoMeuDia[] = ["atenda_agora", "faca_hoje", "agendados", "aguardando_cliente"];

/**
 * Classifica um item da fila em um dos 4 grupos visuais.
 *  - prioridade 1 (cliente respondeu) e 2 (lead novo) => Atenda agora
 *  - 3, 4, 5, 6 (vencidos / promessa / cadência / sem próxima ação) => Faça hoje
 *  - 7 com prazo futuro => Agendados
 *  - respondeu e sem pendência do corretor => Aguardando cliente
 */
export function grupoDoItem(item: { prioridade: number; respondeu?: boolean; proxima_acao_em?: string | null }): GrupoMeuDia {
  if (item.prioridade <= 2) return "atenda_agora";
  if (item.prioridade <= 6) return "faca_hoje";
  if (item.respondeu) return "aguardando_cliente";
  return "agendados";
}
