/* Início móvel: uma única implementação, baseada no Funil 2.0. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("o celular monta diretamente o Funil 2.0", () => {
  const inicio = ler("../app/features/home/InicioApp.tsx");
  assert.match(inicio, /import \{ Funil2Mobile \}/);
  assert.match(inicio, /<Funil2Mobile[^>]+modo="inicio"/s);
  assert.ok(!/SeuDia|TelaCorretor|MeuDiaCorretor|PainelCorretor/.test(inicio));
});

test("o celular não baixa o painel gerencial completo", () => {
  const home = ler("../app/features/home/HomeWorkspace.tsx");
  const posGuarda = home.indexOf("if (!ehDesktop) return;");
  assert.ok(posGuarda >= 0, "a carga gerencial precisa de guarda desktop");
  assert.ok(home.indexOf('fetch("/api/crm"') > posGuarda);
  assert.ok(home.indexOf('fetch("/api/finance"') > posGuarda);
  assert.ok(home.indexOf('fetch("/api/catalog"') > posGuarda);
});

test("o cabeçalho não repete o título do Início", () => {
  const shell = ler("../app/features/system/ErpShell.tsx");
  assert.ok(/moduloAtual === "Início" \?/.test(shell));
});

test("badge aparece somente com número real", () => {
  const shell = ler("../app/features/system/ErpShell.tsx");
  assert.ok(/naoLidas > 0 && <b/.test(shell));
  assert.ok(/\(badges\[m\] \?\? 0\) > 0 &&/.test(shell));
  assert.ok(/badges\["Notificações"\] \?\? 0/.test(shell));
});

test("sino e perfil mantêm alvo de toque e rótulo", () => {
  const css = ler("../app/styles/app-mobile.css");
  const inicio = css.indexOf(".amt-sino, .amt-perfil");
  const bloco = css.slice(inicio, css.indexOf("}", inicio));
  assert.match(bloco, /min-width: 44px/);
  assert.match(bloco, /min-height: 44px/);
  const shell = ler("../app/features/system/ErpShell.tsx");
  assert.match(shell, /aria-label=\{rotuloSino\}/);
  assert.match(shell, /aria-label="Abrir meu perfil"/);
});

test("layout móvel fica isolado do desktop", () => {
  const css = ler("../app/styles/app-mobile.css");
  const trecho = css.slice(css.indexOf("INICIO DO CELULAR"));
  const foraDeMedia = trecho.slice(0, trecho.indexOf("@media"));
  assert.match(foraDeMedia, /\.home-mobile \{ display: none; \}/);
  assert.ok(!/min-height|grid-template|padding:/.test(foraDeMedia));
});
