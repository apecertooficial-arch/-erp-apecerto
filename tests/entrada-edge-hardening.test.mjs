import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyQueueFailure,
  firstScalarString,
  MAX_ENTRADA_BYTES,
  normalizePayloadEntrada,
  parseQueueSuccess,
  stableJson,
} from "../supabase/functions/_shared/entrada-policy.ts";

const source = readFileSync(new URL("../supabase/functions/entrada/index.ts", import.meta.url), "utf8");

test("payload válido normaliza contato e preserva campos declarados pela automação", () => {
  const result = normalizePayloadEntrada({
    full_name: "  Cliente sanitizado  ",
    whatsapp: "+55 (11) 90000-0000",
    email: " cliente@example.invalid ",
    campaign_name: "Campanha sanitizada",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.lead.nome, "Cliente sanitizado");
  assert.equal(result.lead.telefone, "5511900000000");
  assert.equal(result.lead.email, "cliente@example.invalid");
  assert.equal(result.lead.campaign_name, "Campanha sanitizada");
  assert.equal(Object.getPrototypeOf(result.lead), null);
});

test("identificador numérico também gera chave explícita estável", () => {
  assert.equal(firstScalarString(undefined, 123456, "outro"), "123456");
  assert.equal(firstScalarString({}, false, "  "), "");
});

test("payload não objeto, grande, profundo ou com campo de protótipo falha antes da fila", () => {
  assert.deepEqual(normalizePayloadEntrada(null), { ok: false, error: "INVALID_PAYLOAD", status: 400 });
  assert.deepEqual(normalizePayloadEntrada([]), { ok: false, error: "INVALID_PAYLOAD", status: 400 });
  const grande = normalizePayloadEntrada({ texto: "x".repeat(MAX_ENTRADA_BYTES + 1) });
  assert.deepEqual(grande, { ok: false, error: "PAYLOAD_TOO_LARGE", status: 413 });
  let profundo = {};
  for (let i = 0; i < 24; i += 1) profundo = { nivel: profundo };
  assert.deepEqual(normalizePayloadEntrada(profundo), { ok: false, error: "PAYLOAD_TOO_COMPLEX", status: 400 });
  const reservado = JSON.parse('{"__proto__":{"admin":true}}');
  assert.deepEqual(normalizePayloadEntrada(reservado), { ok: false, error: "UNSAFE_FIELD", status: 400 });
});

test("JSON canônico não depende da ordem das chaves", () => {
  assert.equal(stableJson({ b: 2, a: { d: 4, c: 3 } }), stableJson({ a: { c: 3, d: 4 }, b: 2 }));
});

test("falha da fila distingue conflito sem devolver a resposta do banco", () => {
  assert.deepEqual(classifyQueueFailure(400, JSON.stringify({ code: "23505", message: "IDEMPOTENCY_CONFLICT: detalhe interno" })), { error: "IDEMPOTENCY_CONFLICT", status: 409 });
  assert.deepEqual(classifyQueueFailure(500, "stack e SQL internos"), { error: "AUTOMATION_QUEUE_REJECTED", status: 502 });
});

test("sucesso da fila exige contrato completo e fila positiva", () => {
  assert.deepEqual(parseQueueSuccess('{"ok":true,"duplicado":false,"fila_id":17}'), { fila_id: 17, duplicado: false });
  assert.deepEqual(parseQueueSuccess('{"ok":true,"duplicado":true,"fila_id":"18"}'), { fila_id: 18, duplicado: true });
  assert.equal(parseQueueSuccess('{"ok":true,"fila_id":null}'), null);
  assert.equal(parseQueueSuccess('{"fila_id":19,"duplicado":false}'), null);
  assert.equal(parseQueueSuccess('{"ok":true,"fila_id":19}'), null);
  assert.equal(parseQueueSuccess('{"ok":false,"fila_id":19}'), null);
  assert.equal(parseQueueSuccess('não-json'), null);
});

test("Edge falha fechada sem expor Postgres, configuração ou exceção", () => {
  assert.match(source, /if \(!automationResponse\.ok\)/);
  assert.match(source, /AUTOMATION_LOOKUP_FAILED/);
  assert.match(source, /AUTOMATION_LOOKUP_INVALID_RESPONSE/);
  assert.match(source, /SERVICE_CONFIGURATION_UNAVAILABLE/);
  assert.match(source, /AUTOMATION_QUEUE_INVALID_RESPONSE/);
  assert.doesNotMatch(source, /detail:\s*rawQueueResult/);
  assert.doesNotMatch(source, /detail:\s*String\(error\)/);
  assert.match(source, /ultima_entrada: body/);
});
