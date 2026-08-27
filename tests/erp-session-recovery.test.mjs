import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const session = readFileSync(new URL("../app/features/system/ErpSession.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../app/components/SupabaseLogin.tsx", import.meta.url), "utf8");
const loginRoute = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");

test("sessao vencida volta ao login em vez de reutilizar token invalido", () => {
  assert.match(session, /renovada\.error \|\| !renovada\.data\.session/);
  assert.match(session, /signOut\(\{ scope: "local" \}\)/);
  assert.match(session, /resposta\.status === 401/);
});

test("falha no bootstrap e no formulario nunca deixa a entrada travada", () => {
  assert.match(session, /const iniciarSessao = async \(\) => \{[\s\S]*?catch \{/);
  assert.match(login, /signInWithPassword[\s\S]*?catch \{[\s\S]*?finally \{[\s\S]*?setLoading\(false\)/);
});

test("atalho de entrar novamente possui rota publicada", () => {
  assert.match(loginRoute, /redirect\("\/inicio"\)/);
});
