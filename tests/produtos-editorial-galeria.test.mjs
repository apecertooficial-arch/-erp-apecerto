import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { interpretMoneyInput } from "../app/features/products/quality.ts";

const migration = await readFile("supabase/migrations/20260826193000_produtos_editorial_midias_rascunhos.sql", "utf8");
const captureApi = await readFile("app/api/capture/route.ts", "utf8");
const captureWizard = await readFile("app/features/products/CaptureWizard.tsx", "utf8");
const detail = await readFile("app/features/products/ProductDetail.tsx", "utf8");
const productApi = await readFile("app/api/product/route.ts", "utf8");
const classifier = await readFile("app/features/products/PendingMediaClassifier.tsx", "utf8");
const ownerHardening = await readFile("supabase/hardening/produtos_proprietarios_pos_deploy.sql", "utf8");

test("valor completo colado no modo milhares nunca vira mil vezes maior", () => {
  assert.deepEqual(interpretMoneyInput("710", "milhares", "venda"), { value: 710_000, mode: "milhares", inferredFullValue: false });
  assert.deepEqual(interpretMoneyInput("710000", "milhares", "venda"), { value: 710_000, mode: "reais", inferredFullValue: true });
  assert.deepEqual(interpretMoneyInput("3.500", "reais", "aluguel"), { value: 3_500, mode: "reais", inferredFullValue: false });
  assert.deepEqual(interpretMoneyInput("500", "milhares", "venda"), { value: 500_000, mode: "milhares", inferredFullValue: false });
  assert.deepEqual(interpretMoneyInput("500.000", "milhares", "venda"), { value: 500_000, mode: "reais", inferredFullValue: true });
  assert.deepEqual(interpretMoneyInput("R$ 1.250.000", "milhares", "venda"), { value: 1_250_000, mode: "reais", inferredFullValue: true });
  assert.deepEqual(interpretMoneyInput("1.250.000,00", "reais", "venda"), { value: 1_250_000, mode: "reais", inferredFullValue: false });
  assert.deepEqual(interpretMoneyInput("3500", "reais", "aluguel"), { value: 3_500, mode: "reais", inferredFullValue: false });
  assert.deepEqual(interpretMoneyInput("3,5", "milhares", "aluguel"), { value: 3_500, mode: "milhares", inferredFullValue: false });
});

test("rascunho de cadastro é privado, limitado, expira e não depende do corretor", () => {
  assert.match(migration, /private\.produto_cadastro_rascunhos/);
  assert.match(migration, /revoke all on table private\.produto_cadastro_rascunhos from public, anon, authenticated/);
  assert.match(migration, /usuario_id uuid primary key references auth\.users\(id\)/);
  assert.match(migration, /octet_length\(p_payload::text\) > 200000/);
  assert.match(migration, /interval '30 days'/);
  assert.match(migration, /versao = versao \+ 1/);
  assert.match(migration, /DRAFT_CONFLICT/);
  assert.match(captureApi, /expectedVersion/);
  assert.match(captureApi, /status: conflict \? 409 : 502/);
  const draftBlock = captureApi.match(/if \(payload\.action === "saveDraft"\)[\s\S]*?if \(payload\.action === "deleteDraft"\)/)?.[0] ?? "";
  assert.doesNotMatch(draftBlock, /from\("corretores"\)/);
  assert.match(captureWizard, /Rascunho salvo/);
  assert.match(captureWizard, /fotos precisam ser selecionadas novamente/);
});

