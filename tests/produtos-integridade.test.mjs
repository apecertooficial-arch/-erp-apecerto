import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = await readFile("app/api/catalog/route.ts", "utf8");
const productApi = await readFile("app/api/product/route.ts", "utf8");
const productsUi = await readFile("app/features/products/ProductsModule.tsx", "utf8");
const unitWizard = await readFile("app/features/products/UnitWizard.tsx", "utf8");
const captureWizard = await readFile("app/features/products/CaptureWizard.tsx", "utf8");
const detail = await readFile("app/features/products/ProductDetail.tsx", "utf8");
const migration = await readFile("supabase/migrations/20260820153819_produtos_fluxo_seguro_site_unidades.sql", "utf8");

test("catálogo separa contagem de empreendimentos e imóveis", () => {
  assert.match(catalog, /buildingCount: visible\.length/);
  assert.match(productsUi, /\{buildingCount\} empreendimentos · \{products\.length\} imóveis/);
  assert.match(productsUi, /`\$\{produtosVisiveis\.length\} imóveis`/);
});

test("apartamento é a captação principal e condomínio tem fluxo separado", () => {
  assert.ok(productsUi.includes('<button className="primary-action" onClick={() => setUnitWizardOpen(true)} type="button">＋ Cadastrar apartamento</button>'));
  assert.ok(productsUi.includes('<button className="secondary-action" onClick={() => setCaptureOpen(true)} type="button">＋ Cadastrar condomínio</button>'));
  assert.match(unitWizard, /Associe o apartamento captado a um condomínio ou prédio já existente/);
  assert.match(unitWizard, /onCreateCondominium/);
  assert.match(captureWizard, /Só quer cadastrar um apartamento\?/);
});

test("fila de aprovação abre completa e filtros avançados ficam recolhidos", () => {
  assert.match(productsUi, /Fila de aprovação/);
  assert.match(productsUi, /function showApprovalQueue\(\)[\s\S]*setStatus\("Todos"\)[\s\S]*setPuExpandida\(true\)/);
  assert.match(productsUi, /Mais filtros/);
  assert.match(productsUi, /moreFiltersOpen && <div className="filter-row filter-advanced"/);
});

test("unidade pronta usa captador, menu e mídia próprios", () => {
  assert.match(catalog, /capturedBy: corretorNameById\.get\(u\.captador_corretor_id/);
  assert.match(catalog, /media: buildingMediaCount \+ allProductMedia\.filter/);
  assert.match(productsUi, /product\.unitId \?\? product\.id/);
  assert.match(productsUi, /Editar unidade/);
});

test("revisão abre a unidade como produto completo e não deixa o condomínio por baixo", () => {
  assert.match(detail, /const focusedUnit = useMemo/);
  assert.match(detail, /VALOR DESTA UNIDADE/);
  assert.match(detail, /focusedUnitPrice/);
  assert.match(detail, /Este apartamento é um produto independente/);
  assert.match(detail, /Condomínio de referência/);
  assert.doesNotMatch(detail, /initialOpened/);
});

test("edição do prédio nunca altera indicação individual", () => {
  assert.match(detail, /next\.unidades\.filter\(\(unit\) => !unit\.de_terceiros\)/);
  assert.match(productApi, /Indicações de corretores devem ser editadas pela ficha da própria unidade/);
  assert.match(productApi, /\.eq\("de_terceiros", false\)/);
});

test("migração bloqueia unidade pendente e dados privados no acesso anônimo", () => {
  assert.match(migration, /disponivel\s+and aprovacao = 'aprovado'/);
  assert.match(migration, /revoke all privileges on public\.unidades from anon/);
  assert.match(migration, /revoke all privileges on public\.empreendimentos from anon/);
  assert.match(migration, /revoke all privileges on public\.midias from anon/);
  assert.match(migration, /revoke all on function public\.aprovar_empreendimento\(uuid, boolean, text\) from anon/);
  assert.doesNotMatch(
    migration.match(/grant select \([\s\S]*?\) on public\.unidades to anon;/)?.[0] ?? "",
    /proprietario|acesso_/,
  );
});
