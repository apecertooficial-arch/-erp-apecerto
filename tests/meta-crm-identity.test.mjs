import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  hashedBrazilPhone,
  hashedEmail,
  normalizeBrazilPhone,
  normalizeEmail,
  sanitizeMetaCustomData,
} from "../supabase/functions/_shared/meta-identity.ts";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("identificadores consentidos sao normalizados antes do SHA-256", async () => {
  assert.equal(normalizeEmail("  TESTE@EXAMPLE.COM "), "teste@example.com");
  assert.equal(normalizeBrazilPhone("(11) 99999-9999"), "5511999999999");
  assert.equal(await hashedEmail("  TESTE@EXAMPLE.COM "), sha256("teste@example.com"));
  assert.equal(await hashedBrazilPhone("(11) 99999-9999"), sha256("5511999999999"));
});

test("identidade invalida nao vira hash e PII nao entra em custom_data", async () => {
  assert.equal(await hashedEmail("invalido"), "");
  assert.equal(await hashedBrazilPhone("123"), "");
  assert.deepEqual(
    sanitizeMetaCustomData({ email: "teste@example.com", telefone: "11999999999", stage: "lead" }),
    { stage: "lead" },
  );
});
