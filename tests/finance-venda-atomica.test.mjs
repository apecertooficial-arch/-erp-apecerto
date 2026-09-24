// Venda atômica (Fase 2): a rota do financeiro cria e apaga venda por RPC.
// Cliente Supabase falso — só `rpc` —, sem rede e sem banco.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  montarPayloadVenda,
  montarPayloadEdicaoVenda,
  traduzirErroVenda,
  criarVendaAtomica,
  editarVendaAtomica,
  excluirVendaAtomica,
} from "../app/api/finance/venda-rpc.ts";
import { decidirRepasseAtomico, excluirRepasseAtomico } from "../app/api/finance/repasse-rpc.ts";
import { criarCaixaAtomico, decidirRecebimentoAtomico, editarCaixaAtomico, excluirCaixaAtomico } from "../app/api/finance/caixa-rpc.ts";
import { excluirRecebimentoAtomico, salvarRecebimentoAtomico } from "../app/api/finance/recebimento-rpc.ts";

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
  assert.equal(payload.repasses[0].status, "previsto");
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

test("venda nova nunca nasce com repasse pago sem lançamento de caixa", () => {
  const payload = montarPayloadVenda({
    payouts: [{ beneficiarioId: "u-1", papel: "corretor", valor: 1000, status: "pago", dataPagamento: "2026-09-20" }],
  });
  assert.deepEqual(payload.repasses, [{
    beneficiario_id: "u-1",
    papel: "corretor",
    valor: 1000,
    ordem: null,
    data_prevista: null,
    status: "previsto",
    data_pagamento: null,
  }]);
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
    ["VENDA_RECEBIMENTOS_PENDENTES: Baixe cada parcela antes de marcar a venda como paga.", 409],
    ["VENDA_MOVIMENTOS_ATIVOS: Reabra os movimentos antes do distrato.", 409],
    ["VENDA_VALOR_DEPENDENTE: Ajuste os dependentes primeiro.", 409],
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

test("edição da venda usa uma única RPC e não baixa parcelas lateralmente", async () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const inicio = rota.indexOf('if (action === "updateSale")');
  const fim = rota.indexOf('if (action === "savePayout")', inicio);
  const editar = rota.slice(inicio, fim);
  assert.match(editar, /editarVendaAtomica\(semTipos\(auth\.supabase\), saleId, body\)/);
  assert.doesNotMatch(editar, /\.from\("vendas"\)\.(?:update|insert|delete)/);
  assert.doesNotMatch(editar, /\.from\("recebimentos"\)\.(?:update|insert|delete)/);

  const cliente = clienteFalso({ data: { ok: true, venda_id: "v-1", data_conclusao: "2026-09-23", idempotente: false }, error: null });
  const body = { dataVenda: "2026-09-20", vgv: 500000, percent: 5, custos: 0, payment: "Financiamento", status: "concluido", notes: "ok", empreendimentoId: "", empreendimentoNome: "Teste", unidade: "1", clienteNome: "Cliente", proprietarioNome: "" };
  const resposta = await editarVendaAtomica(cliente, "v-1", body);
  assert.equal(cliente.chamadas.length, 1);
  assert.equal(cliente.chamadas[0].fn, "venda_editar");
  assert.equal(cliente.chamadas[0].args.p_venda_id, "v-1");
  assert.deepEqual(cliente.chamadas[0].args.payload, montarPayloadEdicaoVenda(body));
  assert.deepEqual(resposta.body, { success: true, saleId: "v-1", idempotente: false, dataConclusao: "2026-09-23" });
  assert.ok(!("parcial" in resposta.body));

  const payloadInvalido = montarPayloadEdicaoVenda({ ...body, custos: -1 });
  assert.equal(payloadInvalido.custos, -1, "custo negativo chega ao banco para ser rejeitado; não vira zero");
});

test("baixa e reabertura de recebimento usam uma única RPC atômica", async () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const inicio = rota.indexOf('if (action === "settleReceipt")');
  const fim = rota.indexOf('if (action === "updateSale")', inicio);
  const baixa = rota.slice(inicio, fim);
  assert.match(baixa, /decidirRecebimentoAtomico\(semTipos\(auth\.supabase\), receiptId, received, hojeOperacao\(\)\)/);
  assert.doesNotMatch(baixa, /\.from\("recebimentos"\)\.(?:update|delete)/);
  assert.doesNotMatch(baixa, /\.from\("lancamentos_caixa"\)\.(?:insert|update|delete)/);

  const cliente = clienteFalso({ data: { ok: true, recebimento_id: "r-1", lancamento_id: "c-1", idempotente: false }, error: null });
  const resposta = await decidirRecebimentoAtomico(cliente, "r-1", true, "2026-09-23");
  assert.deepEqual(cliente.chamadas, [{
    fn: "financeiro_recebimento_decidir",
    args: { p_recebimento_id: "r-1", p_recebido: true, p_data_recebimento: "2026-09-23" },
  }]);
  assert.deepEqual(resposta.body, { success: true, receiptId: "r-1", cashId: "c-1", idempotente: false });
  assert.ok(!("parcial" in resposta.body));

  const reabrir = clienteFalso({ data: { ok: true, recebimento_id: "r-1", lancamento_id: null, idempotente: true }, error: null });
  await decidirRecebimentoAtomico(reabrir, "r-1", false, "2026-09-23");
  assert.equal(reabrir.chamadas[0].args.p_data_recebimento, null);
});

