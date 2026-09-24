type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };

export type MetasRpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
};

const STATUS_BY_CODE: Record<string, number> = {
  META_SEM_PERMISSAO: 403,
  META_NAO_ENCONTRADA: 404,
  META_CORRETOR_NAO_ENCONTRADO: 404,
  META_REQUEST_CONFLITANTE: 409,
  META_CONFLITO: 409,
};

function translateError(error: RpcError) {
  const message = typeof error?.message === "string" ? error.message : "";
  const business = /^(META_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (business) return { status: STATUS_BY_CODE[business[1]] ?? 422, body: { error: business[2].trim(), code: business[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para alterar metas. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "As metas estão sendo atualizadas. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível concluir a operação de metas. Nada foi alterado — tente novamente." } };
}

export async function mutateMetaAtomic(client: MetasRpcClient, args: { operation: "salvar" | "remover"; metaId: string | null; requestId: string; payload: Record<string, unknown> }) {
  const { data, error } = await client.rpc("metas_mutar", {
    p_operacao: args.operation,
    p_meta_id: args.metaId,
    p_request_id: args.requestId,
    payload: args.payload,
  });
  if (error) return { ...translateError(error), internalError: error };
  const result = (data ?? {}) as { meta_id?: string; operacao?: string; idempotente?: boolean };
  if (!result.meta_id) return { status: 502, body: { error: "Não foi possível confirmar a alteração da meta. Nada foi presumido — tente novamente." } };
  return { status: 200, body: { success: true, metaId: result.meta_id, operation: result.operacao ?? args.operation, idempotent: result.idempotente === true } };
}
