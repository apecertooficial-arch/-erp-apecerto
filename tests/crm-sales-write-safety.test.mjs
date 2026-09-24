import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { criarVendaCrmAtomica } from "../app/api/crm/sales-create-rpc.ts";
import { saveSalesCommissionAtomic } from "../app/api/crm/sales-commission-rpc.ts";
import { reviewSalesDocumentAtomic } from "../app/api/crm/sales-document-review-rpc.ts";
import { mutateSalesPartyAtomic } from "../app/api/crm/sales-party-rpc.ts";
import { returnSaleAtomic } from "../app/api/crm/sales-return-rpc.ts";
import { createSalesStageAtomic } from "../app/api/crm/sales-stage-create-rpc.ts";
import { reorderSalesStagesAtomic } from "../app/api/crm/sales-stage-order-rpc.ts";
import { confirmSalesTriageAtomic } from "../app/api/crm/sales-triage-confirm-rpc.ts";
import { registerSalesBatchAttachmentsAtomic } from "../app/api/crm/sales-batch-attachment-rpc.ts";

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

test("devolver venda usa uma RPC para processo, negócio e auditoria", async () => {
  const inicio = api.indexOf('if (action === "devolverFunil")');
  const fim = api.indexOf('if (action === "approveSale"', inicio);
  const devolver = api.slice(inicio, fim);
  assert.match(devolver, /returnSaleAtomic/);
  assert.doesNotMatch(devolver, /\.from\("(?:negocios|venda_processos)"\)\.update/);
  assert.match(ui, /setDevRequestId\(crypto\.randomUUID\(\)\)/);
  assert.match(ui, /action: "devolverFunil", processId: process\.id, stageId, motivo, requestId: devRequestId/);

  const client = clienteFalso({ data: { processo_id: "p-1", negocio_id: 10, idempotente: false }, error: null });
  const response = await returnSaleAtomic(client, { processId: "p-1", stageId: 20, reason: "retorno", requestId: "req-2" });
  assert.deepEqual(client.chamadas, [{ fn: "esteira_venda_devolver", args: { p_processo_id: "p-1", p_stage_id: 20, p_motivo: "retorno", p_request_id: "req-2" } }]);
  assert.deepEqual(response.body, { success: true, processId: "p-1", dealId: 10, idempotent: false });
});

test("migration devolve processo e negócio em uma transação idempotente", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924040000_esteira_venda_devolver_atomica.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists erp_auditoria_esteira_devolucao_request_uidx/);
  assert.match(sql, /create or replace function public\.esteira_venda_devolver/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /update public\.negocios/);
  assert.match(sql, /update public\.venda_processos/);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /grant execute on function public\.esteira_venda_devolver\(uuid,bigint,text,uuid\) to authenticated,service_role/);
});

test("salvar comissão usa uma RPC para cabeçalho, parcelas e auditoria", async () => {
  const inicio = api.indexOf('if (action === "salvarComissao")');
  const fim = api.indexOf('// ===== Partes da negociação', inicio);
  const salvar = api.slice(inicio, fim);
  assert.match(salvar, /saveSalesCommissionAtomic/);
  assert.doesNotMatch(salvar, /\.from\("venda_comissao(?:_parcelas)?"\)\.(?:upsert|insert|update|delete)/);
  assert.match(ui, /const \[comRequestId, setComRequestId\] = useState\(\(\) => crypto\.randomUUID\(\)\)/);
  assert.match(ui, /action: "salvarComissao", processId: process\.id, requestId: comRequestId/);
  assert.match(ui, /setComRequestId\(crypto\.randomUUID\(\)\)/);

  const client = clienteFalso({ data: { processo_id: "p-1", parcelas: 2, idempotente: false }, error: null });
  const commission = { percentual_total: 5, valor_total: 1000, participantes: [] };
  const installments = [{ valor: 500 }, { valor: 500 }];
  const response = await saveSalesCommissionAtomic(client, { processId: "p-1", commission, installments, requestId: "req-3" });
  assert.deepEqual(client.chamadas, [{ fn: "esteira_comissao_salvar", args: {
    p_processo_id: "p-1", p_comissao: commission, p_parcelas: installments, p_request_id: "req-3",
  } }]);
  assert.deepEqual(response.body, { success: true, processId: "p-1", installments: 2, idempotent: false });
});