test("criação, edição e exclusão da agenda de recebimentos usam somente RPCs", async () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const criar = rota.slice(rota.indexOf('if (action === "createReceipt")'), rota.indexOf('if (action === "settleReceipt")'));
  const salvar = rota.slice(rota.indexOf('if (action === "saveReceipt")'), rota.indexOf('/* IMPORTACAO DE EXTRATO'));
  assert.match(criar, /salvarRecebimentoAtomico\(semTipos\(auth\.supabase\), null,/);
  assert.doesNotMatch(criar, /\.from\("recebimentos"\)\.(?:insert|update|delete)/);
  assert.match(salvar, /salvarRecebimentoAtomico\(semTipos\(auth\.supabase\), receiptId, linha\)/);
  assert.match(salvar, /excluirRecebimentoAtomico\(semTipos\(auth\.supabase\), receiptId\)/);
  assert.doesNotMatch(salvar, /\.from\("recebimentos"\)\.(?:insert|update|delete)/);

  const cliente = clienteFalso({ data: { ok: true, recebimento_id: "r-1", criado: true, idempotente: false }, error: null });
  const resposta = await salvarRecebimentoAtomico(cliente, null, { venda_id: "v-1", request_id: "req-1", numero_parcela: 1, valor_total: 100, data_prevista: "2026-10-01" });
  assert.deepEqual(cliente.chamadas, [{
    fn: "financeiro_recebimento_salvar",
    args: { p_recebimento_id: null, payload: { venda_id: "v-1", request_id: "req-1", numero_parcela: 1, valor_total: 100, data_prevista: "2026-10-01" } },
  }]);
  assert.deepEqual(resposta.body, { success: true, receiptId: "r-1", created: true, idempotente: false });

  const excluir = clienteFalso({ data: { ok: true, recebimento_id: "r-1", idempotente: true }, error: null });
  assert.deepEqual((await excluirRecebimentoAtomico(excluir, "r-1")).body, { success: true, receiptId: "r-1", idempotente: true });

  const ativo = clienteFalso({ data: null, error: { code: "P0001", message: "RECEBIMENTO_MOVIMENTO_ATIVO: Desfaça a baixa antes de editar a parcela." } });
  const bloqueado = await salvarRecebimentoAtomico(ativo, "r-1", { numero_parcela: 1, valor_total: 100 });
  assert.equal(bloqueado.status, 409);
  assert.ok(!("parcial" in bloqueado.body));
});

