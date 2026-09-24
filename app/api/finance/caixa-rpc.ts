/* Criação de caixa e eventual baixa de recebimento em uma transação. */

import type { ClienteRpc, RespostaVenda, RpcErro } from "./venda-rpc";

const STATUS_POR_CODIGO: Record<string, number> = {
  CAIXA_SEM_PERMISSAO: 403,
  CAIXA_NAO_ENCONTRADO: 404,
  CAIXA_RECEBIMENTO_NAO_ENCONTRADO: 404,
  CAIXA_RECEBIMENTO_JA_LANCADO: 409,
  CAIXA_RECEBIMENTO_JA_BAIXADO: 409,
  CAIXA_RECEBIMENTO_INCONSISTENTE: 409,
  CAIXA_REPASSE_VINCULADO: 409,
};

function traduzirErroCaixa(error: RpcErro): RespostaVenda {
  const message = typeof error?.message === "string" ? error.message : "";
  const negocio = /^(CAIXA_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (negocio) return { status: STATUS_POR_CODIGO[negocio[1]] ?? 422, body: { error: negocio[2].trim(), code: negocio[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para concluir esta operação. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "O financeiro está sendo atualizado. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível concluir a operação do caixa. Nada foi alterado — tente novamente." } };
}

async function mutarCaixa(
  cliente: ClienteRpc,
  funcao: "financeiro_caixa_editar" | "financeiro_caixa_excluir",
  args: Record<string, unknown>,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc(funcao, args);
  if (error) return { ...traduzirErroCaixa(error), erroInterno: error };
  const resultado = (data ?? {}) as { lancamento_id?: string; recebimento_reaberto?: boolean; idempotente?: boolean };
  if (!resultado.lancamento_id) return { status: 502, body: { error: "Não foi possível confirmar a alteração. Nada foi alterado — tente novamente." } };
  return {
    status: 200,
    body: {
      success: true,
      cashId: resultado.lancamento_id,
      reopened: resultado.recebimento_reaberto === true,
      idempotente: resultado.idempotente === true,
    },
  };
}

export async function editarCaixaAtomico(cliente: ClienteRpc, cashId: string, payload: Record<string, unknown>) {
  return mutarCaixa(cliente, "financeiro_caixa_editar", { p_lancamento_id: cashId, payload });
}

export async function excluirCaixaAtomico(cliente: ClienteRpc, cashId: string) {
  return mutarCaixa(cliente, "financeiro_caixa_excluir", { p_lancamento_id: cashId });
}

export async function decidirRecebimentoAtomico(
  cliente: ClienteRpc,
  receiptId: string,
  recebido: boolean,
  dataRecebimento: string,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_recebimento_decidir", {
    p_recebimento_id: receiptId,
    p_recebido: recebido,
    p_data_recebimento: recebido ? dataRecebimento : null,
  });
  if (error) return { ...traduzirErroCaixa(error), erroInterno: error };
  const resultado = (data ?? {}) as { recebimento_id?: string; lancamento_id?: string | null; idempotente?: boolean };
  if (!resultado.recebimento_id) return { status: 502, body: { error: "Não foi possível confirmar a baixa. Nada foi alterado — tente novamente." } };
  return {
    status: 200,
    body: {
      success: true,
      receiptId: resultado.recebimento_id,
      cashId: resultado.lancamento_id ?? null,
      idempotente: resultado.idempotente === true,
    },
  };
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
