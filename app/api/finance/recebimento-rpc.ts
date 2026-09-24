/* Agenda de recebimentos: criar, editar e excluir sem separar validação,
   persistência e auditoria em chamadas REST diferentes. */

import type { ClienteRpc, RespostaVenda, RpcErro } from "./venda-rpc";

const STATUS_POR_CODIGO: Record<string, number> = {
  RECEBIMENTO_SEM_PERMISSAO: 403,
  RECEBIMENTO_NAO_ENCONTRADO: 404,
  RECEBIMENTO_MOVIMENTO_ATIVO: 409,
  RECEBIMENTO_PARCELA_DUPLICADA: 409,
  RECEBIMENTO_REQUEST_CONFLITANTE: 409,
  RECEBIMENTO_TOTAL_EXCEDE: 409,
};

function traduzirErroRecebimento(error: RpcErro): RespostaVenda {
  const message = typeof error?.message === "string" ? error.message : "";
  const negocio = /^(RECEBIMENTO_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (negocio) return { status: STATUS_POR_CODIGO[negocio[1]] ?? 422, body: { error: negocio[2].trim(), code: negocio[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para concluir esta operação. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "O financeiro está sendo atualizado. Tente novamente em alguns minutos. Nada foi alterado." } };
  if (error?.code === "22P02") return { status: 422, body: { error: "Recebimento, data ou identificador inválido. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível alterar o recebimento. Nada foi alterado — tente novamente." } };
}

export async function salvarRecebimentoAtomico(
  cliente: ClienteRpc,
  receiptId: string | null,
  payload: Record<string, unknown>,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_recebimento_salvar", { p_recebimento_id: receiptId, payload });
  if (error) return { ...traduzirErroRecebimento(error), erroInterno: error };
  const resultado = (data ?? {}) as { recebimento_id?: string; criado?: boolean; idempotente?: boolean };
  if (!resultado.recebimento_id) return { status: 502, body: { error: "Não foi possível confirmar o recebimento. Nada foi alterado — tente novamente." } };
  return { status: 200, body: { success: true, receiptId: resultado.recebimento_id, created: resultado.criado === true, idempotente: resultado.idempotente === true } };
}

export async function excluirRecebimentoAtomico(
  cliente: ClienteRpc,
  receiptId: string,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_recebimento_excluir", { p_recebimento_id: receiptId });
  if (error) return { ...traduzirErroRecebimento(error), erroInterno: error };
  const resultado = (data ?? {}) as { recebimento_id?: string; idempotente?: boolean };
  if (!resultado.recebimento_id) return { status: 502, body: { error: "Não foi possível confirmar a exclusão. Nada foi alterado — tente novamente." } };
  return { status: 200, body: { success: true, receiptId: resultado.recebimento_id, idempotente: resultado.idempotente === true } };
}
