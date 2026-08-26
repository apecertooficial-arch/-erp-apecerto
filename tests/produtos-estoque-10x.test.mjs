import assert from "node:assert/strict";
import test from "node:test";

import {
  filterQualityQueue,
  qualityRepairAction,
  summarizeInventory,
} from "../app/features/products/product-domain.ts";
import { nextProductMediaRetryUrl } from "../app/features/products/media-image.ts";
import { isPlausibleProductPrice } from "../app/features/products/quality.ts";

test("resumo do estoque explica sem ambiguidade cada unidade", () => {
  assert.deepEqual(summarizeInventory({
    totalUnits: 288,
    approvedAvailable: 269,
    catalogUnits: 157,
    publishedUnits: 71,
    qualityBlocked: 228,
    unavailableUnits: 19,
  }), {
    totalUnits: 288,
    approvedAvailable: 269,
    catalogUnits: 157,
    publishedUnits: 71,
    catalogOffline: 86,
    outsideCommercialCatalog: 112,
    qualityBlocked: 228,
    unavailableUnits: 19,
  });
});

test("resumo do estoque nunca produz contagem negativa", () => {
  assert.equal(summarizeInventory({
    totalUnits: 2,
    approvedAvailable: 1,
    catalogUnits: 2,
    publishedUnits: 3,
    qualityBlocked: 0,
    unavailableUnits: 0,
  }).catalogOffline, 0);
});

test("fila de qualidade pesquisa código, produto, unidade e problema", () => {
  const items = [
    { unitId: "u1", productId: "p1", codigo: "AP0356", numero: "1204", productName: "Club Line", segment: "terceiros", issues: ["sem_foto_propria"] },
    { unitId: "u2", productId: "p2", codigo: "AP0271", numero: "804", productName: "Vista Parque", segment: "remanescente", issues: ["preco_invalido"] },
  ];
  assert.deepEqual(filterQualityQueue(items, "club", "todos").map((item) => item.unitId), ["u1"]);
  assert.deepEqual(filterQualityQueue(items, "804", "todos").map((item) => item.unitId), ["u2"]);
  assert.deepEqual(filterQualityQueue(items, "", "preco_invalido").map((item) => item.unitId), ["u2"]);
});

test("fila abre diretamente o conserto correspondente", () => {
  assert.equal(qualityRepairAction(["sem_foto_propria"]), "media");
  assert.equal(qualityRepairAction(["preco_invalido"]), "edit");
  assert.equal(qualityRepairAction(["sem_condominio_referencia"]), "edit");
  assert.equal(qualityRepairAction(["sem_proprietario"]), "view");
});

test("preço de venda absurdo permanece bloqueado e não parece válido", () => {
  assert.equal(isPlausibleProductPrice(260, "Venda"), false);
  assert.equal(isPlausibleProductPrice(750_000, "Venda"), true);
});

test("imagem com falha recebe uma única tentativa sem perder a URL original", () => {
  const first = nextProductMediaRetryUrl("https://cdn.example/imovel/foto.jpg?x=1", 123);
  assert.equal(first, "https://cdn.example/imovel/foto.jpg?x=1&erp_retry=123");
  assert.equal(nextProductMediaRetryUrl(first, 456), null);
});
