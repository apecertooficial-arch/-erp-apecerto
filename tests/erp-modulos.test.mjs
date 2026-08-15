// Modulos do ERP no celular + revisoes obrigatorias de PWA/offline/logout.
// Verifica CODIGO e CSS. Nao mede layout renderizado.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const raizApp = new URL("../app/", import.meta.url).pathname;
const raizRepo = new URL("../", import.meta.url).pathname;
const css = readFileSync(join(raizApp, "styles/app-mobile.css"), "utf8");
const modulos = css.slice(css.indexOf("MODULOS DO ERP — CELULAR"));
const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const registro = readFileSync(join(raizApp, "components/RegistroPwa.tsx"), "utf8");

/* -------------------- Limpeza no logout: escopo do ApeCerto -------------------- */

test("limparDadosLocais apaga SOMENTE caches do ApeCerto", () => {
  assert.ok(/nomes\.filter\(cacheDoApp\)/.test(registro), "precisa filtrar os caches antes de apagar");
  assert.ok(!/nomes\.map\(\(n\) => caches\.delete\(n\)\)/.test(registro),
    "apagar caches.keys() inteiro atinge caches que nao sao deste app");
  assert.ok(/cacheDoApp = \(nome: string\) => nome\.includes\("apecerto"\)/.test(registro));
});

test("limparDadosLocais apaga SOMENTE chaves com prefixo conhecido", () => {
  // Nominais, nunca clear(). A lista saiu das chaves REAIS de producao: a
  // versao anterior deste teste exigia so ["apecerto-", "sb-"] e por isso
  // deixou passar apecerto_os_v1, ncrm_onboarding_v1_<uuid> e ncrm:variante:<uuid>.
  const linha = registro.match(/const PREFIXOS_APECERTO[^;]+;/)[0];
  for (const p of ["apecerto-", "apecerto_", "ncrm_", "ncrm:", "sb-"]) {
    assert.ok(linha.includes(`"${p}"`), `falta o prefixo ${p} na limpeza de logout`);
  }
  assert.ok(!/"theme"/.test(linha), "lista de prefixos nao e lista de excecoes");
  assert.ok(/pertenceAoApp\(chave, PREFIXOS_APECERTO\)/.test(registro));
  assert.ok(!/localStorage\.clear\(\)/.test(registro), "clear() apagaria armazenamento alheio");
  assert.ok(!/sessionStorage\.clear\(\)/.test(registro), "clear() apagaria armazenamento alheio");
});

test("os prefixos cobrem as chaves que o ERP realmente grava", () => {
  function arquivos(dir, acc = []) {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) arquivos(p, acc);
      else if (/\.(ts|tsx)$/.test(p)) acc.push(p);
    }
    return acc;
  }
  const gravadas = new Set();
  for (const f of arquivos(raizApp)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:local|session)Storage\.setItem\(\s*["'`]([^"'`]+)/g)) gravadas.add(m[1]);
  }
  const prefixos = ["apecerto-", "sb-"];
  for (const chave of gravadas) {
    assert.ok(prefixos.some((p) => chave.startsWith(p)),
      `chave "${chave}" nao seria limpa no logout — adicione o prefixo a PREFIXOS_APECERTO`);
  }
});

test("service worker tambem limita a limpeza aos caches do app", () => {
  assert.ok(/nomes\.filter\(\(n\) => n\.includes\("apecerto"\)\)/.test(sw));
});

/* -------------------- Service worker: cache e atualizacao -------------------- */

test("nada sensivel entra em cache", () => {
  for (const alvo of ["\\/api\\/", "supabase", "\\/auth\\/", "\\/rest\\/v1\\/", "\\/functions\\/v1\\/", "\\/realtime\\/"]) {
    assert.ok(sw.includes(alvo), `padrao privado ausente: ${alvo}`);
  }
  assert.ok(/if \(ehPrivado\(url\)\) return;/.test(sw), "rota privada precisa passar direto para a rede");
});

test("so metodo GET e interceptado (mutacao nunca vem do cache)", () => {
  assert.ok(/req\.method !== "GET"/.test(sw), "POST/PATCH/DELETE nao podem ser servidos do cache");
});

