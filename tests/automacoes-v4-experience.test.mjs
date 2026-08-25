import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const central = readFileSync(
  new URL("../app/features/automations/AutomationsCentralCloudV4.tsx", import.meta.url),
  "utf8",
);
const flowBuilder = readFileSync(
  new URL("../app/features/automations/AutomationFlowBuilderV4.tsx", import.meta.url),
  "utf8",
);
const flowModel = readFileSync(
  new URL("../app/features/automations/automationFlowModel.ts", import.meta.url),
  "utf8",
);
const builder = readFileSync(new URL("../app/features/automations/AutomationsWorkspace.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/(erp)/automacoes/page.tsx", import.meta.url), "utf8");

test("a Central V4 expõe as áreas operacionais essenciais", () => {
  for (const label of [
    "Visão geral",
    "Minhas automações",
    "Gatilhos",
    "Execuções",
    "Exceções",
  ]) {
    assert.match(central, new RegExp(label));
  }
  assert.match(central, /placeholder="Buscar"/);
});

test("a experiência usa dados reais sem voltar para a interface antiga", () => {
  assert.match(central, /automacao_versoes/);
  assert.match(central, /motor_execucoes/);
  assert.match(flowBuilder, /automacao_publicar/);
  assert.match(flowBuilder, /mapa_rascunho/);
  assert.doesNotMatch(central, /AutomationBuilderWorkspace/);
  assert.doesNotMatch(central, /Fila pendente\s*3|v123/);
});

test("as ações administrativas não são apenas decorativas", () => {
  for (const handler of [
    "duplicarAutomacao",
    "arquivarAutomacao",
    "excluirAutomacao",
    "exportarAutomacao",
  ]) {
    assert.match(central, new RegExp(handler));
  }
});

test("o layout carrega a camada visual isolada da Central V4", () => {
  assert.match(layout, /central-automacoes-v4\.css/);
  assert.match(layout, /central-automacoes-cloud-v4\.css/);
  assert.match(page, /AutomationsCentralCloudV4/);
});

test("o construtor fiel contempla modos, biblioteca e publicação segura", () => {
  for (const label of ["Construir", "Testar", "Comparar", "Acompanhar", "Resolver", "Validar", "Publicar"]) {
    assert.match(flowBuilder, new RegExp(label));
  }
  assert.match(flowBuilder, /10 tipos publicáveis/);
  assert.match(flowBuilder, /NENHUM DADO SERÁ ALTERADO/);
  assert.doesNotMatch(flowBuilder, /automationBuilderRuntime/);
});

test("atalhos da Central entram em funções reais do runtime", () => {
  assert.match(builder, /#btnAddAutomation/);
  assert.match(builder, /#btnEscritorio/);
  assert.match(builder, /\[data-addgrp\]/);
  assert.match(builder, /\.sb-item\[data-id=/);
});

test("a Home reconhece o formato real dos gatilhos salvos pelo runtime", () => {
  assert.match(flowModel, /item\.type === "trigger"/);
  assert.match(flowModel, /options\?\.triggers/);
  for (const trigger of ["lead-distribuido-trigger", "lead-mensagem-recebida-trigger", "retomar-na-data-trigger", "checagem-diaria-trigger"]) {
    assert.match(flowModel, new RegExp(trigger));
  }
});
