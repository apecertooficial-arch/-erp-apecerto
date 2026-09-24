type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesRequestDecisionRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_SOLICITACAO_SEM_PERMISSAO: 403,
  ESTEIRA_SOLICITACAO_NAO_ENCONTRADA: 404,
  ESTEIRA_SOLICITACAO_JA_DECIDIDA: 409,
  ESTEIRA_SOLICITACAO_REQUEST_CONFLITANTE: 409,
  ESTEIRA_SOLICITACAO_NEGOCIO_INDISPONIVEL: 409,
  ESTEIRA_SOLICITACAO_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_SOLICITACAO_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Apenas administradores ou gestores podem decidir solicitações. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A decisão de solicitações está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível decidir a solicitação. Nada foi presumido — tente novamente." } };
}

export async function decideSalesRequestAtomic(
  client: SalesRequestDecisionRpcClient,
  args: { requestIdToDecide: string; approve: boolean; reason: string | null; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_solicitacao_decidir", {
    p_id: args.requestIdToDecide,
    p_aprovar: args.approve,
    p_motivo: args.reason,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as {
    solicitacao_id?: unknown;
    status?: unknown;
    venda_id?: unknown;
    processo_id?: unknown;
    idempotente?: boolean;
  };
  if (typeof result.solicitacao_id !== "string" || !["aprovada", "recusada"].includes(String(result.status))) {
    return { status: 502, body: { error: "Não foi possível confirmar a decisão. Nada foi presumido — atualize a tela." } };
  }
  return {
    status: 200,
    body: {
      success: true,
      requestId: result.solicitacao_id,
      status: String(result.status),
      saleId: typeof result.venda_id === "string" ? result.venda_id : null,
      processId: typeof result.processo_id === "string" ? result.processo_id : null,
      idempotent: result.idempotente === true,
    },
  };
}
