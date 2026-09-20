import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/agentes/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/agents/AgentTrainingWorkspace.tsx", import.meta.url), "utf8");

test("Agentes não devolve nem registra detalhes brutos de banco ou Edge", () => {
  assert.match(route, /function falhaAgentes\(/);
  assert.match(route, /console\.error\("agentes_operacao_falhou", \{\s*operacao,\s*codigo:/);
  assert.doesNotMatch(route, /Response\.json\(\{ error: [^}\n]*\.message/);
  assert.doesNotMatch(route, /Response\.json\(await r\.json\(\)/);
  assert.doesNotMatch(route, /console\.(?:error|warn|log)\([^\n]*(?:message|body|payload|telefone|email|input)/i);
});

test("sessão, perfil e supervisão de IA são obrigatórios no servidor", () => {
  assert.match(route, /status: "auth_error"/);
  assert.match(route, /from\("usuarios"\)\.select\("role,ativo"\)/);
  assert.match(route, /papelNoGrupo\(profile\.role, "supervisao_ia"\)/);
  assert.match(route, /if \(access\.status !== "ok"\)/);
});

test("detalhe falha se qualquer fonte obrigatória estiver indisponível", () => {
  assert.match(route, /\[links, ferrs, perms, cenarios, avals, execs\]\.find/);
  assert.match(route, /falhaAgentes\(detailError, "carregar_detalhe"\)/);
  assert.match(route, /data: fontes, error: fontesError/);
});

test("salvar agente, ferramenta e fonte comprova a linha persistida", () => {
  assert.match(route, /atualizar_agente/);
  assert.match(route, /confirmar_agente/);
  assert.match(route, /confirmar_permissao_ferramenta/);
  assert.match(route, /confirmar_fonte/);
  assert.ok((route.match(/\.select\([^\n]+\)\.maybeSingle\(\)/g) ?? []).length >= 4);
});

test("fonte criada sem vínculo e promoção parcial exigem reconciliação", () => {
  assert.match(route, /reconciliacao_necessaria/);
  assert.match(route, /Não repita a ação/);
  assert.match(route, /carregar_cenarios_existentes/);
  assert.match(route, /confirmar_cenarios_promovidos/);
});

test("testes de IA validam paginação e não repassam resposta externa arbitrária", () => {
  assert.match(route, /offset < 0/);
  assert.match(route, /limit > 8/);
  assert.match(route, /respostaIntegracao\(/);
  assert.match(route, /falha_integracao/);
});

test("interface trata rede, JSON inválido e falha HTTP com mensagem operacional", () => {
  assert.match(ui, /const ERRO_OPERACAO = "Não foi possível concluir a operação agora\."/);
  assert.match(ui, /await res\.json\(\) as unknown/);
  assert.doesNotMatch(ui, /payload\.error \|\| payload\.detalhe/);
  assert.doesNotMatch(ui, /error instanceof Error \? error\.message/);
});

test("falha inicial fica explícita e não libera o editor como uma lista vazia", () => {
  assert.match(ui, /const \[listState, setListState\] = useState<"loading" \| "ready" \| "error">/);
  assert.match(ui, /const \[detailState, setDetailState\] = useState<"idle" \| "loading" \| "ready" \| "error">/);
  assert.match(ui, /listState === "error"[\s\S]*Não foi possível carregar o laboratório de IA/);
  assert.match(ui, /detailState === "error"[\s\S]*Não foi possível carregar este agente/);
  assert.ok((ui.match(/Nenhuma configuração foi liberada para edição\./g) ?? []).length >= 2);
});
