type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesReturnRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  VENDA_DEVOLVER_SEM_PERMISSAO: 403,
  VENDA_DEVOLVER_NAO_ENCONTRADA: 404,
  VENDA_DEVOLVER_CONFLITO: 409,
  VENDA_DEVOLVER_REQUEST_CONFLITANTE: 409,
};

function translate(error: RpcError) {
  const match = /^(VENDA_DEVOLVER_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para devolver esta venda. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A devolução está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível devolver a venda ao funil. Nada foi alterado — tente novamente." } };
}

export async function returnSaleAtomic(client: SalesReturnRpcClient, args: { processId: string; stageId: number; reason: string | null; requestId: string }) {
  const { data, error } = await client.rpc("esteira_venda_devolver", {
    p_processo_id: args.processId,
    p_stage_id: args.stageId,
    p_motivo: args.reason,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { processo_id?: string; negocio_id?: number; idempotente?: boolean };
  if (!result.processo_id || !Number.isSafeInteger(result.negocio_id)) return { status: 502, body: { error: "Não foi possível confirmar a devolução. Nada foi presumido — tente novamente." } };
  return { status: 200, body: { success: true, processId: result.processo_id, dealId: result.negocio_id, idempotent: result.idempotente === true } };
}
