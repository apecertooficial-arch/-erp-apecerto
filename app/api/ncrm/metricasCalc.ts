/** Fórmulas puras das métricas (testáveis, sem rede). */
export function taxaRespostaPct(respondeu: number, total: number): number {
  if (!Number.isFinite(respondeu) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((Math.max(0, respondeu) / total) * 100);
}
