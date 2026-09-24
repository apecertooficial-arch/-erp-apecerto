type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesStageOrderRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_ETAPAS_SEM_PERMISSAO: 403,
  ESTEIRA_ETAPAS_CONFLITO: 409,
  ESTEIRA_ETAPAS_REQUEST_CONFLITANTE: 409,
  ESTEIRA_ETAPAS_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_ETAPAS_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para reordenar as etapas. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A configuração das etapas está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível reordenar as etapas. Nada foi alterado — tente novamente." } };
}

export async function reorderSalesStagesAtomic(
  client: SalesStageOrderRpcClient,
  args: { stageIds: string[]; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_etapas_reordenar", {
    p_ids: args.stageIds,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { etapas?: number; idempotente?: boolean };
  if (!Number.isSafeInteger(result.etapas) || Number(result.etapas) < 2) {
    return { status: 502, body: { error: "Não foi possível confirmar a nova ordem. Nada foi presumido — tente novamente." } };
  }
  return { status: 200, body: { success: true, stages: result.etapas, idempotent: result.idempotente === true } };
}
