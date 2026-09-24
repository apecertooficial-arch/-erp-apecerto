/* Criação de caixa e eventual baixa de recebimento em uma transação. */

import type { ClienteRpc, RespostaVenda, RpcErro } from "./venda-rpc";

const STATUS_POR_CODIGO: Record<string, number> = {
  CAIXA_SEM_PERMISSAO: 403,
  CAIXA_RECEBIMENTO_NAO_ENCONTRADO: 404,
  CAIXA_RECEBIMENTO_JA_LANCADO: 409,
  CAIXA_RECEBIMENTO_JA_BAIXADO: 409,
};

function traduzirErroCaixa(error: RpcErro): RespostaVenda {
  const message = typeof error?.message === "string" ? error.message : "";
  const negocio = /^(CAIXA_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (negocio) return { status: STATUS_POR_CODIGO[negocio[1]] ?? 422, body: { error: negocio[2].trim(), code: negocio[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para concluir esta operação. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "O financeiro está sendo atualizado. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível criar o lançamento. Nada foi alterado — tente novamente." } };
}

export async function criarCaixaAtomico(
  cliente: ClienteRpc,
  payload: Record<string, unknown>,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_caixa_criar", { payload });
  if (error) return { ...traduzirErroCaixa(error), erroInterno: error };
  const resultado = (data ?? {}) as { lancamento_id?: string; recebimento_baixado?: boolean; idempotente?: boolean };
  if (!resultado.lancamento_id) return { status: 502, body: { error: "Não foi possível confirmar o lançamento. Nada foi alterado — tente novamente." } };
  return {
    status: 200,
    body: {
      success: true,
      cashId: resultado.lancamento_id,
      receiptSettled: resultado.recebimento_baixado === true,
      idempotente: resultado.idempotente === true,
    },
  };
}
