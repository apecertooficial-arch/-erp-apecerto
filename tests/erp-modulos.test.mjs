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

/* Este teste JA COBRIU o fluxo oposto: durante um tempo a troca de versao
   dependia de alguem tocar em "Atualizar", e o sw.js era byte a byte identico a
   cada deploy -- o navegador nem percebia que havia versao nova e o F5 comum
   continuava servindo o app velho. A correcao de agosto/2026 inverteu a decisao
   de proposito: o worker novo ASSUME sozinho (skipWaiting no install +
   clients.claim no activate, com o cache versionado pelo ?v=<build>), e o que
   passou a ser protegido nao e mais a troca do worker, e a ABA DE QUEM ESTA
   TRABALHANDO -- recarregar por cima de um atendimento sendo digitado perde
   texto. Dai a regra atual: recarga automatica so com a aba escondida; aba na
   frente recebe aviso e recarrega no toque. O teste agora guarda ESSE contrato. */
test("worker novo assume sem atropelar a aba ativa", () => {
  // 1. o worker novo assume automaticamente, sem depender de mensagem da pagina
  assert.match(sw, /addEventListener\("install"[\s\S]*?self\.skipWaiting\(\)/,
    "o install precisa chamar skipWaiting: e o que faz a versao nova assumir sozinha");
  assert.match(sw, /addEventListener\("activate"[\s\S]*?self\.clients\.claim\(\)/,
    "sem clients.claim a aba aberta continuaria controlada pelo worker antigo");
  assert.match(sw, /new URL\(self\.location\.href\)\.searchParams\.get\("v"\)/,
    "o cache precisa ser versionado pelo build; nome fixo nunca expira");

  // 6. o registro carrega /sw.js?v=<build> -- sem a query o arquivo nao muda entre deploys
  assert.match(registro, /navigator\.serviceWorker\.register\(`\/sw\.js\?v=\$\{encodeURIComponent\(build\)\}`/,
    "registrar /sw.js sem ?v=<build> devolve o bug: navegador nao ve versao nova");
  assert.match(registro, /fetch\("\/api\/build", \{ cache: "no-store" \}\)/,
    "o identificador precisa vir do deploy e permanecer estavel entre recargas");
  assert.doesNotMatch(registro, /\|\|\s*String\(Date\.now\(\)\)/,
    "Date.now cria worker novo a cada F5 e prende a pagina num aviso infinito");

  // 2. a pagina escuta controllerchange -- e assim que ela sabe que o worker trocou
  assert.match(registro, /navigator\.serviceWorker\.addEventListener\("controllerchange", aoTrocar\)/,
    "sem ouvir controllerchange a pagina nao sabe que a versao nova assumiu");

  // 3. aba escondida pode recarregar sozinha
  assert.match(registro, /document\.visibilityState === "hidden"[\s\S]*?window\.location\.reload\(\)/,
    "com a aba em segundo plano a recarga automatica e segura e desejada");

  // 4. aba visivel NUNCA recarrega sozinha: apenas avisa
  assert.match(registro, /\} else \{\s*setPrecisaRecarregar\(true\);/,
    "aba na frente so pode ser avisada; recarregar por cima de um atendimento perde texto");

  // 5. o aviso traz botao real, e o toque e que recarrega
  assert.match(registro, /onClick=\{\(\) => window\.location\.reload\(\)\}/,
    "o aviso precisa de botao que recarregue de fato");

  // Compatibilidade preservada: aba antiga ainda pode mandar ATUALIZAR_AGORA.
  assert.match(sw, /evento\.data === "ATUALIZAR_AGORA"/,
    "uma aba de versao anterior ainda manda esta mensagem; o worker nao pode ignorar");
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
  const connections = readFileSync(join(raizApp, "features/settings/ConnectionsWorkspace.tsx"), "utf8");
  const api = readFileSync(join(raizApp, "api/connections/route.ts"), "utf8");
  const globals = readFileSync(join(raizApp, "globals.css"), "utf8");

  assert.match(settings, /return <ConnectionsWorkspace accessToken=\{accessToken\} \/>/);
  assert.doesNotMatch(globals, /\.settings-/,
    "CSS da antiga central de Configurações não pode voltar a sobrepor Conexões");
  assert.match(globals, /\.connections-workspace/,
    "a camada visual vigente de Conexões precisa permanecer disponível");
  assert.match(connections, /fetch\("\/api\/connections"/,
    "o celular deve consultar as conexões pelo domínio do ERP");
  assert.doesNotMatch(connections, /getBrowserSupabaseClient|\.rpc\("wa_v7_painel"\)/,
    "a tela não pode ficar presa na sessão compartilhada do cliente Supabase");
  assert.match(connections, /AbortSignal\.timeout\(15_000\)/,
    "a tela precisa terminar em dados ou erro acionável, nunca carregar para sempre");
  assert.match(api, /auth\.getUser\(token\)/);
  assert.match(api, /rpc\("wa_v7_painel"\)/);
  assert.match(api, /functions\.invoke\("dapi-qr"/);
  assert.doesNotMatch(api, /service.?role/i,
    "o proxy deve preservar o JWT e o escopo do próprio corretor");
});

test("identidade visual não sobrescreve componentes operacionais do celular", () => {
  const identidade = readFileSync(join(raizApp, "styles/apecerto-identidade.css"), "utf8");
  for (const seletor of [".app-bottom-nav", ".f2m-agendar", ".f2m-agendar-ok", ".convite-instalar-ok"]) {
    assert.equal(identidade.includes(seletor), false, `${seletor} deve ter uma única dona em app-mobile.css`);
  }
  assert.match(css, /\.f2m-agendar-ok\s*\{[^}]*background:\s*#1E9E5A/,
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

test("Automações abre direto no construtor, sem biblioteca intermediária duplicada", () => {
  const workspace = readFileSync(join(raizApp, "features/automations/AutomationsWorkspace.tsx"), "utf8");
  const runtime = readFileSync(join(raizApp, "features/automations/automationBuilderRuntime.js"), "utf8");

  assert.match(workspace, /<div className="original-automation-host" ref=\{hostRef\} \/>/);
  assert.doesNotMatch(workspace, /Biblioteca na frente|BIBLIOTECA DE ROTINAS|Abrir construtor/);
  assert.doesNotMatch(workspace, /useState<"biblioteca" \| "construtor">/);
  assert.match(workspace, /onAutomationOpened: \(automacao\) => setAbrirId\(automacao\.id\)/);
  assert.match(runtime, /_ctx\.onAutomationOpened\(\{id:cur\.id,nome:cur\.nome,grupo:cur\.grupo\}\)/);
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

test("Abordagens preserva vídeo e personaliza lead e corretor em todos os envios", () => {
  const tela = readFileSync(join(raizApp, "features/approaches/ApproachesWorkspace.tsx"), "utf8");
  const chat = readFileSync(join(raizApp, "api/live-chat/route.ts"), "utf8");
  assert.match(tela, /addPart\("send-image-message"\)/);
  assert.match(tela, /addPart\("send-video-message"\)/);
  assert.doesNotMatch(tela, /addPart\("send-media"\)/);
  assert.match(tela, /corretor_primeiro_nome\|primeiro_nome_corretor\|corretor_nome\|corretor/);
  assert.match(chat, /brokerNameForInstance/);
  assert.match(chat, /replaceAll\("\{primeiro_nome\}", leadFirstName\)/);
  assert.match(chat, /replaceAll\("\{corretor_primeiro_nome\}", brokerFirstName\)/);
  assert.match(chat, /corretor_nome: brokerName \|\| null/);
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

test("regras aposentadas possuem backup privado antes da exclusão datada", () => {
  const migration = readFileSync(join(
    raizRepo,
    "supabase/migrations/20260815153000_arquivar_regras_aposentadas_antes_exclusao.sql",
  ), "utf8");
  assert.match(migration, /ncrm_private\.arquivo_f2_cadencia_regua_20260815/);
  assert.match(migration, /ncrm_private\.arquivo_funil_regra_20260815/);
  assert.match(migration, /ncrm_private\.arquivo_funil_regra_execucao_20260815/);
  assert.match(migration, /pg_get_functiondef/);
  assert.match(migration, /proibida antes de 19\/08\/2026/);
  assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated/);
  assert.doesNotMatch(migration, /drop\s+(?:table|function)/i);
});

test("corte futuro das regras aposentadas possui preflight fail-closed", () => {
  const preflight = readFileSync(join(
    raizRepo,
    "supabase/verificacao/20260819_preflight_exclusao_regras_aposentadas.sql",
  ), "utf8");
  assert.match(preflight, /current_date < date '2026-08-19'/);
  assert.match(preflight, /mudou depois do backup/);
  assert.match(preflight, /dependencias de funcao mudaram/);
  assert.match(preflight, /existem % crons dependentes/);
  assert.match(preflight, /where regra_id is not null/);
  assert.doesNotMatch(preflight, /drop\s+(?:table|function)/i);
});

test("rollback futuro possui snapshot do DDL além dos dados", () => {
  const migration = readFileSync(join(
    raizRepo,
    "supabase/migrations/20260815154000_arquivar_ddl_regras_aposentadas.sql",
  ), "utf8");
  assert.match(migration, /information_schema\.columns/);
  assert.match(migration, /pg_get_constraintdef/);
  assert.match(migration, /pg_get_indexdef/);
  assert.match(migration, /pg_policy/);
  assert.match(migration, /ncrm_private\.arquivo_regras_ddl_20260815/);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/);
});

test("Sara vigente não depende mais da tabela de cadência aposentada", () => {
  const migration = readFileSync(join(
    raizRepo,
    "supabase/migrations/20260815160000_desacoplar_sara_da_regua_aposentada.sql",
  ), "utf8");
  assert.match(migration, /create or replace function public\.f2_proximo_prazo_contato/);
  assert.match(migration, /f2_sara_ler_conversa/);
  assert.match(migration, /f2_sara_marcar_lido/);
  assert.match(migration, /execute replace\(r\.ddl, 'f2_cadencia_proximo_prazo', 'f2_proximo_prazo_contato'\)/);
  assert.doesNotMatch(migration, /drop\s+(?:table|function|column)/i);
});

test("schema tipado e migração final não reintroduzem regras aposentadas", () => {
  const migration = readFileSync(join(
    raizRepo,
    "supabase/migrations/20260815170000_excluir_regras_aposentadas.sql",
  ), "utf8");
  const types = readFileSync(join(raizApp, "lib/supabase/database.types.ts"), "utf8");

  assert.match(migration, /drop column if exists regra_id/);
  assert.match(migration, /drop table if exists public\.funil_regra_execucao/);
  assert.match(migration, /drop table if exists public\.funil_regra/);
  assert.match(migration, /drop table if exists public\.f2_cadencia_regua/);
  assert.doesNotMatch(types, /\bf2_cadencia_regua:/);
  assert.doesNotMatch(types, /\bfunil_regra(?:_execucao)?:/);
  assert.doesNotMatch(types, /\bf2_cadencia_proximo_prazo:/);
  assert.match(types, /\bf2_proximo_prazo_contato:/);
});
