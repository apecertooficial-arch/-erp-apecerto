import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/financiamento/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/finance/FinancingWorkspace.tsx", import.meta.url), "utf8");

test("Financiamento não devolve nem registra detalhes brutos do Supabase", () => {
  assert.match(route, /function falhaFinanciamento\(/);
  assert.match(route, /console\.error\("financiamento_operacao_falhou", \{\s*operacao,\s*codigo:/);
  assert.doesNotMatch(route, /Response\.json\(\{ error: [^}\n]*\.message/);
  assert.doesNotMatch(route, /console\.(?:error|warn|log)\([^\n]*(?:message|body|payload|telefone|email)/i);
});

test("autenticação separa sessão inválida de falha técnica", () => {
  assert.match(route, /status: "auth_error"/);
  assert.match(route, /falhaFinanciamento\(auth\.error, "autenticar"\)/);
  assert.match(route, /Sessão inválida ou expirada\./);
});

test("papel e vínculo do corretor falham fechados", () => {
  assert.match(route, /from\("usuarios"\)\.select\("role,ativo"\)/);
  assert.match(route, /papelNoGrupo\(profile\.role, "gestao"\)/);
  assert.match(route, /from\("corretores"\)[\s\S]*\.eq\("usuario_id", auth\.user\.id\)/);
  assert.match(route, /perfil_sem_vinculo/);
});

test("corretor é filtrado no banco por vínculo ou autoria", () => {
  assert.match(route, /query = query\.or\(`corretor_id\.in\.\(\$\{brokerIds\.join\(","\)\}\),created_by\.eq\.\$\{auth\.user\.id\}`\)/);
  assert.doesNotMatch(route, /service.?role/i);
});

test("interface converte resposta inválida e falha de rede em mensagem operacional", () => {
  assert.match(ui, /Não foi possível carregar as fichas agora\./);
  assert.doesNotMatch(ui, /throw new Error\(result\.error/);
  assert.doesNotMatch(ui, /reason instanceof Error \? reason\.message/);
});
