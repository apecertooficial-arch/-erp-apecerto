export const CAPTURE_SAFE_CODES: Record<string, string> = {
  CAPTURE_CONFLICT: "A captação mudou enquanto era processada. Recarregue antes de tentar novamente.",
  CAPTURE_FORBIDDEN: "Você não tem permissão para concluir esta ação.",
  CAPTURE_UNAVAILABLE: "Não foi possível concluir esta etapa da captação. Tente novamente.",
  DUPLICATE_PRODUCT: "Já existe um produto semelhante. Abra o cadastro existente em vez de criar outro.",
  PRODUCT_NOT_FOUND: "Produto não encontrado.",
  PRODUCT_NOT_READY: "O imóvel precisa ser completado antes da aprovação.",
  PRODUCT_PUBLICATION_FORBIDDEN: "Apenas a gestão de Produtos pode aprovar imóveis.",
  PUBLICATION_RULE: "A aprovação foi recusada pelas regras do produto.",
  READY_PRODUCT_WITHOUT_APPROVED_UNIT: "Produto pronto precisa ter ao menos uma unidade aprovada e disponível para aparecer no site.",
  RECONCILIATION_REQUIRED: "A captação foi aplicada apenas em parte. Não repita a operação; a gestão precisa reconciliar o cadastro.",
  SITE_PUBLICATION_NOT_CONFIRMED: "A aprovação foi processada, mas a publicação no site precisa ser reconciliada.",
};

export class CaptureClientError extends Error {}

type CaptureResult = Record<string, unknown> & { error?: string; code?: string };

export async function captureResponse(response: Response, fallback: string): Promise<CaptureResult> {
  let result: CaptureResult = {};
  try {
    const parsed = await response.json() as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) result = parsed as CaptureResult;
  } catch {
    result = {};
  }
  if (response.ok) return result;
  const code = typeof result.code === "string" ? result.code : "";
  const safeByCode = CAPTURE_SAFE_CODES[code];
  const businessMessage = response.status < 500 && typeof result.error === "string" ? result.error : null;
  throw new CaptureClientError(safeByCode ?? businessMessage ?? fallback);
}

export function captureFailureMessage(reason: unknown, fallback: string) {
  return reason instanceof CaptureClientError ? reason.message : fallback;
}