test("migration salva comissão e parcelas em uma transação idempotente", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924043000_esteira_comissao_atomica.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists venda_comissao_parcelas_processo_ordem_uidx/);
  assert.match(sql, /create unique index if not exists erp_auditoria_esteira_comissao_request_uidx/);
  assert.match(sql, /create or replace function public\.esteira_comissao_salvar/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /insert into public\.venda_comissao/);
  assert.match(sql, /delete from public\.venda_comissao_parcelas/);
  assert.match(sql, /insert into public\.venda_comissao_parcelas/);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /grant execute on function public\.esteira_comissao_salvar\(uuid,jsonb,jsonb,uuid\) to authenticated,service_role/);
});

test("mutações de parte usam uma RPC para pessoa, flag de cônjuge e auditoria", async () => {
  const inicio = api.indexOf('if (action === "salvarParte" || action === "adicionarParte")');
  const fim = api.indexOf('// ===== Upload em lote', inicio);
  const partes = api.slice(inicio, fim);
  assert.match(partes, /mutateSalesPartyAtomic/);
  assert.doesNotMatch(partes, /\.from\("venda_partes"\)\.(?:upsert|insert|update|delete)/);
  assert.doesNotMatch(partes, /\.from\("venda_condicoes"\)\.upsert/);
  assert.doesNotMatch(partes, /if \(!alvo\) return Response\.json/);
  assert.match(ui, /const parteRequests = useRef\(new Map<string, string>\(\)\)/);
  assert.match(ui, /action: "adicionarParte"[\s\S]*requestId: requestParte\(key\)/);
  assert.match(ui, /action: "removerParte", processId: process\.id, parteId, requestId: requestParte\(key\)/);

  const client = clienteFalso({ data: { parte_id: "pt-1", ordem: 1, removida: false, idempotente: false }, error: null });
  const payload = { papel: "conjuge_comprador", ordem: 1, nome: "Pessoa" };
  const response = await mutateSalesPartyAtomic(client, { action: "salvar", processId: "p-1", payload, requestId: "req-4" });
  assert.deepEqual(client.chamadas, [{ fn: "esteira_parte_mutar", args: {
    p_acao: "salvar", p_processo_id: "p-1", p_parte_id: null, p_payload: payload, p_request_id: "req-4",
  } }]);
  assert.deepEqual(response.body, { success: true, partyId: "pt-1", order: 1, removed: false, idempotent: false });
});

test("migration mantém parte e flag de cônjuge na mesma transação", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924050000_esteira_partes_atomicas.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists erp_auditoria_esteira_parte_request_uidx/);
  assert.match(sql, /create or replace function public\.esteira_parte_mutar/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /insert into public\.venda_partes/);
  assert.match(sql, /delete from public\.venda_partes/);
  assert.match(sql, /insert into public\.venda_condicoes/);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /grant execute on function public\.esteira_parte_mutar\(text,uuid,uuid,jsonb,uuid\) to authenticated,service_role/);
});

test("revisão de documento usa uma RPC para status e trilha", async () => {
  const inicio = api.indexOf('if (action === "docStatus")');
  const fim = api.indexOf('if (action === "docAnexoObrig")', inicio);
  const revisar = api.slice(inicio, fim);
  assert.match(revisar, /reviewSalesDocumentAtomic/);
  assert.doesNotMatch(revisar, /\.from\("esteira_anexos"\)\.update/);
  assert.doesNotMatch(revisar, /trilha\(/);
  assert.match(ui, /const documentReviewRequests = useRef\(new Map<string, string>\(\)\)/);
  assert.match(ui, /action: "docStatus", anexoId: a\.id, status, motivo, requestId: requestDocumento\(key\)/);

  const client = clienteFalso({ data: { anexo_id: "a-1", status: "aprovado", idempotente: false }, error: null });
  const response = await reviewSalesDocumentAtomic(client, { attachmentId: "a-1", status: "aprovado", reason: "", requestId: "req-5" });
  assert.deepEqual(client.chamadas, [{ fn: "esteira_anexo_revisar", args: {
    p_anexo_id: "a-1", p_status: "aprovado", p_motivo: null, p_request_id: "req-5",
  } }]);
  assert.deepEqual(response.body, { success: true, attachmentId: "a-1", status: "aprovado", idempotent: false });
});

test("migration mantém revisão e trilha de documento na mesma transação", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924053000_esteira_documento_revisao_atomica.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists esteira_anexo_eventos_status_request_uidx/);
  assert.match(sql, /create or replace function public\.esteira_anexo_revisar/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /update public\.esteira_anexos/);
  assert.match(sql, /insert into public\.esteira_anexo_eventos/);
  assert.match(sql, /grant execute on function public\.esteira_anexo_revisar\(uuid,text,text,uuid\) to authenticated,service_role/);
});

