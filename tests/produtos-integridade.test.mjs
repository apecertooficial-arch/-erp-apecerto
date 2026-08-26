import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = await readFile("app/api/catalog/route.ts", "utf8");
const productApi = await readFile("app/api/product/route.ts", "utf8");
const captureApi = await readFile("app/api/capture/route.ts", "utf8");
const productsUi = await readFile("app/features/products/ProductsModule.tsx", "utf8");
const unitWizard = await readFile("app/features/products/UnitWizard.tsx", "utf8");
const captureWizard = await readFile("app/features/products/CaptureWizard.tsx", "utf8");
const pendingMediaClassifier = await readFile("app/features/products/PendingMediaClassifier.tsx", "utf8");
const detail = await readFile("app/features/products/ProductDetail.tsx", "utf8");
const detailCss = await readFile("app/styles/produtos-v3-detail.css", "utf8");
const productsModel = await readFile("app/features/products/products.ts", "utf8");
const globalCss = await readFile("app/globals.css", "utf8");
const migration = await readFile("supabase/migrations/20260820153819_produtos_fluxo_seguro_site_unidades.sql", "utf8");
const unpublishMigration = await readFile("supabase/migrations/20260820193000_produtos_despublicacao_individual.sql", "utf8");
const unitMediaMigration = await readFile("supabase/migrations/20260820220000_captador_exclui_midia_da_propria_unidade.sql", "utf8");
const captorIntegrityMigration = await readFile("supabase/migrations/20260820223000_produtos_captador_unidade_obrigatorio.sql", "utf8");

test("catálogo separa contagem de empreendimentos e imóveis", () => {
  assert.match(catalog, /buildingCount: visible\.filter\(\(product\) => !product\.standalone\)\.length/);
  assert.match(productsUi, /const commercialUnits = products\.filter/);
  assert.match(productsUi, /<b>\{commercialUnits\.length\}<\/b><em>Catálogo comercial<\/em>/);
  assert.match(productsUi, /Estoque total: \{inventorySummary\.totalUnits\} unidades/);
  assert.match(catalog, /inventorySummary = summarizeInventory/);
  assert.match(productsUi, /const publishedCount = commercialUnits\.filter/);
  assert.match(productsUi, /const offlineCount = commercialUnits\.filter/);
  assert.match(productsUi, /\{unitProducts\.length\} unidades encontradas/);
});

test("gestão localiza e corrige qualquer unidade sem contaminar o catálogo comercial", () => {
  assert.match(catalog, /const inventoryUnits = \(data \?\? \[\]\)\.flatMap/);
  assert.match(catalog, /canApprove \|\| \(currentBrokerId != null && unit\.captador_corretor_id === currentBrokerId\)/);
  assert.match(catalog, /inCommercialCatalog: commercialUnitIds\.has\(unit\.id\)/);
  assert.match(productsUi, /Estoque completo <span>\{inventoryUnits\.length\}<\/span>/);
  assert.match(productsUi, /Buscar código AP, prédio, unidade ou captador/);
  assert.match(productsUi, /openInventoryUnit\(unit, "media"\)/);
  assert.match(productsUi, /openInventoryUnit\(unit, "delete"\)/);
});

