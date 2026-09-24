type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesDocumentReviewRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_DOC_SEM_PERMISSAO: 403,
  ESTEIRA_DOC_NAO_ENCONTRADO: 404,
  ESTEIRA_DOC_CONFLITO: 409,
  ESTEIRA_DOC_REQUEST_CONFLITANTE: 409,
  ESTEIRA_DOC_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_DOC_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para revisar este documento. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A revisão de documentos está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível revisar o documento. Nada foi alterado — tente novamente." } };
}

export async function reviewSalesDocumentAtomic(
  client: SalesDocumentReviewRpcClient,
  args: { attachmentId: string; status: string; reason?: string | null; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_anexo_revisar", {
    p_anexo_id: args.attachmentId,
    p_status: args.status,
    p_motivo: args.reason || null,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { anexo_id?: string; status?: string; idempotente?: boolean };
  if (!result.anexo_id || !result.status) {
    return { status: 502, body: { error: "Não foi possível confirmar a revisão do documento. Nada foi presumido — tente novamente." } };
  }
  return { status: 200, body: { success: true, attachmentId: result.anexo_id, status: result.status, idempotent: result.idempotente === true } };
}
