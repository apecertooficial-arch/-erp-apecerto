import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = await readFile("app/api/catalog/route.ts", "utf8");
const productApi = await readFile("app/api/product/route.ts", "utf8");
const captureApi = await readFile("app/api/capture/route.ts", "utf8");
const productsUi = await readFile("app/features/products/ProductsModule.tsx", "utf8");
const unitWizard = await readFile("app/features/products/UnitWizard.tsx", "utf8");
const captureWizard = await readFile("app/features/products/CaptureWizard.tsx", "utf8");
const detail = await readFile("app/features/products/ProductDetail.tsx", "utf8");
const productsModel = await readFile("app/features/products/products.ts", "utf8");
const globalCss = await readFile("app/globals.css", "utf8");
const migration = await readFile("supabase/migrations/20260820153819_produtos_fluxo_seguro_site_unidades.sql", "utf8");
const unpublishMigration = await readFile("supabase/migrations/20260820193000_produtos_despublicacao_individual.sql", "utf8");
const unitMediaMigration = await readFile("supabase/migrations/20260820220000_captador_exclui_midia_da_propria_unidade.sql", "utf8");
const captorIntegrityMigration = await readFile("supabase/migrations/20260820223000_produtos_captador_unidade_obrigatorio.sql", "utf8");

test("catálogo separa contagem de empreendimentos e imóveis", () => {
  assert.match(catalog, /buildingCount: visible\.filter\(\(product\) => !product\.standalone\)\.length/);
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

test("apartamento pode ser cadastrado sem associação falsa a condomínio", () => {
  assert.match(unitWizard, /Cadastrar imóvel sem condomínio/);
  assert.match(unitWizard, /onCreateStandalone/);
  assert.match(captureWizard, /initialStandalone/);
  assert.match(captureWizard, /Nenhum condomínio ou prédio será criado automaticamente/);
  assert.match(captureWizard, /unidade_id: standalone \? created\.unidadeId : null/);
  assert.match(catalog, /standalone = item\.origem === "terceiros" && !item\.condominio_id/);
  assert.match(catalog, /if \(p\.standalone\)/);
  assert.match(productApi, /definePublication\(true, unidadeId\)/);
  assert.match(productApi, /produto_definir_publicacao/);
});

test("fila de aprovação abre completa e filtros avançados ficam recolhidos", () => {
  assert.match(productsUi, /Fila de aprovação/);
  assert.match(productsUi, /function showApprovalQueue\(\)[\s\S]*setStatus\("Todos"\)[\s\S]*setPuExpandida\(true\)/);
  assert.match(productsUi, /Mais filtros/);
  assert.match(productsUi, /moreFiltersOpen && <div className="filter-row filter-advanced"/);
});

test("unidade pronta usa captador, menu e mídia próprios", () => {
  assert.match(catalog, /capturedBy: corretorNameById\.get\(u\.captador_corretor_id/);
  assert.match(catalog, /media: buildingMediaCount \+ unitMediaCount/);
  assert.match(catalog, /unitMedia: unitMediaCount/);
  assert.match(catalog, /referenceMedia: buildingMediaCount/);
  assert.match(productsUi, /product\.unitId \?\? product\.id/);
  assert.match(productsUi, /Editar unidade/);
});

test("foto herdada do condomínio abre sem fingir que pertence à unidade", () => {
  assert.match(detail, /focusedUnitUsesReferencePhotos/);
  assert.match(detail, /Fotos do condomínio de referência/);
  assert.match(detail, /Ver \$\{focusedUnitPhotos\.length\} foto/);
  assert.match(productsUi, /do condomínio/);
  assert.match(detail, /setUnitLightbox/);
});

test("setas da galeria ampliada permanecem centralizadas ao lado da foto", () => {
  assert.match(globalCss, /\.lightbox-nav\s*\{[^}]*grid-row:1;[^}]*align-self:center;/);
  assert.match(globalCss, /\.lightbox-nav\.previous\s*\{\s*grid-column:1;/);
  assert.match(globalCss, /\.lightbox-nav\.next\s*\{\s*grid-column:3;/);
});

test("revisão abre a unidade como produto completo e não deixa o condomínio por baixo", () => {
  assert.match(detail, /const focusedUnit = useMemo/);
  assert.match(detail, /VALOR DESTA UNIDADE/);
  assert.match(detail, /focusedUnitPrice/);
  assert.match(detail, /Este imóvel é um produto independente/);
  assert.match(detail, /Condomínio de referência/);
  assert.doesNotMatch(detail, /initialOpened/);
});

test("corretor vê todas as fotos e dados operacionais, mas não o proprietário alheio", () => {
  assert.match(productApi, /midias: media/);
  assert.doesNotMatch(productApi, /const visibleMedia = media\.filter/);
  assert.match(productApi, /proprietarios: null, proprietario_nome: null, proprietario_tel: null, proprietario_email: null/);
  assert.match(productApi, /proprietario_nome: null, proprietario_contato: null/);
  assert.doesNotMatch(productApi, /proprietario_contato: null, acesso_tipo: null/);
  assert.doesNotMatch(productApi, /proprietario_email: null, acesso_tipo: null/);
});

test("imóvel pode sair do site sem perder aprovação ou disponibilidade", () => {
  assert.match(productsUi, /Tirar imóvel do ar/);
  assert.match(productsUi, /publishUnit/);
  assert.match(detail, /Tirar imóvel do ar/);
  assert.match(detail, /O cadastro, a aprovação e a disponibilidade foram mantidos/);
  assert.match(productApi, /body\.action === "publishUnit" \|\| body\.action === "unpublishUnit"/);
  assert.match(productApi, /definePublication\(publish, unidadeId\)/);
  assert.match(productApi, /definePublication\(false\)/);
  assert.doesNotMatch(productApi, /update\(\{ rascunho: true, publicado: false \}\)/);
  assert.doesNotMatch(productApi, /async function auditPublication/);
});

test("publicação individual não tira outras unidades do mesmo condomínio do ar", () => {
  assert.match(catalog, /publicado: boolean/);
  assert.match(catalog, /published: Boolean\(p\.published && u\.publicado !== false\)/);
  assert.match(unpublishMigration, /add column if not exists publicado boolean not null default true/);
  assert.match(unpublishMigration, /u\.publicado and u\.disponivel and u\.aprovacao = 'aprovado'/);
  assert.match(unpublishMigration, /Controle editorial do site\. Não altera disponibilidade comercial/);
});

test("publicação do ERP é transacional e só confirma o que ficou visível no site", () => {
  assert.match(productApi, /rpc\("produto_definir_publicacao"/);
  assert.match(productApi, /publication\.ok !== true \|\| publication\.site_visivel !== publish/);
  assert.match(productApi, /SITE_PUBLICATION_NOT_CONFIRMED/);
  assert.match(productApi, /PRODUCT_NOT_READY/);
  assert.match(productApi, /UNIT_NOT_READY/);
  assert.match(captureApi, /result\.site_visivel !== true/);
  assert.match(captureApi, /publication: result/);
});

test("ERP abre e compartilha a URL limpa da unidade publicada", () => {
  assert.match(productsModel, /https:\/\/apecerto\.com\/imovel\/\$\{slug\}\//);
  assert.match(productsModel, /\$\{base\}-un-\$\{code \? `\$\{code\}-` : ""\}\$\{input\.unitId\}/);
  assert.doesNotMatch(productsUi, /apecerto\.com\/\?imovel=/);
  assert.doesNotMatch(detail, /apecerto\.com\/\?imovel=/);
});

test("edição do prédio nunca altera indicação individual", () => {
  assert.match(detail, /next\.unidades\.filter\(\(unit\) => !unit\.de_terceiros\)/);
  assert.match(productApi, /Indicações de corretores devem ser editadas pela ficha da própria unidade/);
  assert.match(productApi, /\.eq\("de_terceiros", false\)/);
});

test("captador edita a própria unidade e suas imagens sem controlar o condomínio", () => {
  const updateUnitBlock = productApi.match(/if \(body\.action === "updateUnit"\) \{[\s\S]*?if \(body\.action === "decideUnit"\)/)?.[0] ?? "";
  assert.doesNotMatch(updateUnitBlock, /guard\(/);
  assert.match(updateUnitBlock, /currentUnit\.captador_corretor_id === broker\.id/);
  assert.match(productApi, /async function editableMediaContext/);
  assert.match(productApi, /unit\?\.de_terceiros && broker\?\.id != null && unit\.captador_corretor_id === broker\.id/);
  assert.match(productApi, /context\.media\.unidade_id \? clearQuery\.eq\("unidade_id"/);
  assert.match(productApi, /media\.unidade_id \? nextQuery\.eq\("unidade_id"/);
  assert.match(detail, /Editar imagens da unidade/);
  assert.match(detail, /A unidade reina sobre o condomínio/);
  assert.match(detail, /setUnitMediaEdit/);
  assert.match(detail, /unitMediaEditorItems/);
  assert.match(unitMediaMigration, /m\.storage_path = storage\.objects\.name/);
  assert.match(unitMediaMigration, /c\.usuario_id = \(select auth\.uid\(\)\)/);
  assert.match(unitMediaMigration, /u\.de_terceiros/);
});

test("captador da unidade é obrigatório, preservado e visível em todas as situações", () => {
  assert.match(captorIntegrityMigration, /unidades_terceiros_exige_captador_check/);
  assert.match(captorIntegrityMigration, /captador_corretor_id is not null/);
  assert.match(captureWizard, /action: "finalize"/);
  assert.match(captureApi, /Esta captação pertence a outro corretor e não pode ser reassociada/);
  assert.doesNotMatch(catalog, /\.in\("aprovacao", \["pendente", "reprovado"\]\)/);
  assert.match(productsUi, /Todos os imóveis captados por você, aprovados ou em análise/);
  assert.match(productsUi, /product\.capturedBy && <p className="approval-captador">/);
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