test("proprietário é liberado somente ao captador ou à gestão ativa", () => {
  assert.match(migration, /create or replace function public\.produto_proprietarios_meus\(\)/);
  assert.match(migration, /create or replace function public\.produto_proprietario_ler/);
  assert.match(migration, /create or replace function public\.produto_unidades_proprietarios_ler/);
  assert.match(migration, /select p\.unidade_id, p\.nome, p\.contato\s+from private\.unidade_proprietarios p/);
  assert.match(migration, /select public\.is_product_manager\(\)/);
  assert.match(captureWizard, /rpc\("produto_proprietarios_meus"\)/);
  assert.doesNotMatch(captureWizard, /from\("proprietarios"\)\.select\("id,nome,email,telefone"\)/);
  assert.doesNotMatch(productApi, /proprietarios \(\*\)/);
  assert.match(productApi, /rpc\("produto_proprietario_ler"/);
  assert.match(productApi, /rpc\("produto_proprietario_salvar"/);
  assert.match(captureApi, /rpc\("produto_proprietario_captacao_resolver"/);
  assert.doesNotMatch(productApi, /from\("proprietarios"\)/);
  assert.doesNotMatch(captureApi, /from\("proprietarios"\)/);
  assert.match(productApi, /isManager: gerenciaProdutosGet/);
  assert.match(productApi, /profile\?\.ativo !== true/);
  assert.match(captureApi, /Usuário inativo ou sem perfil operacional/);
  assert.match(migration, /is_product_manager\(\)/);
  assert.match(migration, /us\.ativo/);
  assert.match(ownerHardening, /revoke all privileges on table public\.proprietarios from public, anon, authenticated/);
  assert.match(ownerHardening, /NÃO É MIGRAÇÃO AUTOMÁTICA/);
});

test("galeria mantém miniatura, alt, capa e ordem explícita por unidade", () => {
  assert.match(classifier, /pmc-preview/);
  assert.match(classifier, /Descrição acessível da foto/);
  assert.match(migration, /add column if not exists ordem integer/);
  assert.match(migration, /add column if not exists alt_text text/);
  assert.match(migration, /produto_midias_reordenar/);
  assert.match(migration, /count\(distinct media_id\)/);
  assert.match(productApi, /rpc\("produto_midias_reordenar"/);
  assert.match(productApi, /rpc\("produto_midia_definir_capa"/);
  assert.doesNotMatch(productApi, /clearQuery = auth\.supabase\.from\("midias"\)/);
  assert.match(migration, /set is_capa = \(m\.id = p_media_id\)/);
  assert.match(detail, /reorderMedia/);
  assert.match(detail, /media-alt-input/);
  assert.match(detail, /Usar como capa/);
});

test("o captador da unidade edita mídia e ficha mesmo com marcador legado incorreto", () => {
  assert.doesNotMatch(productApi, /unit\?\.de_terceiros/);
  assert.doesNotMatch(productApi, /!currentUnit\.de_terceiros/);
  assert.match(migration, /create or replace function public\.produto_unidade_excluir_canonica/);
  assert.match(productApi, /rpc\("produto_unidade_excluir_canonica"/);
  const storagePolicy = migration.match(/create policy emp_storage_delete_captador[\s\S]*?;\n\n-- Compatibilidade/)?.[0] ?? "";
  assert.doesNotMatch(storagePolicy, /de_terceiros/);
});

test("conteúdo e SEO pertencem à unidade e a publicação bloqueia descrição incompleta", () => {
  for (const field of ["titulo_comercial", "descricao_comercial", "seo_titulo", "seo_descricao"]) {
    assert.match(migration, new RegExp(field));
    assert.match(productApi, new RegExp(field));
    assert.match(detail, new RegExp(field));
  }
  assert.match(detail, /"Descrição comercial": Boolean\(\(focusedUnit\.descricao_comercial \|\| product\?\.descricao \|\| ""\)\.trim\(\)\.length >= 80\)/);
  assert.match(productApi, /Descrição comercial com pelo menos 80 caracteres/);
  assert.match(migration, /'fotos_meta'/);
  assert.match(migration, /order by m\.is_capa desc, m\.ordem, m\.created_at/);
  assert.match(migration, /grant select \(ordem, alt_text, categoria\) on public\.midias to anon/);
});

test("auditoria de preços é somente da gestão e nunca altera dados automaticamente", () => {
  const audit = migration.match(/create or replace function public\.produto_precos_suspeitos\(\)[\s\S]*?grant execute on function public\.produto_precos_suspeitos\(\) to authenticated;/)?.[0] ?? "";
  assert.match(audit, /apenas a gestão pode auditar preços/);
  assert.match(audit, /Venda fora da faixa de R\$ 100\.000 a R\$ 100\.000\.000/);
  assert.match(audit, /Aluguel fora da faixa de R\$ 500 a R\$ 500\.000/);
  assert.doesNotMatch(audit, /update public\.|delete from public\.|insert into public\./);
});

test("falha após upload limpa o objeto e não deixa mídia órfã", () => {
  assert.match(detail, /if \(insertError\) \{ await supabase\.storage\.from\("empreendimentos"\)\.remove\(\[path\]\); throw insertError; \}/);
  assert.match(captureWizard, /await supabase\.storage\.from\("empreendimentos"\)\.remove\(\[storagePath\]\)/);
});