test("edição e exclusão de caixa usam somente RPCs atômicas", async () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const inicio = rota.indexOf('if (action === "updateCash" || action === "deleteCash")');
  const fim = rota.indexOf('if (action === "createReceipt")', inicio);
  const caixa = rota.slice(inicio, fim);
  assert.match(caixa, /editarCaixaAtomico\(semTipos\(auth\.supabase\), cashId,/);
  assert.match(caixa, /excluirCaixaAtomico\(semTipos\(auth\.supabase\), cashId\)/);
  assert.doesNotMatch(caixa, /\.from\("lancamentos_caixa"\)\.(?:update|delete)/);
  assert.doesNotMatch(caixa, /\.from\("erp_auditoria"\)\.insert/);

  const editar = clienteFalso({ data: { ok: true, lancamento_id: "c-1", idempotente: false }, error: null });
  assert.equal((await editarCaixaAtomico(editar, "c-1", { valor: 10 })).status, 200);
  assert.deepEqual(editar.chamadas[0], { fn: "financeiro_caixa_editar", args: { p_lancamento_id: "c-1", payload: { valor: 10 } } });

  const excluir = clienteFalso({ data: { ok: true, lancamento_id: "c-1", recebimento_reaberto: true, idempotente: false }, error: null });
  const resposta = await excluirCaixaAtomico(excluir, "c-1");
  assert.deepEqual(excluir.chamadas[0], { fn: "financeiro_caixa_excluir", args: { p_lancamento_id: "c-1" } });
  assert.equal(resposta.body.reopened, true);
  assert.ok(!("parcial" in resposta.body));
});

test("criação de caixa e baixa de parcela usam uma única RPC", async () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const inicio = rota.indexOf('if (action === "createCash")');
  const fim = rota.indexOf('if (action === "updateCash" || action === "deleteCash")', inicio);
  const caixa = rota.slice(inicio, fim);
  assert.match(caixa, /criarCaixaAtomico\(semTipos\(auth\.supabase\),/);
  assert.doesNotMatch(caixa, /\.from\("lancamentos_caixa"\)\.insert/);
  assert.doesNotMatch(caixa, /\.from\("recebimentos"\)\.update/);

  const cliente = clienteFalso({ data: { ok: true, lancamento_id: "c-1", recebimento_baixado: true, idempotente: false }, error: null });
  const resposta = await criarCaixaAtomico(cliente, { request_id: "req-1", recebimento_id: "r-1", baixar_recebimento: true });
  assert.deepEqual(cliente.chamadas, [{
    fn: "financeiro_caixa_criar",
    args: { payload: { request_id: "req-1", recebimento_id: "r-1", baixar_recebimento: true } },
  }]);
  assert.deepEqual(resposta.body, { success: true, cashId: "c-1", receiptSettled: true, idempotente: false });
  assert.ok(!("parcial" in resposta.body));
});

test("migration do caixa impede duplicidade e audita lançamento + recebimento", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260923211500_financeiro_caixa_criar_atomico.sql", import.meta.url), "utf8");
  assert.match(sql, /lancamentos_caixa_request_id_key/);
  assert.match(sql, /lancamentos_caixa_recebimento_unique/);
  assert.match(sql, /create or replace function public\.financeiro_caixa_criar\(payload jsonb\)/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /from public\.recebimentos[\s\S]+for update/);
  assert.match(sql, /update public\.recebimentos[\s\S]+status = 'recebido'/);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /'lancamento_caixa', to_jsonb\(v_lancamento\)/);
  assert.match(sql, /'recebimento',[\s\S]+select to_jsonb\(r\)/);
  assert.match(sql, /grant execute on function public\.financeiro_caixa_criar\(jsonb\) to authenticated, service_role/);
  assert.match(sql, /revoke all on function public\.financeiro_caixa_criar\(jsonb\) from public, anon/);
});

