import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("../app/styles/apecerto-identidade.css");
const shell = read("../app/styles/redesign-apecerto.css");
const desktop = read("../app/styles/funil.css");
const mobile = read("../app/styles/app-mobile-aprovado.css");

test("direção visual consolida azul, índigo, violeta e profundidade nos tokens", () => {
  for (const token of ["--ape-blue", "--ape-indigo", "--ape-violet", "--bg-atmosphere", "--shadow-depth"]) {
    assert.match(tokens, new RegExp(`${token}:`));
  }
});

test("shell e CRM formam uma prova estrutural, não uma troca isolada de cor", () => {
  assert.match(shell, /\.app-shell\{background:var\(--bg-atmosphere\)/);
  assert.match(desktop, /\.funil-oficial \.f2-v3-toolbar\{[^}]*box-shadow:var\(--shadow-depth\)/);
  assert.match(desktop, /\.funil-oficial \.f2-card-proxima\{[^}]*background:linear-gradient/);
  assert.match(desktop, /\.funil-oficial \.f2-coluna\{[^}]*backdrop-filter/);
});

test("aplicativo traduz a linguagem em fila tátil e respeita redução de movimento", () => {
  assert.match(mobile, /\.ape-app\.modo-crm \.ape-crm-kpis article\{[^}]*box-shadow:var\(--shadow-depth\)/);
  assert.match(mobile, /\.ape-app:is\(\.modo-crm,\.modo-inicio\) \.ape-card-acao\{[^}]*background:linear-gradient/);
  assert.match(mobile, /\.ape-app:is\(\.modo-crm,\.modo-inicio\) \.ape-numeros>article\{[^}]*box-shadow:var\(--shadow-depth\)/);
  assert.match(mobile, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(`${shell}${desktop}${mobile}`, /holmes/i);
});
