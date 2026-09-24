/* Baixa e reabertura de repasse em uma única transação no banco.

   Este módulo fica sem dependências de runtime para que o contrato HTTP/RPC
   possa ser testado com um cliente falso, como já fazemos com venda-rpc.ts. */

import type { ClienteRpc, RespostaVenda, RpcErro } from "./venda-rpc";

const STATUS_POR_CODIGO: Record<string, number> = {
  REPASSE_SEM_PERMISSAO: 403,
  REPASSE_NAO_ENCONTRADO: 404,
  REPASSE_INCONSISTENTE: 409,
};

function traduzirErroRepasse(error: RpcErro): RespostaVenda {
  const message = typeof error?.message === "string" ? error.message : "";
  const negocio = /^(REPASSE_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (negocio) return { status: STATUS_POR_CODIGO[negocio[1]] ?? 422, body: { error: negocio[2].trim(), code: negocio[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para concluir esta operação. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "O financeiro está sendo atualizado. Tente novamente em alguns minutos. Nada foi alterado." } };
  if (error?.code === "22P02") return { status: 422, body: { error: "Repasse ou data de pagamento inválidos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível atualizar o repasse. Nada foi alterado — tente novamente." } };
}

export async function decidirRepasseAtomico(
  cliente: ClienteRpc,
  payoutId: string,
  pago: boolean,
  dataPagamento: string,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_decidir_repasse", {
    p_repasse_id: payoutId,
    p_pago: pago,
    p_data_pagamento: pago ? dataPagamento : null,
  });
  if (error) return { ...traduzirErroRepasse(error), erroInterno: error };
  const resultado = (data ?? {}) as { repasse_id?: string; lancamento_id?: string | null; idempotente?: boolean };
  if (!resultado.repasse_id) return { status: 502, body: { error: "Não foi possível confirmar a atualização do repasse. Nada foi alterado — tente novamente." } };
  return {
    status: 200,
    body: {
      success: true,
      payoutId: resultado.repasse_id,
      cashId: resultado.lancamento_id ?? null,
      idempotente: resultado.idempotente === true,
    },
  };
}

export async function excluirRepasseAtomico(
  cliente: ClienteRpc,
  payoutId: string,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_excluir_repasse", { p_repasse_id: payoutId });
  if (error) return { ...traduzirErroRepasse(error), erroInterno: error };
  const resultado = (data ?? {}) as { repasse_id?: string; lancamento_removido?: boolean; idempotente?: boolean };
  if (!resultado.repasse_id) return { status: 502, body: { error: "Não foi possível confirmar a exclusão do repasse. Nada foi alterado — tente novamente." } };
  return {
    status: 200,
    body: {
      success: true,
      payoutId: resultado.repasse_id,
      cashRemoved: resultado.lancamento_removido === true,
      idempotente: resultado.idempotente === true,
    },
  };
}
