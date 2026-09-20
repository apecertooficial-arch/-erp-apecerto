import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/catalog/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/products/ProductsModule.tsx", import.meta.url), "utf8");

test("Catálogo não devolve nem registra detalhes brutos do banco", () => {
  assert.match(route, /function falhaCatalogo\(/);
  assert.match(route, /console\.error\("catalogo_operacao_falhou", \{\s*operacao,\s*codigo:/);
  assert.doesNotMatch(route, /Response\.json\(\{ error: [^}\n]*\.message/);
  assert.doesNotMatch(route, /console\.(?:error|warn|log)\([^\n]*(?:message|telefone|email|proprietario|payload)/i);
});

test("autenticação e perfil separam ausência de sessão de falha técnica", () => {
  assert.match(route, /if \(authError\) return falhaCatalogo\(authError, "autenticar"\)/);
  assert.match(route, /if \(!authData\.user\).*status: 401/);
  assert.match(route, /data: me, error: profileError/);
  assert.match(route, /if \(profileError\) return falhaCatalogo\(profileError, "carregar_perfil"\)/);
});

test("todas as fontes obrigatórias do catálogo falham fechadas", () => {
  for (const operacao of [
    "listar_produtos", "carregar_favoritos", "carregar_corretores", "carregar_corretor_atual",
    "carregar_condominios", "carregar_fila_qualidade", "carregar_origens_unidades", "carregar_vinculos_leads",
  ]) assert.match(route, new RegExp(`falhaCatalogo\\([^\\n]+, "${operacao}"\\)`));
});

test("filas de aprovação e captações próprias não viram vazio quando o banco falha", () => {
  for (const operacao of [
    "carregar_unidades_pendentes", "carregar_midias_pendentes", "carregar_captacoes_proprias",
    "carregar_midias_proprias", "carregar_proprietarios_proprios",
  ]) assert.match(route, new RegExp(`falhaCatalogo\\([^\\n]+, "${operacao}"\\)`));
});

test("interface mantém estados loading, auth, erro e live sem exibir detalhe técnico", () => {
  assert.match(ui, /setDataState\("loading"\)/);
  assert.match(ui, /setDataState\("auth"\)/);
  assert.match(ui, /setDataState\("error"\)/);
  assert.match(ui, /setDataState\("live"\)/);
  assert.doesNotMatch(ui, /error instanceof Error \? error\.message/);
});
