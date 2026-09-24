type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesAttachmentRemoveRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_ANEXO_SEM_PERMISSAO: 403,
  ESTEIRA_ANEXO_NAO_ENCONTRADO: 404,
  ESTEIRA_ANEXO_CONFLITO: 409,
  ESTEIRA_ANEXO_REQUEST_CONFLITANTE: 409,
  ESTEIRA_ANEXO_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_ANEXO_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para remover este documento. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A remoção de documentos está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível remover o documento. Nada foi presumido — tente novamente." } };
}

export async function removeSalesAttachmentAtomic(
  client: SalesAttachmentRemoveRpcClient,
  args: { attachmentId: string; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_anexo_remover", {
    p_anexo_id: args.attachmentId,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { anexo_id?: unknown; path?: unknown; idempotente?: boolean };
  if (result.anexo_id !== args.attachmentId || typeof result.path !== "string" || !result.path) {
    return { status: 502, body: { error: "Não foi possível confirmar a remoção persistida. Nada foi presumido — atualize a tela." } };
  }
  return {
    status: 200,
    body: { success: true, attachmentId: result.anexo_id, idempotent: result.idempotente === true },
    filePath: result.path,
  };
}
