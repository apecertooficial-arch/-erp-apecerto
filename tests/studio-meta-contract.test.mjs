import assert from "node:assert/strict";
import test from "node:test";

import {
  META_REQUIRED_SCOPES,
  assertExactRedirectUri,
  missingMetaScopes,
  normalizeGraphVersion,
  oauthEnabled,
  selectProfessionalAccount,
  sha256Hex,
} from "../supabase/functions/_shared/studio-meta-contract.ts";

test("Meta OAuth fica desativado sem configuração completa", () => {
  assert.equal(oauthEnabled({ META_OAUTH_ENABLED: "true", META_APP_ID: "id" }), false);
  assert.equal(oauthEnabled({
    META_OAUTH_ENABLED: "true",
    META_APP_ID: "id",
    META_APP_SECRET: "secret",
    META_OAUTH_REDIRECT_URI: "https://erp.example.invalid/oauth",
    META_GRAPH_API_VERSION: "v25.0",
  }), true);
});

test("versão e redirect URI são estritos", () => {
  assert.equal(normalizeGraphVersion("v25.0"), "v25.0");
  assert.throws(() => normalizeGraphVersion("latest"), /inválida/);
  assert.equal(assertExactRedirectUri("https://erp.example.invalid/oauth"), "https://erp.example.invalid/oauth");
  assert.equal(assertExactRedirectUri("http://localhost:54321/functions/v1/social-meta-oauth"), "http://localhost:54321/functions/v1/social-meta-oauth");
  assert.throws(() => assertExactRedirectUri("http://example.com/oauth"), /HTTPS/);
});

test("escopos ausentes e conta incompatível bloqueiam a conexão", () => {
  const granted = META_REQUIRED_SCOPES.map((permission) => ({ permission, status: "granted" }));
  assert.deepEqual(missingMetaScopes(granted), []);
  assert.deepEqual(missingMetaScopes(granted.slice(0, -1)), ["pages_read_engagement"]);
  assert.throws(() => selectProfessionalAccount([{ id: "page", access_token: "token" }]), /conta profissional/);
  const selected = selectProfessionalAccount([{
    id: "page",
    name: "Página",
    access_token: "page-token",
    instagram_business_account: { id: "ig", username: "apecerto" },
  }]);
  assert.equal(selected.instagram_business_account.id, "ig");
});

test("hash de state é determinístico e não preserva o segredo", async () => {
  const state = "a".repeat(64);
  const hash = await sha256Hex(state);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, state);
  assert.equal(await sha256Hex(state), hash);
});
