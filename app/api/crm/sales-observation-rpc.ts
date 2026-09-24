type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesObservationRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_OBSERVACAO_SEM_PERMISSAO: 403,
  ESTEIRA_OBSERVACAO_NAO_ENCONTRADA: 404,
  ESTEIRA_OBSERVACAO_REQUEST_CONFLITANTE: 409,
  ESTEIRA_OBSERVACAO_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_OBSERVACAO_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para registrar observações nesta venda. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "O registro de observações está sendo atualizado. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível registrar a observação. Nada foi presumido — tente novamente." } };
}

export async function addSalesObservationAtomic(
  client: SalesObservationRpcClient,
  args: { processId: string; text: string; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_observacao_adicionar", {
    p_processo_id: args.processId,
    p_texto: args.text,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { observacao_id?: unknown; processo_id?: unknown; idempotente?: boolean };
  if (typeof result.observacao_id !== "string" || typeof result.processo_id !== "string") {
    return { status: 502, body: { error: "Não foi possível confirmar a observação registrada. Nada foi presumido — atualize a tela." } };
  }
  return {
    status: 200,
    body: {
      success: true,
      observationId: result.observacao_id,
      processId: result.processo_id,
      idempotent: result.idempotente === true,
    },
  };
}
