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
  assert.match(quality, /RENT_PRICE_MIN = 500/);
  assert.match(quality, /productPriceBounds/);
  assert.match(quality, /raw\.replace\(\/\\\.\/g, ""\)/);
  assert.match(capture, /validateProductPrice/);
});

test("imóvel avulso não valida a unidade vazia escondida como preço zero", () => {
  const wizard = read("app/features/products/CaptureWizard.tsx");
  const capture = read("app/api/capture/route.ts");
  assert.match(wizard, /units: propertyType === "construtora" \? units\.map/);
  assert.match(wizard, /: \[\],/);
  const unitValidation = capture.match(/if \(payload\.propertyType === "construtora"\) \{[\s\S]*?\/\/ Evita imóveis repetidos/)?.[0] ?? "";
  assert.match(unitValidation, /for \(const unit of units\)/);
  assert.match(unitValidation, /Preço da unidade/);
  assert.doesNotMatch(capture.match(/const propertyPriceCheck[\s\S]*?if \(payload\.propertyType === "construtora"\)/)?.[0] ?? "", /for \(const unit of units\)/);
});

test("nota pode chegar a 100 e publicação reflete a view pública", () => {
  const quality = read("app/features/products/quality.ts");
  const catalog = read("app/api/catalog/route.ts");
  const product = read("app/api/product/route.ts");
  const publication = read("app/features/products/publication.ts");
  const detail = read("app/features/products/ProductDetail.tsx");
  assert.match(quality, /cadastro \+= 5/);
  assert.match(quality, /cadastro \+= 3/);
  assert.match(quality, /cadastro \+= 4/);
  assert.match(catalog, /isProductPublishedOnSite/);
  assert.match(product, /isProductPublishedOnSite/);
  assert.match(publication, /status\?\.trim\(\)\.toLowerCase\(\) !== "pronto"/);
  assert.match(publication, /availableApprovedUnits > 0/);
  assert.match(detail, /site_published/);
});

test("ERP e site compartilham título, tour e link direto do imóvel", () => {
  const detail = read("app/features/products/ProductDetail.tsx");
  const migration = read("supabase/migrations/20260818130000_produtos_site_conectados.sql");
  assert.match(detail, /\?imovel=/);
  assert.match(migration, /e\.titulo/);
  assert.match(migration, /e\.tour_url/);
  assert.match(migration, /security_invoker = true/);
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
  assert.match(processor, /logo-apecerto-branco\.png/);
  assert.doesNotMatch(css, /apêcerto<\/text>/);
  assert.match(processor, /canvas\.toBlob/);
  assert.match(wizard, /applyOfficialWatermark/);
});
