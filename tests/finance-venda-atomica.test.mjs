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
    "baixar_parcela_apos_lancamento",
    "auditar_edicao_lancamento",
    "reabrir_parcela_apos_exclusao",
    "baixar_parcelas_apos_venda",
    "baixar_repasse",
    "gravar_linhas_extrato",
    "marcar_linha_extrato",
  ]) {
    assert.match(rota, new RegExp(`falhaFinanceiro\\([^\\n]+"${operacao}"[^\\n]+parcial`), `${operacao} não sinaliza estado parcial`);
  }
});
