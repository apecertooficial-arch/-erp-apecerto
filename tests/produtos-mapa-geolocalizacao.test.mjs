import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260824181028_mapa_geolocalizacao_validada_v2.sql";
const tempusMigrationPath = "supabase/migrations/20260824183000_mapa_tempus_e_publicacao_geolocalizada.sql";

test("migration corrige exatamente os 21 empreendimentos sem alterar publicação", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const codigos = Array.from(sql.matchAll(/\('(?<codigo>AP\d{4})',\s*-23\./g), (match) => match.groups.codigo);
  assert.equal(new Set(codigos).size, 21);
  assert.match(sql, /set latitude = v_alvo\.nova_latitude,[\s\S]{0,80}?longitude = v_alvo\.nova_longitude/);
  assert.doesNotMatch(sql, /set\s+publicado\s*=/i);
  assert.match(sql, /MAP_COORDS_CHANGED/);
  assert.match(sql, /MAP_PARTIAL_UPDATE/);
  assert.match(sql, /corrigir_geolocalizacao_mapa/);
});

test("banco rejeita par parcial, Null Island e fecha a RPC anônima", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /empreendimentos_coordenadas_validas_check/);
  assert.match(sql, /not \(latitude = 0 and longitude = 0\)/);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /revoke all on function public\.set_empreendimento_coords[\s\S]*?from public, anon, authenticated, service_role/);
  assert.match(sql, /grant execute on function public\.set_empreendimento_coords[\s\S]*?to authenticated/);
  assert.match(sql, /auth\.uid\(\) is null/);
});

test("geocoder aceita somente endereço exato em São Paulo e confirma a gravação", async () => {
  const route = await readFile("app/api/geocode/route.ts", "utf8");
  assert.match(route, /addressdetails=1&limit=5&countrycodes=br/);
  assert.match(route, /resultMatchesAddress\(item, rua, numero\)/);
  assert.match(route, /addressNumber\(result\.address\?\.house_number\)/);
  assert.match(route, /withinSaoPaulo\(lat, lon\)/);
  assert.doesNotMatch(route, /\[bairro, cidade, uf, "Brasil"\]/);
  assert.doesNotMatch(route, /cep \? \[cep, cidade, "Brasil"\]/);
  assert.match(route, /const \{ error: cacheError \} = await supabase\.rpc/);
  assert.match(route, /status: denied \? 403 : 503/);
});

test("preflight, verificação e rollback são versionados e fail-closed", async () => {
  const [preflight, verification, rollback] = await Promise.all([
    readFile("supabase/verificacao/20260824_mapa_geolocalizacao_validada_preflight.sql", "utf8"),
    readFile("supabase/verificacao/20260824_mapa_geolocalizacao_validada_verificacao.sql", "utf8"),
    readFile("supabase/rollback/20260824_mapa_geolocalizacao_validada_rollback.sql", "utf8"),
  ]);
  assert.match(preflight, /bloqueado_estado_inesperado/);
  assert.match(verification, /FALHA MAP-1/);
  assert.match(verification, /public\.site_produtos/);
  assert.match(verification, /has_function_privilege\('anon'/);
  assert.match(rollback, /ROLLBACK_MAP_BLOCKED/);
  assert.match(rollback, /v_total not in \(0, 21\)/);
});

test("Tempus entra no mapa sem alterar regras globais de publicação", async () => {
  const [sql, preflight, verification, rollback] = await Promise.all([
    readFile(tempusMigrationPath, "utf8"),
    readFile("supabase/verificacao/20260824_mapa_tempus_e_publicacao_geolocalizada_preflight.sql", "utf8"),
    readFile("supabase/verificacao/20260824_mapa_tempus_e_publicacao_geolocalizada_verificacao.sql", "utf8"),
    readFile("supabase/rollback/20260824_mapa_tempus_e_publicacao_geolocalizada_rollback.sql", "utf8"),
  ]);

  assert.match(sql, /where e\.codigo = 'AP0058'/);
  assert.match(sql, /set latitude = -23\.612253,[\s\S]*?longitude = -46\.668321/);
  assert.doesNotMatch(sql, /set\s+publicado\s*=/i);
  assert.doesNotMatch(sql, /create\s+trigger/i);
  assert.doesNotMatch(sql, /create\s+or\s+replace\s+function/i);
  assert.match(preflight, /bloqueado_estado_inesperado/);
  assert.match(verification, /FALHA MAP-T2/);
  assert.match(verification, /auditoria AP0058/);
  assert.match(rollback, /ROLLBACK_MAP_TEMPUS_BLOCKED/);
});
