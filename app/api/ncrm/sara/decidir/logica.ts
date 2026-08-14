/* Regras puras da decisão da Sara, sem dependência de Supabase.
 *
 * Separadas da rota para que a lógica pura possa ser testada diretamente: a rota
 * importa o cliente do banco, que não resolve fora do bundler, e sem isso não
 * dá para testar a validação do lote direto no node.
 */

/** Teto do lote. Espelha a trava do banco — o cliente nunca é a única defesa. */
export const LOTE_MAX = 100;

export type Decisao = "aprovada" | "rejeitada";

/** Só as duas decisões que a RPC aceita. Qualquer outra coisa vira null. */
export function lerDecisao(bruto: unknown): Decisao | null {
  return bruto === "aprovada" ? "aprovada" : bruto === "rejeitada" ? "rejeitada" : null;
}

/**
 * Ids válidos, únicos e dentro do teto. Lista suja não vira chamada ao banco.
 * Rejeita: não-array, vazio, acima do teto, não-inteiro, zero, negativo, NaN.
 * Deduplica ANTES de conferir o teto — 200 repetições do mesmo id são 1 item.
 */
export function normalizarLote(bruto: unknown): number[] | null {
  if (!Array.isArray(bruto)) return null;
  const ids = [...new Set(bruto.map(Number))];
  if (ids.length === 0 || ids.length > LOTE_MAX) return null;
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  return ids;
}
