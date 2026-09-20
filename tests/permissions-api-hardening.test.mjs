import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rota = readFileSync(new URL("../app/api/permissions/route.ts", import.meta.url), "utf8");
const estilos = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("permissões não devolve nem registra a mensagem bruta do banco", () => {
  assert.doesNotMatch(rota, /Response\.json\(\{ error: [^}\n]*\.message/);
  assert.doesNotMatch(rota, /console\.error\([^\n]*message/);
  assert.match(rota, /erro: semPermissao \? "sem_permissao" : parcial \? "reconciliacao_necessaria" : "falha_banco"/);
});

test("falha ao ler o perfil de autorização não é disfarçada de 403", () => {
  assert.match(rota, /error: profileError/);
  assert.match(rota, /if \(auth\.authError\) return falhaPermissoes\(auth\.authError, "autorizar_listagem"\)/);
  assert.match(rota, /if \(auth\.authError\) return falhaPermissoes\(auth\.authError, "autorizar_alteracao"\)/);
});

test("alterações conferem a leitura anterior e a linha realmente afetada", () => {
  assert.match(rota, /if \(antesError\) return falhaPermissoes/);
  assert.match(rota, /if \(!antes\) return Response\.json\(\{ error: "Perfil não encontrado\."/);
  assert.match(rota, /if \(!antes\) return Response\.json\(\{ error: "Usuário não encontrado\."/);
  assert.equal((rota.match(/\.select\("id"\)\.maybeSingle\(\)/g) ?? []).length, 3);
  assert.equal((rota.match(/if \(!atualizado\) return Response\.json/g) ?? []).length, 3);
});

test("falha de auditoria nunca confirma sucesso", () => {
  assert.match(rota, /const \{ error \} = await supabase\.rpc\("registrar_auditoria"/);
  assert.doesNotMatch(rota, /\.then\(\(\) => undefined, \(\) => undefined\)/);
  assert.equal((rota.match(/if \(auditError\) return falhaPermissoes\([^\n]+true\);/g) ?? []).length, 3);
  assert.match(rota, /A permissão foi alterada, mas a auditoria não foi confirmada/);
});

test("mantém autenticação 401 e autorização pelo grupo canônico acesso_total", () => {
  assert.match(rota, /Sessão inválida ou expirada\./);
  assert.match(rota, /papelNoGrupo\(role, "acesso_total"\)/);
  assert.doesNotMatch(rota, /role\s*===\s*["']admin["']/);
});

test("permissões empilha navegação e conteúdo no aplicativo", () => {
  assert.match(estilos, /\/\* Permissões mobile: navegação e conteúdo em uma coluna \*\//);
  assert.match(estilos, /\.perms-body\{grid-template-columns:minmax\(0,1fr\);gap:14px;\}/);
  assert.match(estilos, /\.perms-side\{position:static;display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(estilos, /\.perm-seg\{grid-column:1\/-1;display:flex;flex-wrap:wrap;width:100%;\}/);
});
