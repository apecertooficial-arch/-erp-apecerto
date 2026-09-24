type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesStageDeleteRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_ETAPA_REMOCAO_SEM_PERMISSAO: 403,
  ESTEIRA_ETAPA_REMOCAO_NAO_ENCONTRADA: 404,
  ESTEIRA_ETAPA_REMOCAO_COM_VENDAS: 409,
  ESTEIRA_ETAPA_REMOCAO_REQUEST_CONFLITANTE: 409,
  ESTEIRA_ETAPA_REMOCAO_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_ETAPA_REMOCAO_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para excluir etapas. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A configuração das etapas está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível excluir a etapa. Nada foi alterado — tente novamente." } };
}

export async function deleteSalesStageAtomic(
  client: SalesStageDeleteRpcClient,
  args: { stageId: string; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_etapa_remover", {
    p_etapa_id: args.stageId,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { etapa_id?: unknown; slug?: unknown; idempotente?: boolean };
  if (typeof result.etapa_id !== "string" || typeof result.slug !== "string") {
    return { status: 502, body: { error: "Não foi possível confirmar a exclusão da etapa. Nada foi presumido — atualize a tela." } };
  }
  return {
    status: 200,
    body: { success: true, stageId: result.etapa_id, slug: result.slug, idempotent: result.idempotente === true },
  };
}
