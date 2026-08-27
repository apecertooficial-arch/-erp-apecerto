import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  canViewUnitOwner,
  resolveCommercialOrigin,
  summarizeQualityIssues,
} from "../app/features/products/product-domain.ts";

const migration = await readFile(new URL("../supabase/migrations/20260824215809_produtos_dados_privados_origem_qualidade.sql", import.meta.url), "utf8");
const catalog = await readFile(new URL("../app/api/catalog/route.ts", import.meta.url), "utf8");
const product = await readFile(new URL("../app/api/product/route.ts", import.meta.url), "utf8");
const detail = await readFile(new URL("../app/features/products/ProductDetail.tsx", import.meta.url), "utf8");

test("origem comercial explícita prevalece e o fallback preserva o estoque atual", () => {
  assert.equal(resolveCommercialOrigin({ explicit: "terceiros", thirdParty: false, buildingStatus: "Pronto" }), "terceiros");
  assert.equal(resolveCommercialOrigin({ explicit: null, thirdParty: true, buildingStatus: "Em obras" }), "terceiros");
  assert.equal(resolveCommercialOrigin({ explicit: null, thirdParty: false, buildingStatus: "Pronto" }), "remanescente");
  assert.equal(resolveCommercialOrigin({ explicit: null, thirdParty: false, buildingStatus: "Lançamento" }), "lancamento");
});

test("captador e gestão enxergam o proprietário; outro corretor não", () => {
  assert.equal(canViewUnitOwner({ viewerBrokerId: 12, captorBrokerId: 12 }), true);
  assert.equal(canViewUnitOwner({ viewerBrokerId: 99, captorBrokerId: 12 }), false);
  assert.equal(canViewUnitOwner({ viewerBrokerId: null, captorBrokerId: 12 }), false);
  assert.equal(canViewUnitOwner({ viewerBrokerId: 99, captorBrokerId: 12, isManager: true }), true);
});

test("fila de qualidade traduz bloqueios sem expor dados privados", () => {
  assert.deepEqual(
    summarizeQualityIssues(["sem_foto_propria", "sem_condominio_referencia", "sem_proprietario"]),
    ["Sem foto própria", "Condomínio não vinculado", "Proprietário incompleto"],
  );
});

test("migração separa proprietário, grava origem e oferece fila segura", () => {
  assert.match(migration, /create table if not exists private\.unidade_proprietarios/i);
  assert.match(migration, /add column if not exists origem_comercial/i);
  assert.match(migration, /produto_unidades_proprietarios_ler/i);
  assert.match(migration, /produto_qualidade_fila/i);
  assert.match(migration, /set proprietario_nome = null[\s\S]*proprietario_contato = null/i);
});

test("APIs consomem a camada privada e a origem canônica", () => {
  assert.match(product, /produto_unidades_proprietarios_ler/);
  assert.match(catalog, /produto_qualidade_fila/);
  assert.match(catalog, /resolveCommercialOrigin/);
  assert.doesNotMatch(catalog, /\.select\("[^"]*proprietario_nome/);
});

test("unidade já publicada apresenta pendências antigas como correções recomendadas", () => {
  assert.match(detail, /focusedUnitPublished \? "Correções recomendadas"/);
  assert.match(detail, /ajuste\(s\) de qualidade ainda pendente\(s\)/);
});
