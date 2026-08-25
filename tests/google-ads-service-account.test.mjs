import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { createServiceAccountAssertion, GOOGLE_ADS_SCOPE } from "../supabase/functions/marketing-ads-read/google-service-account.ts";

const decodeBase64Url = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
};

test("gera uma assertion RS256 válida para o escopo do Google Ads", async () => {
  const keys = await webcrypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const privateDer = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey));
  const privateKey = `-----BEGIN PRIVATE KEY-----\n${privateDer.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
  const now = Date.UTC(2026, 7, 25, 12, 0, 0);
  const credentials = JSON.stringify({
    client_email: "google-ads-erp@example-project.iam.gserviceaccount.com",
    private_key: privateKey,
    token_uri: "https://oauth2.googleapis.com/token",
  });

  const result = await createServiceAccountAssertion(credentials, now);
  assert.ok(result);
  const [header, claims, signature] = result.assertion.split(".");
  assert.deepEqual(JSON.parse(decodeBase64Url(header)), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(JSON.parse(decodeBase64Url(claims)), {
    iss: "google-ads-erp@example-project.iam.gserviceaccount.com",
    scope: GOOGLE_ADS_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
  });
  assert.equal(await webcrypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    keys.publicKey,
    decodeBase64Url(signature),
    new TextEncoder().encode(`${header}.${claims}`),
  ), true);
});

test("rejeita credenciais incompletas sem expor detalhes", async () => {
  assert.equal(await createServiceAccountAssertion("{}"), null);
  assert.equal(await createServiceAccountAssertion("não é json"), null);
});
