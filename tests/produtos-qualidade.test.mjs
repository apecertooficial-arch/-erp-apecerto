import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("qualidade é uma regra compartilhada por catálogo, ficha e aprovação", () => {
  const catalog = read("app/api/catalog/route.ts");
  const product = read("app/api/product/route.ts");
  const capture = read("app/api/capture/route.ts");
  for (const source of [catalog, product, capture]) assert.match(source, /assessProductQuality/);
  assert.match(product, /PRODUCT_NOT_READY/);
  assert.match(capture, /PRODUCT_NOT_READY/);
});

test("preço em milhares tem confirmação visual e validação também no servidor", () => {
  const moneyInput = read("app/features/products/MoneyInput.tsx");
  const quality = read("app/features/products/quality.ts");
  const capture = read("app/api/capture/route.ts");
  assert.match(moneyInput, /Em milhares/);
  assert.match(moneyInput, /O imóvel será salvo por/);
  assert.match(quality, /PRODUCT_PRICE_MIN = 100_000/);
  assert.match(capture, /validateProductPrice/);
});

test("cadastro profissional alimenta os campos comerciais já usados pelo site", () => {
  const wizard = read("app/features/products/CaptureWizard.tsx");
  const product = read("app/api/product/route.ts");
  for (const field of ["titulo", "slogan", "finalidade", "lazer", "diferenciais"]) {
    assert.match(product, new RegExp(field));
  }
  assert.match(wizard, /Descrição comercial/);
  assert.match(wizard, /Diferenciais/);
});

test("marca d'água usa o logotipo oficial, sem SVG textual improvisado", () => {
  const css = read("app/globals.css");
  const processor = read("app/features/products/watermark.ts");
  const wizard = read("app/features/products/CaptureWizard.tsx");
  assert.match(css, /logo-apecerto-branco\.png/);
  assert.doesNotMatch(css, /apêcerto<\/text>/);
  assert.match(processor, /canvas\.toBlob/);
  assert.match(wizard, /applyOfficialWatermark/);
});
