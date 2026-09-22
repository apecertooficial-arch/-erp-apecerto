import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/team/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/team/TeamWorkspace.tsx", import.meta.url), "utf8");

test("Equipe não devolve nem registra detalhes brutos do Supabase", () => {
  assert.match(route, /function falhaTeam\(/);
  assert.match(route, /console\.error\("team_operacao_falhou", \{\s*operacao,\s*codigo:/);
  assert.doesNotMatch(route, /Response\.json\(\{ error: [^}\n]*\.message/);
  assert.doesNotMatch(route, /console\.(?:error|warn|log)\([^\n]*(?:message|body|payload|telefone|email)/i);
});

test("autenticação separa sessão, falha técnica e autorização canônica", () => {
  assert.match(route, /status: "auth_error"/);
  assert.match(route, /falhaTeam\(auth\.error, "autorizar_/);
  assert.match(route, /papelNoGrupo\(profile\.role, "admin"\)/);
  assert.match(route, /Sessão inválida ou expirada\./);
  assert.doesNotMatch(route, /profile\.role === "admin"/);
});

test("leitura obrigatória não transforma auditoria indisponível em lista vazia", () => {
  assert.match(route, /\[users, brokers, instances, links, audits\]\.find/);
  assert.match(route, /falhaTeam\(firstError, "carregar_equipe"\)/);
});

test("acesso usa a autoridade de Perfis e comprova alvo e linha alterada", () => {
  assert.match(route, /"permissoes" in body[\s\S]*autoridade_permissoes/);
  assert.match(route, /data: before, error: beforeError/);
  assert.match(route, /if \(!before\)[\s\S]*usuario_nao_encontrado/);
  assert.match(route, /update\(update\)\.eq\("id", userId\)\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(route, /if \(!updated\)[\s\S]*usuario_conflito/);
  assert.match(route, /Não é permitido remover o próprio acesso administrativo/);
});

test("corretor, vínculos e documento comprovam pré-condições e gravações", () => {
  assert.match(route, /data: before, error: beforeError[\s\S]*from\("corretores"\)/);
  assert.match(route, /data: linksBefore, error: linksBeforeError/);
  assert.match(route, /instancias_solicitadas_invalidas/);
  assert.ok((route.match(/\.select\("id"\)\.maybeSingle\(\)/g) ?? []).length >= 3);
  assert.match(route, /documento_caminho_invalido/);
});

test("falha de auditoria ou etapa posterior exige reconciliação", () => {
  assert.doesNotMatch(route, /\.then\(\(\) => undefined, \(\) => undefined\)/);
  assert.ok((route.match(/falhaTeam\([^\n]+true\)/g) ?? []).length >= 5);
  assert.match(route, /reconciliacao_necessaria/);
  assert.match(route, /Não repita a ação/);
});

test("interface não exibe mensagem técnica de Storage", () => {
  assert.doesNotMatch(ui, /setToast\(uploadError\.message\)/);
  assert.doesNotMatch(ui, /setToast\(signedError\?\.message/);
  assert.match(ui, /Não foi possível enviar o documento agora\./);
});

test("interface bloqueia criação e convite enquanto a autoridade está indisponível", () => {
  assert.ok((ui.match(/disabled=\{loading \|\| Boolean\(error\)/g) ?? []).length >= 2);
});

test("interface rejeita resposta 200 incompleta em vez de desmontar a equipe", () => {
  assert.match(ui, /if \(!\[body\.users, body\.brokers, body\.instances, body\.links, body\.audits\]\.every\(Array\.isArray\)\) throw new Error\("payload_invalido"\)/);
});

test("interface só confirma gravações da equipe depois de success explícito", () => {
  assert.equal((ui.match(/\.success !== true/g) ?? []).length, 3);
  assert.match(ui, /O servidor não confirmou a alteração do corretor/);
  assert.match(ui, /O servidor não confirmou a alteração de acesso/);
  assert.match(ui, /O servidor não confirmou o vínculo do documento/);
});
