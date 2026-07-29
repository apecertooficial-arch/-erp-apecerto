/**
 * Regras PURAS da classificação assistida da carteira antiga (Fase 6 PR B).
 * Sem dependência de rede ou banco — testável isoladamente.
 */

/** Teto rígido de itens por lote. Nunca deve ser afrouxado sem nova decisão. */
export const LIMITE_LOTE = 10;

/** Hash estável (djb2) do contexto — idempotência da leitura, sem depender do relógio. */
export function hashContexto(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `ca${(h >>> 0).toString(36)}`;
}

/** Qualidade do contexto a partir de sinais reais da conversa. Nunca inventa base. */
export function qualidadeContexto(
  mensagens: number, recebidas: number, audiosSemTranscricao: number,
): "insuficiente" | "parcial" | "boa" {
  if (mensagens <= 0) return "insuficiente";
  if (mensagens < 4 || recebidas <= 0 || audiosSemTranscricao > 0) return "parcial";
  return "boa";
}

/** Normaliza a quantidade pedida ao teto do lote. */
export function quantidadeDoLote(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 1) return LIMITE_LOTE;
  return Math.min(Math.trunc(n), LIMITE_LOTE);
}
