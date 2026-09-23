export const PRODUCT_SAFE_CODES: Record<string, string> = {
  INVALID_JSON: "A solicitação do imóvel é inválida. Atualize a tela e tente novamente.",
  PRODUCT_NOT_FOUND: "Produto não encontrado.",
  UNIT_NOT_FOUND: "Unidade não encontrada.",
  PRODUCT_NOT_READY: "O imóvel precisa ser completado antes da publicação.",
  UNIT_NOT_READY: "A unidade precisa ser completada antes da publicação.",
  PRODUCT_HAS_LINKS: "O produto possui histórico comercial e não pode ser excluído.",
  UNIT_HAS_LINKS: "A unidade possui histórico comercial e não pode ser excluída.",
  PRODUCT_DELETE_NOT_CONFIRMED: "A exclusão do produto não foi confirmada.",
  UNIT_DELETE_NOT_CONFIRMED: "A exclusão da unidade não foi confirmada.",
  PRODUCT_UPDATE_NOT_CONFIRMED: "A atualização do produto não foi confirmada.",
  UNIT_UPDATE_NOT_CONFIRMED: "A atualização da unidade não foi confirmada.",
  UNIT_DECISION_NOT_CONFIRMED: "A decisão da unidade não foi confirmada.",
  CAPTURE_DECISION_REASON_REQUIRED: "Informe o motivo da reprovação.",
  CAPTURE_DECISION_CONFLICT: "A captação já recebeu outra decisão. Atualize a tela antes de continuar.",
  CAPTURE_DECISION_AUDIT_MISSING: "A decisão não possui a auditoria esperada. Atualize a tela e acione a gestão.",
  PRODUCT_REQUEST_NOT_CONFIRMED: "O envio para aprovação não foi confirmado.",
  MEDIA_COVER_NOT_CONFIRMED: "A nova capa não foi confirmada.",
  MEDIA_UPDATE_NOT_CONFIRMED: "A classificação da mídia não foi confirmada.",
  MEDIA_DELETE_NOT_CONFIRMED: "A exclusão da mídia não foi confirmada.",
  MEDIA_AI_CONFLICT: "A galeria mudou desde a análise. Analise novamente para não sobrescrever outra edição.",
  MEDIA_AI_FORBIDDEN: "Você não tem permissão para aplicar sugestões nesta galeria.",
  MEDIA_AI_INVALID: "As sugestões precisam ser revisadas antes da aplicação.",
  FAVORITE_CHANGE_NOT_CONFIRMED: "A alteração do favorito não foi confirmada.",
  LEAD_LINK_CHANGE_NOT_CONFIRMED: "A alteração do vínculo com o lead não foi confirmada.",
  SITE_PUBLICATION_NOT_CONFIRMED: "A publicação foi processada, mas a vitrine precisa ser reconciliada.",
  RECONCILIATION_REQUIRED: "A alteração foi aplicada apenas em parte. Não repita a operação; atualize a ficha e acione a gestão para reconciliar o cadastro.",
};

export class ProductClientError extends Error {}

export type ProductResult = Record<string, unknown> & {
  error?: string;
  code?: string;
};

export async function productResponse(response: Response, fallback: string): Promise<ProductResult> {
  let result: ProductResult = {};
  try {
    const parsed = await response.json() as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) result = parsed as ProductResult;
  } catch {
    throw new ProductClientError(fallback);
  }
  if (response.ok) return result;
  const code = typeof result.code === "string" ? result.code : "";
  const safeByCode = PRODUCT_SAFE_CODES[code];
  const businessMessage = response.status < 500 && typeof result.error === "string" ? result.error : null;
  throw new ProductClientError(safeByCode ?? businessMessage ?? fallback);
}

export function productFailureMessage(reason: unknown, fallback: string) {
  return reason instanceof ProductClientError ? reason.message : fallback;
}

export function productSuccessMessage(result: ProductResult, success: string) {
  const code = typeof result.code === "string" ? result.code : "";
  return PRODUCT_SAFE_CODES[code] ?? success;
}
