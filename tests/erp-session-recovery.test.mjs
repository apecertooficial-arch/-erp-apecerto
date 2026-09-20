import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const session = readFileSync(new URL("../app/features/system/ErpSession.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../app/components/SupabaseLogin.tsx", import.meta.url), "utf8");
const entry = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../app/features/system/erp-routes.ts", import.meta.url), "utf8");

test("sessao vencida volta ao login em vez de reutilizar token invalido", () => {
  assert.match(session, /renovada\.error \|\| !renovada\.data\.session/);
  assert.match(session, /signOut\(\{ scope: "local" \}\)/);
  assert.match(session, /resposta\.status === 401/);
  assert.match(session, /const iniciarSessao = async \(\) => \{[\s\S]*?catch \{[\s\S]*?mostrarLogin\(\)/);
});

test("falha no bootstrap e no formulario nunca deixa a entrada travada", () => {
  assert.match(session, /const iniciarSessao = async \(\) => \{[\s\S]*?catch \{/);
  assert.match(login, /signInWithPassword[\s\S]*?catch \{[\s\S]*?finally \{[\s\S]*?setLoading\(false\)/);
  assert.match(login, /resetPasswordForEmail[\s\S]*?catch \{[\s\S]*?finally \{[\s\S]*?setLoading\(false\)/);
});

test("entrada canônica publicada preserva o fluxo de recuperação", () => {
  assert.match(entry, /destinoEntradaLegada\(window\.location\.search, window\.location\.hash\)/);
  assert.match(routes, /export function destinoEntradaLegada/);
  assert.match(routes, /return `\$\{destino\}[\s\S]*\$\{hash \|\| ""\}`/);
});
