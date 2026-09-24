import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { criarVendaCrmAtomica } from "../app/api/crm/sales-create-rpc.ts";

const api = readFileSync(new URL("../app/api/crm/sales/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/sales/SalesProcessWorkspace.tsx", import.meta.url), "utf8");
const harness = readFileSync(new URL("./crm-visual-harness/main.tsx", import.meta.url), "utf8");
const salesHarness = readFileSync(new URL("./sales-mobile-visual-harness/main.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function clienteFalso(resposta) {
  const chamadas = [];
  return {
    chamadas,
    rpc(fn, args) {
      chamadas.push({ fn, args });
      return Promise.resolve(resposta);
    },
  };
}

test("observação comprova acesso ao processo antes de inserir", () => {
  const comando = api.match(/if \(action === "addObs"\)[\s\S]*?return error \?/)?.[0] ?? "";
  assert.match(comando, /from\("venda_processos"\)\.select\("id"\)\.eq\("id", processId\)\.maybeSingle\(\)/);
  assert.match(comando, /if \(processoError\) return falhaEsteira\(processoError, "autorizar_observacao"\)/);
  assert.match(comando, /if \(!processo\) return Response\.json\(\{ error: "Venda não encontrada ou sem acesso\." \}, \{ status: 404 \}\)/);

  const autorizacao = comando.indexOf('from("venda_processos")');
  const escrita = comando.indexOf('from("venda_observacoes").insert');
  assert.ok(autorizacao >= 0 && escrita > autorizacao, "a autorização deve anteceder a escrita");
});

test("movimentação usa revisão otimista e comprova a linha alterada", () => {
  const move = api.match(/if \(action === "move"\)[\s\S]*?if \(action === "addAnexo"/)?.[0] ?? "";
  assert.match(move, /\.update\(update\)\.eq\("id", processId\)\.eq\("etapa", ctx\.proc\.etapa\)\.select\("id,etapa"\)\.maybeSingle\(\)/);
  assert.match(move, /if \(!movido\) return Response\.json\(\{ error: "Esta venda mudou de etapa enquanto você trabalhava\. Recarregue e tente novamente\." \}, \{ status: 409 \}\)/);
  assert.match(move, /return Response\.json\(\{ success: true, stage: movido\.etapa \}\)/);
});

test("avanço da Esteira não pula etapas nem aceita verificação como atalho", () => {
  const move = api.match(/if \(action === "move"\)[\s\S]*?if \(action === "addAnexo"/)?.[0] ?? "";
  assert.match(move, /if \(!podeEditarEtapa\(ctx\.role, ctx\.atual\)\)/);
  assert.match(move, /const proxima = proximaEtapa\(ctx\)/);
  assert.match(move, /if \(avancando && destino\.slug !== proxima\?\.slug\)/);
  assert.match(move, /const pendencias = pendenciasDoContexto\(ctx\)/);
  assert.doesNotMatch(move, /if \(!verif\)/);
});

test("verificação gerencial só vale para a etapa atual completa e aprovada", () => {
  const verify = api.match(/if \(action === "verifyStage" \|\| action === "unverifyStage"\)[\s\S]*?if \(\["docCreate"/)?.[0] ?? "";
  assert.match(verify, /const ctx = await contexto\(auth, processId\)/);
  assert.match(verify, /etapaSlug !== ctx\.atual\?\.slug/);
  assert.match(verify, /const pendencias = pendenciasDoContexto\(ctx\)/);
  assert.match(api, /anexo\.status === "aprovado"/);
});

test("documento de marco pertence à etapa atual e pode existir sem grupo de parte", () => {
  const attachments = api.match(/if \(action === "addAnexo" \|\| action === "removeAnexo"\)[\s\S]*?if \(action === "verifyStage"/)?.[0] ?? "";
  assert.match(attachments, /etapa_slug/);
  assert.match(attachments, /guardDocumentoEtapa/);
  assert.match(api, /function guardDocumentoEtapa[\s\S]*?etapaSlug !== ctx\.atual\?\.slug/);
  assert.match(attachments, /grupo: grupoAlvo \|\| null/);
});

test("movimentação em massa é recusada para preservar pré-condições por venda", () => {
  const bulk = api.match(/if \(action === "bulkMoveStage"\)[\s\S]*?\/\/ deleteStage/)?.[0] ?? "";
  assert.match(bulk, /movida individualmente/);
  assert.doesNotMatch(bulk, /venda_processos"\)\.update/);
  assert.doesNotMatch(ui, /bulkMoveStage|Mover todas as vendas desta etapa/);
});

test("interface mostra comprovação da etapa e só oferece o próximo avanço", () => {
  assert.match(ui, /etapaDocs=\{data\.etapaDocs \?\? \[\]\}/);
  assert.match(ui, /Comprovação da etapa/);
  assert.match(ui, /docsEtapaAtual/);
  assert.match(ui, /opcoesDeMovimento/);
  assert.match(ui, /podeMoverProcesso\(stageList, item, sessionRole\)/);
  assert.match(ui, /_etapa\/\$\{process\.etapa\}/);
  assert.match(salesHarness, /Minuta do contrato/);
  assert.match(css, /@media\(max-width:720px\)\{\.sale-full\{overflow-y:auto\}/);
  assert.match(css, /grid-template-columns:auto minmax\(0,1fr\)/);
});

test("Esteira rejeita carga parcial em vez de publicar falso vazio", () => {
  assert.match(ui, /const payloadVendasValido = \(result: unknown\)/);
  assert.match(ui, /if \(!response\.ok \|\| !payloadVendasValido\(result\)\) throw new Error\(/);
  assert.match(ui, /Não foi possível confirmar os dados da Esteira/);
  assert.match(harness, /SalesProcessView/);
  assert.match(harness, /salesPayload/);
});

test("criação de venda só fecha o modal após confirmação explícita", () => {
  assert.match(ui, /if \(!response\.ok \|\| result\.success !== true\) throw new Error\(result\.error \|\| "A Esteira não confirmou a criação da venda\."\)/);
  assert.match(harness, /salesCreate/);
});

test("conectar venda ao CRM usa uma única RPC atômica e request estável", async () => {
  const inicio = api.indexOf('if (action === "create")');
  const fim = api.indexOf('if (action === "solicitar")', inicio);
  const criar = api.slice(inicio, fim);
  assert.match(criar, /criarVendaCrmAtomica/);
  assert.doesNotMatch(criar, /\.from\("(?:vendas|negocios|venda_processos)"\)\.(?:insert|update|delete)/);
  assert.match(ui, /const \[requestId\] = useState\(\(\) => crypto\.randomUUID\(\)\)/);
  assert.match(ui, /action: "create", requestId, dealId:/);

  const payload = { request_id: "req-1", negocio_id: 10, produto_id: "prod-1" };
  const cliente = clienteFalso({ data: { venda_id: "v-1", processo_id: "p-1", aprovacao: "aprovada", idempotente: false }, error: null });
  const resposta = await criarVendaCrmAtomica(cliente, payload);
  assert.deepEqual(cliente.chamadas, [{ fn: "esteira_venda_criar", args: { payload } }]);
  assert.deepEqual(resposta.body, { success: true, saleId: "v-1", processId: "p-1", aprovacao: "aprovada", idempotente: false });
});

test("migration conecta venda, negócio, processo e auditoria em uma transação", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924020000_esteira_venda_criar_atomica.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists venda_processos_negocio_id_uidx/);
  assert.match(sql, /create or replace function public\.esteira_venda_criar\(payload jsonb\)/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(v_request_id::text,0\)\)/);
  assert.match(sql, /insert into public\.vendas/);
  assert.match(sql, /update public\.negocios/);
  assert.match(sql, /insert into public\.venda_processos/);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /'idempotente',true/);
  assert.match(sql, /revoke all on function public\.esteira_venda_criar\(jsonb\) from public,anon/);
  assert.match(sql, /grant execute on function public\.esteira_venda_criar\(jsonb\) to authenticated,service_role/);
});

test("drawer só atualiza etapa após movimentação confirmada", () => {
  assert.match(ui, /if \(!response\.ok \|\| result\.success !== true\) throw new Error\(result\.error \|\| "A Esteira não confirmou a movimentação da venda\."\)/);
  assert.match(ui, /if \(await move\(detailItem\.id, stage\)\) setDetailItem/);
  assert.match(harness, /salesMove/);
});

test("escritas do detalhe só limpam o formulário após confirmação explícita", () => {
  assert.match(ui, /if \(!r\.ok \|\| j\.success !== true\) throw new Error\(j\.error \|\| "A Esteira não confirmou a alteração\."\)/);
  assert.match(harness, /salesWrite/);
});
