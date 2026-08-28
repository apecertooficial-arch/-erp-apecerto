import test from "node:test";
import assert from "node:assert/strict";
import { runProductsAuthSmoke } from "../scripts/smoke-products-auth.mjs";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const UNIT_ID = "22222222-2222-4222-8222-222222222222";
const TOKENS = { captor: "synthetic-captor-token", nonCaptor: "synthetic-non-captor-token", manager: "synthetic-manager-token" };

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function fixtureFetch({ leakOwner = false, nestedLeak = false, visitorLeak = false, managerHidden = false } = {}) {
  return async (url, options) => {
    const token = String(options.headers.Authorization ?? "").replace("Bearer ", "");
    const role = token === TOKENS.captor ? "captor" : token === TOKENS.nonCaptor ? "nonCaptor" : token === TOKENS.manager ? "manager" : "visitor";
    if (url.pathname === "/api/session") {
      if (role === "visitor") return response(visitorLeak ? { error: "Sessão necessária.", audit: { proprietario_id: "leak" } } : { error: "Sessão necessária." }, 401);
      return response({ active: true, role: role === "manager" ? "gestor" : "corretor", brokerId: role === "captor" ? 10 : role === "nonCaptor" ? 20 : null });
    }
    if (url.pathname === "/api/product") {
      if (role === "visitor") {
        return response(
          visitorLeak
            ? { error: "Sessão necessária.", audit: { proprietario_id: "leak" } }
            : { error: "Sessão necessária." },
          401,
        );
      }
      const canSee = role === "captor" || (role === "manager" && !managerHidden) || (role === "nonCaptor" && leakOwner);
      return response({ product: {
        proprietario_id: canSee ? "33333333-3333-4333-8333-333333333333" : null,
        proprietarios: canSee ? [{ synthetic: true }] : null,
        proprietario_nome: null,
        proprietario_tel: null,
        proprietario_email: null,
        midias: [{ id: "photo-1" }, { id: "photo-2" }],
        unidades: [{
          id: UNIT_ID,
          mine: role === "captor",
          pode_editar: role === "captor" || role === "manager",
          pode_ver_proprietario: canSee,
          proprietario_nome: canSee ? "Proprietário Sintético" : null,
          proprietario_contato: canSee ? "Contato Sintético" : null,
          ...(role === "nonCaptor" && nestedLeak ? { metadata: { proprietario_id: "44444444-4444-4444-8444-444444444444" } } : {}),
        }],
      } });
    }
    return response({ error: "not found" }, 404);
  };
}

const config = {
  baseUrl: "http://localhost:3001",
  captorToken: TOKENS.captor,
  nonCaptorToken: TOKENS.nonCaptor,
  managerToken: TOKENS.manager,
  confirmSynthetic: true,
  productId: PRODUCT_ID,
  unitId: UNIT_ID,
};

test("smoke read-only valida visitante, captador, não captador e gestão", async () => {
  const lines = [];
  const result = await runProductsAuthSmoke(config, { fetchImpl: fixtureFetch(), log: line => lines.push(line) });
  assert.equal(result.ok, true);
  assert.equal(Object.values(result.checks).every(Boolean), true);
  assert.equal(lines.length, 1);
  assert.doesNotMatch(lines[0], /synthetic-(?:captor|non-captor|manager)-token/);
});

test("smoke falha fechado se o não captador receber proprietário", async () => {
  await assert.rejects(runProductsAuthSmoke(config, { fetchImpl: fixtureFetch({ leakOwner: true }) }), /autorização indevida de proprietário/);
  await assert.rejects(runProductsAuthSmoke(config, { fetchImpl: fixtureFetch({ nestedLeak: true }) }), /proprietario_id/);
});

test("smoke falha fechado se visitante receber proprietário em qualquer nível", async () => {
  await assert.rejects(runProductsAuthSmoke(config, { fetchImpl: fixtureFetch({ visitorLeak: true }) }), /proprietario_id/);
});

test("smoke exige proprietário autorizado para gestão", async () => {
  await assert.rejects(runProductsAuthSmoke(config, { fetchImpl: fixtureFetch({ managerHidden: true }) }), /gestão não recebeu/);
});

test("smoke exige três sessões sintéticas distintas", async () => {
  await assert.rejects(runProductsAuthSmoke({ ...config, managerToken: TOKENS.captor }, { fetchImpl: fixtureFetch() }), /três sessões sintéticas precisam ser distintas/);
});

test("smoke rejeita origem arbitrária e execução sem confirmação sintética", async () => {
  await assert.rejects(runProductsAuthSmoke({ ...config, baseUrl: "https://evil.test.invalid" }, { fetchImpl: fixtureFetch() }), /allowlist/);
  await assert.rejects(runProductsAuthSmoke({ ...config, confirmSynthetic: false }, { fetchImpl: fixtureFetch() }), /fixtures sintéticas/);
});

test("erros e logs nunca incluem tokens", async () => {
  const logs = [];
  await assert.rejects(runProductsAuthSmoke({ ...config, productId: "inválido" }, { fetchImpl: fixtureFetch(), log: line => logs.push(line) }), /IDs sintéticos inválidos/);
  assert.equal(logs.join(""), "");
});
