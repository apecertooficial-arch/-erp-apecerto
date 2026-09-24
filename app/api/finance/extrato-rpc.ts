/* Conciliação de extrato e caixa em uma única transação. */

import type { ClienteRpc, RespostaVenda, RpcErro } from "./venda-rpc";

const STATUS_POR_CODIGO: Record<string, number> = {
  EXTRATO_SEM_PERMISSAO: 403,
  EXTRATO_NAO_ENCONTRADO: 404,
  EXTRATO_LANCAMENTO_NAO_ENCONTRADO: 404,
  EXTRATO_JA_RESOLVIDO: 409,
  EXTRATO_INCONSISTENTE: 409,
};

function traduzirErroExtrato(error: RpcErro): RespostaVenda {
  const message = typeof error?.message === "string" ? error.message : "";
  const negocio = /^(EXTRATO_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (negocio) return { status: STATUS_POR_CODIGO[negocio[1]] ?? 422, body: { error: negocio[2].trim(), code: negocio[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para conciliar o extrato. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A conciliação está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível conciliar o extrato. Nada foi alterado — tente novamente." } };
}

export async function resolverLinhaExtratoAtomica(
  cliente: ClienteRpc,
  linhaId: string,
  decisao: "lancar" | "vincular" | "ignorar",
  payload: Record<string, unknown>,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_extrato_resolver", {
    p_linha_id: linhaId,
    p_decisao: decisao,
    payload,
  });
  if (error) return { ...traduzirErroExtrato(error), erroInterno: error };
  const resultado = (data ?? {}) as { linha_id?: string; lancamento_id?: string | null; situacao?: string; idempotente?: boolean };
  if (!resultado.linha_id) return { status: 502, body: { error: "Não foi possível confirmar a conciliação. Nada foi alterado — tente novamente." } };
  return { status: 200, body: { success: true, lineId: resultado.linha_id, cashId: resultado.lancamento_id ?? null, status: resultado.situacao, idempotente: resultado.idempotente === true } };
}

export async function resolverLoteExtratoAtomico(
  cliente: ClienteRpc,
  importacaoId: string,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_extrato_resolver_lote", { p_importacao_id: importacaoId });
  if (error) return { ...traduzirErroExtrato(error), erroInterno: error };
  const resultado = (data ?? {}) as { importacao_id?: string; lancadas?: number; vinculadas?: number; ignoradas?: number; pulou?: number; idempotente?: boolean };
  if (!resultado.importacao_id) return { status: 502, body: { error: "Não foi possível confirmar a conciliação em lote. Nada foi alterado — tente novamente." } };
  return { status: 200, body: { success: true, importacaoId: resultado.importacao_id, lancadas: resultado.lancadas ?? 0, vinculadas: resultado.vinculadas ?? 0, ignoradas: resultado.ignoradas ?? 0, pulou: resultado.pulou ?? 0, idempotente: resultado.idempotente === true } };
}
