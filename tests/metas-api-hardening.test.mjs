import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rota = readFileSync(new URL("../app/api/metas/route.ts", import.meta.url), "utf8");
const tela = readFileSync(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
const harness = readFileSync(new URL("./finance-visual-harness/main.tsx", import.meta.url), "utf8");
const estilos = readFileSync(new URL("../app/styles/redesign-apecerto-financeiro-abas.css", import.meta.url), "utf8");

test("metas não expõe mensagem SQL nem payload em resposta ou log", () => {
  assert.doesNotMatch(rota, /Response\.json\(\{ error: error\.message/);
  assert.doesNotMatch(rota, /console\.error\([^\n]*(message|body|metaVgv|metaVendas)/);
  assert.match(rota, /erro: semPermissao \? "sem_permissao" : "falha_banco"/);
});

test("falha ao ler o papel não é disfarçada de acesso negado", () => {
  assert.match(rota, /data: me, error: meError/);
  assert.match(rota, /if \(meError\) return falhaMetas\(meError, "autorizar_alteracao"\)/);
  assert.match(rota, /papelNoGrupo\(me\.role, "metas"\)/);
});

test("erro ao procurar meta interrompe antes de decidir update ou insert", () => {
  const leitura = rota.indexOf("existingError");
  const decisao = rota.indexOf("if (existing)");
  assert.ok(leitura >= 0 && leitura < decisao);
  assert.match(rota, /if \(existingError\) return falhaMetas/);
});

test("período, valores e corretor são validados sem coerção silenciosa", () => {
  assert.match(rota, /periodoTipo === "mensal"[\s\S]*periodo <= 12/);
  assert.match(rota, /periodoTipo === "semestral"[\s\S]*periodo <= 2/);
  assert.match(rota, /periodoTipo === "anual" && periodo === 0/);
  assert.match(rota, /!Number\.isFinite\(metaVgv\) \|\| metaVgv < 0/);
  assert.match(rota, /!Number\.isInteger\(metaVendas\) \|\| metaVendas < 0/);
  assert.match(rota, /metaVgvVazio \|\| metaVendasVazio/);
  assert.match(rota, /corretorId <= 0/);
  assert.doesNotMatch(rota, /Number\(body\.metaVgv\) \|\| 0/);
});

test("update, insert e delete só confirmam sucesso com linha retornada", () => {
  assert.equal((rota.match(/\.select\("id"\)\.maybeSingle\(\)/g) ?? []).length, 3);
  assert.match(rota, /if \(!updated\)[\s\S]*meta_conflito/);
  assert.match(rota, /if \(!created\) return falhaMetas/);
  assert.match(rota, /if \(!deleted\)[\s\S]*meta_nao_encontrada/);
});

test("interface não transforma falha em lista vazia nem confirma remoção rejeitada", () => {
  assert.match(tela, /if \(!response\.ok\) throw new Error\(payload\.error \|\| "Não foi possível carregar as metas\."\)/);
  assert.match(tela, /if \(!response\.ok\) throw new Error\(payload\.error \|\| "Não foi possível apagar a meta\."\)/);
  assert.match(tela, /metaVgv: form\.metaVgv, metaVendas: form\.metaVendas/);
  assert.match(tela, /A lista não pôde ser atualizada; recarregue a tela antes de repetir/);
  assert.match(tela, /metasStatus === "error" \? "Indisponível"/);
  assert.match(tela, /role="alert"[\s\S]*Tentar novamente/);
});

test("harness visual exercita a falha de Metas sem liberar mutações", () => {
  assert.match(harness, /"metaserror"/);
  assert.match(harness, /url\.pathname === "\/api\/metas"/);
  assert.match(harness, /estado === "metaserror"[\s\S]*sessionRole="admin"/);
  assert.match(harness, /method !== "GET" \|\| url\.origin !== window\.location\.origin/);
  assert.match(estilos, /\.finance-goal-panel \.finance-error-state/);
  assert.match(estilos, /\.finance-error-state button[^{]*\{[^}]*min-height:44px/);
});
