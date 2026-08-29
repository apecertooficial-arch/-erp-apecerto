import test from "node:test";
import assert from "node:assert/strict";
import { runProductsIsolatedSmoke } from "../scripts/smoke-products-isolated.mjs";
import { createHash, createHmac } from "node:crypto";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const UNIT_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";
const MEDIA_IDS = ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"];
const TOKENS = { captor: "fixture-captor-token", nonCaptor: "fixture-non-captor-token", manager: "fixture-manager-token", inactive: "fixture-inactive-token" };
const MARKER = "CODEX_SMOKE_PRODUCTS_RUN_20260828";
const PROOF_SECRET = "fixture-isolated-proof-secret-20260828";
const ISOLATED_REF_HASH = createHash("sha256").update("fixture-isolated-ref").digest("hex");
const PRODUCTION_REF_HASH = createHash("sha256").update("fixture-production-ref").digest("hex");
const CAPTOR_USER_ID = "66666666-6666-4666-8666-666666666666";
const NON_CAPTOR_USER_ID = "77777777-7777-4777-8777-777777777777";
const LINKED_PATH = `${NON_CAPTOR_USER_ID}/${PRODUCT_ID}/codex_smoke_products_run_20260828-linked.png`;

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function roleFrom(options) {
  const token = String(options.headers.Authorization ?? "").replace("Bearer ", "");
  if (token === TOKENS.captor) return "captor";
  if (token === TOKENS.nonCaptor) return "nonCaptor";
  if (token === TOKENS.manager) return "manager";
  if (token === TOKENS.inactive) return "inactive";
  return "visitor";
}

