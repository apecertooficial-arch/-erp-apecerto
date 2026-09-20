import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile("app/api/product/route.ts", "utf8");
const getBlock = route.match(/export async function GET[\s\S]*?\n}\n\nexport async function PATCH/)?.[0] ?? "";

test("ficha de produto sanitiza falhas técnicas sem devolver mensagens internas", () => {
  assert.match(route, /function productTechnicalFailure\(/);
  assert.match(route, /console\.error\("\[product-api\]", \{ operation, code \}\)/);
  assert.doesNotMatch(getBlock, /error:\s*(?:error|\w+Error)\??\.message/);
});

test("leituras obrigatórias da ficha falham fechado", () => {
  for (const name of [
    "brokerError",
    "profileError",
    "favoriteError",
    "linksError",
    "leadOptionsError",
    "corretoresError",
    "privateOwnersError",
    "ownerStatusesError",
    "productOwnersError",
  ]) {
    assert.match(getBlock, new RegExp(`\\b${name}\\b`), `${name} precisa ser verificado`);
  }
  assert.match(getBlock, /if \(contextReadError\)/);
  assert.match(getBlock, /if \(relatedReadError\)/);
});

test("somente gestão ou captador recebe dados do proprietário", () => {
  assert.match(getBlock, /const podeVerProprietarioProduto = gerenciaProdutosGet \|\| mine/);
  assert.match(getBlock, /proprietario_id: podeVerProprietarioProduto \? data\.proprietario_id : null/);
  assert.match(getBlock, /const podeVerProprietarioUnidade = canViewUnitOwner\(\{[\s\S]*?isManager: gerenciaProdutosGet/);
  assert.match(getBlock, /pode_ver_proprietario: podeVerProprietarioUnidade/);
});

test("usuário sem papel de gestão nem vínculo de corretor não recebe a carteira", () => {
  assert.match(getBlock, /if \(!gerenciaProdutosGet && !broker\?\.id\)/);
  assert.match(getBlock, /return Response\.json\(\{ error: "Seu usuário ainda não está vinculado a uma carteira ativa\." \}, \{ status: 403 \}\)/);
  assert.match(getBlock, /if \(broker\?\.id\) leadsQuery = leadsQuery\.eq\("corretor_id", broker\.id\)/);
});

test("resposta da ficha não confunde falha técnica com ausência", () => {
  assert.match(getBlock, /error\.code === "PGRST116"/);
  assert.match(getBlock, /productTechnicalFailure\("read_product", error\)/);
  assert.match(getBlock, /productTechnicalFailure\("read_product_context", contextReadError\)/);
  assert.match(getBlock, /productTechnicalFailure\("read_product_relations", relatedReadError\)/);
});