test("migration de edição/exclusão mantém recebimento reconciliado e protege caixa de repasse", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260923212000_financeiro_caixa_editar_excluir_atomico.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.financeiro_caixa_editar\(/);
  assert.match(sql, /create or replace function public\.financeiro_caixa_excluir\(/);
  assert.equal((sql.match(/security invoker/g) ?? []).length, 2);
  assert.match(sql, /from public\.pagamentos_comissao p where p\.lancamento_id=p_lancamento_id/);
  assert.match(sql, /CAIXA_REPASSE_VINCULADO/);
  assert.match(sql, /v_tipo<>'entrada' or v_valor<>round\(v_recebimento\.valor_total,2\)/);
  assert.match(sql, /update public\.recebimentos set status='recebido',data_recebimento=v_data/);
  assert.match(sql, /update public\.recebimentos set status='pendente',data_recebimento=null/);
  assert.equal((sql.match(/insert into public\.erp_auditoria/g) ?? []).length, 2);
  assert.match(sql, /a\.acao='excluir lançamento'/);
  assert.match(sql, /revoke all on function public\.financeiro_caixa_editar\(uuid,jsonb\) from public,anon/);
  assert.match(sql, /revoke all on function public\.financeiro_caixa_excluir\(uuid\) from public,anon/);
});

test("migration da baixa direta trava linhas, sincroniza caixa e audita sem backfill", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260923213000_financeiro_recebimento_decidir_atomico.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.financeiro_recebimento_decidir\(/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /from public\.recebimentos[\s\S]+for update/);
  assert.match(sql, /from public\.lancamentos_caixa[\s\S]+for update/);
  assert.match(sql, /insert into public\.lancamentos_caixa/);
  assert.match(sql, /delete from public\.lancamentos_caixa/);
  assert.match(sql, /update public\.recebimentos set status='recebido'/);
  assert.match(sql, /update public\.recebimentos set status='pendente',data_recebimento=null/);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /'idempotente',true/);
  assert.match(sql, /sem backfill automático/i);
  assert.match(sql, /revoke all on function public\.financeiro_recebimento_decidir\(uuid,boolean,date\) from public,anon/);
  assert.match(sql, /grant execute on function public\.financeiro_recebimento_decidir\(uuid,boolean,date\) to authenticated,service_role/);
});

test("migration da agenda preserva caixa baixado, legado e retries", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260923224500_financeiro_recebimento_agenda_atomica.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists request_id uuid/);
  assert.match(sql, /create unique index if not exists recebimentos_request_id_uidx/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(v_request_id::text,0\)\)/);
  assert.equal((sql.match(/security invoker/g) ?? []).length, 2);
  assert.match(sql, /create or replace function public\.financeiro_recebimento_salvar/);
  assert.match(sql, /create or replace function public\.financeiro_recebimento_excluir/);
  assert.match(sql, /from public\.recebimentos where id=p_recebimento_id for update/);
  assert.match(sql, /RECEBIMENTO_MOVIMENTO_ATIVO:[\s\S]+Desfaça a baixa/);
  assert.match(sql, /exists\(select 1 from public\.lancamentos_caixa l where l\.recebimento_id=p_recebimento_id\)/);
  assert.match(sql, /v_soma_depois>v_bruta and v_soma_depois>v_soma_antes/);
  assert.match(sql, /RECEBIMENTO_PARCELA_DUPLICADA/);
  assert.match(sql, /v_parcela_num<>trunc\(v_parcela_num\)/);
  assert.match(sql, /insert into public\.erp_auditoria/g);
  assert.match(sql, /'idempotente',true/);
  assert.match(sql, /revoke all on function public\.financeiro_recebimento_salvar\(uuid,jsonb\),public\.financeiro_recebimento_excluir\(uuid\) from public,anon/);
});

