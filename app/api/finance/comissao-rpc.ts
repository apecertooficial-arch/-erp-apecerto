/* Comissão avulsa da ficha de venda: criação/edição/exclusão ficam no banco
   para que limite, vínculos, idempotência e auditoria sejam uma só decisão. */

import type { ClienteRpc, RespostaVenda, RpcErro } from "./venda-rpc";

const STATUS_POR_CODIGO: Record<string, number> = {
  COMISSAO_SEM_PERMISSAO: 403,
  COMISSAO_NAO_ENCONTRADA: 404,
  COMISSAO_MOVIMENTO_ATIVO: 409,
  COMISSAO_DUPLICADA: 409,
  COMISSAO_REQUEST_CONFLITANTE: 409,
  COMISSAO_TOTAL_EXCEDE: 409,
};

function traduzirErroComissao(error: RpcErro): RespostaVenda {
  const message = typeof error?.message === "string" ? error.message : "";
  const negocio = /^(COMISSAO_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (negocio) return { status: STATUS_POR_CODIGO[negocio[1]] ?? 422, body: { error: negocio[2].trim(), code: negocio[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para concluir esta operação. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "O financeiro está sendo atualizado. Tente novamente em alguns minutos. Nada foi alterado." } };
  if (error?.code === "22P02" || error?.code === "23503") return { status: 422, body: { error: "Venda, beneficiário ou comissão inválidos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível alterar a comissão. Nada foi alterado — tente novamente." } };
}

export async function salvarComissaoAtomica(
  cliente: ClienteRpc,
  commissionId: string | null,
  payload: Record<string, unknown>,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_comissao_salvar", { p_comissao_id: commissionId, payload });
  if (error) return { ...traduzirErroComissao(error), erroInterno: error };
  const resultado = (data ?? {}) as { comissao_id?: string; criada?: boolean; idempotente?: boolean };
  if (!resultado.comissao_id) return { status: 502, body: { error: "Não foi possível confirmar a comissão. Nada foi alterado — tente novamente." } };
  return { status: 200, body: { success: true, commissionId: resultado.comissao_id, created: resultado.criada === true, idempotente: resultado.idempotente === true } };
}

export async function excluirComissaoAtomica(
  cliente: ClienteRpc,
  commissionId: string,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_comissao_excluir", { p_comissao_id: commissionId });
  if (error) return { ...traduzirErroComissao(error), erroInterno: error };
  const resultado = (data ?? {}) as { comissao_id?: string; idempotente?: boolean };
  if (!resultado.comissao_id) return { status: 502, body: { error: "Não foi possível confirmar a exclusão. Nada foi alterado — tente novamente." } };
  return { status: 200, body: { success: true, commissionId: resultado.comissao_id, idempotente: resultado.idempotente === true } };
}
