import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { podeVer, rotasModulo } from "../app/features/system/erp-routes.ts";

const workspace = readFileSync(new URL("../app/features/inteligencia/CentralComandoWorkspace.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/central-comando/route.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/styles/central-comando.css", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260822145143_central_comando_dados_reais.sql", import.meta.url), "utf8");

test("Central de Comando tem rota própria e fica restrita à gestão", () => {
  assert.equal(rotasModulo["Central de Comando"].path, "/inteligencia");
  assert.equal(podeVer("Central de Comando", { role: "admin", permissoes: null, carregado: true }), true);
  assert.equal(podeVer("Central de Comando", { role: "gestor", permissoes: { dashboard: ["ver"] }, carregado: true }), true);
  assert.equal(podeVer("Central de Comando", { role: "corretor", permissoes: { dashboard: ["ver"] }, carregado: true }), false);
});

test("painel usa fontes reais e não tem fallback de números mockados", () => {
  assert.match(api, /central_comando_dashboard_v2/);
  assert.match(api, /tracking_360_dashboard/);
  assert.match(api, /marketing-ads-read/);
  assert.match(api, /lerGa4/);
  assert.doesNotMatch(workspace, /mock|fixture|fakeData|Math\.random/i);
  assert.match(workspace, /Nenhum número fictício será exibido/);
});

test("coorte executiva não confunde importação histórica com lead novo", () => {
  const correction = readFileSync(new URL("../supabase/migrations/20260822152410_central_comando_funil_sem_legado.sql", import.meta.url), "utf8");
  assert.match(correction, /momento_codigo <> 'LEAD_LEGADO'/);
  assert.match(correction, /Lead novo = card que entrou no Funil 2/);
  assert.match(workspace, /Sem base no período anterior/);
  assert.match(workspace, /as contas ainda não autorizaram a leitura/);
  assert.match(workspace, /Quando a leitura não está autorizada, o painel não apresenta zero/);
  assert.match(workspace, /document\.body\.appendChild\(link\)/);
  assert.match(workspace, /Exportação preparada:/);
  assert.doesNotMatch(workspace, /Math\.max\(1, flow\[index - 1\]\.value\)/);
});

test("visão do sócio mantém no máximo seis indicadores principais", () => {
  const partnerBlock = workspace.split('<div className="cc-kpis partner">')[1].split('</div>\n      <div className="cc-grid partner-grid">')[0];
  assert.equal((partnerBlock.match(/<Kpi /g) ?? []).length, 6);
  for (const label of ["Vendas", "Valor vendido", "Comissão", "Investimento em mídia", "Pessoas interessadas", "Visitas realizadas"]) {
    assert.match(partnerBlock, new RegExp(`label="${label}"`));
  }
  assert.match(workspace, /Ver detalhes da operação/);
});

test("hierarquia de cores usa o laranja e roxo oficiais", () => {
  assert.match(css, /--cc-orange:#ff7000/);
  assert.match(css, /--cc-orange-hover:#e66200/);
  assert.match(css, /--cc-orange-text:#cc5800/);
  assert.match(css, /--cc-purple:#8b00cc/);
  assert.match(css, /--cc-purple-dark:#66009a/);
});

test("atividade começa na implantação e não fabrica histórico", () => {
  assert.match(migration, /nenhum tempo anterior é inventado/i);
  assert.match(migration, /least\(65,/);
  assert.match(migration, /Intervalos suspensos não entram/);
  assert.match(workspace, /Não existe reconstrução retroativa/);
});

test("segurança consolida números sem expor PII", () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /central_gestao_autorizada/);
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(api, /telefone|email|wa_mensagens|mensagem_texto/i);
  const revokeLegacy = readFileSync(new URL("../supabase/migrations/20260822154702_central_comando_revoga_rpc_legada.sql", import.meta.url), "utf8");
  assert.match(revokeLegacy, /revoke execute on function public\.central_comando_dashboard\(integer\)[\s\S]*from authenticated/);
});