test("modal de recebimento mantém requestId estável durante retry", () => {
  const workspace = readFileSync(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
  const inicio = workspace.indexOf("function ReceiptModal(");
  const fim = workspace.indexOf("function MoneyInput(", inicio);
  const modal = workspace.slice(inicio, fim);
  assert.match(modal, /const \[requestId\] = useState\(\(\) => crypto\.randomUUID\(\)\)/);
  assert.match(modal, /onSave\(\{ action: "createReceipt", requestId,/);

  const ficha = readFileSync(new URL("../app/features/finance/VendaModal.tsx", import.meta.url), "utf8");
  assert.match(ficha, /disabled=\{somenteLeitura \|\| linha\.recebido\} type="number"/);
  assert.match(ficha, /disabled=\{busy \|\| linha\.recebido\} title=\{linha\.recebido \? "Desfaça a baixa para editar"/);
  assert.match(ficha, /disabled=\{busy \|\| linha\.recebido\} title=\{linha\.recebido \? "Desfaça a baixa para remover"/);
});

test("migration da edição de venda protege dependentes e preserva o legado", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260923215500_financeiro_venda_editar_atomica.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.venda_editar\(p_venda_id uuid,payload jsonb\)/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /from public\.vendas where id=p_venda_id for update/);
  for (const tabela of ["comissoes", "recebimentos", "pagamentos_comissao", "lancamentos_caixa"]) {
    assert.match(sql, new RegExp(`from public\\.${tabela} where venda_id=p_venda_id order by id for update`));
  }
  assert.match(sql, /VENDA_VALOR_DEPENDENTE/);
  assert.match(sql, /VENDA_MOVIMENTOS_ATIVOS/);
  assert.match(sql, /VENDA_RECEBIMENTOS_PENDENTES/);
  assert.match(sql, /left join public\.lancamentos_caixa l on l\.recebimento_id=r\.id/);
  assert.match(sql, /v_antes\.status::text<>'pago'/);
  assert.doesNotMatch(sql, /update public\.recebimentos/);
  assert.match(sql, /data_conclusao=v_conclusao/);
  assert.match(sql, /'idempotente',true/);
  assert.match(sql, /auditoria por trigger/);
  assert.match(sql, /Sem backfill/);
  assert.match(sql, /revoke all on function public\.venda_editar\(uuid,jsonb\) from public,anon/);
  assert.match(sql, /grant execute on function public\.venda_editar\(uuid,jsonb\) to authenticated,service_role/);
});

test("modal de caixa envia requestId estável para retry idempotente", () => {
  const workspace = readFileSync(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
  const inicio = workspace.indexOf("function CashModal");
  const fim = workspace.indexOf("function ReceiptModal", inicio);
  const modal = workspace.slice(inicio, fim);
  assert.match(modal, /const \[requestId\] = useState\(\(\) => typeof crypto/);
  assert.match(modal, /action: "createCash",\s+requestId,/);
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

test("GET do financeiro falha fechado se qualquer conjunto obrigatório falhar", () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const gate = /const firstError = \[([^\]]+)\]/.exec(rota)?.[1] ?? "";
  const conjuntos = [
    "sales", "details", "commissions", "receipts", "cash", "users", "brokers", "goals",
    "leads", "deals", "empreendimentos", "categorias", "rankingVgv", "payouts", "extratos", "extratoLinhas",
  ];
  for (const conjunto of conjuntos) assert.match(gate, new RegExp(`\\b${conjunto}\\b`), `${conjunto} ficou fora do gate`);
  assert.match(rota, /const \{ data: me, error: meError \} = await auth\.supabase\.from\("usuarios"\)/);
  assert.match(rota, /if \(meError\) return falhaFinanceiro\(meError, "carregar_perfil"\)/);
});

test("rota financeira não devolve detalhes internos nem os grava no log", () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const linhasComRespostaCrua = rota.split("\n").filter((linha) => linha.includes("Response.json") && linha.includes(".message"));
  const linhasComLogCru = rota.split("\n").filter((linha) => linha.includes("console.error") && linha.includes(".message"));
  assert.deepEqual(linhasComRespostaCrua, []);
  assert.deepEqual(linhasComLogCru, []);
  assert.match(rota, /function falhaFinanceiro\(/);
  assert.match(rota, /erro: semPermissao \? "sem_permissao" : opcoes\.erro \?\? \(parcial \? "reconciliacao_necessaria" : "falha_banco"\)/);
  assert.match(rota, /status: semPermissao \? 403 : opcoes\.status \?\? 502/);
});

test("corretor recebe somente o próprio escopo financeiro", () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  assert.match(rota, /const hasFullFinanceAccess = papelNoGrupo\(me\?\.role, "financeiro"\)/);
  assert.match(rota, /const isBroker = !hasFullFinanceAccess/);
  assert.match(rota, /commission\.beneficiario_id === auth\.user\.id/);
  assert.match(rota, /payout\.beneficiario_id === auth\.user\.id/);
  assert.match(rota, /broker\.usuario_id === auth\.user\.id/);
  assert.match(rota, /goal\.corretor_id !== null && brokerIds\.has\(goal\.corretor_id\)/);
  assert.doesNotMatch(rota, /scopedGoals[\s\S]{0,160}brokerNames\.has/);
  assert.match(rota, /const scopedReceipts = isBroker \? \[\] :/);
  assert.match(rota, /const scopedCash = isBroker \? \[\] :/);
  assert.match(rota, /const scopedLeads = isBroker \? \[\] :/);
  assert.match(rota, /const scopedEmpreendimentos = isBroker \? \[\] :/);
  assert.match(rota, /const scopedCategorias = isBroker \? \[\] :/);
  assert.match(rota, /const scopedExtratos = isBroker \? \[\] :/);
  assert.match(rota, /const scopedExtratoLinhas = isBroker \? \[\] :/);
  assert.match(rota, /brokerSaleIds\.has\(sale\.id\)/);
});

test("repasse só vira pago pelo comando que também movimenta o caixa", () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const inicio = rota.indexOf('if (action === "savePayout")');
  const fim = rota.indexOf('if (action === "settlePayout")', inicio);
  const savePayout = rota.slice(inicio, fim);
  assert.match(savePayout, /status: "previsto"/);
  assert.match(savePayout, /data_pagamento: null/);
  assert.match(savePayout, /\.neq\("status", "pago"\)/);
  assert.match(savePayout, /repasse_ja_pago/);
  assert.doesNotMatch(savePayout, /body\.status/);
});

test("baixa e reabertura de repasse usam uma única RPC atômica", async () => {
  const cliente = clienteFalso({ data: { ok: true, repasse_id: "r-1", lancamento_id: "c-1", idempotente: false }, error: null });
  const resposta = await decidirRepasseAtomico(cliente, "r-1", true, "2026-09-23");

  assert.deepEqual(cliente.chamadas, [{
    fn: "financeiro_decidir_repasse",
    args: { p_repasse_id: "r-1", p_pago: true, p_data_pagamento: "2026-09-23" },
  }]);
  assert.deepEqual(resposta, {
    status: 200,
    body: { success: true, payoutId: "r-1", cashId: "c-1", idempotente: false },
  });

  const reabrir = clienteFalso({ data: { ok: true, repasse_id: "r-1", lancamento_id: null, idempotente: true }, error: null });
  await decidirRepasseAtomico(reabrir, "r-1", false, "2026-09-23");
  assert.equal(reabrir.chamadas[0].args.p_data_pagamento, null);
});

test("falha da RPC de repasse nunca sinaliza estado parcial", async () => {
  const inconsistente = clienteFalso({ data: null, error: { code: "P0001", message: "REPASSE_INCONSISTENTE: Caixa divergente; solicite conferência financeira." } });
  const resposta = await decidirRepasseAtomico(inconsistente, "r-1", true, "2026-09-23");
  assert.equal(resposta.status, 409);
  assert.equal(resposta.body.error, "Caixa divergente; solicite conferência financeira.");
  assert.ok(!("parcial" in resposta.body));

  const indisponivel = clienteFalso({ data: null, error: { code: "PGRST202", message: "schema cache" } });
  assert.equal((await decidirRepasseAtomico(indisponivel, "r-1", false, "2026-09-23")).status, 503);
});

test("exclusão de repasse e caixa usa uma única RPC atômica e idempotente", async () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const inicio = rota.indexOf('if (action === "deletePayout")');
  const fim = rota.indexOf('if (action === "saveReceipt")', inicio);
  const excluir = rota.slice(inicio, fim);
  assert.match(excluir, /excluirRepasseAtomico\(semTipos\(auth\.supabase\), payoutId\)/);
  assert.doesNotMatch(excluir, /\.from\("pagamentos_comissao"\)\.(?:select|delete|update)/);
  assert.doesNotMatch(excluir, /\.from\("lancamentos_caixa"\)\.(?:select|delete|update)/);
  assert.doesNotMatch(excluir, /parcial/);

  const cliente = clienteFalso({ data: { ok: true, repasse_id: "r-1", lancamento_removido: true, idempotente: false }, error: null });
  const resposta = await excluirRepasseAtomico(cliente, "r-1");
  assert.deepEqual(cliente.chamadas, [{ fn: "financeiro_excluir_repasse", args: { p_repasse_id: "r-1" } }]);
  assert.deepEqual(resposta, {
    status: 200,
    body: { success: true, payoutId: "r-1", cashRemoved: true, idempotente: false },
  });

  const repetido = clienteFalso({ data: { ok: true, repasse_id: "r-1", lancamento_removido: true, idempotente: true }, error: null });
  assert.equal((await excluirRepasseAtomico(repetido, "r-1")).body.idempotente, true);

  const falha = clienteFalso({ data: null, error: { code: "P0001", message: "REPASSE_INCONSISTENTE: O caixa ligado diverge do repasse." } });
  const respostaFalha = await excluirRepasseAtomico(falha, "r-1");
  assert.equal(respostaFalha.status, 409);
  assert.ok(!("parcial" in respostaFalha.body));
});

test("migration do repasse trava linhas, sincroniza caixa e audita na mesma função", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260923205500_financeiro_repasse_atomico.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.financeiro_decidir_repasse\(/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /from public\.pagamentos_comissao[\s\S]+for update/);
  assert.match(sql, /insert into public\.lancamentos_caixa/);
  assert.match(sql, /delete from public\.lancamentos_caixa/);
  assert.match(sql, /update public\.pagamentos_comissao/);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /'idempotente', true/);
  assert.match(sql, /revoke all on function public\.financeiro_decidir_repasse\(uuid, boolean, date\) from public, anon/);
  assert.match(sql, /grant execute on function public\.financeiro_decidir_repasse\(uuid, boolean, date\) to authenticated, service_role/);
});

