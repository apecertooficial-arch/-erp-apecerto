/* VENDA ATÔMICA (Fase 2 / Financeiro no banco, set/2026).

   Criar e apagar venda deixaram de ser 6 (e 5) gravações soltas na rota. Agora
   são UMA chamada RPC cada — venda_criar(payload) e venda_excluir(p_venda_id),
   migration 20260916120000_fase2_venda_atomica — e o Postgres garante que ou
   grava tudo ou não grava nada. Arredondamento, somas e papel são validados no
   banco.

   Este arquivo não importa nada em tempo de execução de propósito: os testes
   (tests/finance-venda-atomica.test.mjs) carregam o .ts direto no Node, com um
   cliente falso que só tem `rpc`. */

export type RpcErro = { message?: string; code?: string; details?: string | null; hint?: string | null };
export type RpcResultado = { data: unknown; error: RpcErro | null };
export type ClienteRpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResultado> };
export type RespostaVenda = { status: number; body: Record<string, unknown> };

const texto = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const numeroOuNulo = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const lista = (value: unknown) => Array.isArray(value)
  ? (value as unknown[]).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
  : [];

/** Traduz o corpo que a ficha da venda já envia (camelCase) para o payload da RPC.
    Não "conserta" valor nenhum: negativo, fração errada e papel inválido chegam
    ao banco como vieram e são rejeitados lá, em vez de virarem 0 ou 1 em silêncio. */
export function montarPayloadVenda(body: Record<string, unknown>): Record<string, unknown> {
  const percent = numeroOuNulo(body.percent);
  const negocioId = numeroOuNulo(body.negocioId);
  const corretorId = numeroOuNulo(body.corretorId);
  return {
    request_id: texto(body.requestId, 60) || null,
    data_venda: texto(body.dataVenda, 10),
    vgv: numeroOuNulo(body.vgv),
    percentual: percent,
    custos: numeroOuNulo(body.custos) ?? 0,
    forma_pgto: texto(body.payment, 100) || null,
    status: texto(body.status, 20) || "pendente",
    obs: texto(body.notes, 1000) || null,
    empreendimento_id: texto(body.empreendimentoId, 60) || null,
    empreendimento_nome: texto(body.empreendimentoNome, 200) || null,
    unidade_rotulo: texto(body.unidade, 120) || null,
    cliente_nome: texto(body.clienteNome, 200) || null,
    proprietario_nome: texto(body.proprietarioNome, 200) || null,
    corretor_id: corretorId !== null && Number.isSafeInteger(corretorId) && corretorId > 0 ? corretorId : null,
    negocio_id: negocioId !== null && Number.isSafeInteger(negocioId) && negocioId > 0 ? negocioId : null,
    documentos: lista(body.documentos).map((doc) => ({ nome: texto(doc.nome, 200), path: texto(doc.path, 1000), bucket: texto(doc.bucket, 60) || "esteira-docs" })),
    corretores: lista(body.brokers).map((row) => ({
      corretor_id: texto(row.corretorId, 60) || null,
      corretor_nome: texto(row.corretorNome, 200) || null,
      fracao: numeroOuNulo(row.fracao),
      eh_indicador: row.ehIndicador === true,
    })),
    comissoes: lista(body.commissions).map((row) => ({
      papel: texto(row.papel, 40),
      beneficiario_id: texto(row.beneficiarioId, 60) || null,
      valor: numeroOuNulo(row.valor),
      ratear: row.ratear === true,
    })),
    recebimentos: lista(body.receipts).map((row) => ({
      numero_parcela: numeroOuNulo(row.numeroParcela),
      valor: numeroOuNulo(row.valor),
      data_prevista: texto(row.dataPrevista, 10) || null,
    })),
    repasses: lista(body.payouts).map((row) => ({
      beneficiario_id: texto(row.beneficiarioId, 60) || null,
      papel: texto(row.papel, 40),
      valor: numeroOuNulo(row.valor),
      ordem: numeroOuNulo(row.ordem),
      data_prevista: texto(row.dataPrevista, 10) || null,
      // Venda nova agenda o repasse; a baixa ocorre somente pelo comando que
      // também cria o lançamento de caixa. Isso impede marcar "pago" sem caixa.
      status: "previsto",
      data_pagamento: null,
    })),
  };
}

const STATUS_POR_CODIGO: Record<string, number> = {
  VENDA_SEM_PERMISSAO: 403,
  VENDA_NAO_ENCONTRADA: 404,
  VENDA_NEGOCIO_NAO_ENCONTRADO: 404,
  VENDA_NEGOCIO_JA_VINCULADO: 409,
};

/** Erro da RPC -> resposta segura. Só a mensagem de negócio escrita na função
    (prefixo VENDA_<CODIGO>:) chega ao usuário; o resto vira texto genérico. */
export function traduzirErroVenda(error: RpcErro, operacao: "criar" | "excluir"): RespostaVenda {
  const message = typeof error?.message === "string" ? error.message : "";
  const negocio = /^(VENDA_[A-Z_]+):\s*([\s\S]+)$/.exec(message);
  if (negocio) return { status: STATUS_POR_CODIGO[negocio[1]] ?? 422, body: { error: negocio[2].trim(), code: negocio[1] } };
  if (error?.code === "42501") {
    return { status: 403, body: { error: "Você não tem permissão para concluir esta operação. Nada foi alterado." } };
  }
  if (error?.code === "PGRST202" || error?.code === "42883") {
    return { status: 503, body: { error: "O financeiro está sendo atualizado. Tente novamente em alguns minutos. Nada foi alterado." } };
  }
  if (error?.code === "22P02") {
    return { status: 422, body: { error: operacao === "criar" ? "Algum campo da venda está em formato inválido. Nada foi gravado." : "Venda inválida." } };
  }
  if (error?.code === "23503" || error?.code === "23514") {
    return { status: 422, body: { error: operacao === "criar"
      ? "Algum dado da venda aponta para um cadastro que não existe (corretor, beneficiário ou empreendimento). Nada foi gravado."
      : "A venda tem registros ligados que impedem a exclusão. Nada foi apagado." } };
  }
  return { status: 502, body: { error: operacao === "criar"
    ? "Não foi possível lançar a venda. Nada foi gravado — tente novamente."
    : "Não foi possível apagar a venda. Nada foi apagado — tente novamente." } };
}

export async function criarVendaAtomica(cliente: ClienteRpc, body: Record<string, unknown>): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("venda_criar", { payload: montarPayloadVenda(body) });
  if (error) return { ...traduzirErroVenda(error, "criar"), erroInterno: error };
  const resultado = (data ?? {}) as { venda_id?: string; idempotente?: boolean; comissao_bruta?: number | null; comissao_distribuida?: number };
  if (!resultado.venda_id) return { status: 502, body: { error: "Não foi possível lançar a venda. Nada foi gravado — tente novamente." } };
  return {
    status: 200,
    body: {
      success: true,
      saleId: resultado.venda_id,
      idempotente: resultado.idempotente === true,
      comissaoBruta: resultado.comissao_bruta ?? null,
      comissaoDistribuida: resultado.comissao_distribuida ?? 0,
    },
  };
}

export async function excluirVendaAtomica(cliente: ClienteRpc, saleId: string): Promise<RespostaVenda & { erroInterno?: RpcErro }> {
  const { data, error } = await cliente.rpc("venda_excluir", { p_venda_id: saleId });
  if (error) return { ...traduzirErroVenda(error, "excluir"), erroInterno: error };
  return { status: 200, body: { success: true, removidos: data ?? null } };
}
