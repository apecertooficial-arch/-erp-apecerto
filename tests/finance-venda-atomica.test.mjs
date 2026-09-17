// Venda atômica (Fase 2): a rota do financeiro cria e apaga venda por RPC.
// Cliente Supabase falso — só `rpc` —, sem rede e sem banco.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  montarPayloadVenda,
  traduzirErroVenda,
  criarVendaAtomica,
  excluirVendaAtomica,
} from "../app/api/finance/venda-rpc.ts";

function clienteFalso(resposta) {
  const chamadas = [];
  return {
    chamadas,
    rpc(fn, args) {
      chamadas.push({ fn, args });
      return Promise.resolve(typeof resposta === "function" ? resposta(fn, args) : resposta);
    },
  };
}

const corpoDaFicha = {
  action: "createSale",
  requestId: "7c1f7c9e-4a55-4d2b-9d7f-2a6f1f0b6a01",
  negocioId: 42,
  dataVenda: "2026-09-16",
  empreendimentoId: "",
  empreendimentoNome: " Residencial Teste ",
  unidade: "101",
  vgv: 425422.5,
  percent: 4.5,
  custos: 0,
  payment: "Financiamento",
  status: "concluido",
  clienteNome: "Cliente",
  proprietarioNome: "",
  notes: "",
  commissions: [
    { papel: "corretor", beneficiarioId: "u-1", valor: 6381.3375 },
    { papel: "apecerto", beneficiarioId: "", valor: 12762.675 },
  ],
  receipts: [{ numeroParcela: 1, valor: 19144.01, dataPrevista: "2026-10-01" }],
  payouts: [{ beneficiarioId: "u-1", papel: "corretor", valor: 6381.34, ordem: 1, dataPrevista: "2026-09-16", status: "previsto", dataPagamento: "" }],
  documentos: [{ nome: "contrato.pdf", path: "vendas/2026-09-16/x.pdf", bucket: "esteira-docs" }],
};

test("createSale chama UMA rpc venda_criar com o payload traduzido", async () => {
  const cliente = clienteFalso({ data: { ok: true, venda_id: "v-1", idempotente: false, comissao_bruta: 19144.01, comissao_distribuida: 19144.01 }, error: null });
  const resposta = await criarVendaAtomica(cliente, corpoDaFicha);

  assert.equal(cliente.chamadas.length, 1, "uma chamada só = uma transação");
  assert.equal(cliente.chamadas[0].fn, "venda_criar");
  const payload = cliente.chamadas[0].args.payload;
  assert.equal(payload.request_id, corpoDaFicha.requestId);
  assert.equal(payload.data_venda, "2026-09-16");
  assert.equal(payload.vgv, 425422.5);
  assert.equal(payload.percentual, 4.5, "percentual segue em %, o banco converte para fração");
  assert.equal(payload.negocio_id, 42);
  assert.equal(payload.empreendimento_id, null);
  assert.equal(payload.empreendimento_nome, "Residencial Teste");
  assert.deepEqual(payload.comissoes[1], { papel: "apecerto", beneficiario_id: null, valor: 12762.675, ratear: false });
  assert.deepEqual(payload.recebimentos, [{ numero_parcela: 1, valor: 19144.01, data_prevista: "2026-10-01" }]);
  assert.equal(payload.repasses[0].data_pagamento, null);
  assert.deepEqual(payload.corretores, []);

  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.body, { success: true, saleId: "v-1", idempotente: false, comissaoBruta: 19144.01, comissaoDistribuida: 19144.01 });
});

test("payload não conserta valor inválido em silêncio: o banco decide", () => {
  const payload = montarPayloadVenda({
    dataVenda: "2026-09-16", vgv: 1000, percent: 5, custos: -3, status: "qualquer",
    brokers: [{ corretorId: "u-1", fracao: "abc" }, { corretorId: "u-2", fracao: 0.4 }],
    commissions: [{ papel: "diretor", valor: -10 }],
  });
  assert.equal(payload.custos, -3, "antes virava 0");
  assert.equal(payload.status, "qualquer", "antes virava pendente");
  assert.equal(payload.corretores[0].fracao, null, "antes virava 1");
  assert.equal(payload.comissoes[0].papel, "diretor", "antes era gravado sem validar");
  assert.equal(payload.comissoes[0].valor, -10);
});

test("erro de negócio da RPC chega em português, sem o código interno na mensagem", async () => {
  const cliente = clienteFalso({ data: null, error: { code: "P0001", message: "VENDA_RATEIO: O rateio dos corretores precisa somar exatamente 100% (soma atual: 90,00%)." } });
  const resposta = await criarVendaAtomica(cliente, corpoDaFicha);
  assert.equal(resposta.status, 422);
  assert.equal(resposta.body.error, "O rateio dos corretores precisa somar exatamente 100% (soma atual: 90,00%).");
  assert.equal(resposta.body.code, "VENDA_RATEIO");
  assert.ok(!("saleId" in resposta.body), "falha não devolve venda pela metade");
});

