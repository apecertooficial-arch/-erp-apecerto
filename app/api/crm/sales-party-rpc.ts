type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesPartyRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_PARTE_SEM_PERMISSAO: 403,
  ESTEIRA_PARTE_NAO_ENCONTRADA: 404,
  ESTEIRA_PARTE_CONFLITO: 409,
  ESTEIRA_PARTE_REQUEST_CONFLITANTE: 409,
  ESTEIRA_PARTE_TITULAR: 409,
  ESTEIRA_PARTE_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_PARTE_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para alterar esta parte. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "O cadastro das partes está sendo atualizado. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível alterar a parte. Nada foi alterado — tente novamente." } };
}

export async function mutateSalesPartyAtomic(
  client: SalesPartyRpcClient,
  args: { action: "salvar" | "adicionar" | "remover"; processId: string; partyId?: string | null; payload?: Record<string, unknown>; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_parte_mutar", {
    p_acao: args.action,
    p_processo_id: args.processId,
    p_parte_id: args.partyId ?? null,
    p_payload: args.payload ?? {},
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { parte_id?: string; ordem?: number; removida?: boolean; idempotente?: boolean };
  if (!result.parte_id || !Number.isSafeInteger(result.ordem)) {
    return { status: 502, body: { error: "Não foi possível confirmar a alteração da parte. Nada foi presumido — tente novamente." } };
  }
  return { status: 200, body: { success: true, partyId: result.parte_id, order: result.ordem, removed: result.removida === true, idempotent: result.idempotente === true } };
}
