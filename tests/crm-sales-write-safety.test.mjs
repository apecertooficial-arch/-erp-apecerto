import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync(new URL("../app/api/crm/sales/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/sales/SalesProcessWorkspace.tsx", import.meta.url), "utf8");
const harness = readFileSync(new URL("./crm-visual-harness/main.tsx", import.meta.url), "utf8");

test("observação comprova acesso ao processo antes de inserir", () => {
  const comando = api.match(/if \(action === "addObs"\)[\s\S]*?return error \?/)?.[0] ?? "";
  assert.match(comando, /from\("venda_processos"\)\.select\("id"\)\.eq\("id", processId\)\.maybeSingle\(\)/);
  assert.match(comando, /if \(processoError\) return falhaEsteira\(processoError, "autorizar_observacao"\)/);
  assert.match(comando, /if \(!processo\) return Response\.json\(\{ error: "Venda não encontrada ou sem acesso\." \}, \{ status: 404 \}\)/);

  const autorizacao = comando.indexOf('from("venda_processos")');
  const escrita = comando.indexOf('from("venda_observacoes").insert');
  assert.ok(autorizacao >= 0 && escrita > autorizacao, "a autorização deve anteceder a escrita");
});

test("movimentação usa revisão otimista e comprova a linha alterada", () => {
  const move = api.match(/if \(action === "move"\)[\s\S]*?if \(action === "addAnexo"/)?.[0] ?? "";
  assert.match(move, /\.update\(update\)\.eq\("id", processId\)\.eq\("etapa", ctx\.proc\.etapa\)\.select\("id,etapa"\)\.maybeSingle\(\)/);
  assert.match(move, /if \(!movido\) return Response\.json\(\{ error: "Esta venda mudou de etapa enquanto você trabalhava\. Recarregue e tente novamente\." \}, \{ status: 409 \}\)/);
  assert.match(move, /return Response\.json\(\{ success: true, stage: movido\.etapa \}\)/);
});

test("Esteira rejeita carga parcial em vez de publicar falso vazio", () => {
  assert.match(ui, /const payloadVendasValido = \(result: unknown\)/);
  assert.match(ui, /if \(!response\.ok \|\| !payloadVendasValido\(result\)\) throw new Error\(/);
  assert.match(ui, /Não foi possível confirmar os dados da Esteira/);
  assert.match(harness, /SalesProcessView/);
  assert.match(harness, /salesPayload/);
});

test("criação de venda só fecha o modal após confirmação explícita", () => {
  assert.match(ui, /if \(!response\.ok \|\| result\.success !== true\) throw new Error\(result\.error \|\| "A Esteira não confirmou a criação da venda\."\)/);
  assert.match(harness, /salesCreate/);
});
