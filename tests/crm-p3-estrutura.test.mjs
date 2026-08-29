import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../app/styles/funil.css");
const identidade = read("../app/styles/apecerto-identidade.css");
const inicio = "CRM_CANONICAL_ACTIVE_START";
const fim = "CRM_CANONICAL_ACTIVE_END";
const blocoAtivo = css.split(inicio)[1]?.split(fim)[0] ?? "";

test("bloco canônico do CRM é delimitado e não contém cor crua ativa", () => {
  assert.ok(blocoAtivo.length > 1_000, "o bloco ativo precisa estar explicitamente delimitado");
  assert.doesNotMatch(blocoAtivo, /#[\da-f]{3,8}\b|rgba?\(/i);
});

test("todo token referenciado pelo CRM ativo existe na identidade oficial", () => {
  const referencias = new Set([...blocoAtivo.matchAll(/var\((--[\w-]+)/g)].map((resultado) => resultado[1]));
  const declarados = new Set([...identidade.matchAll(/(--[\w-]+)\s*:/g)].map((resultado) => resultado[1]));
  const ausentes = [...referencias].filter((token) => !declarados.has(token)).sort();
  assert.deepEqual(ausentes, []);
});

test("extração P3 não introduz regra ativa exatamente duplicada", () => {
  const regras = [...blocoAtivo.matchAll(/([^{}@][^{}]*)\{([^{}]*)\}/g)]
    .map((resultado) => `${resultado[1].trim()}{${resultado[2].replace(/\s+/g, "")}}`)
    .filter(Boolean);
  const repetidas = [...new Set(regras.filter((regra, indice) => regras.indexOf(regra) !== indice))];
  assert.deepEqual(repetidas, []);
});

test("harness visual continua fora do bundle produtivo do Funil", () => {
  const fontesProdutivas = [
    "../app/features/funil-2/Funil2Workspace.tsx",
    "../app/features/funil-2/Funil2Mobile.tsx",
    "../app/features/funil-2/Funil2BoardToolbar.tsx",
    "../app/features/funil-2/Funil2BoardPrimitives.tsx",
    "../app/features/funil-2/Funil2MobileChrome.tsx",
  ].map(read).join("\n");
  assert.doesNotMatch(fontesProdutivas, /crm-visual-harness|visual-sintetico|crmHarness/);
});

test("responsabilidades extraídas preservam semântica operacional", () => {
  const toolbar = read("../app/features/funil-2/Funil2BoardToolbar.tsx");
  const primitivas = read("../app/features/funil-2/Funil2BoardPrimitives.tsx");
  const chromeMobile = read("../app/features/funil-2/Funil2MobileChrome.tsx");
  assert.match(toolbar, /aria-label="Busca, filtros e ações do quadro"/);
  assert.match(toolbar, /role="group" aria-label="Situação dos negócios"/);
  assert.match(primitivas, /role="group" aria-label="Filtrar por temperatura"/);
  assert.match(chromeMobile, /aria-label="Navegação do Funil"/);
  assert.match(chromeMobile, /aria-label="Carregando"/);
});
