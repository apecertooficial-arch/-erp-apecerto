type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesAttachmentReplaceRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_SUBSTITUICAO_SEM_PERMISSAO: 403,
  ESTEIRA_SUBSTITUICAO_NAO_ENCONTRADO: 404,
  ESTEIRA_SUBSTITUICAO_CONFLITO: 409,
  ESTEIRA_SUBSTITUICAO_REQUEST_CONFLITANTE: 409,
  ESTEIRA_SUBSTITUICAO_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_SUBSTITUICAO_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para substituir este documento. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A substituição de documentos está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível substituir o documento. O documento anterior foi preservado — tente novamente." } };
}

export async function replaceSalesAttachmentAtomic(
  client: SalesAttachmentReplaceRpcClient,
  args: { attachmentId: string; requestId: string; payload: Record<string, unknown> },
) {
  const { data, error } = await client.rpc("esteira_anexo_substituir", {
    p_anexo_id: args.attachmentId,
    p_request_id: args.requestId,
    p_payload: args.payload,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { anexo_id?: unknown; status?: unknown; path_anterior?: unknown; idempotente?: boolean };
  if (result.anexo_id !== args.attachmentId || result.status !== "anexado" || typeof result.path_anterior !== "string" || !result.path_anterior) {
    return { status: 502, body: { error: "Não foi possível confirmar a substituição persistida. Nada foi presumido — atualize a tela." } };
  }
  return {
    status: 200,
    body: { success: true, attachmentId: result.anexo_id, status: result.status, idempotent: result.idempotente === true },
    previousFilePath: result.path_anterior,
  };
}
