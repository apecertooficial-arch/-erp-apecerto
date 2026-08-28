import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const products = await readFile("app/features/products/ProductsModule.tsx", "utf8");
const detail = await readFile("app/features/products/ProductDetail.tsx", "utf8");
const catalog = await readFile("app/api/catalog/route.ts", "utf8");
const condoApi = await readFile("app/api/condominiums/route.ts", "utf8");
const condoWizard = await readFile("app/features/products/CondominiumWizard.tsx", "utf8");
const detailCss = await readFile("app/styles/produtos-v3-detail.css", "utf8");
const qualityQueue = await readFile("app/features/products/ProductQualityQueue.tsx", "utf8");
const publicContract = await readFile("supabase/migrations/20260828113000_produtos_contrato_publico_privado.sql", "utf8");

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

test("corretor recebe próxima melhor ação explicável e ligada ao campo correto", () => {
  assert.match(detail, /Próxima melhor ação/);
  assert.match(detail, /severity: "Bloqueador"/);
  assert.match(detail, /Confirmar o preço completo/);
  assert.match(detail, /Fotos do condomínio não substituem as fotos do imóvel/);
  assert.match(detail, /openRecommendation/);
  assert.match(detail, /setTab\("galeria"\)/);
  assert.match(detail, /Identidade pública protegida/);
});

test("gestor tem central única com risco, bloqueios, tempo e decisões", () => {
  assert.match(products, /Central de decisões/);
  assert.match(products, /Risco comercial imediato/);
  assert.match(products, /Sem revisão há 30\+ dias/);
  assert.match(products, /Devolver com motivo/);
  assert.match(products, />Aprovar</);
  assert.match(qualityQueue, /Severidade/);
  assert.match(qualityQueue, /Responsável/);
  assert.match(qualityQueue, /Tipo de estoque/);
  assert.match(qualityQueue, /Parado há/);
});

test("contrato público remove identidade interna, ponto exato e paths de mídia", () => {
  assert.match(publicContract, /site_identidade_publica/);
  assert.match(publicContract, /site_logradouro_publico/);
  assert.match(publicContract, /null::numeric\(9,6\) as latitude/);
  assert.match(publicContract, /'imovel-' \|\| u\.id::text/);
  assert.match(publicContract, /site_midia_token/);
  assert.match(publicContract, /security_invoker = true/);
  assert.match(publicContract, /site_produto_resolver_slug_legado/);
});
