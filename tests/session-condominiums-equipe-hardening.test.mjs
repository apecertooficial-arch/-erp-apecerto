import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sessionApi = read("../app/api/session/route.ts");
const sessionClient = read("../app/features/system/ErpSession.tsx");
const condominiumApi = read("../app/api/condominiums/route.ts");
const condominiumClient = read("../app/features/products/CondominiumWizard.tsx");
const equipeApi = read("../app/api/equipe/route.ts");
const equipeClient = read("../app/features/team/EquipeWorkspace.tsx");
const authErrors = read("../app/lib/supabase/auth-errors.ts");

test("classificação de sessão usa códigos oficiais e não texto instável", () => {
  for (const code of ["bad_jwt", "session_not_found", "session_expired", "user_not_found"]) {
    assert.match(authErrors, new RegExp(`"${code}"`));
  }
  assert.match(authErrors, /export function isInvalidSessionError/);
  assert.doesNotMatch(authErrors, /\.message|status\s*===/);
});

test("sessão falha fechada sem expor mensagem interna ou ignorar permissões", () => {
  assert.match(sessionApi, /function falhaSessao\(/);
  assert.doesNotMatch(sessionApi, /Response\.json\(\{ error: [^}\n]*\.message/);
  assert.doesNotMatch(sessionApi, /console\.(?:error|warn|log)\([^\n]*(?:message|email|token|payload)/i);
  assert.match(sessionApi, /if \(authError && isInvalidSessionError\(authError\)\)/);
  assert.match(sessionApi, /if \(authError\) return falhaSessao\(authError, "autenticar"\)/);
  assert.match(sessionApi, /if \(profileError\) return falhaSessao\(profileError, "carregar_perfil"\)/);
  assert.match(sessionApi, /if \(brokerError\) return falhaSessao\(brokerError, "carregar_corretor"\)/);
  assert.match(sessionApi, /if \(roleProfileError\) return falhaSessao\(roleProfileError, "carregar_permissoes_papel"\)/);
});

test("cliente da sessão rejeita HTTP, JSON e perfil incompletos", () => {
  assert.match(sessionClient, /resposta\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(sessionClient, /isSessionProfile\(/);
  assert.match(sessionClient, /if \(!resposta\.ok \|\| !isSessionProfile\(body\)\) throw/);
});

test("condomínio sanitiza falhas e confirma a linha persistida", () => {
  assert.match(condominiumApi, /function falhaCondominio\(/);
  assert.doesNotMatch(condominiumApi, /Response\.json\(\{ error: [^}\n]*\.message/);
  assert.doesNotMatch(condominiumApi, /console\.(?:error|warn|log)\([^\n]*(?:message|address|endereco|payload)/i);
  assert.match(condominiumApi, /if \(authError && isInvalidSessionError\(authError\)\)/);
  assert.match(condominiumApi, /if \(authError\) return falhaCondominio\(authError, "autenticar"\)/);
  assert.match(condominiumApi, /falhaCondominio\(duplicateError, "buscar_duplicidade"\)/);
  assert.match(condominiumApi, /error\?\.code === "23505"/);
  assert.match(condominiumApi, /if \(!data\) return falhaCondominio\(null, "confirmar_cadastro"\)/);
});

test("cadastro de condomínio só fecha após resposta comprovada", () => {
  assert.match(condominiumClient, /response\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(condominiumClient, /isSavedCondominium\(/);
  assert.match(condominiumClient, /!response\.ok \|\| !isSavedCondominium\(result\)/);
  assert.doesNotMatch(condominiumClient, /result\.error/);
  assert.doesNotMatch(condominiumClient, /error instanceof Error \? error\.message/);
});

test("Equipe separa falha técnica de sessão e registra somente código", () => {
  assert.match(equipeApi, /function falhaEquipe\(/);
  assert.match(equipeApi, /isInvalidSessionError\(error\)/);
  assert.match(equipeApi, /auth\.status === "auth_error"/);
  assert.match(equipeApi, /falhaEquipe\(auth\.error, "autenticar"\)/);
  assert.match(equipeApi, /falhaEquipe\(error, "carregar_equipe"\)/);
  assert.doesNotMatch(equipeApi, /console\.(?:error|warn|log)\([^\n]*(?:message|nome|email|payload)/i);
});

test("cliente de Equipe não transforma HTTP ou JSON incerto em vazio", () => {
  assert.match(equipeClient, /response\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(equipeClient, /isTeamResponse\(/);
  assert.match(equipeClient, /!response\.ok \|\| !isTeamResponse\(body\)/);
  assert.doesNotMatch(equipeClient, /e instanceof Error \? e\.message/);
  assert.match(equipeClient, /controller\.abort\(\)/);
});