test("códigos de negócio mapeiam para status HTTP", () => {
  const casos = [
    ["VENDA_SEM_PERMISSAO: Apenas administradores podem apagar vendas.", 403],
    ["VENDA_NAO_ENCONTRADA: Venda não encontrada ou já apagada.", 404],
    ["VENDA_NEGOCIO_JA_VINCULADO: Este negócio já está ligado a outra venda.", 409],
    ["VENDA_VALOR_INVALIDO: Comissão não pode ser negativa.", 422],
    ["VENDA_COMISSAO_EXCEDE: As comissões somam R$ 5000,01 e passam da comissão bruta de R$ 5000,00 (VGV × percentual).", 422],
  ];
  for (const [message, status] of casos) {
    const r = traduzirErroVenda({ code: "P0001", message }, "criar");
    assert.equal(r.status, status, message);
    assert.ok(!r.body.error.startsWith("VENDA_"), message);
  }
});

test("erro técnico vira mensagem genérica, sem detalhe do Postgres", () => {
  const fk = traduzirErroVenda({ code: "23503", message: 'insert or update on table "pagamentos_comissao" violates foreign key constraint "pagamentos_comissao_beneficiario_id_fkey"' }, "criar");
  assert.equal(fk.status, 422);
  assert.doesNotMatch(fk.body.error, /pagamentos_comissao|constraint|foreign/i);
  assert.match(fk.body.error, /Nada foi gravado/);

  const rls = traduzirErroVenda({ code: "42501", message: 'new row violates row-level security policy for table "pagamentos_comissao"' }, "criar");
  assert.equal(rls.status, 403);
  assert.doesNotMatch(rls.body.error, /row-level|pagamentos_comissao/);

  const semFuncao = traduzirErroVenda({ code: "PGRST202", message: "Could not find the function public.venda_criar(payload) in the schema cache" }, "criar");
  assert.equal(semFuncao.status, 503);
  assert.doesNotMatch(semFuncao.body.error, /schema cache|venda_criar/);

  const outro = traduzirErroVenda({ code: "XX000", message: "canceling statement due to statement timeout" }, "excluir");
  assert.equal(outro.status, 502);
  assert.match(outro.body.error, /Nada foi apagado/);
  assert.doesNotMatch(outro.body.error, /statement/);
});

test("repetir o lançamento com o mesmo requestId devolve a venda existente", async () => {
  const cliente = clienteFalso({ data: { ok: true, venda_id: "v-1", idempotente: true }, error: null });
  const resposta = await criarVendaAtomica(cliente, corpoDaFicha);
  assert.equal(resposta.status, 200);
  assert.equal(resposta.body.saleId, "v-1");
  assert.equal(resposta.body.idempotente, true);
});

test("deleteSale chama UMA rpc venda_excluir e repassa as contagens", async () => {
  const removidos = { ok: true, venda_id: "v-1", comissoes: 3, recebimentos: 1, repasses: 1, corretores: 2, negocios_desvinculados: 1, lancamentos_caixa_desvinculados: 1 };
  const cliente = clienteFalso({ data: removidos, error: null });
  const resposta = await excluirVendaAtomica(cliente, "v-1");
  assert.deepEqual(cliente.chamadas, [{ fn: "venda_excluir", args: { p_venda_id: "v-1" } }]);
  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.body, { success: true, removidos });
});

test("deleteSale com erro não finge sucesso", async () => {
  const cliente = clienteFalso({ data: null, error: { code: "42501", message: "VENDA_SEM_PERMISSAO: Você não tem permissão para apagar esta venda." } });
  const resposta = await excluirVendaAtomica(cliente, "v-1");
  assert.equal(resposta.status, 403);
  assert.equal(resposta.body.success, undefined);
  assert.equal(resposta.body.error, "Você não tem permissão para apagar esta venda.");
});

test("a rota não grava mais venda tabela a tabela em createSale/deleteSale", () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const trecho = (inicio, fim) => rota.slice(rota.indexOf(inicio), rota.indexOf(fim, rota.indexOf(inicio)));
  const criar = trecho('if (action === "createSale")', 'if (action === "createCash")');
  const apagar = trecho('if (action === "deleteSale")', 'if (action === "addCommission"');
  assert.match(criar, /criarVendaAtomica\(/);
  assert.match(apagar, /excluirVendaAtomica\(/);
  for (const tabela of ["vendas", "venda_corretores", "comissoes", "recebimentos", "pagamentos_comissao", "negocios", "lancamentos_caixa"]) {
    assert.doesNotMatch(criar, new RegExp(`from\\("${tabela}"\\)`), `createSale ainda escreve em ${tabela}`);
    assert.doesNotMatch(apagar, new RegExp(`from\\("${tabela}"\\)`), `deleteSale ainda escreve em ${tabela}`);
  }
  // Mesma regra de quem pode apagar (não mudou).
  assert.match(apagar, /papelNoGrupo\(me\.role, "financeiro"\)/);
  assert.match(criar, /guard\(\[\["vendas", "criar"\], \["financeiro", "criar"\]\]/);
});

test("a migration usa SECURITY INVOKER, transação única e grava auditoria", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260916120000_fase2_venda_atomica.sql", import.meta.url), "utf8");
  assert.equal((sql.match(/security invoker/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /security definer/i);
  assert.match(sql, /revoke all on function public\.venda_criar\(jsonb\) from public, anon/);
  assert.equal((sql.match(/insert into public\.erp_auditoria/g) ?? []).length, 2);
  assert.match(sql, /round\(v_vgv \* v_pct, 2\)/);
});

test("a ficha manda requestId estável no lançamento", () => {
  const ficha = readFileSync(new URL("../app/features/finance/VendaModal.tsx", import.meta.url), "utf8");
  assert.match(ficha, /const \[requestId\] = useState\(/);
  assert.match(ficha, /action: "createSale",\s*requestId,/);
});
