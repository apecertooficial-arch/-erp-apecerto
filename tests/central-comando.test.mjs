import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { podeVer, rotasModulo } from "../app/features/system/erp-routes.ts";

const workspace = readFileSync(new URL("../app/features/inteligencia/CentralComandoPrototypeWorkspace.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/central-comando/route.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/styles/central-comando-prototype.css", import.meta.url), "utf8");
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
  assert.match(workspace, /Indisponível/);
  assert.match(workspace, /Sem base/);
});

test("coorte executiva não confunde importação histórica com lead novo", () => {
  const correction = readFileSync(new URL("../supabase/migrations/20260822152410_central_comando_funil_sem_legado.sql", import.meta.url), "utf8");
  assert.match(correction, /momento_codigo <> 'LEAD_LEGADO'/);
  assert.match(correction, /Lead novo = card que entrou no Funil 2/);
  assert.match(workspace, /Sem base anterior/);
  assert.match(workspace, /leitura não autorizada/);
  assert.match(workspace, /O painel não apresenta zero quando a fonte não pode ser lida/);
  assert.doesNotMatch(workspace, /Math\.max\(1, flow\[index - 1\]\.value\)/);
});

test("visão do sócio mantém no máximo seis indicadores principais", () => {
  const partnerBlock = workspace.split('<div className="cc-kpigrid partner-kpis">')[1].split('<div className="cc-partner-funnel">')[0];
  assert.equal((partnerBlock.match(/<Kpi /g) ?? []).length, 6);
  for (const label of ["Vendas fechadas", "Valor vendido", "Comissão recebida", "Investimento em anúncios", "Pessoas interessadas", "Visitas realizadas"]) {
    assert.match(partnerBlock, new RegExp(`label="${label}"`));
  }
  assert.match(workspace, /Ver detalhes da operação/);
});

test("hierarquia de cores usa o laranja e roxo oficiais", () => {
  assert.match(css, /--cc-atencao:color-mix\(in srgb,#CC5800 74%,var\(--neutral-900\)\)/);
  assert.match(css, /--cc-laranja-texto:color-mix\(in srgb,#CC5800 86%,var\(--neutral-900\)\)/);
  assert.match(css, /var\(--ape-orange\)/);
  assert.match(css, /var\(--ape-purple\)/);
});

test("indicadores preservam o componente e os estados cromáticos do protótipo", () => {
  assert.match(workspace, /className=\{`ape-kpi\$\{tone === "plain"/);
  for (const tone of ["orange", "purple", "success", "danger"]) {
    assert.match(css, new RegExp(`\\.ape-kpi--${tone}`));
  }
});

test("estrutura publicada preserva a arquitetura visual do Claude Design", () => {
  for (const marker of ["cc-prototype", "ape-nav", "ape-kpi", "cc-card", "ape-table", "ape-tabs"]) {
    assert.match(workspace, new RegExp(marker));
  }
  assert.match(workspace, /Comparação <strong>Período anterior<\/strong>/);
  assert.match(workspace, /Canal <strong>todos<\/strong>/);
  assert.match(workspace, /Equipe ou corretor <strong>todos<\/strong>/);
  assert.match(workspace, /FUNIL COMERCIAL/);
  assert.match(workspace, /ONDE AGIR AGORA/);
  for (const profile of ["CEO \/ admin", "Sócio", "Gestor de tráfego", "Gestor comercial"]) assert.match(workspace, new RegExp(profile));
  assert.match(css, /\.cc-prototype \*\{box-sizing:content-box\}/);
  assert.match(css, /\.cc-prototype button,\.cc-prototype select\{box-sizing:border-box\}/);
  assert.match(css, /\.cc-prototype>\.ape-nav\{width:240px;min-width:240px\}/);
  assert.match(css, /\.cc-prototype-header\{[^}]*gap:12px[^}]*padding:14px 24px 0/);
  assert.match(css, /\.cc-prototype \.ape-kpi\{[^}]*padding:12px 16px[^}]*gap:4px/);
  assert.match(css, /\.cc-prototype \.ape-section-title\{font-size:16px/);
  assert.match(css, /\.cc-prototype-main>div\{display:grid;gap:16px\}/);
  assert.doesNotMatch(workspace, /<main className="cc-prototype-main cc-scroll"><div>\{content\[page\]\}<\/div><\/main>/);
  assert.match(css, /\.app-shell:has\(\.cc-prototype\)\{grid-template-columns:minmax\(0,1fr\)!important\}/);
  assert.match(css, /\.cc-prototype-header/);
  assert.match(css, /\.cc-prototype-main/);
  assert.match(css, /\.cc-flow-row/);
});

test("Marketing mantém a densidade e hierarquia da tela aprovada", () => {
  for (const label of ["Investimento", "CPL válido", "Custo/qualificado", "Custo/visita", "CAC", "ROAS de comissão"]) {
    assert.match(workspace, new RegExp(`label="${label.replace("/", "\\/")}"`));
  }
  assert.match(workspace, /Canal → campanha → conjunto → anúncio/);
  assert.match(workspace, /Performance de mídia/);
  assert.match(workspace, /Resultado do negócio/);
  assert.match(workspace, /"13\/13" : "10\/10"/);
  assert.match(workspace, /Comparar: período anterior/);
  assert.match(workspace, /_level: "conjunto"/);
  const marketingBlock = workspace.split('const pageMarketing =')[1].split('const pageTracking =')[0];
  for (const heading of ["Nível", "Investimento", "Impressões", "Alcance", "Freq.", "CPM", "Cliques link", "CTR link", "CPC link", "LPV", "Leads plataforma", "Leads CRM", "Leads válidos", "CPL"]) {
    assert.match(marketingBlock, new RegExp(`<th>${heading.replace(".", "\\.")}</th>`));
  }
  assert.ok((marketingBlock.match(/<th>/g) ?? []).length >= 24);
});

test("atividade começa na implantação e não fabrica histórico", () => {
  assert.match(migration, /nenhum tempo anterior é inventado/i);
  assert.match(migration, /least\(65,/);
  assert.match(migration, /Intervalos suspensos não entram/);
  assert.match(workspace, /Começando agora/);
  assert.match(workspace, /sem carga histórica importada/);
});

test("segurança consolida números sem expor PII", () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /central_gestao_autorizada/);
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(api, /telefone|email|wa_mensagens|mensagem_texto/i);
  const revokeLegacy = readFileSync(new URL("../supabase/migrations/20260822154702_central_comando_revoga_rpc_legada.sql", import.meta.url), "utf8");
  assert.match(revokeLegacy, /revoke execute on function public\.central_comando_dashboard\(integer\)[\s\S]*from authenticated/);
});
