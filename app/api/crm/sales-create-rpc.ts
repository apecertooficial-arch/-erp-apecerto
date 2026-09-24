/* Venda, negócio e processo da Esteira nascem juntos. */

type RpcErro = { code?: string; message?: string } | null;
type RpcResultado = { data: unknown; error: RpcErro };
export type ClienteRpcVendaCrm = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResultado>;
};

const STATUS_POR_CODIGO: Record<string, number> = {
  VENDA_CRM_SEM_PERMISSAO: 403,
  VENDA_CRM_NAO_ENCONTRADA: 404,
  VENDA_CRM_NEGOCIO_VINCULADO: 409,
  VENDA_CRM_REQUEST_CONFLITANTE: 409,
};

function traduzirErro(error: RpcErro) {
  const message = typeof error?.message === "string" ? error.message : "";
  const negocio = /^(VENDA_CRM_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (negocio) return { status: STATUS_POR_CODIGO[negocio[1]] ?? 422, body: { error: negocio[2].trim(), code: negocio[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para conectar esta venda. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A criação de vendas está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível conectar a venda ao CRM. Nada foi alterado — tente novamente." } };
}

export async function criarVendaCrmAtomica(cliente: ClienteRpcVendaCrm, payload: Record<string, unknown>) {
  const { data, error } = await cliente.rpc("esteira_venda_criar", { payload });
  if (error) return { ...traduzirErro(error), erroInterno: error };
  const resultado = (data ?? {}) as { venda_id?: string; processo_id?: string; aprovacao?: string; idempotente?: boolean };
  if (!resultado.venda_id || !resultado.processo_id) return { status: 502, body: { error: "Não foi possível confirmar a venda e seu processo. Nada foi alterado — tente novamente." } };
  return { status: 200, body: { success: true, saleId: resultado.venda_id, processId: resultado.processo_id, aprovacao: resultado.aprovacao ?? "aprovada", idempotente: resultado.idempotente === true } };
}
