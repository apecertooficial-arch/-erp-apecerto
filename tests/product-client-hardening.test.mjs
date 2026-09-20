import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ProductClientError,
  productFailureMessage,
  productResponse,
  productSuccessMessage,
} from "../app/features/products/product-client.ts";

const detail = await readFile("app/features/products/ProductDetail.tsx", "utf8");
const moduleSource = await readFile("app/features/products/ProductsModule.tsx", "utf8");
const unitWizard = await readFile("app/features/products/UnitWizard.tsx", "utf8");

test("cliente rejeita JSON inválido e não mostra falha técnica arbitrária", async () => {
  await assert.rejects(
    () => productResponse(new Response("gateway", { status: 502 }), "Falha operacional."),
    (error) => error instanceof ProductClientError && error.message === "Falha operacional.",
  );
  await assert.rejects(
    () => productResponse(new Response(JSON.stringify({ error: "SQL connection refused" }), { status: 502 }), "Falha operacional."),
    (error) => error instanceof ProductClientError && error.message === "Falha operacional.",
  );
});

test("cliente preserva regra de negócio e traduz reconciliação", async () => {
  await assert.rejects(
    () => productResponse(new Response(JSON.stringify({ error: "Preço inválido." }), { status: 422 }), "Falha operacional."),
    (error) => error instanceof ProductClientError && error.message === "Preço inválido.",
  );
  const result = await productResponse(new Response(JSON.stringify({ success: true, code: "RECONCILIATION_REQUIRED" }), { status: 200 }), "Falha operacional.");
  assert.match(productSuccessMessage(result, "Concluído."), /aplicada apenas em parte/i);
  assert.equal(productFailureMessage(new Error("token interno"), "Falha operacional."), "Falha operacional.");
});

test("ficha usa o parser seguro em toda resposta de Produto", () => {
  assert.match(detail, /from "\.\/product-client"/);
  assert.doesNotMatch(detail, /const (?:result|data) = await response\.json\(/);
  assert.match(detail, /productSuccessMessage\(result/);
  assert.match(detail, /productFailureMessage\(error/);
});

test("ações do catálogo não exibem payload arbitrário", () => {
  assert.match(moduleSource, /from "\.\/product-client"/);
  const mutationBlock = moduleSource.slice(moduleSource.indexOf("const decideUnitFromList"), moduleSource.indexOf("useEffect(() => {\n    publicarBadge"));
  assert.doesNotMatch(mutationBlock, /response\.json\(/);
  assert.match(mutationBlock, /productResponse\(response/);
  assert.match(mutationBlock, /productFailureMessage\(/);
});

test("cadastro de unidade confirma API e persistência da mídia", () => {
  assert.match(unitWizard, /from "\.\/product-client"/);
  assert.doesNotMatch(unitWizard, /response\.json\(/);
  assert.doesNotMatch(unitWizard, /mediaError\.message/);
  assert.match(unitWizard, /productResponse\(response/);
  assert.match(unitWizard, /\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(unitWizard, /if \(mediaError \|\| !savedMedia\)/);
});
