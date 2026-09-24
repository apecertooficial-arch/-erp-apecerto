type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesCommissionRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_COMISSAO_SEM_PERMISSAO: 403,
  ESTEIRA_COMISSAO_NAO_ENCONTRADA: 404,
  ESTEIRA_COMISSAO_CONFLITO: 409,
  ESTEIRA_COMISSAO_REQUEST_CONFLITANTE: 409,
  ESTEIRA_COMISSAO_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_COMISSAO_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para alterar esta comissão. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A gravação da comissão está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível salvar a comissão. Nada foi alterado — tente novamente." } };
}

export async function saveSalesCommissionAtomic(
  client: SalesCommissionRpcClient,
  args: { processId: string; commission: Record<string, unknown>; installments: Array<Record<string, unknown>> | null; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_comissao_salvar", {
    p_processo_id: args.processId,
    p_comissao: args.commission,
    p_parcelas: args.installments,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { processo_id?: string; parcelas?: number; idempotente?: boolean };
  if (!result.processo_id || !Number.isSafeInteger(result.parcelas)) {
    return { status: 502, body: { error: "Não foi possível confirmar a comissão. Nada foi presumido — tente novamente." } };
  }
  return { status: 200, body: { success: true, processId: result.processo_id, installments: result.parcelas, idempotent: result.idempotente === true } };
}