function fixtureFetch({ leakOwner = false, leakDraft = false, allowNonCaptorEdit = false, staleDraftStatus = 409, missingMarker = false, failActionOnce = null } = {}) {
  let failedAction = false;
  const state = {
    unit: {
      id: UNIT_ID,
      numero: "101",
      tipologia: "2 dormitórios",
      area_m2: 74,
      vagas: 1,
      titulo_comercial: missingMarker ? "Fixture sem marcador" : MARKER,
      descricao_comercial: "Descrição comercial sintética longa e sem qualquer dado pessoal ou endereço real.",
      seo_titulo: "Fixture sintética",
      seo_descricao: "Fixture sintética para smoke isolado.",
      valor_tabela: 500000,
      valor_promo: null,
      disponivel: true,
      compre_ja_alugado: false,
      condominio_valor: 900,
      iptu: 200,
      outros_custos: 0,
      proprietario_nome: "Proprietário Fixture",
      proprietario_contato: "fixture-owner@example.invalid",
      acesso_tipo: "portaria",
      acesso_codigo: null,
      acesso_instrucoes: "Instrução sintética",
      aprovacao: "pendente",
      publicado: false,
    },
    media: [
      { id: MEDIA_IDS[0], unidade_id: UNIT_ID, categoria: "sala", alt_text: "Sala sintética", is_capa: true, ordem: 0, url: "https://fixture.supabase.co/storage/v1/object/sign/empreendimentos/opaco-1" },
      { id: MEDIA_IDS[1], unidade_id: UNIT_ID, categoria: "quarto", alt_text: "Quarto sintético", is_capa: false, ordem: 1, url: "https://fixture.supabase.co/storage/v1/object/sign/empreendimentos/opaco-2" },
    ],
    drafts: new Map(),
    storage: new Set([LINKED_PATH]),
  };

  const fetchImpl = async (url, options) => {
    const role = roleFrom(options);

    if (url.hostname === "fixture.supabase.invalid") {
      const deleteBody = options.method === "DELETE" ? JSON.parse(options.body ?? "{}") : null;
      const path = options.method === "DELETE"
        ? deleteBody?.prefixes?.[0]
        : decodeURIComponent(url.pathname.replace("/storage/v1/object/empreendimentos/", ""));
      if (options.method === "GET") return role === "captor" && state.storage.has(path)
        ? response({ synthetic: true })
        : response({ error: "privado" }, 400);
      if (options.method === "POST") {
        if (role !== "captor") return response({ error: "negado" }, 403);
        state.storage.add(path); return response({ Key: path });
      }
      if (options.method === "DELETE") {
        if (url.pathname !== "/storage/v1/object/empreendimentos" || !Array.isArray(deleteBody?.prefixes) || deleteBody.prefixes.length !== 1) {
          return response({ error: "contrato inválido" }, 405);
        }
        if (path === LINKED_PATH && role === "nonCaptor") return response({ error: "negado" }, 403);
        if (!state.storage.has(path)) return response({ error: "ausente" }, 404);
        state.storage.delete(path); return response({});
      }
    }
    const body = options.body ? JSON.parse(options.body) : null;

    if (url.pathname === "/api/products-smoke-environment") {
      const challenge = url.searchParams.get("challenge");
      return response({ isolated: true, projectRefHash: ISOLATED_REF_HASH, signature: createHmac("sha256", PROOF_SECRET).update(`${challenge}|${ISOLATED_REF_HASH}|true`).digest("hex") });
    }

    if (url.pathname === "/api/session") {
      if (role === "visitor") return response({ error: "Sessão necessária." }, 401);
      return response({
        active: role !== "inactive",
        role: role === "manager" ? "gestor" : "corretor",
        brokerId: role === "captor" ? 10 : role === "nonCaptor" ? 20 : null,
        userId: role === "captor" ? CAPTOR_USER_ID : role === "nonCaptor" ? NON_CAPTOR_USER_ID : "88888888-8888-4888-8888-888888888888",
      });
    }

    if (url.pathname === "/api/product" && options.method === "GET") {
      if (role === "visitor") return response({ error: "Sessão necessária." }, 401);
      if (role === "inactive") return response({ error: "Sessão inválida ou expirada." }, 401);
      const canSeeOwner = role === "captor" || role === "manager" || (role === "nonCaptor" && leakOwner);
      return response({ product: {
        nome: missingMarker ? "Produto fixture" : MARKER,
        proprietario_id: canSeeOwner ? OWNER_ID : null,
        proprietarios: canSeeOwner ? { id: OWNER_ID, fixture: true } : null,
        midias: state.media.map((item) => ({ ...item })),
        unidades: [{
          ...state.unit,
          mine: role === "captor",
          pode_editar: role === "captor" || role === "manager",
          pode_ver_proprietario: canSeeOwner,
          proprietario_nome: canSeeOwner ? state.unit.proprietario_nome : null,
          proprietario_contato: canSeeOwner ? state.unit.proprietario_contato : null,
        }],
      } });
    }

    if (url.pathname === "/api/product" && options.method === "PATCH") {
      const canEdit = role === "captor" || role === "manager" || (role === "nonCaptor" && allowNonCaptorEdit);
      if (!canEdit) return response({ error: "Acesso negado." }, 403);
      if (body.action === failActionOnce && !failedAction) {
        failedAction = true;
        return response({ error: "Falha sintética." }, 502);
      }
      if (body.action === "updateUnit") {
        state.unit = { ...state.unit, ...body.unidade };
        return response({ success: true });
      }
      if (body.action === "setUnitAvailability") {
        state.unit.disponivel = body.disponivel === true;
        return response({ success: true, unidadeId: UNIT_ID, disponivel: state.unit.disponivel, publicado: false });
      }
      if (body.action === "updateMedia") {
        const media = state.media.find((item) => item.id === body.mediaId);
        if (!media) return response({ error: "Mídia não encontrada." }, 404);
        media.categoria = body.category;
        if (body.altText !== undefined) media.alt_text = body.altText;
        return response({ success: true });
      }
      if (body.action === "setCover") {
        for (const media of state.media) media.is_capa = media.id === body.mediaId;
        return response({ success: true });
      }
      if (body.action === "reorderMedia") {
        body.mediaIds.forEach((id, index) => { state.media.find((item) => item.id === id).ordem = index; });
        return response({ success: true });
      }
      return response({ error: "Ação desconhecida." }, 422);
    }

    if (url.pathname === "/api/capture" && options.method === "GET") {
      const draft = leakDraft && role === "nonCaptor" ? state.drafts.get("captor") : state.drafts.get(role);
      return response({ draft: draft ? structuredClone(draft) : {} });
    }

    if (url.pathname === "/api/capture" && options.method === "POST") {
      if (body.action === "deleteDraft") {
        state.drafts.delete(role);
        return response({ ok: true });
      }
      if (body.action === "saveDraft") {
        const current = state.drafts.get(role);
        if (current && body.expectedVersion !== current.versao) return response({ error: "Conflito." }, staleDraftStatus);
        const versao = (current?.versao ?? 0) + 1;
        state.drafts.set(role, { payload: body.payload, etapa: body.step, versao });
        return response({ ok: true, versao });
      }
    }

    return response({ error: "Não encontrado." }, 404);
  };
  return { fetchImpl, state };
}

