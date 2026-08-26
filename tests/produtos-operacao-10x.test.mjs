import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const products = await readFile("app/features/products/ProductsModule.tsx", "utf8");
const detail = await readFile("app/features/products/ProductDetail.tsx", "utf8");
const catalog = await readFile("app/api/catalog/route.ts", "utf8");
const condoApi = await readFile("app/api/condominiums/route.ts", "utf8");
const condoWizard = await readFile("app/features/products/CondominiumWizard.tsx", "utf8");
const detailCss = await readFile("app/styles/produtos-v3-detail.css", "utf8");

test("captador abre dados, fotos e exclusão diretamente do próprio imóvel", () => {
  assert.match(products, /type UnitOpenAction = "view" \| "edit" \| "media" \| "delete"/);
  assert.match(products, /openProduct\(product, "media"\)/);
  assert.match(products, /openProduct\(product, "delete"\)/);
  assert.match(products, />Editar fotos</);
  assert.match(products, />Excluir imóvel</);
  assert.match(detail, /initialUnitAction\?: UnitOpenAction/);
  assert.match(detail, /initialUnitAction === "media"/);
  assert.match(detail, /setUnitMediaEdit\(\{ \.\.\.focusedUnit \}\)/);
  assert.match(detail, /initialUnitAction === "delete"/);
  assert.match(detail, /setConfirmDeleteUnit\(focusedUnit\)/);
});

test("unidade do captador continua visível mesmo quando a referência está pendente", () => {
  assert.match(catalog, /unitMine/);
  assert.match(catalog, /p\.approval === "aprovado" \|\| p\.mine/);
  assert.match(catalog, /u\.captador_corretor_id === currentBrokerId/);
});

test("condomínios reais vêm da tabela de referências e não de produtos improvisados", () => {
  assert.match(catalog, /from\("condominios"\)/);
  assert.match(catalog, /condominiums:/);
  assert.match(products, /type CondominiumSummary/);
  assert.match(products, /setCondominiums\(result\.condominiums \?\? \[\]\)/);
  assert.doesNotMatch(products, /const condominiumProducts = referenceProducts\.filter/);
});

test("cadastro de condomínio é separado do cadastro de empreendimento", () => {
  assert.match(products, /<CondominiumWizard/);
  assert.match(products, /registrationChoice === "condominio"/);
  assert.match(products, /setCondominiumOpen\(true\)/);
  assert.match(products, /registrationChoice === "empreendimento"/);
  assert.match(products, /setCaptureOpen\(true\)/);
  assert.match(condoWizard, /Condomínio é referência, não é imóvel à venda/);
  assert.match(condoApi, /created_by: authData\.user\.id/);
});

test("ficha e galeria ficam acima do cabeçalho móvel", () => {
  assert.match(detailCss, /product-detail-layer:has\(\.pv3-detail\)[^{]*\{[^}]*z-index:\s*80/s);
});
