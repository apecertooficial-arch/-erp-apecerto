import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile("app/api/product/route.ts", "utf8");
const jsonBoundary = await readFile("app/lib/http/read-json-command.mjs", "utf8");
const types = await readFile("app/lib/supabase/database.types.ts", "utf8");
const patchBlock = route.match(/export async function PATCH[\s\S]*$/)?.[0] ?? "";

test("mutações rejeitam JSON inválido e contexto técnico incompleto", () => {
  assert.match(route, /import \{ lerComandoJson \} from "\.\.\/\.\.\/lib\/http\/read-json-command\.mjs"/);
  assert.match(patchBlock, /const command = await lerComandoJson\(request, PRODUCT_COMMAND_MAX_BYTES\)/);
  assert.match(patchBlock, /if \(!command\.ok\) return Response\.json/);
  assert.doesNotMatch(patchBlock, /request\.json\(\)/);
  assert.match(jsonBoundary, /"json_invalido"/);
  assert.match(jsonBoundary, /total > maxBytes/);
  for (const name of ["productContextError", "profilePatchError", "brokerContextError"]) {
    assert.match(patchBlock, new RegExp(`\\b${name}\\b`));
  }
  assert.match(patchBlock, /if \(mutationContextError\)/);
  assert.match(patchBlock, /if \(!productContext\) return Response\.json\(\{ error: "Produto não encontrado\." \}, \{ status: 404 \}\)/);
});

test("nenhuma mutação devolve mensagem bruta de banco ou Storage", () => {
  assert.doesNotMatch(patchBlock, /error:\s*(?:error|\w+Error|result\.error)\??\.message/);
  assert.doesNotMatch(patchBlock, /\$\{(?:error|\w+Error|result\.error)\??\.message/);
  assert.match(route, /const PUBLICATION_MESSAGES: Record<string, string>/);
  assert.match(route, /return productTechnicalFailure\("publication_command", error/);
});

test("capa usa a RPC transacional que existe no banco", () => {
  const block = patchBlock.match(/if \(body\.action === "setCover"\)[\s\S]*?if \(body\.action === "updateMedia"\)/)?.[0] ?? "";
  assert.match(block, /rpc\("produto_midia_definir_capa"/);
  assert.match(block, /result\.ok !== true \|\| result\.media_id !== mediaId/);
  assert.doesNotMatch(block, /clearQuery|is_capa: false|is_capa: true/);
  assert.match(types, /produto_midia_definir_capa:\s*\{[\s\S]*?p_media_id: string[\s\S]*?p_unidade_id: string \| null[\s\S]*?Returns: Json/);
});

test("exclusão de mídia confirma metadado antes do Storage e sinaliza limpeza pendente", () => {
  const block = patchBlock.match(/if \(body\.action === "deleteMedia"\)[\s\S]*?if \(body\.action === "deleteProduct"\)/)?.[0] ?? "";
  const databaseDelete = block.indexOf('.from("midias").delete()');
  const storageDelete = block.indexOf('.storage.from("empreendimentos").remove');
  assert.ok(databaseDelete >= 0 && storageDelete > databaseDelete);
  assert.match(block, /select\("id"\)\.maybeSingle\(\)/);
  assert.match(block, /storageCleanupPending: Boolean\(storageWarning\)/);
  assert.match(block, /RECONCILIATION_REQUIRED/);
});

test("edições e decisões confirmam a linha realmente afetada", () => {
  assert.match(patchBlock, /const \{ data: updatedProduct, error: productUpdateError \}[^;]*\.update\(update\)[^;]*\.select\("id"\)\.maybeSingle\(\)/s);
  assert.match(patchBlock, /PRODUCT_UPDATE_NOT_CONFIRMED/);
  assert.match(patchBlock, /rpc\("produto_decidir_captacao"/);
  assert.doesNotMatch(patchBlock.match(/if \(body\.action === "decideUnit"\)[\s\S]*?if \(body\.action === "toggleFavorite"\)/)?.[0] ?? "", /from\("unidades"\)\.update/);
  assert.match(patchBlock, /UNIT_DECISION_NOT_CONFIRMED/);
  assert.match(patchBlock, /const \{ data: requestedProduct, error: requestError \}[^;]*\.update\([^;]*\.select\("id"\)\.maybeSingle\(\)/s);
  assert.match(patchBlock, /PRODUCT_REQUEST_NOT_CONFIRMED/);
});

test("favorito, vínculo e classificação são idempotentes ou comprovados", () => {
  assert.match(patchBlock, /from\("produto_favoritos"\)\.upsert\(/);
  assert.match(patchBlock, /onConflict: "empreendimento_id,usuario_id"/);
  assert.match(patchBlock, /from\("lead_produtos"\)\.upsert\(/);
  assert.match(patchBlock, /onConflict: "lead_id,empreendimento_id"/);
  assert.match(patchBlock, /FAVORITE_CHANGE_NOT_CONFIRMED/);
  assert.match(patchBlock, /LEAD_LINK_CHANGE_NOT_CONFIRMED/);
  assert.match(patchBlock, /MEDIA_UPDATE_NOT_CONFIRMED/);
});