const config = {
  baseUrl: "http://127.0.0.1:3001",
  isolationProof: "confirmed-isolated-no-real-data",
  expectedProjectRefHash: ISOLATED_REF_HASH,
  productionProjectRefHash: PRODUCTION_REF_HASH,
  proofSecret: PROOF_SECRET,
  supabaseUrl: "https://fixture.supabase.invalid",
  publishableKey: "sb_publishable_fixture",
  foreignLinkedMediaPath: LINKED_PATH,
  confirmSynthetic: true,
  captorToken: TOKENS.captor,
  nonCaptorToken: TOKENS.nonCaptor,
  managerToken: TOKENS.manager,
  inactiveToken: TOKENS.inactive,
  productId: PRODUCT_ID,
  unitId: UNIT_ID,
  mediaIds: MEDIA_IDS,
  runMarker: MARKER,
};

test("smoke mutável isolado cobre visitante, três perfis, unidade, mídia, rascunho e restauração", async () => {
  const fixture = fixtureFetch();
  const original = structuredClone({ unit: fixture.state.unit, media: fixture.state.media });
  const logs = [];
  const result = await runProductsIsolatedSmoke(config, { fetchImpl: fixture.fetchImpl, log: line => logs.push(line) });
  assert.equal(result.ok, true);
  assert.equal(Object.values(result.checks).every(Boolean), true);
  assert.deepEqual(fixture.state.unit, original.unit);
  assert.deepEqual(fixture.state.media, original.media);
  assert.equal(fixture.state.drafts.size, 0);
  assert.deepEqual([...fixture.state.storage], [LINKED_PATH]);
  assert.equal(logs.length, 1);
  assert.doesNotMatch(logs[0], /fixture-(?:captor|non-captor|manager)-token/);
});

test("smoke mutável bloqueia produção antes de qualquer chamada", async () => {
  let calls = 0;
  for (const baseUrl of ["https://apecerto-erp.onrender.com", "https://apecerto-erp.onrender.com./"]) {
    await assert.rejects(runProductsIsolatedSmoke({ ...config, baseUrl, approvedIsolatedOrigin: baseUrl }, {
      fetchImpl: async () => { calls += 1; return response({}); },
    }), /Produção é bloqueada/);
  }
  assert.equal(calls, 0);
});

test("localhost também exige prova explícita de isolamento", async () => {
  let calls = 0;
  await assert.rejects(runProductsIsolatedSmoke({ ...config, isolationProof: undefined }, {
    fetchImpl: async () => { calls += 1; return response({}); },
  }), /prova explícita de isolamento/);
  assert.equal(calls, 0);
});

