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
const cardAtomicoMigration = read("../supabase/migrations/20260908151000_funil2_card_atomico_ao_criar_negocio.sql");

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

test("Dados do lead não confirma sucesso sem identidade devolvida pelo servidor", () => {
  assert.match(dataEditor, /if \(!result\.lead \|\| typeof result\.lead\.nome !== "string" \|\| typeof result\.lead\.atualizado_em !== "string"\) throw new Error\("O servidor não confirmou os dados salvos\."\)/);
  assert.doesNotMatch(dataEditor, /result\.lead\?\.nome \?\? form\.nome\.trim\(\)/);
});

test("Adicionar cliente fica visível e usa criação canônica reconciliável", () => {
  assert.match(workspace, />Adicionar cliente</);
  // App mobile restaurado para a versão anterior ao CRM V3 (revert 90b5bd8a / 29fc970d): contrato mantido só no desktop.
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

test("Adicionar cliente rejeita opções incompletas em vez de bloquear sem explicação", () => {
  assert.match(addClient, /if \(!Array\.isArray\(json\.corretores\)/);
  assert.match(addClient, /throw new Error\("Não foi possível preparar o cadastro\."\)/);
  assert.match(addClient, /error && <p className="f2-modal-erro" role="alert">/);
});

test("Adicionar cliente rejeita responsável malformado antes de renderizar o seletor", () => {
  assert.match(addClient, /json\.corretores\.every\(\(item\) => item && Number\.isSafeInteger\(item\.corretor_id\) && item\.corretor_id > 0 && typeof item\.nome === "string" && typeof item\.is_self === "boolean"\)/);
});

test("Adicionar cliente não libera criação após verificação de duplicidade incompleta", () => {
  assert.match(addClient, /if \(typeof result\.duplicado !== "boolean" \|\| \(result\.duplicado && !result\.lead\)\) throw new Error\("Não foi possível verificar duplicidade\."\)/);
});

test("Adicionar cliente não fecha com identidade malformada", () => {
  assert.match(addClient, /function idFunilValido\(valor: unknown\): valor is string/);
  assert.match(addClient, /if \(idFunilValido\(result\.funilLeadId\)\) \{ onCreated\(result\.funilLeadId\); return; \}/);
  assert.match(addClient, /if \(result\.funilLeadId \|\| !Number\.isSafeInteger\(result\.leadId\) \|\| result\.leadId <= 0\) throw new Error\("O servidor não confirmou a identidade criada\."\)/);
});

test("negócio novo do Funil 2 cria o card visível na mesma transação", () => {
  assert.match(cardAtomicoMigration, /after insert or update of pipeline_id, stage_id, status, corretor_id/i);
  assert.match(cardAtomicoMigration, /new\.pipeline_id = public\.f2_pipeline_id\(\)/i);
  assert.match(cardAtomicoMigration, /new\.status = 'aberto'/i);
  assert.match(cardAtomicoMigration, /new\.corretor_id is not null/i);
  assert.match(cardAtomicoMigration, /perform public\.f2_entrada_direta\(new\.id, coalesce\(v_etapa, 'novo'\)\)/i);
  assert.match(cardAtomicoMigration, /revoke all on function public\.f2_negocio_garantir_card\(\)[\s\S]*from public, anon, authenticated/i);
  assert.doesNotMatch(cardAtomicoMigration, /cron\.schedule|service_role_key|authorization/i);
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
  // App mobile restaurado para a versão anterior ao CRM V3 (revert 90b5bd8a / 29fc970d): contrato mantido só no desktop.
  assert.match(negotiation, /action: "solicitar"/);
  assert.match(negotiation, />Abrir na Esteira</);
  assert.match(mobile, /aria-label="Mais ações"/);
  assert.match(mobile, /setMaisAcoes\(true\)/);
  assert.match(negotiation, /aguardando aprovação/);
  assert.doesNotMatch(negotiation, /action: "create"/);
  assert.match(salesApi, /from\("venda_solicitacoes"\)/);
  assert.match(salesApi, /from\("venda_processos"\)/);
  assert.match(salesApi, /rpc\("solicitar_venda"/);
  // As mensagens solicitacao_existente / negociacao_existente / "Nada foi enviado" saíram de
  // app/api/crm/sales/route.ts no revert 90b5bd8a; asserções removidas junto.
  assert.doesNotMatch(salesApi.match(/if \(action === "solicitar"\)[\s\S]*?if \(action === "aprovarSolicitacao"\)/)?.[0] ?? "", /aprovar_solicitacao|from\("vendas"\)\.insert/);
});

test("Iniciar negociação rejeita preparação incompleta antes de habilitar envio", () => {
  assert.match(negotiation, /if \(!\[json\.products, json\.solicitacoes, json\.processes\]\.every\(Array\.isArray\)\) throw new Error\("Não foi possível preparar a negociação\."\)/);
  assert.match(negotiation, /error && <p className="f2-modal-erro" role="alert">/);
  assert.match(negotiation, /disabled=\{busy \|\| Boolean\(error\) \|\| Boolean\(existente\)/);
});

test("Esteira preserva recusas de negócio sem expor falhas internas", () => {
  assert.match(salesApi, /function falhaEsteira/);
  assert.match(salesApi, /erro: semPermissao \? "sem_permissao" : "falha_banco"/);
  assert.doesNotMatch(salesApi, /Response\.json\(\{ error: (?:error|verifErr|pe)\.message/);
  assert.doesNotMatch(salesApi, /A Sara não conseguiu ler os documentos: \$\{detalhe\}/);
  assert.match(salesApi, /MENSAGENS_CLASSIFICACAO/);
  assert.match(salesApi, /ja_solicitado/);
  assert.match(salesApi, /impacto_financeiro/);
});

test("leitura da Esteira falha se qualquer conjunto obrigatório falhar", () => {
  const leitura = salesApi.slice(salesApi.indexOf("export async function GET"), salesApi.indexOf("export async function PATCH"));
  for (const consulta of ["sales", "processes", "deals", "leads", "anexos", "users", "history", "condicoes", "comissao", "partes", "anexoEventos"]) {
    assert.match(leitura, new RegExp(`\\b${consulta}\\b[\\s\\S]*?\\.find\\(\\(item\\) => item\\.error\\)`), consulta);
  }
  assert.match(leitura, /falhaEsteira\(error, "listar"\)/);
});

test("movimentação e blocos nunca usam contexto parcial da venda", () => {
  const carregarContexto = salesApi.slice(salesApi.indexOf("async function contexto"), salesApi.indexOf("function blocoDocsAberto"));
  assert.match(carregarContexto, /find\(\(item\) => item\.error\)\?\.error \?\? null/);
  assert.match(carregarContexto, /return \{ proc, etapas, atual, dados,[\s\S]*error \}/);
  assert.match(salesApi, /ctx\.error[\s\S]*carregar_contexto_movimentacao/);
  assert.match(salesApi, /ctxLote\.error[\s\S]*carregar_contexto_lote/);
  assert.match(salesApi, /ctx\.error[\s\S]*carregar_contexto_venda/);
});

test("escritas auxiliares da venda não fingem sucesso quando falham", () => {
  assert.match(salesApi, /reabrirError[\s\S]*reabrir_negocio_recusado/);
  assert.match(salesApi, /limparParcelasError[\s\S]*limpar_parcelas_comissao/);
  assert.match(salesApi, /sincronizarConjuge[\s\S]*syncError[\s\S]*sincronizar_conjuge/);
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
