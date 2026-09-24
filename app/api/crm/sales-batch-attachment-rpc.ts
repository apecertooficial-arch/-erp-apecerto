type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesBatchAttachmentRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_LOTE_SEM_PERMISSAO: 403,
  ESTEIRA_LOTE_NAO_ENCONTRADO: 404,
  ESTEIRA_LOTE_CONFLITO: 409,
  ESTEIRA_LOTE_REQUEST_CONFLITANTE: 409,
  ESTEIRA_LOTE_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_LOTE_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para enviar documentos nesta etapa. Nada foi registrado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "O envio de documentos está sendo atualizado. Tente novamente em alguns minutos. Nada foi registrado." } };
  return { status: 502, body: { error: "Não foi possível registrar o lote de documentos. Nada foi registrado — tente novamente." } };
}

export async function registerSalesBatchAttachmentsAtomic(
  client: SalesBatchAttachmentRpcClient,
  args: {
    processId: string;
    batchId: string;
    stageSlug?: string | null;
    files: Array<{ nome: string; path: string; mime?: string | null; tamanho?: number | null }>;
  },
) {
  const { data, error } = await client.rpc("esteira_anexo_lote_registrar", {
    p_processo_id: args.processId,
    p_lote_id: args.batchId,
    p_etapa_slug: args.stageSlug || null,
    p_arquivos: args.files,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { lote_id?: unknown; anexos?: unknown; idempotente?: boolean };
  if (result.lote_id !== args.batchId || !Array.isArray(result.anexos)) {
    return { status: 502, body: { error: "Não foi possível confirmar o lote persistido. Nada foi presumido — atualize a tela." } };
  }
  return {
    status: 200,
    body: { success: true, loteId: result.lote_id, anexos: result.anexos, idempotent: result.idempotente === true },
  };
}
