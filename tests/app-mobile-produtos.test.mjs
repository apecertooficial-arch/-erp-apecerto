import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tela = readFileSync(new URL("../app/features/products/ProductsModule.tsx", import.meta.url), "utf8");

test("Produtos mobile usa catálogo real sem fallback", () => {
  assert.match(tela, /fetch\("\/api\/catalog"/);
  assert.match(tela, /useState<Product\[]>\(\[\]\)/);
  assert.doesNotMatch(tela, /fallbackProducts|products as fallback/);
});

test("card omite dados que não existem em vez de inventar", () => {
  assert.match(tela, /product\.bedrooms > 0/);
  assert.match(tela, /product\.area > 0/);
  assert.match(tela, /product\.parking > 0/);
  assert.doesNotMatch(tela, /bathrooms|banheiros/);
});

test("Produtos mobile tem estados e filtros do protótipo", () => {
  for (const trecho of ["Pronto pra morar", "Obras", "Lançamento", "Favoritos", "ape-produto-esqueleto", "Nenhum produto encontrado", "Tentar novamente", "AppMobileOffline", "AppMobileSessaoExpirada"]) {
    assert.ok(tela.includes(trecho), `faltou ${trecho}`);
  }
});
