// Regras de CSS do shell mobile.
// NAO mede layout renderizado — verifica que as regras exigidas existem e nao
// regridem. Medicao real de viewport exige navegador (indisponivel no ambiente).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const css = readFileSync(new URL("../../app/styles/app-mobile.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../app/components/AppShell.tsx", import.meta.url), "utf8");
const telasMoveis = [
  "../../app/features/tasks/SaraTasksMobile.tsx",
  "../../app/features/system/ManagementMobile.tsx",
  "../../app/features/home/InicioGestaoMobile.tsx",
  "../../app/features/funil-2/Funil2Mobile.tsx",
  "../../app/components/ProfilePanel.tsx",
].map((arquivo) => readFileSync(new URL(arquivo, import.meta.url), "utf8")).join("\n");
function lerFeaturesTsx(diretorio) {
  return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = new URL(`${entrada.name}${entrada.isDirectory() ? "/" : ""}`, diretorio);
    if (entrada.isDirectory()) return lerFeaturesTsx(caminho);
    return entrada.name.endsWith(".tsx") ? [readFileSync(caminho, "utf8")] : [];
  });
}
const featuresAutenticadas = lerFeaturesTsx(new URL("../../app/features/", import.meta.url)).join("\n");
const bloco = css.slice(css.indexOf("CASCA DO APLICATIVO"));

test("elementos mobile ficam ocultos por padrao (desktop intacto)", () => {
  assert.match(bloco, /\.app-mobile-top,\s*\n?\s*\.app-bottom-nav,\s*\n?\s*\.app-mais-overlay\s*\{\s*display:\s*none/);
});

test("breakpoint do shell e 900px e nao mexe acima disso", () => {
  assert.ok(bloco.includes("@media (max-width: 900px)"), "precisa do breakpoint de 900px");
  assert.ok(!/@media \(min-width/.test(bloco), "o bloco nao deve alterar telas maiores");
});

test("sidebar sai do fluxo no celular (senao gera scroll horizontal)", () => {
  assert.match(bloco, /\.app-shell \.sidebar\s*\{\s*display:\s*none/);
  assert.match(bloco, /\.app-shell,\s*\n?\s*\.app-shell\.nav-collapsed\s*\{\s*grid-template-columns:\s*1fr/);
});

test("scroll horizontal bloqueado", () => {
  assert.match(bloco, /html,\s*body\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(bloco, /\.app-shell,\s*\.workspace\s*\{[^}]*overflow-x:\s*hidden/);
});

test("safe-area do iPhone aplicada em topo e base", () => {
  assert.ok(bloco.includes("env(safe-area-inset-top"), "cabecalho precisa de safe-area-inset-top");
  assert.ok(bloco.includes("env(safe-area-inset-bottom"), "barra precisa de safe-area-inset-bottom");
  // O conteudo precisa reservar espaco, senao a barra cobre o final da tela.
  assert.match(bloco, /padding-bottom:\s*calc\(60px \+ env\(safe-area-inset-bottom/);
});

test("alvos de toque >= 44px", () => {
  const alvos = [...bloco.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(alvos.length >= 3, `esperado >=3 alvos com min-height; achei ${alvos.length}`);
  for (const v of alvos) assert.ok(v >= 44, `alvo de toque com ${v}px viola o minimo de 44px`);
  /* min-width so vale como alvo de toque em elemento INTERATIVO. Contador e
     badge sao <span>/<i> decorativos: ninguem toca neles, e exigir 44px ali
     deformaria o card. A regra continua valendo onde importa. */
  const regras = [...bloco.matchAll(/([^{}]+)\{([^}]*min-width:\s*(\d+)px[^}]*)\}/g)];
  for (const [, seletor, , px] of regras) {
    const interativo = /button|(^|[\s,>])a[\s.,:{]|input|\[role="button"\]/.test(seletor);
    if (interativo) assert.ok(Number(px) >= 44, `alvo interativo "${seletor.trim()}" tem min-width ${px}px`);
  }
});

test("barra inferior e fixa e ocupa a largura toda", () => {
  assert.match(bloco, /\.app-bottom-nav\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*0[^}]*left:\s*0[^}]*right:\s*0/s);
});

test("rotulos da barra nao estouram (ellipsis) e ha ajuste para 360px", () => {
  assert.ok(bloco.includes("text-overflow: ellipsis"), "rotulo precisa truncar em vez de empurrar layout");
  assert.ok(bloco.includes("@media (max-width: 380px)"), "precisa de ajuste para telas de 360px");
});

test("folha Mais cobre a tela e rola sem vazar", () => {
  assert.match(bloco, /\.app-mais-overlay\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s);
  assert.match(bloco, /\.app-mais-folha\s*\{[^}]*overflow-y:\s*auto/s);
});

test("foco visivel no teclado (acessibilidade basica)", () => {
  assert.ok(bloco.includes(":focus-visible"), "navegacao precisa de foco visivel");
});

test("folha móvel não carrega seletores do CRM Nova Era aposentado", () => {
  assert.doesNotMatch(css, /\.nova-crm-(?:board|card|col|etapas|panel)/);
  assert.doesNotMatch(css, /\.ncrm-dia-(?:acao|ajuda|busca|card|mais)/);
  assert.match(css, /\.ncrm-wa-principal/, "o botão WhatsApp compartilhado com o F2 deve permanecer");
});

test("layout não carrega a folha órfã do protótipo CRM móvel", () => {
  assert.doesNotMatch(layout, /tela-crm\.css/);
});

test("aplicativo preserva um único marco principal no shell", () => {
  assert.match(shell, /<main className="workspace">\{children\}<\/main>/);
  assert.doesNotMatch(telasMoveis, /<\/?main\b/);
  assert.match(telasMoveis, /aria-label="Tarefas da Sara"/);
  assert.match(telasMoveis, /aria-label="Gestão do dia"/);
});

test("painel de perfil se anuncia como diálogo e fecha pelo teclado", () => {
  assert.match(telasMoveis, /role="dialog"/);
  assert.match(telasMoveis, /aria-modal="true"/);
  assert.match(telasMoveis, /aria-labelledby="profile-panel-title"/);
  assert.match(telasMoveis, /event\.key !== "Escape"/);
  assert.match(telasMoveis, /closeButton\.current\?\.focus\(\)/);
});

test("workspaces autenticados não criam um segundo marco principal", () => {
  assert.doesNotMatch(featuresAutenticadas, /<\/?main\b/);
});
