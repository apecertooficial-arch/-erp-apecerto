import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/campaigns/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/campaigns/CampaignWorkspace.tsx", import.meta.url), "utf8");

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
});
