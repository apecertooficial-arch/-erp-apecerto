import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { podeVer, rotasModulo } from "../app/features/system/erp-routes.ts";

const wrapper = readFileSync(new URL("../app/features/inteligencia/CentralComandoWorkspace.tsx", import.meta.url), "utf8");
const prototype = readFileSync(new URL("../public/central-comando/prototype.html", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/central-comando/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260822145143_central_comando_dados_reais.sql", import.meta.url), "utf8");
const teamExecutionMigration = readFileSync(new URL("../supabase/migrations/20260824190000_central_equipe_execucao_real.sql", import.meta.url), "utf8");

test("Central de Comando é uma rota interna e fica restrita à gestão", () => {
  assert.equal(rotasModulo["Central de Comando"].path, "/inteligencia");
  assert.equal(podeVer("Central de Comando", { role: "admin", permissoes: null, carregado: true }), true);
  assert.equal(podeVer("Central de Comando", { role: "gestor", permissoes: { dashboard: ["ver"] }, carregado: true }), true);
  assert.equal(podeVer("Central de Comando", { role: "corretor", permissoes: { dashboard: ["ver"] }, carregado: true }), false);
  assert.match(wrapper, /src="\/central-comando\/prototype\.html\?v=20260828-1"/);
  assert.doesNotMatch(wrapper, /target=|window\.open/);
});

test("a fonte integral do Claude Design está embarcada", () => {
  for (const page of ["Visão CEO", "Marketing", "CRM e funil", "Equipe e corretores", "Site e imóveis", "Financeiro", "Meu dia"]) assert.match(prototype, new RegExp(page));
  assert.doesNotMatch(prototype, /<span class="cc-navlabel">Tracking<\/span>/);
  for (const marker of ["ape-nav", "ape-kpi", "cc-card", "ape-table", "ape-tabs", "cc-kpigrid", "serieLinha", "diaTarefas"]) assert.match(prototype, new RegExp(marker));
  assert.match(prototype, /\.ape-kpi:hover\{box-shadow:var\(--shadow-sm\);transform:translateY\(-2px\)\}/);
  assert.match(prototype, /Canal → campanha → conjunto → anúncio/);
  assert.match(prototype, /Criativo dinâmico/);
});

test("o ERP autoriza o painel sem expor token em URL ou armazenamento", () => {
  assert.match(wrapper, /postMessage/);
  assert.match(wrapper, /window\.location\.origin/);
  assert.match(prototype, /apecerto:central:ready/);
  assert.match(prototype, /apecerto:central:auth/);
  assert.match(prototype, /Authorization: 'Bearer ' \+ accessToken/);
  assert.doesNotMatch(wrapper, /localStorage|sessionStorage|document\.cookie|searchParams/);
});

test("dados reais substituem todas as áreas operacionais", () => {
  assert.match(api, /central_comando_dashboard_v2/);
  assert.match(api, /central_comando_site_marketing/);
  assert.match(api, /central_comando_atribuicao_marketing/);
  assert.match(api, /central_comando_qualidade_dados/);
  assert.doesNotMatch(api, /tracking_360_/);
  assert.match(api, /marketing-ads-read/);
  assert.match(api, /lerGa4/);
  for (const key of ["diaKpis", "crmKpis", "siteKpis", "finKpis", "mktKpis", "tronco", "trilhas", "trkGrupos", "socioKpis"]) assert.match(prototype, new RegExp(`${key}: realView\\.${key}`));
  assert.match(prototype, /corretor: corretorReal/);
  assert.match(prototype, /Indisponível/);
  assert.match(prototype, /Nenhum zero estimado é apresentado como dado real/);
  assert.match(prototype, /Conversas individuais não são exibidas sem uma fonte real autorizada/);
  assert.match(api, /sources:/);
  assert.match(prototype, /st\.realData \? \[\] : OPORTUNIDADES/);
  assert.match(prototype, /const VAR_FLUXO = st\.realData \? \[\]/);
  assert.match(prototype, /iaCriterios: realView\.iaCriterios/);
  assert.match(prototype, /iaFalhas: realView\.iaFalhas/);
  assert.match(prototype, /elementos: st\.realData \? \[\]/);
  assert.doesNotMatch(prototype, /row\.leads_validos \|\| row\.leads_crm \|\| row\.leads_plataforma/);
});

test("atualização, período, alertas e CSV usam operações reais", () => {
  assert.match(prototype, /diasDoPeriodo\(rotulo\)/);
  assert.match(prototype, /carregarDadosReais\(this\._centralToken, true, F\.periodo\)/);
  assert.doesNotMatch(prototype, /setTimeout\(\(\) => this\.setState\(\{ atualizando: false/);
  assert.match(prototype, /salvarAcaoAlerta/);
  assert.match(prototype, /method: 'POST'/);
  assert.match(prototype, /baixarCsvMarketing/);
  assert.match(prototype, /CSV exportado/);
});

test("Meta e Google preservam a hierarquia e não quebram quando desconectados", () => {
  assert.match(prototype, /montarArvoreRealDeMidia/);
  assert.match(prototype, /media\.meta && media\.meta\.anuncios/);
  assert.match(prototype, /media\.google && media\.google\.anuncios/);
  assert.match(prototype, /Nenhum anúncio disponível/);
  assert.match(prototype, /Meta Ads e Google Ads ainda não forneceram investimento/);
  assert.match(prototype, /const adNode = achaNo\(st\.adSel\) \|\| achaNo\('ad1'\) \|\|/);
});

test("coorte executiva não confunde importação histórica com lead novo", () => {
  const correction = readFileSync(new URL("../supabase/migrations/20260822152410_central_comando_funil_sem_legado.sql", import.meta.url), "utf8");
  assert.match(correction, /momento_codigo <> 'LEAD_LEGADO'/);
  assert.match(correction, /Lead novo = card que entrou no Funil 2/);
  assert.match(prototype, /coorte nova, sem carga histórica/);
});

test("laranja oficial e interações do design aprovado permanecem intactos", () => {
  assert.match(prototype, /--chart-1:var\(--ape-orange\)/);
  assert.match(prototype, /--cc-atencao:color-mix\(in srgb,#CC5800 74%,var\(--neutral-900\)\)/);
  assert.match(prototype, /var\(--ape-orange\)/);
  assert.match(prototype, /var\(--ape-purple\)/);
  assert.match(prototype, /transform:translateY\(-2px\)/);
});

test("segurança consolida números sem expor PII", () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /central_gestao_autorizada/);
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(api, /telefone|email|wa_mensagens|mensagem_texto/i);
  const revokeLegacy = readFileSync(new URL("../supabase/migrations/20260822154702_central_comando_revoga_rpc_legada.sql", import.meta.url), "utf8");
  assert.match(revokeLegacy, /revoke execute on function public\.central_comando_dashboard\(integer\)[\s\S]*from authenticated/);
});

test("execução da equipe usa leads distintos e nunca eventos como percentual", () => {
  assert.match(api, /central_comando_equipe_execucao/);
  assert.match(teamExecutionMigration, /count\(distinct ca\.lead_id\)/);
  assert.match(teamExecutionMigration, /pct_carteira_trabalhada/);
  assert.match(teamExecutionMigration, /percentile_cont\(0\.9\)/);
  assert.match(teamExecutionMigration, /p\.valor <= 15/);
  assert.doesNotMatch(prototype, /n\(row\.movimentacoes\) \/ n\(row\.leads_recebidos\)/);
  assert.match(prototype, /row\.pct_carteira_trabalhada/);
});