test("migration exclui repasse e caixa ligados na mesma transação auditada", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260923222000_financeiro_repasse_excluir_atomico.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.financeiro_excluir_repasse\(p_repasse_id uuid\)/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /from public\.pagamentos_comissao[\s\S]+for update/);
  assert.match(sql, /from public\.lancamentos_caixa[\s\S]+for update/);
  assert.match(sql, /REPASSE_INCONSISTENTE:[\s\S]+caixa ligado diverge/);
  assert.match(sql, /delete from public\.lancamentos_caixa where id=v_caixa\.id/);
  assert.match(sql, /delete from public\.pagamentos_comissao where id=p_repasse_id/);
  assert.equal((sql.match(/get diagnostics v_n=row_count/g) ?? []).length, 2);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /'acao'='excluir repasse'|'excluir repasse','Financeiro'/);
  assert.match(sql, /'idempotente',true/);
  assert.match(sql, /revoke all on function public\.financeiro_excluir_repasse\(uuid\) from public,anon/);
  assert.match(sql, /grant execute on function public\.financeiro_excluir_repasse\(uuid\) to authenticated,service_role/);
});

test("painel do corretor separa comissão a receber de repasse já pago", () => {
  const workspace = readFileSync(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /const brokerReceived = brokerPayouts\.filter\(\(item\) => item\.status === "pago"\)/);
  assert.match(workspace, /const brokerToReceive = Math\.max\(0, paidCommission - brokerReceived\)/);
  assert.match(workspace, /<span>Já recebido<\/span><strong>\{compact\.format\(brokerReceived\)\}/);
  assert.match(workspace, /"Minha comissão a receber"/);
  assert.match(workspace, /sessionRole === "corretor" \? brokerToReceive/);
  assert.doesNotMatch(workspace, /sessionRole === "corretor" \? paidCommission/);
});