test("confirmação da triagem usa uma RPC para anexo e trilha", async () => {
  const inicio = api.indexOf('if (action === "triagemConfirmar")');
  const fim = api.indexOf('// ===== Exclusão definitiva', inicio);
  const confirmar = api.slice(inicio, fim);
  assert.match(confirmar, /confirmSalesTriageAtomic/);
  assert.doesNotMatch(confirmar, /\.from\("esteira_anexos"\)\.update/);
  assert.doesNotMatch(confirmar, /trilha\(/);
  assert.match(ui, /const triageConfirmRequests = useRef\(new Map<string, string>\(\)\)/);
  assert.match(ui, /action: "triagemConfirmar", anexoId, grupo, docNome, obrigatorio, requestId/);

  const client = clienteFalso({ data: { anexo_id: "a-2", status: "anexado", evento: "corrigido", idempotente: false }, error: null });
  const response = await confirmSalesTriageAtomic(client, {
    attachmentId: "a-2", group: "comprador", documentName: "RG", required: true, requestId: "req-8",
  });
  assert.deepEqual(client.chamadas, [{ fn: "esteira_anexo_triagem_confirmar", args: {
    p_anexo_id: "a-2", p_grupo: "comprador", p_doc_nome: "RG", p_obrigatorio: true, p_request_id: "req-8",
  } }]);
  assert.deepEqual(response.body, { success: true, attachmentId: "a-2", status: "anexado", event: "corrigido", idempotent: false });
});

test("migration confirma triagem e grava trilha na mesma transação", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924100500_esteira_triagem_confirmacao_atomica.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists esteira_anexo_eventos_triagem_request_uidx/);
  assert.match(sql, /create or replace function public\.esteira_anexo_triagem_confirmar/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /update public\.esteira_anexos/);
  assert.match(sql, /insert into public\.esteira_anexo_eventos/);
  assert.match(sql, /grant execute on function public\.esteira_anexo_triagem_confirmar\(uuid,text,text,boolean,uuid\) to authenticated,service_role/);
});

test("upload em lote usa uma RPC para anexos e trilha", async () => {
  const inicio = api.indexOf('if (action === "addAnexoLote")');
  const fim = api.indexOf('if (action === "classificarLote")', inicio);
  const lote = api.slice(inicio, fim);
  assert.match(lote, /registerSalesBatchAttachmentsAtomic/);
  assert.doesNotMatch(lote, /\.from\("esteira_anexos"\)\.insert/);
  assert.doesNotMatch(lote, /trilha\(/);
  assert.match(ui, /action: "addAnexoLote", processId: process\.id, loteId, etapaSlug: process\.etapa, arquivos: enviados/);

  const arquivos = [{ nome: "RG.pdf", path: "esteira/p-1/_lote/l-1/RG.pdf", mime: "application/pdf", tamanho: 50 }];
  const client = clienteFalso({ data: { lote_id: "l-1", anexos: [{ id: "a-1", nome: "RG.pdf" }], idempotente: false }, error: null });
  const response = await registerSalesBatchAttachmentsAtomic(client, {
    processId: "p-1", batchId: "l-1", stageSlug: null, files: arquivos,
  });
  assert.deepEqual(client.chamadas, [{ fn: "esteira_anexo_lote_registrar", args: {
    p_processo_id: "p-1", p_lote_id: "l-1", p_etapa_slug: null, p_arquivos: arquivos,
  } }]);
  assert.deepEqual(response.body, { success: true, loteId: "l-1", anexos: [{ id: "a-1", nome: "RG.pdf" }], idempotent: false });
});

test("migration registra lote e trilha na mesma transação", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924103000_esteira_anexo_lote_atomico.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists esteira_anexo_eventos_upload_lote_uidx/);
  assert.match(sql, /create or replace function public\.esteira_anexo_lote_registrar/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /insert into public\.esteira_anexos/);
  assert.match(sql, /insert into public\.esteira_anexo_eventos/);
  assert.match(sql, /grant execute on function public\.esteira_anexo_lote_registrar\(uuid,uuid,text,jsonb\) to authenticated,service_role/);
});

