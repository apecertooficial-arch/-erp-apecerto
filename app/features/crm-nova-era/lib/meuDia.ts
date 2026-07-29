/**
 * Helpers PUROS do Meu Dia (Fase 5). Sem JSX: testável em node.
 */
export function esperaHumana(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "agora";
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;
  return `${Math.floor(min / (60 * 24))}d ${Math.floor((min % (60 * 24)) / 60)}h`;
}
