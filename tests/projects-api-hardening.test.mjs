import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/projects/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/projects/ProjectsWorkspace.tsx", import.meta.url), "utf8");

test("Projetos não devolve nem registra detalhes brutos do banco ou da Edge", () => {
  assert.match(route, /function falhaProjetos\(/);
  assert.match(route, /console\.error\("projetos_operacao_falhou", \{\s*operacao,\s*codigo:/);
  assert.doesNotMatch(route, /Response\.json\(\{ error: [^}\n]*\.message/);
  assert.doesNotMatch(route, /IA indisponível:\s*\$\{[^}]*\.message/);
  assert.doesNotMatch(route, /IA não respondeu:\s*\$\{/);
  assert.doesNotMatch(route, /console\.(?:error|warn|log)\([^\n]*(?:message|body|payload|telefone|email|texto)/i);
});

test("autenticação e JSON inválido falham fechados", () => {
  assert.match(route, /status: "auth_error"/);
  assert.match(route, /falhaProjetos\(auth\.error, "autenticar"\)/);
  assert.match(route, /try \{ body = await request\.json\(\)/);
  assert.match(route, /Dados inválidos\./);
});

test("carregamento exige todos os conjuntos usados pela tela", () => {
  assert.match(route, /\[projetos, participantes, colunas, tarefas, comentarios, atividades, usuarios, leads, produtos, vendas, anexos\]\.find/);
  assert.match(route, /falhaProjetos\(error, "carregar_workspace"\)/);
});

test("mutações críticas comprovam linha e estados parciais pedem reconciliação", () => {
  assert.match(route, /function falhaProjetosParcial\(/);
  assert.match(route, /reconciliacao_necessaria/);
  assert.match(route, /Não repita a ação/);
  assert.ok((route.match(/\.select\("id"\)\.maybeSingle\(\)/g) ?? []).length >= 8);
  for (const operacao of [
    "criar_colunas_padrao",
    "substituir_participantes",
    "reordenar_colunas",
    "criar_tarefas_ia",
    "auditar_projeto_criado",
  ]) assert.match(route, new RegExp(`"${operacao}"`));
  assert.match(route, /"projeto_excluido", `Projeto \$\{id\} excluído\.`, null, null/);
});

test("interface trata JSON inválido e preserva estado depois de uma escrita confirmada", () => {
  assert.match(ui, /async function projectsResponse</);
  assert.match(ui, /catch \{ return fetch\(input, init\); \}/);
  assert.match(ui, /A alteração foi salva, mas a atualização da tela falhou\. Não repita a ação/);
  assert.match(ui, /Não foi possível carregar os projetos[\s\S]*Tentar novamente/);
  assert.doesNotMatch(ui, /const result = await response\.json\(\) as ApiData/);
});

test("calendário de projetos abre no mês operacional de São Paulo", () => {
  assert.match(ui, /useState\(\(\) => new Date\(`\$\{hoje\(\)\}T12:00:00`\)\)/);
});
