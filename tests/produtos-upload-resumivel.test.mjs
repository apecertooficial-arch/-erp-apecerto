import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const unitWizard = await readFile("app/features/products/UnitWizard.tsx", "utf8");
const captureWizard = await readFile("app/features/products/CaptureWizard.tsx", "utf8");
const productDetail = await readFile("app/features/products/ProductDetail.tsx", "utf8");
const productsModule = await readFile("app/features/products/ProductsModule.tsx", "utf8");
const catalogApi = await readFile("app/api/catalog/route.ts", "utf8");
const productApi = await readFile("app/api/product/route.ts", "utf8");
const resumableUpload = await readFile("app/features/products/resumable-upload.ts", "utf8");
const migration = await readFile("supabase/migrations/20260902170000_produtos_upload_resumivel.sql", "utf8");

test("fotos de imóveis usam upload recomeçável com tentativas e progresso", () => {
  assert.match(resumableUpload, /from "tus-js-client"/);
  assert.match(resumableUpload, /retryDelays:\s*\[0,\s*1000,\s*3000,\s*5000,\s*10000\]/);
  assert.match(resumableUpload, /findPreviousUploads\(\)/);
  assert.match(resumableUpload, /resumeFromPreviousUpload/);
  assert.match(resumableUpload, /fingerprint:/);
  assert.match(resumableUpload, /metadata\?\.objectName/);
  assert.match(resumableUpload, /onProgress/);
  assert.match(resumableUpload, /storage\.supabase\.co/);
  assert.match(resumableUpload, /const gateway =/);
  assert.match(resumableUpload, /for \(const endpoint of resumableEndpoints/);
  assert.match(resumableUpload, /uploadDataDuringCreation:\s*false/);
  assert.match(unitWizard, /uploadProductMediaResumable/);
  assert.match(captureWizard, /uploadProductMediaResumable/);
  assert.match(productDetail, /uploadProductMediaResumable/);
});

test("falha no armazenamento local do Android não impede o envio", () => {
  assert.match(resumableUpload, /findPreviousUploads\(\)/);
  assert.match(resumableUpload, /catch\(\(error\) => \{/);
  assert.match(resumableUpload, /Retomada local indisponível/);
  assert.match(resumableUpload, /upload\.start\(\)/);
  assert.match(resumableUpload, /globalThis\.crypto\?\.subtle/);
  assert.match(resumableUpload, /Web Crypto indisponível/);
});

test("o caminho determinístico e a mídia idempotente impedem duplicação no retry", () => {
  assert.match(resumableUpload, /buildProductMediaPath/);
  assert.match(resumableUpload, /crypto\?\.subtle/);
  assert.match(resumableUpload, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(unitWizard, /onConflict:\s*"storage_path"/);
  assert.match(captureWizard, /onConflict:\s*"storage_path"/);
  assert.match(productDetail, /onConflict:\s*"storage_path"/);
  assert.match(migration, /unique index if not exists midias_storage_path_key/i);
});

test("tentativa repetida retoma a unidade do mesmo corretor em vez de duplicar", () => {
  assert.match(productApi, /RESUMABLE_UNIT_LOOKUP/);
  assert.match(productApi, /resumed:\s*true/);
  assert.match(unitWizard, /created\.resumed/);
  assert.match(captureWizard, /created\.resumed/);
});

test("captação sem foto fica visível com ação direta para continuar", () => {
  assert.match(catalogApi, /photoCount/);
  assert.match(productsModule, /Cadastro incompleto · envie as fotos/);
  assert.match(productsModule, /Continuar fotos/);
  assert.match(productsModule, /setInitialUnitAction\("media"\)/);
});

test("falha parcial informa cada arquivo sem apagar os envios concluídos", () => {
  assert.match(unitWizard, /arquivosComFalha/);
  assert.match(productDetail, /arquivosComFalha/);
  assert.match(unitWizard, /enviadaComSucesso/);
  assert.match(productDetail, /enviadaComSucesso/);
});
