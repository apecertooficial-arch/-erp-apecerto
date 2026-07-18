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
