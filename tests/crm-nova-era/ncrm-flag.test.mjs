// CRM Nova Era — testes do gate de feature flag (visibilidade; a autorização real é do banco).
// Executar: node --test tests/crm-nova-era/ncrm-flag.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

const MOD = "../../app/features/crm-nova-era/featureFlag.ts";
let bust = 0;
async function withEnv(env, fn) {
  const prev = {};
  for (const k of Object.keys(env)) { prev[k] = process.env[k]; process.env[k] = env[k]; }
  try {
    const m = await import(`${MOD}?b=${bust++}`); // cache-bust: reler env no topo do módulo
    await fn(m);
  } finally {
    for (const k of Object.keys(env)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; }
  }
}

test("flag desligada => sempre false (todos veem o CRM antigo)", async () => {
  await withEnv({ NEXT_PUBLIC_CRM_NOVA_ERA_ENABLED: "false", NEXT_PUBLIC_CRM_NOVA_ERA_ALLOWLIST: "u1" }, (m) => {
    assert.equal(m.crmNovaEraLiberado("u1", { role: "admin" }), false);
    assert.equal(m.crmNovaEraLiberado("u1", { role: "corretor" }), false);
  });
});

test("canário compilado libera somente Samuel mesmo sem flag client-side", async () => {
  await withEnv({ NEXT_PUBLIC_CRM_NOVA_ERA_ENABLED: "false", NEXT_PUBLIC_CRM_NOVA_ERA_ALLOWLIST: "" }, (m) => {
    assert.equal(m.crmNovaEraLiberado("4dfdffae-0009-41de-8d6f-2365a06dc066", { role: "admin" }), true);
    assert.equal(m.crmNovaEraLiberado("outro-admin", { role: "admin" }), false);
  });
});

test("flag ligada: admin sempre liberado; corretor fora da allowlist não", async () => {
  await withEnv({ NEXT_PUBLIC_CRM_NOVA_ERA_ENABLED: "true", NEXT_PUBLIC_CRM_NOVA_ERA_ALLOWLIST: "" }, (m) => {
    assert.equal(m.crmNovaEraLiberado("qualquer", { role: "admin" }), true);
    assert.equal(m.crmNovaEraLiberado("qualquer", { role: "corretor" }), false);
    assert.equal(m.crmNovaEraLiberado(null, { role: "admin" }), false, "sem userId => false");
  });
});

test("flag ligada: allowlist libera apenas os ids listados", async () => {
  await withEnv({ NEXT_PUBLIC_CRM_NOVA_ERA_ENABLED: "true", NEXT_PUBLIC_CRM_NOVA_ERA_ALLOWLIST: "u1,u2" }, (m) => {
    assert.equal(m.crmNovaEraLiberado("u1", { role: "corretor" }), true);
    assert.equal(m.crmNovaEraLiberado("u3", { role: "corretor" }), false);
  });
});
