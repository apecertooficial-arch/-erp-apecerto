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
  assert.match(html, /Carregando seu ERP/);
  assert.match(html, />CRM</);
  assert.match(html, />Produtos</);
  assert.doesNotMatch(html, /Cadastrar produto/);
  assert.doesNotMatch(html, /Botanic Cyrela/);
  assert.doesNotMatch(html, /Captação rápida/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("preserva o HTML final original na rota de referência", async () => {
  const response = await render("/original");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /ERP ApêCerto — HTML final original/i);
  assert.match(html, /\/legacy\/CRM_ApeCerto_FINAL\.html/);
});

test("mantém Performance e Financeiro ligados aos dados reais por perfil", async () => {
  const runtime = await readFile(new URL("../public/legacy-runtime.html", import.meta.url), "utf8");
  assert.match(runtime, /_samePerson\(v\.corretor, meuNomeFin\)/);
  assert.match(runtime, /lastPayload\.screen === 'performance'/);
  assert.match(runtime, /app\._loadVendasReal\(\); app\._loadCaixaReal\(\)/);
  assert.match(runtime, /\/recebimentos\?select=id,venda_id,numero_parcela/);
  assert.match(runtime, /\/comissoes\?select=id,venda_id,beneficiario_id,papel,valor_final/);
  assert.match(runtime, /\/venda_corretores\?select=venda_id,corretor_id,corretor_nome,fracao,eh_indicador/);
  assert.match(runtime, /\/pagamentos_comissao\?select=id,venda_id,comissao_id,beneficiario_id,papel,valor/);
  assert.match(runtime, /String\(x\.beneficiario_id\|\|''\)===String\(meuUserId\)/);
  assert.match(runtime, /v\._minhaComissao=minha/);
  assert.match(runtime, /const ratio = d\._liquidada \? 1/);
  assert.match(runtime, /d\.recebimentos=total>0\?\[/);
  assert.match(runtime, /Minha comissão/);
  assert.match(runtime, /Pago em/);
  assert.match(runtime, /Valor e calendário de recebimento ainda não cadastrados/);
  assert.match(runtime, /vendaTab:'recebimentos'/);
  assert.match(runtime, /Visão geral.*label: 'Vendas'.*label: 'Indicações'/s);
  assert.match(runtime, /Minhas indicações/);
  assert.match(runtime, /VGV indicado/);
  assert.match(runtime, /isCorrIndicacoes/);
  assert.match(runtime, /Pagamentos de comissão e indicação/);
  assert.match(runtime, /Somente administradores podem editar pagamentos/);
  assert.match(runtime, /Editar venda e parcelas/);
  assert.match(runtime, /Somente administradores podem editar os dados financeiros da venda/);
  assert.match(runtime, /data-sale-field="data_venda"/);
  assert.match(runtime, /data-sale-field="vgv"/);
  assert.match(runtime, /data-rec-field="valor_total"/);
  assert.match(runtime, /data-rec-field="data_recebimento"/);
  assert.match(runtime, /Confirma a atualização desta venda/);
  assert.match(runtime, /String\(\(st\.sessionPerfil\|\|''\)\)\.toLowerCase\(\)==='admin'/);
  assert.match(runtime, /d\._meuPagoReal != null/);
});

test("troca a faixa vermelha por aviso breve e central persistente no sino", async () => {
  const runtime = await readFile(new URL("../public/legacy-runtime.html", import.meta.url), "utf8");
  assert.match(runtime, /position:fixed;right:22px;bottom:92px/);
  assert.match(runtime, /Novo atendimento pendente/);
  assert.match(runtime, /_slaUltimoAvisado/);
  assert.match(runtime, /setTimeout\(function\(\)\{try\{b\.remove\(\)/);
  assert.doesNotMatch(runtime, /position:fixed;top:16px;right:18px/);
  assert.doesNotMatch(runtime, /_beepTimer=setInterval/);
  assert.doesNotMatch(runtime, /position:fixed;top:0;left:0;right:0;z-index:99999/);
});

test("mostra VGV no destaque e ranking nominal do time", async () => {
  const runtime = await readFile(new URL("../public/legacy-runtime.html", import.meta.url), "utf8");
  assert.match(runtime, /VGV no período/);
  assert.match(runtime, /Falta para a meta/);
  assert.match(runtime, /ranking_vgv_corretores/);
  assert.match(runtime, /nome:me\?'Você · '\+r\.nome:r\.nome/);
  assert.doesNotMatch(runtime, /vendas:me\?.*confidencial/);
});

test("mantém o Início enxuto, priorizado e com cards mais vivos", async () => {
  const home = await readFile(new URL("../app/features/home/HomeWorkspace.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(home, /slice\(0, 10\)/);
  assert.match(home, /Top 10 por volume/);
  assert.match(home, /Pendências prioritárias/);
  assert.match(home, /product-rank tone-/);
  assert.doesNotMatch(home, /VGV por mês/);
  assert.doesNotMatch(home, /Leads por origem/);
  assert.doesNotMatch(home, /Atalhos operacionais/);
  assert.match(css, /Paleta viva compartilhada/);
  assert.match(css, /background:#ffe0c7/);
  assert.match(css, /background:#ead2fa/);
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

test("aplica o CRM aprovado e mantém as duas formas decorativas nos indicadores", async () => {
  const crm = await readFile(new URL("../app/features/crm/CrmWorkspace.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(crm, /CRM · Funil de vendas/);
  assert.match(crm, /CRM · Leads/);
  assert.match(crm, /CRM · Vendas em processo/);
  assert.match(crm, /CRM · Analítico de funil/);
  assert.match(crm, /CRM · Agenda/);
  assert.match(crm, /CRM · Atividades/);
  assert.match(crm, /card-broker-inline-v3/);
  assert.match(crm, /<th>Atualização<\/th>/);
  assert.match(crm, /<span>Conversão geral<\/span>/);
  assert.doesNotMatch(crm, /<section className="crm-metrics">/);
  assert.match(css, /CRM — composição final baseada nas telas aprovadas do Claude Designer/);
  assert.match(css, /\.crm-v2\{\s*zoom:1/);
  assert.match(css, /\.finance-kpis article::after,\.analytics-kpis article::after,\.home-kpis article::after\{width:58px/);
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
