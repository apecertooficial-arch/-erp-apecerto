// Modulos do ERP no celular + revisoes obrigatorias de PWA/offline/logout.
// Verifica CODIGO e CSS. Nao mede layout renderizado.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const raizApp = new URL("../app/", import.meta.url).pathname;
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

test("Inicio: KPIs deixam de exigir 945px de largura", () => {
  assert.match(modulos, /\.home-kpis \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(modulos, /\.home-two-columns, \.home-three-columns \{ grid-template-columns: 1fr/);
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
  assert.match(modulos, /\.crm-leads-table-v3, \.finance-table, \.team-table \{[\s\S]*?overflow-x: auto/);
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