test("preview exige origem exata e prova explícita de isolamento", async () => {
  const fixture = fixtureFetch();
  await assert.rejects(runProductsIsolatedSmoke({ ...config, baseUrl: "https://preview.example.invalid" }, { fetchImpl: fixture.fetchImpl }), /Configuração ausente/);
  await assert.rejects(runProductsIsolatedSmoke({
    ...config,
    baseUrl: "https://preview.example.invalid",
    approvedIsolatedOrigin: "https://outro.example.invalid",
    isolationProof: "confirmed-isolated-no-real-data",
  }, { fetchImpl: fixture.fetchImpl }), /não coincide/);
});

test("smoke exige project ref distinto de produção e prova assinada", async () => {
  const fixture = fixtureFetch();
  await assert.rejects(runProductsIsolatedSmoke({ ...config, productionProjectRefHash: ISOLATED_REF_HASH }, { fetchImpl: fixture.fetchImpl }), /coincide com produção/);
  await assert.rejects(runProductsIsolatedSmoke({ ...config, proofSecret: "segredo-incorreto-com-tamanho-minimo-123" }, { fetchImpl: fixture.fetchImpl }), /Assinatura da prova/);
});

test("smoke falha fechado se não captador receber proprietário", async () => {
  const fixture = fixtureFetch({ leakOwner: true });
  await assert.rejects(runProductsIsolatedSmoke(config, { fetchImpl: fixture.fetchImpl }), /autorização de proprietário|proprietario_id/);
});

test("smoke falha se chamada forjada permitir edição do não captador", async () => {
  const fixture = fixtureFetch({ allowNonCaptorEdit: true });
  await assert.rejects(runProductsIsolatedSmoke(config, { fetchImpl: fixture.fetchImpl }), /deveria retornar HTTP 403/);
});

test("smoke exige conflito 409 no rascunho obsoleto", async () => {
  const fixture = fixtureFetch({ staleDraftStatus: 200 });
  await assert.rejects(runProductsIsolatedSmoke(config, { fetchImpl: fixture.fetchImpl }), /deveria retornar HTTP 409/);
});

test("smoke detecta rascunho do captador vazado ao não captador", async () => {
  const fixture = fixtureFetch({ leakDraft: true });
  await assert.rejects(runProductsIsolatedSmoke(config, { fetchImpl: fixture.fetchImpl }), /rascunho privado do captador/);
  assert.equal(fixture.state.drafts.size, 0);
});

test("smoke recusa fixture sem marcador antes da primeira escrita", async () => {
  const fixture = fixtureFetch({ missingMarker: true });
  const original = structuredClone({ unit: fixture.state.unit, media: fixture.state.media });
  await assert.rejects(runProductsIsolatedSmoke(config, { fetchImpl: fixture.fetchImpl }), /não contém o marcador sintético/);
  assert.deepEqual({ unit: fixture.state.unit, media: fixture.state.media }, original);
});

test("falha intermediária ainda executa cleanup compensatório", async () => {
  const fixture = fixtureFetch({ failActionOnce: "setCover" });
  const original = structuredClone({ unit: fixture.state.unit, media: fixture.state.media });
  await assert.rejects(runProductsIsolatedSmoke(config, { fetchImpl: fixture.fetchImpl }), /HTTP 502/);
  assert.deepEqual(fixture.state.unit, original.unit);
  assert.deepEqual(fixture.state.media, original.media);
  assert.equal(fixture.state.drafts.size, 0);
});

test("smoke rejeita ausência de confirmação sintética e IDs inválidos", async () => {
  const fixture = fixtureFetch();
  await assert.rejects(runProductsIsolatedSmoke({ ...config, confirmSynthetic: false }, { fetchImpl: fixture.fetchImpl }), /fixtures sintéticas/);
  await assert.rejects(runProductsIsolatedSmoke({ ...config, unitId: "inválido" }, { fetchImpl: fixture.fetchImpl }), /IDs sintéticos/);
});
