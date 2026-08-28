import { pathToFileURL } from "node:url";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGER_ROLES = new Set(["admin", "gestor", "executivo", "gestor_comercial", "gestor_equipe"]);
const ALLOWED_ORIGINS = new Set(["https://apecerto-erp.onrender.com", "http://localhost", "http://localhost:3001", "http://127.0.0.1", "http://127.0.0.1:3001"]);
const OWNER_KEYS = new Set(["proprietario_id", "proprietario_nome", "proprietario_contato", "proprietario_tel", "proprietario_telefone", "proprietario_email", "proprietarios"]);

function required(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Configuração ausente: ${label}.`);
  return value.trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(fetchImpl, baseUrl, path, token) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchImpl(new URL(path, baseUrl), { method: "GET", headers, redirect: "error" });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function jsonRequest(fetchImpl, baseUrl, path, token) {
  const { response, body } = await request(fetchImpl, baseUrl, path, token);
  if (!response.ok) throw new Error(`Smoke autenticado recebeu HTTP ${response.status} em leitura.`);
  if (!body || typeof body !== "object") throw new Error("Smoke autenticado recebeu resposta inválida.");
  return body;
}

function unitFrom(body, unitId) {
  const units = Array.isArray(body?.product?.unidades) ? body.product.unidades : [];
  return units.find((unit) => unit?.id === unitId) ?? null;
}

function ownerVisible(unit, product) {
  return unit?.pode_ver_proprietario === true
    && (Boolean(unit?.proprietario_nome || unit?.proprietario_contato) || product?.proprietarios != null);
}

function assertNoOwnerValue(value, path = "payload") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoOwnerValue(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (OWNER_KEYS.has(key)) assert(item == null, `O payload contém ${key} em ${path}.${key}.`);
    assertNoOwnerValue(item, `${path}.${key}`);
  }
}

function assertOwnerHidden(unit, product, fullBody) {
  assert(unit?.pode_ver_proprietario === false, "O não captador recebeu autorização indevida de proprietário.");
  assertNoOwnerValue(fullBody);
}

export async function runProductsAuthSmoke(config, { fetchImpl = fetch, log = () => {} } = {}) {
  const baseUrl = new URL(required(config.baseUrl, "APECERTO_ERP_BASE_URL"));
  assert(ALLOWED_ORIGINS.has(baseUrl.origin), "A origem do ERP não pertence à allowlist do smoke.");
  assert(config.confirmSynthetic === true, "Confirme explicitamente que contas, produto, unidade e proprietário são fixtures sintéticas.");
  const captorToken = required(config.captorToken, "APECERTO_CAPTOR_ACCESS_TOKEN");
  const nonCaptorToken = required(config.nonCaptorToken, "APECERTO_NON_CAPTOR_ACCESS_TOKEN");
  const managerToken = required(config.managerToken, "APECERTO_MANAGER_ACCESS_TOKEN");
  assert(new Set([captorToken, nonCaptorToken, managerToken]).size === 3, "As três sessões sintéticas precisam ser distintas.");
  const productId = required(config.productId, "APECERTO_SMOKE_PRODUCT_ID");
  const unitId = required(config.unitId, "APECERTO_SMOKE_UNIT_ID");
  assert(UUID.test(productId) && UUID.test(unitId), "IDs sintéticos inválidos.");

  const visitor = await request(fetchImpl, baseUrl, `/api/product?id=${encodeURIComponent(productId)}`);
  assert(visitor.response.status === 401, "Visitante sem sessão não foi bloqueado com 401.");
  assert(visitor.body?.product == null, "Visitante sem sessão recebeu payload de produto.");
  assertNoOwnerValue(visitor.body);

  const [captorSession, nonCaptorSession, managerSession] = await Promise.all([
    jsonRequest(fetchImpl, baseUrl, "/api/session", captorToken),
    jsonRequest(fetchImpl, baseUrl, "/api/session", nonCaptorToken),
    jsonRequest(fetchImpl, baseUrl, "/api/session", managerToken),
  ]);
  assert(captorSession.active === true && captorSession.role === "corretor" && captorSession.brokerId != null, "A sessão de captador não é um corretor ativo.");
  assert(nonCaptorSession.active === true && nonCaptorSession.role === "corretor" && nonCaptorSession.brokerId != null, "A sessão de não captador não é um corretor ativo.");
  assert(captorSession.brokerId !== nonCaptorSession.brokerId, "Os perfis sintéticos precisam representar corretores diferentes.");
  assert(managerSession.active === true && MANAGER_ROLES.has(managerSession.role), "A sessão de gestão não possui papel ativo de Produtos.");

  const productPath = `/api/product?id=${encodeURIComponent(productId)}`;
  const [captorBody, nonCaptorBody, managerBody] = await Promise.all([
    jsonRequest(fetchImpl, baseUrl, productPath, captorToken),
    jsonRequest(fetchImpl, baseUrl, productPath, nonCaptorToken),
    jsonRequest(fetchImpl, baseUrl, productPath, managerToken),
  ]);
  const captorUnit = unitFrom(captorBody, unitId);
  const nonCaptorUnit = unitFrom(nonCaptorBody, unitId);
  const managerUnit = unitFrom(managerBody, unitId);
  assert(captorUnit && nonCaptorUnit && managerUnit, "A unidade sintética não apareceu para os três perfis.");

  assert(captorUnit.mine === true && captorUnit.pode_editar === true, "O captador não recebeu a própria unidade editável.");
  assert(ownerVisible(captorUnit, captorBody.product), "O captador não recebeu o proprietário sintético permitido.");
  assert(nonCaptorUnit.mine === false && nonCaptorUnit.pode_editar === false, "O não captador recebeu posse ou edição indevida.");
  assertOwnerHidden(nonCaptorUnit, nonCaptorBody.product, nonCaptorBody);
  assert(ownerVisible(managerUnit, managerBody.product), "A gestão não recebeu o proprietário sintético permitido.");

  const captorMedia = Array.isArray(captorBody.product?.midias) ? captorBody.product.midias : [];
  const nonCaptorMedia = Array.isArray(nonCaptorBody.product?.midias) ? nonCaptorBody.product.midias : [];
  const managerMedia = Array.isArray(managerBody.product?.midias) ? managerBody.product.midias : [];
  assert(captorMedia.length > 0 && nonCaptorMedia.length === captorMedia.length && managerMedia.length === captorMedia.length, "A galeria operacional não ficou igualmente visível para os três perfis.");

  const checks = {
    visitorDenied: true,
    distinctSyntheticProfiles: true,
    captorOwnsAndEdits: true,
    captorOwnerVisible: true,
    nonCaptorOwnerHidden: true,
    nonCaptorEditDenied: true,
    managerOwnerVisible: true,
    operationalMediaVisible: true,
  };
  log(JSON.stringify({ event: "products_auth_smoke", ok: true, checks: Object.keys(checks).length }));
  return { ok: true, checks };
}

function configFromEnvironment(env) {
  return {
    baseUrl: env.APECERTO_ERP_BASE_URL || "https://apecerto-erp.onrender.com",
    captorToken: env.APECERTO_CAPTOR_ACCESS_TOKEN,
    nonCaptorToken: env.APECERTO_NON_CAPTOR_ACCESS_TOKEN,
    managerToken: env.APECERTO_MANAGER_ACCESS_TOKEN,
    confirmSynthetic: env.APECERTO_SMOKE_CONFIRM_SYNTHETIC === "true",
    productId: env.APECERTO_SMOKE_PRODUCT_ID,
    unitId: env.APECERTO_SMOKE_UNIT_ID,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductsAuthSmoke(configFromEnvironment(process.env), { log: console.log }).catch((error) => {
    console.error(JSON.stringify({ event: "products_auth_smoke", ok: false, error: error instanceof Error ? error.message : "Falha desconhecida." }));
    process.exitCode = 1;
  });
}
