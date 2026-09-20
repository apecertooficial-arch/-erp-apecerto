import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function ler(caminho) {
  return readFileSync(new URL(caminho, import.meta.url), "utf8");
}

const cadastro = ler("../app/cadastro/page.tsx");
const definirSenha = ler("../app/definir-senha/page.tsx");
const reset = ler("../app/components/ResetPassword.tsx");
const login = ler("../app/components/SupabaseLogin.tsx");
const css = ler("../app/globals.css");

test("fluxos públicos de credencial possuem marco e título principais", () => {
  for (const fonte of [cadastro, definirSenha, reset]) {
    assert.match(fonte, /<main className="auth-layer">/);
    assert.match(fonte, /<h1 id=/);
    assert.doesNotMatch(fonte, /<h2 id=/);
  }
});

test("login usa main fora da prévia e diálogo dentro do ERP", () => {
  assert.match(login, /const Root = preview \? "div" : "main"/);
  assert.match(login, /role=\{preview \? "dialog" : undefined\}/);
  assert.match(login, /aria-modal=\{preview \|\| undefined\}/);
  assert.match(login, /<h1 id="login-title">/);
  assert.match(login, /className="login-hero-title"/);
});

test("troca semântica preserva os estilos dos títulos", () => {
  assert.match(css, /\.auth-card h1 \{/);
  assert.match(css, /\.auth-card-v2 \.auth-welcome h1 \{/);
  assert.match(css, /\.login-heading h1 \{/);
  assert.match(css, /\.login-hero-title \{/);
});
