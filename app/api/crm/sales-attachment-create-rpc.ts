type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesAttachmentCreateRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_UPLOAD_SEM_PERMISSAO: 403,
  ESTEIRA_UPLOAD_NAO_ENCONTRADO: 404,
  ESTEIRA_UPLOAD_CONFLITO: 409,
  ESTEIRA_UPLOAD_REQUEST_CONFLITANTE: 409,
  ESTEIRA_UPLOAD_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_UPLOAD_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para anexar este documento. Nada foi registrado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "O envio de documentos está sendo atualizado. Tente novamente em alguns minutos. Nada foi registrado." } };
  return { status: 502, body: { error: "Não foi possível registrar o documento. Nada foi registrado — tente novamente." } };
}

export async function createSalesAttachmentAtomic(
  client: SalesAttachmentCreateRpcClient,
  args: { processId: string; requestId: string; payload: Record<string, unknown> },
) {
  const { data, error } = await client.rpc("esteira_anexo_registrar", {
    p_processo_id: args.processId,
    p_request_id: args.requestId,
    p_payload: args.payload,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { anexo_id?: unknown; status?: unknown; idempotente?: boolean };
  if (typeof result.anexo_id !== "string" || result.status !== "anexado") {
    return { status: 502, body: { error: "Não foi possível confirmar o documento persistido. Nada foi presumido — atualize a tela." } };
  }
  return {
    status: 200,
    body: { success: true, attachmentId: result.anexo_id, status: result.status, idempotent: result.idempotente === true },
  };
}
