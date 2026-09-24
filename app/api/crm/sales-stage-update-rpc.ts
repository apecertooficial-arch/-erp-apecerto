type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesStageUpdateRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_ETAPA_EDICAO_SEM_PERMISSAO: 403,
  ESTEIRA_ETAPA_EDICAO_NAO_ENCONTRADA: 404,
  ESTEIRA_ETAPA_EDICAO_REQUEST_CONFLITANTE: 409,
  ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_ETAPA_EDICAO_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para editar etapas. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A configuração das etapas está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível editar a etapa. Nada foi presumido — tente novamente." } };
}

export async function updateSalesStageAtomic(
  client: SalesStageUpdateRpcClient,
  args: { stageId: string; patch: Record<string, unknown>; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_etapa_atualizar", {
    p_etapa_id: args.stageId,
    p_patch: args.patch,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { etapa_id?: unknown; slug?: unknown; idempotente?: boolean };
  if (typeof result.etapa_id !== "string" || typeof result.slug !== "string") {
    return { status: 502, body: { error: "Não foi possível confirmar a etapa editada. Nada foi presumido — atualize a tela." } };
  }
  return { status: 200, body: { success: true, stageId: result.etapa_id, slug: result.slug, idempotent: result.idempotente === true } };
}
