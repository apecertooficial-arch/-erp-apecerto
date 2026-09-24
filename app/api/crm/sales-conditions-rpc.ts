type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesConditionsRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_CONDICOES_SEM_PERMISSAO: 403,
  ESTEIRA_CONDICOES_NAO_ENCONTRADA: 404,
  ESTEIRA_CONDICOES_BLOQUEADAS: 409,
  ESTEIRA_CONDICOES_REQUEST_CONFLITANTE: 409,
  ESTEIRA_CONDICOES_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_CONDICOES_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para alterar as condições desta venda. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "As condições comerciais estão sendo atualizadas. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível salvar as condições comerciais. Nada foi presumido — tente novamente." } };
}

export async function saveSalesConditionsAtomic(
  client: SalesConditionsRpcClient,
  args: { processId: string; payload: Record<string, unknown>; spouseOnly: boolean; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_condicoes_salvar", {
    p_processo_id: args.processId,
    p_payload: args.payload,
    p_somente_conjuge: args.spouseOnly,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { processo_id?: unknown; idempotente?: boolean };
  if (typeof result.processo_id !== "string") {
    return { status: 502, body: { error: "Não foi possível confirmar as condições salvas. Nada foi presumido — atualize a tela." } };
  }
  return { status: 200, body: { success: true, processId: result.processo_id, idempotent: result.idempotente === true } };
}
