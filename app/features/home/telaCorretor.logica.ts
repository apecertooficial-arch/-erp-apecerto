/* Regras puras da tela do corretor.
 *
 * Vivem fora do .tsx porque o runner de teste usa o strip-types do node, que
 * não entende JSX: importar o componente quebraria a suíte inteira. Mesmo
 * padrão de meuDia.logica.ts e de fila-operacional/logica.ts.
 */

/** Payload de /api/ncrm/fila-operacional, na parte que a tela usa. */
export type ItemTela = {
  negocio_id: number;
  nome: string | null;
  telefone_normalizado: string | null;
  interesse_resumo: string | null;
  motivo_prioridade: string;
  prioridade: number;
  respondeu: boolean;
  etapa: string;
  tempo_espera: number;
  sara_orientacao_curta: string | null;
  proxima_acao_prazo: string | null;
  outbound_real_confirmado: boolean;
  aguardando_sincronizacao: boolean;
};

export type Filtro = "agora" | "hoje" | "todos";

/** Duas iniciais. Nome de uma palavra usa as duas primeiras letras. */
export function iniciais(nome: string | null): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** "12 min", "24h", "3 d". Minuto cheio não interessa depois de uma hora. */
export function espera(minutos: number): string {
  const m = Math.max(0, Math.round(Number(minutos) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)} d`;
}

/** "sexta, 31 de julho" — minúscula, como no protótipo. */
export function dataPorExtenso(d: Date): string {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .replace("-feira", "")
    .toLowerCase();
}

export function saudacaoHora(h: number): string {
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Hoje no fuso de São Paulo — o corretor pensa no dia dele, não em UTC. */
export function ehHoje(iso: string | null, agora: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const fmt = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return fmt(d) === fmt(agora);
}

/** Prioridade 1 e 2 é quem espera AGORA: respondeu, ou lead novo sem atuação. */
export const ehAgora = (i: ItemTela) => i.prioridade <= 2;

/**
 * "Hoje" CONTÉM "Agora" de propósito. Se não contivesse, o corretor trocaria
 * de filtro e perderia de vista justamente quem está esperando.
 */
export function filtrar(itens: ItemTela[], f: Filtro): ItemTela[] {
  if (f === "agora") return itens.filter(ehAgora);
  if (f === "hoje") return itens.filter((i) => ehHoje(i.proxima_acao_prazo) || ehAgora(i));
  return itens;
}

/** Vencida: próxima ação passou do prazo, ou cadência vencida. */
export const ehVencida = (i: ItemTela) => i.prioridade === 3 || i.prioridade === 5;

/** Manchete do topo. É o que o corretor lê de longe, andando. */
export function manchete(qtd: number, carregando: boolean): string {
  if (carregando) return "Carregando sua fila…";
  if (qtd === 0) return "Ninguém esperando agora";
  return `${qtd} ${qtd === 1 ? "pessoa espera" : "pessoas esperam"} você agora`;
}