test("filtros e metas usam o ano e o mês operacional de São Paulo", () => {
  const workspace = readFileSync(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /const periodoOperacao = \(\) => \{ const \[ano, mes\] = hojeOperacao\(\)\.split\("-"\); return \{ ano, mes: String\(Number\(mes\)\) \}; \}/);
  assert.doesNotMatch(workspace, /new Date\(\)\.getFullYear\(\)/);
  assert.match(workspace, /const \{ ano, mes \} = periodoOperacao\(\)/);
  assert.match(workspace, /ano: ano, periodo: mes/);
});

test("falha da primeira carga sai do loading e oferece nova tentativa", () => {
  const workspace = readFileSync(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /if \(!\[result\.sales, result\.details, result\.commissions, result\.receipts, result\.cash, result\.users, result\.brokers, result\.goals, result\.leads, result\.deals\]\.every\(Array\.isArray\)\) throw new Error\("Não foi possível confirmar os dados financeiros\."\)/);
  assert.match(workspace, /const \[initialLoadSettled, setInitialLoadSettled\] = useState\(false\)/);
  assert.match(workspace, /\.finally\(\(\) => setInitialLoadSettled\(true\)\)/);
  assert.match(workspace, /if \(!data && !initialLoadSettled\) return <div className="crm-loading"/);
  assert.match(workspace, /if \(!data\) return <section className="finance-load-error" role="alert">/);
  assert.match(workspace, /<button type="button" onClick=\{carregarInicial\}>Tentar novamente<\/button>/);
  assert.match(workspace, /const reload = \(\) => \{ void load\(\)\.catch/);
});

test("harness financeiro usa o componente produtivo e bloqueia mutações e rede externa", () => {
  const harness = readFileSync(new URL("./finance-visual-harness/main.tsx", import.meta.url), "utf8");
  const vite = readFileSync(new URL("./finance-visual-harness/vite.config.mjs", import.meta.url), "utf8");
  assert.match(harness, /import \{ FinanceWorkspace, type FinanceData \}/);
  assert.match(harness, /<FinanceWorkspace accessToken="harness-test-only" sessionRole="corretor"/);
  assert.match(harness, /method !== "GET" \|\| url\.origin !== window\.location\.origin/);
  assert.match(harness, /url\.pathname !== "\/api\/finance"/);
  assert.match(harness, /Cliente sanitizado/);
  assert.doesNotMatch(harness, /@gmail\.|@hotmail\.|\+55 1[1-9]/);
  assert.match(vite, /mock-supabase\.ts/);
});

test("gravações do financeiro não ignoram a resposta do banco", () => {
  const rota = readFileSync(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const gravacoesIgnoradas = rota.split("\n").filter((linha) => /^\s*await (?:semTipos\([^)]*\)|auth\.supabase)\.from\([^\n]+\)\.(?:insert|update|delete)\(/.test(linha));
  assert.deepEqual(gravacoesIgnoradas, []);
  for (const operacao of [
    "gravar_linhas_extrato",
    "marcar_linha_extrato",
  ]) {
    assert.match(rota, new RegExp(`falhaFinanceiro\\([^\\n]+"${operacao}"[^\\n]+parcial`), `${operacao} não sinaliza estado parcial`);
  }
});
