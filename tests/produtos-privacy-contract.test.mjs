import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = await readFile("app/api/catalog/route.ts", "utf8");
const product = await readFile("app/api/product/route.ts", "utf8");
const capture = await readFile("app/api/capture/route.ts", "utf8");
const geocode = await readFile("app/api/geocode/route.ts", "utf8");
const publicContract = await readFile("supabase/migrations/20260828113000_produtos_contrato_publico_privado.sql", "utf8");
const publicAddressFix = await readFile("supabase/migrations/20260828183000_produtos_logradouro_publico_fail_closed.sql", "utf8");
const baseHardening = await readFile("supabase/migrations/20260820153819_produtos_fluxo_seguro_site_unidades.sql", "utf8");

test("endpoints operacionais de Produtos bloqueiam visitante antes de serializar dados", () => {
  assert.match(catalog, /if \(!accessToken\) return Response\.json\(\{ error: "Sessão necessária\." \}, \{ status: 401 \}\)/);
  assert.match(product, /if \(!auth\) return Response\.json\(\{ error: "Sessão inválida ou expirada\." \}, \{ status: 401 \}\)/);
  assert.match(capture, /if \(!accessToken\) return Response\.json\(\{ error: "Sessão necessária\." \}, \{ status: 401 \}\)/);
  assert.match(geocode, /if \(!token\) return Response\.json\(\{ error: "Sessão inválida ou expirada\." \}, \{ status: 401 \}\)/);
});

test("não captador recebe proprietário fail-closed no produto e nas unidades", () => {
  assert.match(product, /proprietario_id: podeVerProprietarioProduto \? data\.proprietario_id : null/);
  assert.match(product, /proprietarios: podeVerProprietarioProduto \? productOwner : null/);
  assert.match(product, /proprietario_nome: null, proprietario_tel: null, proprietario_email: null/);
  assert.match(product, /pode_ver_proprietario: false[\s\S]{0,180}proprietario_nome: null, proprietario_contato: null/);
  assert.match(product, /const podeVerProprietarioProduto = gerenciaProdutosGet \|\| mine/);
});

test("catálogo autenticado não seleciona proprietário no inventário geral", () => {
  const inventorySelect = catalog.match(/from\("empreendimentos"\)[\s\S]*?\.order\("created_at"/)?.[0] ?? "";
  assert.ok(inventorySelect, "select principal do catálogo não encontrado");
  assert.doesNotMatch(inventorySelect, /proprietario(?:_id|_nome|_contato|s)?/i);
  assert.match(catalog, /mineProductIds\.length[\s\S]*?produto_unidades_proprietarios_ler/);
});

test("contrato do visitante usa identidade neutra, localização reduzida e tokens de mídia", () => {
  const view = publicContract.match(/create or replace view public\.site_produtos[\s\S]*?create or replace view public\.site_produtos_catalogo/)?.[0] ?? "";
  assert.ok(view, "view pública não encontrada");
  assert.match(view, /null::numeric\(9,6\) as latitude/);
  assert.match(view, /null::numeric\(9,6\) as longitude/);
  assert.match(view, /null::text as codigo/);
  assert.match(view, /site_logradouro_publico\(e\.endereco\)/);
  assert.match(view, /site_midia_token\(m\.id\)/);
  assert.doesNotMatch(view, /m\.storage_path|proprietario|captado_por|captador_corretor_id|contato|telefone|email/i);
});

test("logradouro público remove complemento antes do número residual", () => {
  assert.match(publicAddressFix, /\(\[0-9\]\|\[\[:space:\]\]\+/);
  assert.match(publicAddressFix, /fundos\\M\|casa\\M\|sala\\M\|andar\\M/);
  assert.match(publicAddressFix, /revoke all on function public\.site_logradouro_publico\(text\) from public/i);
  assert.doesNotMatch(publicAddressFix, /insert\s|update\s|delete\s|storage_path|proprietario/i);
});

test("tabelas-base de Produtos não ficam concedidas ao visitante", () => {
  for (const table of ["empreendimentos", "unidades", "midias"]) {
    assert.match(baseHardening, new RegExp(`revoke all privileges on public\\.${table} from anon`, "i"));
  }
});
