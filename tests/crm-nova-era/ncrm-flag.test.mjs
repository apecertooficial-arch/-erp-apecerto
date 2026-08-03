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

/* Piloto fechado: corretores permanecem exclusivamente no funil atual. */

test("CRM 3.0 aparece apenas para gestao e canario", async () => {
  await withEnv({ NEXT_PUBLIC_CRM_NOVA_ERA_KILL: "false" }, (m) => {
    assert.equal(m.crmNovaEraLiberado("u1", { role: "admin" }), true);
    assert.equal(m.crmNovaEraLiberado("u2", { role: "gestor" }), true);
    assert.equal(m.crmNovaEraLiberado("u3", { role: "corretor" }), false);
    assert.equal(m.crmNovaEraLiberado("qualquer"), false, "papel ausente fecha o acesso");
    assert.equal(m.crmNovaEraLiberado("4dfdffae-0009-41de-8d6f-2365a06dc066", { role: "corretor" }), true,
      "canario explicito continua podendo validar");
  });
});

test("sem usuario autenticado nao ha CRM nenhum", async () => {
  await withEnv({ NEXT_PUBLIC_CRM_NOVA_ERA_KILL: "false" }, (m) => {
    assert.equal(m.crmNovaEraLiberado(null, { role: "admin" }), false);
    assert.equal(m.crmNovaEraLiberado(undefined), false);
    assert.equal(m.crmNovaEraLiberado(""), false);
  });
});

test("kill-switch devolve todos ao CRM antigo, menos o canario", async () => {
  await withEnv({ NEXT_PUBLIC_CRM_NOVA_ERA_KILL: "true" }, (m) => {
    assert.equal(m.crmNovaEraLiberado("u1", { role: "admin" }), false, "admin comum volta ao antigo");
    assert.equal(m.crmNovaEraLiberado("u2", { role: "corretor" }), false);
    assert.equal(m.crmNovaEraLiberado("4dfdffae-0009-41de-8d6f-2365a06dc066"), true, "canario segue no 3.0 para diagnosticar");
  });
});

test("a flag antiga nao libera corretor", async () => {
  await withEnv({ NEXT_PUBLIC_CRM_NOVA_ERA_ENABLED: "false", NEXT_PUBLIC_CRM_NOVA_ERA_KILL: "false" }, (m) => {
    assert.equal(m.crmNovaEraLiberado("u1", { role: "corretor" }), false);
    assert.equal(m.crmNovaEraLiberado("u2", { role: "admin" }), true);
  });
});
