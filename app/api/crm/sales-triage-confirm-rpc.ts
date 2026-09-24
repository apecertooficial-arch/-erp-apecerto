type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };
export type SalesTriageConfirmRpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

const STATUS: Record<string, number> = {
  ESTEIRA_TRIAGEM_SEM_PERMISSAO: 403,
  ESTEIRA_TRIAGEM_NAO_ENCONTRADO: 404,
  ESTEIRA_TRIAGEM_CONFLITO: 409,
  ESTEIRA_TRIAGEM_REQUEST_CONFLITANTE: 409,
  ESTEIRA_TRIAGEM_DADOS_INVALIDOS: 422,
};

function translate(error: RpcError) {
  const match = /^(ESTEIRA_TRIAGEM_[A-Z_]+):\s*([\s\S]+)$/.exec(typeof error?.message === "string" ? error.message : "");
  if (match) return { status: STATUS[match[1]] ?? 422, body: { error: match[2].trim(), code: match[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para confirmar esta triagem. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A confirmação da triagem está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível confirmar a triagem. Nada foi alterado — tente novamente." } };
}

export async function confirmSalesTriageAtomic(
  client: SalesTriageConfirmRpcClient,
  args: { attachmentId: string; group: string; documentName: string; required: boolean; requestId: string },
) {
  const { data, error } = await client.rpc("esteira_anexo_triagem_confirmar", {
    p_anexo_id: args.attachmentId,
    p_grupo: args.group,
    p_doc_nome: args.documentName,
    p_obrigatorio: args.required,
    p_request_id: args.requestId,
  });
  if (error) return { ...translate(error), internalError: error };
  const result = (data ?? {}) as { anexo_id?: unknown; status?: unknown; evento?: unknown; idempotente?: boolean };
  if (typeof result.anexo_id !== "string" || result.status !== "anexado" || !["confirmado", "corrigido"].includes(String(result.evento))) {
    return { status: 502, body: { error: "Não foi possível confirmar a triagem persistida. Nada foi presumido — atualize a tela." } };
  }
  return {
    status: 200,
    body: { success: true, attachmentId: result.anexo_id, status: result.status, event: result.evento as string, idempotent: result.idempotente === true },
  };
}
