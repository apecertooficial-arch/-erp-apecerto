import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/campaigns/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/campaigns/CampaignWorkspace.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const harness = readFileSync(new URL("./campaigns-visual-harness/main.tsx", import.meta.url), "utf8");

test("Campanhas sanitiza falhas técnicas sem registrar payload ou PII", () => {
  assert.match(route, /function falhaCampanha\(/);
  assert.match(route, /console\.error\("campanha_operacao_falhou", \{\s*operacao,\s*codigo:/);
  assert.doesNotMatch(route, /Response\.json\(\{ error: [^}\n]*\.message/);
  assert.doesNotMatch(route, /console\.(?:error|warn|log)\([^\n]*(?:telefone|leadIds|payload|body|rows)/i);
});

test("todas as leituras obrigatórias falham fechadas", () => {
  for (const operacao of [
    "carregar_campanhas", "validar_etapas", "validar_leads_da_etapa",
    "carregar_leads", "carregar_instancias_dos_corretores",
    "validar_instancias_ativas", "validar_instancias_informadas",
    "carregar_corretor_autor", "carregar_donos_das_instancias",
    "carregar_nomes_dos_corretores", "carregar_abordagens",
  ]) assert.match(route, new RegExp(`falhaCampanha\\([^\\n]+, "${operacao}"\\)`));
});

test("leitura e envio exigem permissões efetivas no servidor", () => {
  assert.match(route, /resolveEffectiveAccess\(auth\.supabase, auth\.user\.id\)/);
  assert.match(route, /denyIfCannot\(access, \[\["disparos", "ver"\]\]\)/);
  assert.match(route, /denyIfCannot\(access, \[\["disparos", "enviar"\]\]\)/);
  assert.match(route, /validar_permissao_leitura/);
  assert.match(route, /validar_permissao_envio/);
});

test("cadência visível atravessa o contrato e não usa Date.parse do servidor", () => {
  assert.match(route, /planejarSlotsCampanha\(\{ start, endTime, periodDays, days, rate, instanceCount, recipientCount: valid\.length, tailMs: variantTailMs \}\)/);
  assert.doesNotMatch(route, /Date\.parse\(body\.start\)/);
  assert.match(ui, /endTime, periodDays: Number\(period\), days/);
  assert.match(ui, /O servidor respondeu sem confirmar a quantidade agendada/);
});

test("janela inclui todos os passos e lote tem limite seguro", () => {
  assert.match(route, /const variantTailMs = Math\.max/);
  assert.match(route, /rows\.length > MAX_CAMPAIGN_ROWS/);
  assert.match(route, /limite seguro de 5\.000 mensagens/);
});

test("IDs repetidos e abordagem alterada não geram lote parcial silencioso", () => {
  assert.match(route, /\[\.\.\.new Set\(body\.leadIds\.map\(Number\)/);
  assert.match(route, /\(aps \?\? \[\]\)\.length !== approachIds\.length/);
  assert.match(route, /erro: "configuracao_alterada"/);
});

test("agendamento só confirma a quantidade de linhas realmente gravada", () => {
  assert.match(route, /\.insert\(rows\)\.select\("id"\)/);
  assert.match(route, /inserted\?\.length !== rows\.length/);
  assert.match(route, /erro: "reconciliacao_necessaria"/);
  assert.match(route, /scheduled: inserted\.length/);
});

test("a interface preserva sucesso confirmado quando apenas a recarga falha", () => {
  assert.match(ui, /try \{\s*await load\(true\);\s*setNotice\(successMessage\)/);
  assert.match(ui, /As mensagens foram agendadas, mas o painel não pôde ser atualizado\. Recarregue antes de repetir\./);
  assert.match(ui, /finally \{ setBusy\(false\); \}/);
  assert.match(ui, /Não foi possível carregar os disparos/);
  assert.match(ui, /if \(!\[body\.leads, body\.deals, body\.stages, body\.approaches, body\.products, body\.recent, body\.instances, body\.brokers, body\.instanceLinks\]\.every\(Array\.isArray\)\) throw new Error\("payload_invalido"\)/);
});

test("harness visual usa a tela real, dados sanitizados e bloqueia mutações", () => {
  assert.match(harness, /CampaignWorkspace/);
  assert.match(harness, /campaignsHarness = "sanitizado"/);
  assert.match(harness, /method !== "GET"/);
  assert.match(harness, /Harness visual: mutação bloqueada/);
  assert.doesNotMatch(harness, /@gmail\.|@hotmail\.|\+55 1[1-9]/);
  assert.match(css, /@media\(max-width:650px\)[\s\S]*?\.campaign-workspace \.campaign-card select[^}]*min-height:44px/);
  assert.match(css, /\.campaign-workspace \.message-card>header button[^}]*min-height:44px/);
});