test("atualizacao e controlada pela pagina, nao automatica", () => {
  assert.ok(/ATUALIZAR_AGORA/.test(sw) && /skipWaiting/.test(sw));
  assert.ok(!/self\.skipWaiting\(\);\s*\}\)?\s*;?\s*self\.addEventListener\("install"/.test(sw),
    "skipWaiting nao pode rodar no install");
  assert.ok(/aguardando\.postMessage\("ATUALIZAR_AGORA"\)/.test(registro),
    "a troca precisa partir de um toque do usuario");
});

test("offline mostra pagina sem dado nenhum", () => {
  assert.ok(/req\.mode === "navigate"/.test(sw));
  assert.ok(/caches\.match\(OFFLINE\)/.test(sw));
  const offline = readFileSync(new URL("../public/offline.html", import.meta.url), "utf8");
  assert.ok(!/conclu[ií]d|salvo|enviad|sincronizad/i.test(offline),
    "tela offline nao pode afirmar que alguma acao foi concluida");
});

/* -------------------- Estrutura mobile dos modulos -------------------- */

test("Inicio mobile monta somente a tela operacional vigente", () => {
  const home = readFileSync(join(raizApp, "features/home/HomeWorkspace.tsx"), "utf8");
  const globals = readFileSync(join(raizApp, "globals.css"), "utf8");
  assert.match(home, /ehCelular === true[\s\S]*?<div className="home-mobile">[\s\S]*?<InicioApp/);
  assert.match(modulos, /\.home-mobile \{ display: block/);
  assert.doesNotMatch(modulos, /\.home-(?:workspace|header|kpis|goal|two-columns|three-columns|panel|atalhos)/);
  assert.doesNotMatch(globals, /\.home-(?:workspace|header|kpis|goal|two-columns|three-columns|panel|funnel-row|ranking-row|list-row|alert|charts?|chart-head|bars|legend|atalhos|avatar|status)\b/,
    "as camadas Home anteriores não podem voltar a competir com home-v2 e home-mobile");
});

test("Produtos: grid de uma coluna e filtros que cabem", () => {
  assert.match(modulos, /\.product-grid \{ grid-template-columns: 1fr/);
  assert.match(modulos, /\.filter-row select, \.filter-row input \{[^}]*min-width:\s*0/);
});

test("Tarefas: quadro horizontal vira lista vertical", () => {
  assert.match(modulos, /\.projeto-board, \.kanban-board \{ display: block/);
  assert.match(modulos, /\.projeto-coluna, \.kanban-col \{ width: 100%/);
});

test("tabelas largas rolam DENTRO do container, nao na pagina", () => {
  assert.match(modulos, /\.finance-table, \.team-table \{[\s\S]*?overflow-x: auto/);
});

test("nenhuma regra do bloco usa largura fixa que estoure 360px", () => {
  const larguras = [...modulos.matchAll(/(?<!max-|min-)width:\s*(\d+)px/g)].map((m) => Number(m[1]));
  for (const w of larguras) assert.ok(w <= 360, `largura fixa de ${w}px estoura a tela de 360px`);
});

test("DESKTOP INTACTO: o bloco inteiro esta sob max-width", () => {
  assert.ok(modulos.includes("@media (max-width: 900px)"));
  assert.ok(!/@media \(min-width/.test(modulos), "o bloco nao pode alterar telas grandes");
});

/* -------------------- Corte do runtime legado -------------------- */

test("Ajuda, Conhecimento e Financiamento não montam o runtime legado", () => {
  const paginas = ["ajuda", "conhecimento", "financiamento"].map((rota) =>
    readFileSync(join(raizApp, `(erp)/${rota}/page.tsx`), "utf8"),
  );
  for (const pagina of paginas) assert.doesNotMatch(pagina, /LegacyModuleWorkspace|legacy-runtime/);

  assert.match(paginas[1], /redirect\("\/agentes-ia"\)/);
  assert.match(paginas[2], /FinancingWorkspace/);
});

test("Financiamento lê fichas reais com o JWT e respeita RLS", () => {
  const api = readFileSync(join(raizApp, "api/financiamento/route.ts"), "utf8");
  assert.match(api, /createServerSupabaseClient\(token\)/);
  assert.match(api, /auth\.getUser\(token\)/);
  assert.match(api, /from\("financiamento_fichas"\)/);
  assert.doesNotMatch(api, /service.?role/i);
});

test("Configurações possui uma única camada: Conexões", () => {
  const settings = readFileSync(join(raizApp, "features/settings/SettingsWorkspace.tsx"), "utf8");
  const globals = readFileSync(join(raizApp, "globals.css"), "utf8");

  assert.match(settings, /return <ConnectionsWorkspace accessToken=\{accessToken\} \/>/);
  assert.doesNotMatch(globals, /\.settings-/,
    "CSS da antiga central de Configurações não pode voltar a sobrepor Conexões");
  assert.match(globals, /\.connections-workspace/,
    "a camada visual vigente de Conexões precisa permanecer disponível");
});

test("identidade visual não sobrescreve componentes operacionais do celular", () => {
  const identidade = readFileSync(join(raizApp, "styles/apecerto-identidade.css"), "utf8");
  for (const seletor of [".app-bottom-nav", ".f2m-agendar", ".f2m-agendar-ok", ".convite-instalar-ok"]) {
    assert.equal(identidade.includes(seletor), false, `${seletor} deve ter uma única dona em app-mobile.css`);
  }
  assert.match(css, /\.f2m-agendar-ok\s*\{[^}]*background:\s*var\(--f2m-green\)/,
    "a ação principal de agendar deve continuar verde no CSS que realmente vence");
});

test("Automações usa um único histórico de execução", () => {
  const mapa = readFileSync(join(raizApp, "features/system/module-map.ts"), "utf8");
  const tipos = readFileSync(join(raizApp, "lib/supabase/database.types.ts"), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20260815141000_remover_execucoes_automacao_legada.sql", import.meta.url), "utf8");

  assert.match(mapa, /"motor_execucoes"/);
  assert.doesNotMatch(mapa, /"automacao_execucoes"/);
  assert.doesNotMatch(tipos, /automacao_execucoes:/);
  assert.match(migration, /drop table public\.automacao_execucoes/);
});

test("migração assistida do CRM antigo foi removida como um conjunto fechado", () => {
  const tipos = readFileSync(join(raizApp, "lib/supabase/database.types.ts"), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20260815150000_remover_migracao_ncrm_concluida.sql", import.meta.url), "utf8");

  assert.doesNotMatch(tipos, /ncrm_migracao_(?:analise|item|aprovar|contexto|preview|registrar_analise|rollback)/);
  for (const objeto of ["ncrm_migracao_analise", "ncrm_migracao_item"]) {
    assert.match(migration, new RegExp(`DROP TABLE public\\.${objeto}`));
  }
  assert.match(migration, /v_new text := '''duplicidades_impedidas'', 0'/,
    "o painel de saúde deve sobreviver sem depender da migração aposentada");
});

test("construtor de Automações pertence à feature e não é injetado como global", () => {
  const workspace = readFileSync(join(raizApp, "features/automations/AutomationsWorkspace.tsx"), "utf8");
  const runtime = readFileSync(join(raizApp, "features/automations/automationBuilderRuntime.js"), "utf8");

  assert.match(workspace, /import\("\.\/automationBuilderRuntime\.js"\)/);
  assert.match(workspace, /import "\.\.\/\.\.\/styles\/automation-builder\.css"/);
  assert.doesNotMatch(workspace, /createElement\("script"\)|document\.head\.appendChild|window\.ApeCertoAutomationBuilder/);
  assert.doesNotMatch(runtime, /window\.ApeCertoAutomationBuilder\s*=/);
  assert.doesNotMatch(runtime, /window\.__ape/,
    "a feature não deve publicar atalhos globais para funções que já são internas");
  assert.doesNotMatch(runtime, /diaegvfveqezispcthwk|eyJhbGciOi/,
    "a feature deve consumir a configuração Supabase oficial, sem cópia embutida");
  assert.match(workspace, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(runtime, /_ctx\.authToken/);
  assert.match(runtime, /export default ApeCertoAutomationBuilder/);
  assert.equal(existsSync(new URL("../public/automation-builder-original.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../public/automation-builder-original.css", import.meta.url)), false);
});

test("Central de Automações não carrega gestores duplicados de CRM, funis e captação", () => {
  const runtime = readFileSync(join(raizApp, "features/automations/automationBuilderRuntime.js"), "utf8");
  assert.doesNotMatch(runtime, /open(?:Abordagens|Captacao|Pipelines|Crm)Manager|CRM real|PIPELINE — gestão real/);
  assert.match(runtime, /window\.location\.href='\/abordagens'/);
});

test("Produtos e Usuários não exibem controles de busca ou comparação sem ação", () => {
  const produtos = readFileSync(join(raizApp, "features/products/ProductsModule.tsx"), "utf8");
  const usuarios = readFileSync(join(raizApp, "features/team/TeamWorkspace.tsx"), "utf8");
  assert.doesNotMatch(produtos, /Buscar lead, telefone, bairro|▦ Comparar/);
  assert.match(produtos, /value=\{query\} onChange=/);
  assert.match(usuarios, /value=\{query\} onChange=\{\(event\) => \{ setQuery\(event\.target\.value\); setView\("lista"\); \}\}/);
  assert.match(usuarios, /matchesQuery &&/);
});

test("Disparos não exibe busca falsa nem chama modelos locais de IA", () => {
  const disparos = readFileSync(join(raizApp, "features/campaigns/CampaignWorkspace.tsx"), "utf8");
  assert.doesNotMatch(disparos, /Buscar lead, telefone, bairro|Gerar com IA|ABORDAGENS COM IA|A IA cria variações/);
  assert.match(disparos, /Gerar variações/);
  assert.match(disparos, /if \(!response\.ok\)/);
});

test("venda manual pode nascer ligada ao negócio real do CRM", () => {
  const modal = readFileSync(join(raizApp, "features/finance/VendaModal.tsx"), "utf8");
  const api = readFileSync(join(raizApp, "api/finance/route.ts"), "utf8");
  assert.match(modal, /Negócio de origem no CRM/);
  assert.match(modal, /negocioId: negocioId \? Number\(negocioId\) : null/);
  assert.match(api, /Este negócio já está ligado a outra venda/);
  assert.match(api, /from\("negocios"\)\.update\(\{ venda_id: saleId \}\)/);
  assert.match(api, /\.is\("venda_id", null\)\.select\("id"\)\.maybeSingle\(\)/);
});

test("runtime legado e API geral do CRM foram removidos fisicamente", () => {
  const removidos = [
    "api/crm/route.ts",
    "components/OriginalErpHost.tsx",
    "features/system/LegacyModuleWorkspace.tsx",
    "original/page.tsx",
    "../public/legacy-runtime.html",
    "../public/legacy-crm-actions.js",
    "styles/mobile-overrides.css",
    "api/ncrm/ingest/route.ts",
  ];
  for (const caminho of removidos) {
    assert.equal(existsSync(join(raizApp, caminho)), false, `${caminho} não pode voltar`);
  }
  assert.equal(existsSync(join(raizApp, "api/crm/sales/route.ts")), true,
    "a Esteira de Vendas ativa precisa continuar disponível");
  assert.equal(existsSync(new URL("../supabase/functions/ncrm-ingest/index.ts", import.meta.url)), false,
    "a Edge Function de ingestão antiga não implantada não pode voltar como segunda entrada");
  assert.doesNotMatch(readFileSync(join(raizApp, "globals.css"), "utf8"), /\.original-erp-host/);
});

test("CI valida o ERP atual e não mantém o harness do CRM Nova Era", () => {
  const semArquivos = (path) => !existsSync(path) || readdirSync(path, { recursive: true }).every((entry) => !statSync(join(path, entry)).isFile());
  assert.equal(semArquivos(join(raizRepo, "tests/crm-nova-era")), true);
  assert.equal(semArquivos(join(raizApp, "features/crm-nova-era")), true);
  assert.equal(existsSync(join(raizRepo, ".github/workflows/crm-nova-era.yml")), false);
  assert.equal(existsSync(join(raizRepo, ".github/workflows/erp-validacao.yml")), false);
  const workflow = readFileSync(join(raizRepo, ".github/workflows/frontend.yml"), "utf8");
  assert.match(workflow, /push:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /pnpm run test:frontend/);
  assert.match(workflow, /tsc --noEmit --incremental false/);
  assert.match(workflow, /pnpm run lint/);
  assert.match(workflow, /(?:pnpm run build|vinext build)/);
});

test("documentação e fontes isoladas do CRM Nova Era não voltam como segunda arquitetura", () => {
  const semArquivos = (path) => !existsSync(path) || readdirSync(path, { recursive: true }).every((entry) => !statSync(join(path, entry)).isFile());
  assert.equal(semArquivos(join(raizRepo, "docs/crm-nova-era")), true);
  assert.equal(semArquivos(join(raizRepo, "staging")), true);
  assert.equal(existsSync(join(raizRepo, "supabase/ROLLOUT_ncrm_integracao.md")), false);
  assert.equal(existsSync(join(raizRepo, "supabase/functions/ncrm-ingest/logic.ts")), false);
  assert.equal(existsSync(join(raizApp, "api/ncrm/saraSchema.ts")), true);

  // Push e observer continuam sendo infraestrutura vigente do Funil 2, não um CRM paralelo.
  assert.equal(existsSync(join(raizApp, "api/ncrm/push/chave/route.ts")), true);
  assert.equal(existsSync(join(raizApp, "api/ncrm/push/registrar/route.ts")), true);
  assert.equal(existsSync(join(raizRepo, "supabase/functions/ncrm-web-push/index.ts")), true);
  assert.equal(existsSync(join(raizRepo, "supabase/functions/ncrm-sara-observer/index.ts")), true);
});

test("CSS global não mantém as camadas visuais do CRM V2 e dos módulos operacionais aposentados", () => {
  const globals = readFileSync(join(raizApp, "globals.css"), "utf8");
  assert.doesNotMatch(globals, /\.crm-v2(?:\s|\{|:)/);
  assert.doesNotMatch(globals, /\.crm-drawer-v2(?:\s|\{|:)/);
  assert.doesNotMatch(globals, /\.operational-module(?:\s|\{|:)/);
  assert.doesNotMatch(globals, /\.aq-[a-z0-9_-]+/i);
  assert.doesNotMatch(globals, /\.(?:perf-|performance-workspace|notif-|notification-)/);
  assert.doesNotMatch(globals, /\.(?:analytics-|stage-config-|connection-card|module-topbar|marketing-hero)/);
  assert.doesNotMatch(globals, /\.(?:esteira-docs|hist-|momentox|presence-cfg|dist-config|momcfg-|cse-|minerva-)/);
  assert.doesNotMatch(globals, /\.(?:attention-|broker-picker-|resp-toast|chat-rec-bar|sap-|visit-edit-)/);
  assert.doesNotMatch(globals, /\.(?:sale-drawer|sale-esteira-stage|lead-funnel-status|pj-panel-grid|detail-hero|nova-venda-modal)/);
  assert.match(readFileSync(join(raizApp, "styles/funil-2.css"), "utf8"), /\.f2-esteira-oficial>\.sales-process/);
});

test("autenticação do ERP não mantém o scaffold órfão do ChatGPT", () => {
  assert.equal(existsSync(join(raizApp, "chatgpt-auth.ts")), false);
});

test("ERP Supabase não mantém scaffold vazio de banco D1/Drizzle", () => {
  const pkg = JSON.parse(readFileSync(join(raizRepo, "package.json"), "utf8"));
  assert.equal(existsSync(join(raizRepo, "drizzle.config.ts")), false);
  assert.equal(existsSync(join(raizRepo, "db/index.ts")), false);
  assert.equal(existsSync(join(raizRepo, "db/schema.ts")), false);
  assert.equal(existsSync(join(raizRepo, "examples/d1/app/api/notes/route.ts")), false);
  assert.equal(existsSync(join(raizRepo, "examples/d1/db/schema.ts")), false);
  assert.equal(pkg.dependencies?.["drizzle-orm"], undefined);
  assert.equal(pkg.devDependencies?.["drizzle-kit"], undefined);
  assert.equal(pkg.scripts?.["db:generate"], undefined);
  assert.equal(existsSync(join(raizRepo, "drizzle/meta/_journal.json")), false);
});

test("CI atual não mantém scripts diferenciais aposentados", () => {
  assert.equal(existsSync(join(raizRepo, "scripts/ci-lint-delta.mjs")), false);
  assert.equal(existsSync(join(raizRepo, "scripts/ci-typecheck-delta.mjs")), false);
});