test("reordenação das etapas usa uma RPC para a sequência completa", async () => {
  const inicio = api.indexOf('if (action === "reorderStages")');
  const fim = api.indexOf('if (action === "bulkMoveStage")', inicio);
  const reordenar = api.slice(inicio, fim);
  assert.match(reordenar, /reorderSalesStagesAtomic/);
  assert.doesNotMatch(reordenar, /\.from\("esteira_etapas"\)\.update/);
  assert.match(ui, /const stageOrderRequests = useRef\(new Map<string, string>\(\)\)/);
  assert.match(ui, /action: "reorderStages", ids, requestId/);

  const client = clienteFalso({ data: { etapas: 3, idempotente: false }, error: null });
  const response = await reorderSalesStagesAtomic(client, { stageIds: ["s-2", "s-1", "s-3"], requestId: "req-6" });
  assert.deepEqual(client.chamadas, [{ fn: "esteira_etapas_reordenar", args: {
    p_ids: ["s-2", "s-1", "s-3"], p_request_id: "req-6",
  } }]);
  assert.deepEqual(response.body, { success: true, stages: 3, idempotent: false });
});

test("criação de etapa usa uma RPC idempotente e só fecha o formulário após confirmação", async () => {
  const inicio = api.indexOf('if (action === "createStage")');
  const fim = api.indexOf('if (action === "updateStage")', inicio);
  const criar = api.slice(inicio, fim);
  assert.match(criar, /createSalesStageAtomic/);
  assert.doesNotMatch(criar, /\.from\("esteira_etapas"\)\.select/);
  assert.doesNotMatch(criar, /\.from\("esteira_etapas"\)\.insert/);
  assert.match(ui, /const stageCreateRequests = useRef\(new Map<string, string>\(\)\)/);
  assert.match(ui, /action: "createStage", nome, requestId/);
  assert.match(ui, /if \(await mutateStages\([\s\S]*?setAddingStage\(false\)/);

  const client = clienteFalso({ data: { etapa_id: "s-4", slug: "vistoria", ordem: 4, idempotente: false }, error: null });
  const response = await createSalesStageAtomic(client, {
    name: "Vistoria", slugBase: "vistoria", color: "#8d2bd1", role: "Corretor", slaDays: 3, resale: false, requestId: "req-7",
  });
  assert.deepEqual(client.chamadas, [{ fn: "esteira_etapa_criar", args: {
    p_nome: "Vistoria", p_slug_base: "vistoria", p_cor: "#8d2bd1", p_papel: "Corretor", p_sla_dias: 3, p_resale: false, p_request_id: "req-7",
  } }]);
  assert.deepEqual(response.body, { success: true, stageId: "s-4", slug: "vistoria", order: 4, idempotent: false });
});

test("migration cria etapa e auditoria na mesma transação serializada", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924063000_esteira_etapa_criar_atomica.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists erp_auditoria_esteira_etapa_criar_request_uidx/);
  assert.match(sql, /create or replace function public\.esteira_etapa_criar/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('esteira_etapas_ordem',0\)\)/);
  assert.match(sql, /insert into public\.esteira_etapas/);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /grant execute on function public\.esteira_etapa_criar\(text,text,text,text,integer,boolean,uuid\) to authenticated,service_role/);
});

test("migration reordena todas as etapas e auditoria na mesma transação", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924060000_esteira_etapas_reordenacao_atomica.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists erp_auditoria_esteira_etapas_ordem_request_uidx/);
  assert.match(sql, /create or replace function public\.esteira_etapas_reordenar/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /set ordem=-array_position\(p_ids,id\)/);
  assert.match(sql, /set ordem=array_position\(p_ids,id\)/);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /grant execute on function public\.esteira_etapas_reordenar\(uuid\[\],uuid\) to authenticated,service_role/);
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