test("apartamento é a captação principal e condomínio tem fluxo separado", () => {
  assert.match(productsUi, /setRegistrationOpen\(true\)/);
  assert.match(productsUi, /\["apartamento", "Apartamento individual"/);
  assert.match(productsUi, /\["condominio", "Condomínio"/);
  assert.match(productsUi, /registrationChoice === "apartamento" \|\| registrationChoice === "remanescente"/);
  assert.match(unitWizard, /Associe o apartamento captado a um condomínio ou prédio já existente/);
  assert.match(unitWizard, /onCreateCondominium/);
  assert.match(captureWizard, /Só quer cadastrar um apartamento\?/);
});

test("corretor classifica cada mídia pela miniatura antes de cadastrar", () => {
  assert.match(pendingMediaClassifier, /className="pmc-preview"/);
  assert.match(pendingMediaClassifier, /<img src=\{item\.preview\}/);
  assert.match(pendingMediaClassifier, /aria-label=\{`Classificar \$\{item\.file\.name\}`\}/);
  assert.match(captureWizard, /<PendingMediaClassifier/);
  assert.match(unitWizard, /URL\.createObjectURL\(file\)/);
  assert.match(unitWizard, /categoria: item\.category/);
  assert.match(unitWizard, /is_capa: Boolean\(item\.cover\)/);
  assert.match(captureWizard, /entry\.kind === "foto" && entry\.cover/);
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
  assert.match(productsUi, /Central de aprovação/);
  assert.match(productsUi, /function showApprovalQueue\(\)[\s\S]*setStatus\("Todos"\)[\s\S]*setPuExpandida\(true\)/);
  assert.match(productsUi, /Filtros/);
  assert.match(productsUi, /moreFiltersOpen && <section className="pv3-filters"/);
});

test("unidade pronta usa captador, menu e mídia próprios", () => {
  assert.match(catalog, /capturedBy: corretorNameById\.get\(u\.captador_corretor_id/);
  assert.match(catalog, /media: unitMediaCount/);
  assert.match(catalog, /unitMedia: unitMediaCount/);
  assert.match(catalog, /referenceMedia: buildingMediaCount/);
  assert.match(productsUi, /product\.unitId \?\? product\.id/);
  assert.match(productsUi, /Editar unidade/);
});

test("captação individual não desaparece quando o empreendimento está em obras", () => {
  assert.match(catalog, /unidadesBrutas\.filter\(\(u\) => u\.de_terceiros === true \|\| u\.publicado !== false\)/);
  assert.match(catalog, /return ehPronto \|\| p\.standalone \? unitCards : \[p, \.\.\.unitCards\]/);
});

test("unidade tipo publicada aparece mesmo em lançamento ou obra", () => {
  assert.match(catalog, /u\.de_terceiros === true \|\| u\.publicado !== false/);
});

test("foto herdada do condomínio abre sem fingir que pertence à unidade", () => {
  assert.match(detail, /const focusedUnitPhotos = focusedUnitOwnPhotos/);
  assert.match(detail, /Áreas comuns do condomínio/);
  assert.match(detail, /nunca são usadas como capa ou como fotos privativas da unidade/);
  assert.doesNotMatch(detail, /focusedUnitPhotos = focusedUnitUsesReferencePhotos \? focusedUnitReferencePhotos/);
  assert.match(detail, /Ver \$\{focusedUnitPhotos\.length\} foto/);
  assert.match(catalog, /referenceMedia: buildingMediaCount/);
  assert.match(catalog, /coverUrl: fotoDaUnidade \? publicMediaUrl\(fotoDaUnidade\.storage_path\) : null/);
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

test("ficha aberta usa o Produtos v3 e mantém a composição aprovada", () => {
  assert.match(detail, /renderFocusedUnitDesign/);
  assert.match(detail, /renderProductDesign/);
  assert.match(detail, /pv3-detail-quick-actions/);
  assert.match(detail, /pv3-detail-readiness/);
  assert.match(detail, /pv3-detail-side-group/);
  assert.match(detailCss, /grid-template-columns: minmax\(0, 1fr\) 340px/);
  assert.match(detailCss, /height: min\(900px, 90vh\)/);
  assert.doesNotMatch(detail, /className="legacy-focused-unit" hidden/);
  assert.doesNotMatch(detail, /className="legacy-product-detail" hidden/);
  assert.match(detail, /renderFocusedUnitDesign\(product, focusedUnit\)\}\{false &&/);
  assert.match(detail, /renderProductDesign\(product\)\}\{false &&/);
});

test("ficha da unidade não mascara preço inválido nem libera publicação", () => {
  assert.match(detail, /isPlausibleProductPrice\(focusedUnitPrice, product\?\.finalidade\)/);
  assert.match(detail, /"Preço válido": focusedUnitPriceValid/);
  assert.match(detail, /⚠ Preço inválido/);
  assert.match(detail, /disabled=\{busy \|\| !unit\.disponivel \|\| focusedUnitBlocking > 0\}/);
  assert.match(detailCss, /\.pv3-detail-price\.invalid/);
});

test("corretor vê todas as fotos e dados operacionais, mas não o proprietário alheio", () => {
  assert.match(productApi, /midias: media/);
  assert.doesNotMatch(productApi, /const visibleMedia = media\.filter/);
  assert.match(productApi, /proprietarios: podeVerProprietarioProduto \? data\.proprietarios : null/);
  assert.match(productApi, /proprietario_nome: null, proprietario_tel: null, proprietario_email: null/);
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
  assert.match(catalog, /published: Boolean\(p\.published && u\.publicado !== false && unitMediaCount > 0\)/);
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
  assert.match(productsUi, /Minhas captações/);
  assert.match(productsUi, /Captador: <b>\{product\.capturedBy \|\| "não identificado"\}<\/b>/);
  assert.match(productsUi, /group\.segment === "terceiros" \? "Sem captador" : "Estoque ApêCerto"/);
});

test("corretor encontra produtos por vagas e por origem comercial", () => {
  assert.match(productsUi, /aria-label="Vagas"/);
  assert.match(productsUi, /product\.parking >= Number\(parking\)/);
  assert.match(productsUi, /Terceiros/);
  assert.match(productsUi, /Lançamentos/);
  assert.match(productsUi, /Remanescentes/);
  assert.match(productsUi, /Condomínio de referência ainda não vinculado/);
  assert.match(catalog, /resolveCommercialOrigin\(\{/);
  assert.match(catalog, /explicit: originByUnit\.get\(u\.id\) \?\? null/);
});

test("dados do proprietário da unidade ficam apenas com o captador", () => {
  assert.match(productApi, /return unidadeMinha/);
  assert.match(productApi, /pode_ver_proprietario: false/);
  assert.match(productApi, /proprietario_nome: null, proprietario_contato: null/);
  assert.match(productApi, /ownsUnit \? \{ proprietario_nome: proprietarioNome, proprietario_contato: proprietarioContato \} : \{\}/);
  assert.match(detail, /somente o corretor captador pode consultar ou alterar o proprietário/);
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
