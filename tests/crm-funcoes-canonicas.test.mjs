import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const entry = read("../app/features/funil-2/FunilEntry.tsx");
const dataEditor = read("../app/features/funil-2/LeadDataEditor.tsx");
const addClient = read("../app/features/funil-2/AdicionarClienteModal.tsx");
const negotiation = read("../app/features/funil-2/IniciarNegociacaoModal.tsx");
const clientApi = read("../app/api/funil2/clientes/route.ts");
const salesApi = read("../app/api/crm/sales/route.ts");

test("a entrega mantém somente o CRM novo e não reativa a interface clássica", () => {
  assert.match(entry, /Funil2Workspace/);
  assert.match(entry, /Funil2Mobile/);
  assert.doesNotMatch(`${entry}\n${workspace}\n${mobile}`, /CrmWorkspace|crm-classic|tela-crm|805d71eb/);
  assert.equal(existsSync(new URL("../app/features/crm/CrmWorkspace.tsx", import.meta.url)), false);
});

test("Dados do lead possui edição real, estado sujo, cancelar e persistência canônica", () => {
  assert.match(dataEditor, /Salvar alterações/);
  assert.match(dataEditor, /Cancelar/);
  assert.match(dataEditor, /expectedUpdatedAt/);
  assert.match(dataEditor, /method: "PATCH"/);
  assert.match(dataEditor, /\/api\/funil2\/clientes/);
  assert.match(dataEditor, /beforeunload/);
  assert.match(dataEditor, /409/);
  assert.match(dataEditor, /Valores atuais no servidor/);
  assert.match(dataEditor, /Usar valores atuais/);
  assert.match(clientApi, /action !== "atualizar"/);
  assert.match(clientApi, /rpc\("telefone_br_normalizado"/);
  assert.match(clientApi, /rpc\("wa_match_lead"/);
  assert.match(clientApi, /from\("leads"\)\.update/);
  assert.match(clientApi, /eq\("atualizado_em", expectedUpdatedAt\)/);
  assert.doesNotMatch(clientApi, /service_role|SUPABASE_SERVICE_ROLE/);
});

test("Adicionar cliente fica visível e usa criação canônica reconciliável", () => {
  assert.match(workspace, />Adicionar cliente</);
  assert.match(mobile, />Adicionar cliente</);
  assert.match(addClient, /aria-label="Adicionar cliente"/);
  assert.match(addClient, /crypto\.randomUUID/);
  assert.match(addClient, /buscandoDuplicidade/);
  assert.match(addClient, /response\.status !== 202/);
  assert.match(clientApi, /action !== "criar"/);
  assert.match(clientApi, /listar_corretores_transferencia/);
  assert.match(clientApi, /from\("leads"\)\.insert/);
  assert.match(clientApi, /from\("negocios"\)\.insert/);
  assert.match(clientApi, /origem: "manual"/);
  assert.match(clientApi, /crm_manual_idempotency/);
  assert.match(clientApi, /from\("f2_lead"\)/);
  assert.match(clientApi, /status: 202/);
  assert.doesNotMatch(clientApi, /fetch\(|WhatsApp|D-API|service_role/);
});

test("deduplicação cobre telefone, e-mail e CPF sem retry silencioso", () => {
  assert.match(clientApi, /wa_match_lead/);
  assert.match(clientApi, /ilike\("email"/);
  assert.match(clientApi, /contains\("extras", \{ cpf_cnpj/);
  assert.match(clientApi, /duplicado/);
  assert.match(clientApi, /status: 409/);
  assert.doesNotMatch(addClient, /retry|tentarNovamenteAutomaticamente/i);
});

test("Iniciar negociação usa apenas a solicitação pendente da Esteira", () => {
  assert.match(workspace, />Iniciar negociação</);
  assert.match(mobile, />Iniciar negociação</);
  assert.match(negotiation, /action: "solicitar"/);
  assert.match(negotiation, />Abrir na Esteira</);
  assert.match(mobile, /setAreaCrm\("esteira"\)/);
  assert.match(mobile, /<SalesProcessView/);
  assert.match(mobile, /aria-label="Mais ações"/);
  assert.match(mobile, /setMaisAcoes\(true\)/);
  assert.match(negotiation, /aguardando aprovação/);
  assert.doesNotMatch(negotiation, /action: "create"/);
  assert.match(salesApi, /from\("venda_solicitacoes"\)/);
  assert.match(salesApi, /from\("venda_processos"\)/);
  assert.match(salesApi, /rpc\("solicitar_venda"/);
  assert.match(salesApi, /solicitacao_existente/);
  assert.match(salesApi, /negociacao_existente/);
  assert.match(salesApi, /Nada foi enviado/);
  assert.doesNotMatch(salesApi.match(/if \(action === "solicitar"\)[\s\S]*?if \(action === "aprovarSolicitacao"\)/)?.[0] ?? "", /aprovar_solicitacao|from\("vendas"\)\.insert/);
});

test("os três fluxos preservam foco, teclado e alvos móveis", () => {
  for (const source of [addClient, negotiation]) {
    assert.match(source, /Escape/);
    assert.match(source, /evento\.key !== "Tab"/);
    assert.match(source, /aria-modal="true"/);
  }
  assert.match(dataEditor, /beforeunload/);
  assert.match(dataEditor, /onDirtyChange/);
});
