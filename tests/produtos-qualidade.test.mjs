import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessProductQuality,
  productPricePerSquareMeterBounds,
  validateProductPricePerSquareMeter,
} from "../app/features/products/quality.ts";

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

test("preço por m² incompatível bloqueia um imóvel mesmo com nota alta", () => {
  const saleBounds = productPricePerSquareMeterBounds("venda");
  assert.deepEqual(saleBounds, { min: 3_000, max: 100_000, rental: false });

  const ap0342 = validateProductPricePerSquareMeter(850_000, 850, "AP0342", "venda");
  assert.equal(ap0342.value, 1_000);
  assert.equal(ap0342.plausible, false);
  assert.equal(ap0342.direction, "below");
  assert.match(ap0342.error ?? "", /AP0342: R\$ 1\.000\/m² está abaixo/);
  assert.match(ap0342.error ?? "", /R\$ 3\.000\/m² a R\$ 100\.000\/m²/);

  const completeProduct = {
    name: "AP0342",
    title: "Apartamento pronto para morar em Moema",
    slogan: "Conforto e localização em uma visita",
    description: "Apartamento muito bem localizado, com ambientes iluminados, planta funcional, acabamentos de qualidade e acesso simples aos principais serviços do bairro.",
    purpose: "venda",
    price: 850_000,
    area: 850,
    bedrooms: 2,
    bathrooms: 2,
    parking: 1,
    address: "Avenida Pavão",
    number: "342",
    neighborhood: "Moema",
    city: "São Paulo",
    state: "SP",
    zip: "04516-000",
    condominiumFee: 0,
    propertyTax: 0,
    otherCosts: 0,
    photos: 10,
    videos: 1,
    hasCover: true,
    mediaCategories: ["sala", "cozinha", "quarto", "banheiro", "fachada"],
    units: 1,
    availableUnits: 1,
    unitsWithValidPrice: 1,
    amenities: ["academia"],
    differentiators: ["próximo ao metrô"],
  };
  const quality = assessProductQuality(completeProduct);
  assert.ok(quality.score >= 90, "a inconsistência deve bloquear mesmo quando o restante do cadastro é excelente");
  assert.equal(quality.readyForSite, false);
  assert.match(quality.blocking.join("\n"), /Imóvel: R\$ 1\.000\/m²/);

  const corrected = assessProductQuality({ ...completeProduct, area: 50 });
  assert.equal(corrected.readyForSite, true);
  assert.doesNotMatch(corrected.blocking.join("\n"), /faixa plausível/);
});

test("limites de preço por m² continuam inclusivos para venda e aluguel", () => {
  assert.equal(validateProductPricePerSquareMeter(300_000, 100, "Venda", "venda").plausible, true);
  assert.equal(validateProductPricePerSquareMeter(10_000_000, 100, "Venda", "venda").plausible, true);
  assert.equal(validateProductPricePerSquareMeter(1_000, 100, "Aluguel", "aluguel").plausible, true);
  assert.equal(validateProductPricePerSquareMeter(500, 100, "Aluguel", "aluguel").direction, "below");
});

test("banco recalcula valor por m² e corrige AP0342 com auditoria idempotente", () => {
  const migration = read("supabase/migrations/20260821211800_unidades_valor_m2_consistente.sql");
  assert.match(migration, /create or replace function private\.produto_valor_m2_plausivel/);
  assert.match(migration, /p_preco \/ p_area between 3000 and 100000/);
  assert.match(migration, /p_preco \/ p_area between 10 and 2000/);
  assert.match(migration, /private\.produto_valor_m2_plausivel\([\s\S]*?\) is true/);
  assert.match(migration, /UNIT_PRICE_M2_INVALID/);
  assert.match(migration, /create trigger trg_unidades_bloquear_valor_m2_incompativel/);
  assert.match(migration, /create trigger trg_unidades_recalcular_valor_m2/);
  assert.match(migration, /before insert or update of area_m2, valor_tabela, valor_promo, valor_m2/);
  assert.match(migration, /new\.valor_m2 := round\(v_preco \/ new\.area_m2, 2\)/);
  assert.match(migration, /where e\.codigo = 'AP0062'[\s\S]*?for update/);
  assert.match(migration, /where u\.empreendimento_id = v_empreendimento_id[\s\S]*?and u\.codigo = 'AP0342'[\s\S]*?for update/);
  assert.doesNotMatch(migration, /d81e92b7-408f-418c-9c05-d68a0da17989|714f7986-11e9-4836-9d6b-dd061f885366/);
  assert.match(migration, /set area_m2 = 73/);
  assert.match(migration, /AP0342_UNEXPECTED_STATE/);
  assert.match(migration, /insert into public\.erp_auditoria/);
  assert.match(migration, /'corrigir_dado'/);
});

test("aprovação individual também bloqueia preço por m² incoerente", () => {
  const route = read("app/api/product/route.ts");
  assert.match(route, /validateProductPricePerSquareMeter\(/);
  assert.match(route, /if \(pricePerSquareMeter\.error\) blocking\.push\(pricePerSquareMeter\.error\)/);
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
  assert.match(detail, /sitePropertyUrl/);
  assert.doesNotMatch(detail, /\?imovel=/);
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
