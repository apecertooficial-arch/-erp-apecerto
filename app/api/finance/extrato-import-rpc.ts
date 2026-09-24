/* Cabeçalho e linhas do extrato entram juntos e são deduplicados pelo conteúdo. */

import type { ClienteRpc, RespostaVenda, RpcErro } from "./venda-rpc";

const STATUS_POR_CODIGO: Record<string, number> = {
  EXTRATO_IMPORTACAO_SEM_PERMISSAO: 403,
  EXTRATO_IMPORTACAO_CONFLITANTE: 409,
};

function traduzirErroImportacao(error: RpcErro): RespostaVenda {
  const message = typeof error?.message === "string" ? error.message : "";
  const negocio = /^(EXTRATO_IMPORTACAO_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (negocio) return { status: STATUS_POR_CODIGO[negocio[1]] ?? 422, body: { error: negocio[2].trim(), code: negocio[1] } };
  if (error?.code === "42501") return { status: 403, body: { error: "Você não tem permissão para importar extratos. Nada foi alterado." } };
  if (error?.code === "PGRST202" || error?.code === "42883") return { status: 503, body: { error: "A importação está sendo atualizada. Tente novamente em alguns minutos. Nada foi alterado." } };
  return { status: 502, body: { error: "Não foi possível importar o extrato. Nada foi alterado — tente novamente." } };
}

export async function importarExtratoAtomico(
  cliente: ClienteRpc,
  payload: Record<string, unknown>,
  linhas: Array<Record<string, unknown>>,
): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("financeiro_extrato_importar", { payload, linhas });
  if (error) return { ...traduzirErroImportacao(error), erroInterno: error };
  const resultado = (data ?? {}) as { importacao_id?: string; linhas?: number; idempotente?: boolean };
  if (!resultado.importacao_id) return { status: 502, body: { error: "Não foi possível confirmar a importação. Nada foi alterado — tente novamente." } };
  return { status: 200, body: { success: true, importacaoId: resultado.importacao_id, linhas: resultado.linhas ?? 0, idempotente: resultado.idempotente === true } };
}
