/* Cadastro de categorias: mudança e auditoria pertencem à mesma transação. */

import type { ClienteRpc, RespostaVenda, RpcErro } from "./venda-rpc";

const STATUS_POR_CODIGO: Record<string, number> = {
  CATEGORIA_SEM_PERMISSAO: 403,
  CATEGORIA_NAO_ENCONTRADA: 404,
  CATEGORIA_DUPLICADA: 409,
  CATEGORIA_ESPECIAL_DUPLICADA: 409,
  CATEGORIA_ESTRUTURAL: 409,
};

function traduzirErroCategoria(error: RpcErro): RespostaVenda {
  const message = typeof error?.message === "string" ? error.message : "";
  const negocio = /^(CATEGORIA_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (negocio) return { status: STATUS_POR_CODIGO[negocio[1]] ?? 422, body: { error: negocio[2].trim(), code: negocio[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para gerenciar categorias. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "O cadastro de categorias está sendo atualizado. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível alterar a categoria. Nada foi alterado — tente novamente." } };
}

export async function mutarCategoriaAtomica(
  cliente: ClienteRpc,
  categoryId: string | null,
  operacao: "criar" | "editar" | "remover",
  payload: Record<string, unknown>,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_categoria_mutar", { p_categoria_id: categoryId, p_operacao: operacao, payload });
  if (error) return { ...traduzirErroCategoria(error), erroInterno: error };
  const resultado = (data ?? {}) as { categoria_id?: string; criada?: boolean; idempotente?: boolean };
  if (!resultado.categoria_id) return { status: 502, body: { error: "Não foi possível confirmar a categoria. Nada foi alterado — tente novamente." } };
  return { status: 200, body: { success: true, categoryId: resultado.categoria_id, created: resultado.criada === true, idempotente: resultado.idempotente === true } };
}
