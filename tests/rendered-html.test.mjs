import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renderiza o shell protegido do ERP como aplicação principal", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Abrindo o ERP…/);
  // Sem sessão, a resposta inicial não antecipa menus nem dados protegidos.
  assert.doesNotMatch(html, /Dados reais · sessão protegida/);
  assert.doesNotMatch(html, /Cadastrar produto/);
  assert.doesNotMatch(html, /Botanic Cyrela/);
  assert.doesNotMatch(html, /Captação rápida/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("mantém o Início gerencial enxuto e ligado aos painéis canônicos", async () => {
  const home = await readFile(new URL("../app/features/home/HomeWorkspace.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(home, /<NaMesaCards/);
  assert.match(home, /<RodagemCards/);
  assert.match(home, /<FunilCards/);
  assert.match(home, /<FinanceiroCards/);
  assert.match(home, /hv2-hero/);
  assert.match(home, /Produtos mais vendidos/);
  assert.doesNotMatch(home, /VGV por mês/);
  assert.doesNotMatch(home, /Leads por origem/);
  assert.doesNotMatch(home, /Atalhos operacionais/);
  assert.match(css, /\.hv2-hero/);
  assert.match(css, /--ape-orange/);
});

test("aplica a composição aprovada do Claude Designer na visão geral financeira", async () => {
  const finance = await readFile(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(finance, /finance-vgv-hero/);
  assert.match(finance, /finance-summary-strip/);
  assert.match(finance, /finance-ranking-designer/);
  assert.match(finance, />Corretor</);
  assert.match(finance, />Equipe</);
  assert.match(finance, />Empreendimento</);
  assert.match(finance, /range:\$\{start\},\$\{end\}/);
  assert.doesNotMatch(finance, /className="finance-panel evolution"/);
  assert.doesNotMatch(finance, /className="finance-panel recent-sales"/);
  assert.doesNotMatch(finance, /className="finance-panel due-list"/);
  assert.match(css, /Financeiro — composição fiel ao painel aprovado no Claude Designer/);
  assert.match(css, /grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
});

test("aplica a referência aprovada em Vendas & comissões", async () => {
  const finance = await readFile(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(finance, /finance-sales-designer/);
  assert.match(finance, /Lançar nova venda/);
  assert.match(finance, /finance-sales-month/);
  assert.match(finance, /Com\. receb\./);
  assert.match(finance, /Todos os status/);
  assert.match(api, /id,nome,origem,criado_em,corretor_id/);
  assert.match(css, /\.sales-kpis article::before,\.finance-kpis article::before.*display:block!important/);
  assert.match(css, /nth-of-type\(4n\+1\)>b \{ background:var\(--orange\)!important; \}/);
});

test("a Esteira preserva fotos, tags e identidade dos cards", async () => {
  const crm = await readFile(new URL("../app/features/sales/SalesProcessWorkspace.tsx", import.meta.url), "utf8");
  const salesApi = await readFile(new URL("../app/api/crm/sales/route.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(crm, /function LeadAvatar/);
  assert.match(crm, /tagList\(lead\?\.tags\)\.slice\(0, 2\)/);
  assert.match(crm, /className="sale-card-content"/);
  assert.match(salesApi, /id,nome,telefone,email,corretor_id,tags,extras/);
  assert.match(css, /\.crm-leads-table-v3 tbody tr\.lead-tone-1\{border-left-color:#ff6500!important\}/);
  assert.match(css, /Vendas em processo: o mesmo desenho dos cards de lead do funil/);
});

test("padroniza indicações, fluxo de caixa e a hierarquia tipográfica financeira", async () => {
  const finance = await readFile(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(finance, /finance-indications-designer/);
  assert.match(finance, /finance-cash-toolbar/);
  assert.match(finance, /finance-indication-row/);
  assert.match(finance, /finance-cash-row/);
  assert.match(finance, /finance-receipt-row/);
  assert.match(finance, /Buscar indicações/);
  assert.match(finance, /Buscar no fluxo de caixa/);
  assert.match(css, /--finance-body:12px/);
  assert.match(css, /\.finance-sales-month>header strong \{ font-size:var\(--finance-sm\)/);
  assert.match(css, /\.finance-sale-row \{ min-height:49px; font-size:var\(--finance-body\)/);
});

test("pagina o caixa e estende a identidade financeira aos módulos restantes", async () => {
  const finance = await readFile(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(finance, /const pageSize = 15/);
  assert.match(finance, /visibleMovementRows = movementRows\.slice/);
  assert.match(finance, /aria-label="Próxima página"/);
  assert.match(finance, /finance-marketing-designer/);
  assert.match(finance, /finance-earnings-designer/);
  assert.match(finance, /finance-goals-designer/);
  assert.match(finance, /<\/select><\/div><\/header><nav>/);
  assert.doesNotMatch(finance, /<\/select>\{sessionRole !== "corretor" && <button type="button" onClick=\{\(\) => setCashOpen\(true\)\}>＋ Nova movimentação/);
  assert.match(css, /Marketing, Meus ganhos e Metas — mesma identidade/);
  assert.match(css, /\.finance-module-kpis \{ display:grid/);
  assert.match(css, /\.finance-workspace \.finance-sales-footer \{ padding-right:92px/);
  assert.match(css, /\.finance-marketing-head,\.finance-marketing-row/);
  assert.match(css, /\.finance-earnings-head,\.finance-earnings-row/);
  assert.match(css, /\.finance-goals-designer \{ grid-template-columns/);
});
