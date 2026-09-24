type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesStageCreateRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_ETAPA_SEM_PERMISSAO: 403,
  ESTEIRA_ETAPA_CONFLITO: 409,
  ESTEIRA_ETAPA_REQUEST_CONFLITANTE: 409,
  ESTEIRA_ETAPA_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_ETAPA_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para criar etapas. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A configuração das etapas está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível criar a etapa. Nada foi alterado — tente novamente." } };
}

export async function createSalesStageAtomic(
  client: SalesStageCreateRpcClient,
  args: { name: string; slugBase: string; color: string; role: string; slaDays: number; resale: boolean; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_etapa_criar", {
    p_nome: args.name,
    p_slug_base: args.slugBase,
    p_cor: args.color,
    p_papel: args.role,
    p_sla_dias: args.slaDays,
    p_resale: args.resale,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { etapa_id?: unknown; slug?: unknown; ordem?: unknown; idempotente?: boolean };
  if (typeof result.etapa_id !== "string" || typeof result.slug !== "string" || !Number.isSafeInteger(result.ordem) || Number(result.ordem) < 1) {
    return { status: 502, body: { error: "Não foi possível confirmar a etapa criada. Nada foi presumido — atualize a tela." } };
  }
  return {
    status: 200,
    body: { success: true, stageId: result.etapa_id, slug: result.slug, order: result.ordem as number, idempotent: result.idempotente === true },
  };
}
