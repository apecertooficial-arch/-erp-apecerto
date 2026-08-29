import { pathToFileURL } from "node:url";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGER_ROLES = new Set(["admin", "gestor", "executivo", "gestor_comercial", "gestor_equipe"]);
const PRODUCTION_HOSTNAME = "apecerto-erp.onrender.com";
const ISOLATION_PROOF = "confirmed-isolated-no-real-data";
const OWNER_KEYS = new Set([
  "proprietario_id", "proprietario_nome", "proprietario_contato", "proprietario_tel",
  "proprietario_telefone", "proprietario_email", "proprietarios",
]);

function required(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Configuração ausente: ${label}.`);
  return value.trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isLocalOrigin(origin) {
  const url = new URL(origin);
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
}

function assertIsolatedOrigin(baseUrl, config) {
  const hostname = baseUrl.hostname.toLowerCase().replace(/\.+$/, "");
  assert(hostname !== PRODUCTION_HOSTNAME, "Produção é bloqueada por definição neste smoke mutável.");
  assert(config.isolationProof === ISOLATION_PROOF, "Falta a prova explícita de isolamento e ausência de dados reais.");
  if (isLocalOrigin(baseUrl.origin)) return;
  const approvedOrigin = new URL(required(config.approvedIsolatedOrigin, "APECERTO_ISOLATED_APPROVED_ORIGIN")).origin;
  assert(baseUrl.origin === approvedOrigin, "A origem não coincide com o preview isolado aprovado.");
}

async function verifyEnvironmentProof(fetchImpl, baseUrl, config) {
  const expectedHash = required(config.expectedProjectRefHash, "APECERTO_ISOLATED_PROJECT_REF_SHA256").toLowerCase();
  const productionHash = required(config.productionProjectRefHash, "APECERTO_PRODUCTION_PROJECT_REF_SHA256").toLowerCase();
  const proofSecret = required(config.proofSecret, "APECERTO_ISOLATED_SMOKE_PROOF_SECRET");
  assert(/^[0-9a-f]{64}$/.test(expectedHash) && /^[0-9a-f]{64}$/.test(productionHash), "Hashes de project ref inválidos.");
  assert(expectedHash !== productionHash, "O project ref isolado coincide com produção.");
  assert(proofSecret.length >= 32, "O segredo de prova isolada é inválido.");
  const challenge = randomBytes(24).toString("hex");
  const proof = await expectOk(fetchImpl, baseUrl, `/api/products-smoke-environment?challenge=${challenge}`, {}, "prova server-side de isolamento");
  assert(proof.isolated === true && proof.projectRefHash === expectedHash && /^[0-9a-f]{64}$/.test(proof.signature ?? ""), "Prova server-side de isolamento inválida.");
  const expectedSignature = createHmac("sha256", proofSecret).update(`${challenge}|${expectedHash}|true`).digest();
  const receivedSignature = Buffer.from(proof.signature, "hex");
  assert(receivedSignature.length === expectedSignature.length && timingSafeEqual(receivedSignature, expectedSignature), "Assinatura da prova de isolamento inválida.");
}

function safeError(status, operation) {
  return new Error(`Smoke isolado recebeu HTTP ${status} em ${operation}.`);
}

async function request(fetchImpl, baseUrl, path, { token, method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetchImpl(new URL(path, baseUrl), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
  });
  const payload = await response.json().catch(() => null);
  return { response, body: payload };
}

async function expectStatus(fetchImpl, baseUrl, path, options, expected, operation) {
  const result = await request(fetchImpl, baseUrl, path, options);
  assert(result.response.status === expected, `${operation} deveria retornar HTTP ${expected}, mas retornou ${result.response.status}.`);
  return result.body;
}

async function expectOk(fetchImpl, baseUrl, path, options, operation) {
  const result = await request(fetchImpl, baseUrl, path, options);
  if (!result.response.ok) throw safeError(result.response.status, operation);
  assert(result.body && typeof result.body === "object", `${operation} recebeu resposta inválida.`);
  return result.body;
}

async function storageCall(fetchImpl, config, token, path, method, body) {
  const base = new URL(required(config.supabaseUrl, "APECERTO_ISOLATED_SUPABASE_URL"));
  const publishableKey = required(config.publishableKey, "APECERTO_ISOLATED_SUPABASE_PUBLISHABLE_KEY");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return fetchImpl(new URL(`/storage/v1/object/empreendimentos/${encoded}`, base), {
    method,
    headers: { apikey: publishableKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "image/png" } : {}) },
    body,
    redirect: "error",
  });
}

async function storageDelete(fetchImpl, config, token, path) {
  const base = new URL(required(config.supabaseUrl, "APECERTO_ISOLATED_SUPABASE_URL"));
  const publishableKey = required(config.publishableKey, "APECERTO_ISOLATED_SUPABASE_PUBLISHABLE_KEY");
  return fetchImpl(new URL("/storage/v1/object/empreendimentos", base), {
    method: "DELETE",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: [path] }),
    redirect: "error",
  });
}

async function verifyPrivateStorage(fetchImpl, config, sessions, tokens, productId, marker) {
  const captorUserId = required(sessions.captor.userId, "userId sintético do captador");
  const nonCaptorUserId = required(sessions.nonCaptor.userId, "userId sintético do não captador");
  assert(UUID.test(captorUserId) && UUID.test(nonCaptorUserId), "IDs das sessões sintéticas são inválidos.");
  const suffix = marker.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const orphanPath = `${captorUserId}/${productId}/${suffix}-orphan.png`;
  const forgedPath = `${nonCaptorUserId}/${productId}/${suffix}-forged.png`;
  const linkedPath = required(config.foreignLinkedMediaPath, "APECERTO_SMOKE_FOREIGN_LINKED_MEDIA_PATH");
  assert(linkedPath.startsWith(`${nonCaptorUserId}/${productId}/`) && linkedPath.includes(suffix), "Path vinculado sintético não corresponde ao não captador/produto/marcador.");
  const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137]);

  const direct = await storageCall(fetchImpl, config, null, linkedPath, "GET");
  assert(!direct.ok, "Bucket privado respondeu diretamente sem sessão.");
  const allowedUpload = await storageCall(fetchImpl, config, tokens.captor, orphanPath, "POST", png);
  assert(allowedUpload.ok, `Upload sintético autorizado falhou com HTTP ${allowedUpload.status}.`);
  const orphanCleanup = await storageDelete(fetchImpl, config, tokens.captor, orphanPath);
  assert(orphanCleanup.ok, `Cleanup de órfão sintético falhou com HTTP ${orphanCleanup.status}.`);

  const forgedUpload = await storageCall(fetchImpl, config, tokens.nonCaptor, forgedPath, "POST", png);
  if (forgedUpload.ok) {
    await storageDelete(fetchImpl, config, tokens.nonCaptor, forgedPath);
    throw new Error("Upload forjado do não captador foi aceito.");
  }
  const linkedBefore = await storageCall(fetchImpl, config, tokens.captor, linkedPath, "GET");
  assert(linkedBefore.ok, `Mídia vinculada sintética não existia antes do teste (HTTP ${linkedBefore.status}).`);
  const linkedDelete = await storageDelete(fetchImpl, config, tokens.nonCaptor, linkedPath);
  assert([400, 403, 404].includes(linkedDelete.status), `Antigo uploader não captador removeu mídia vinculada (HTTP ${linkedDelete.status}).`);
  const linkedAfter = await storageCall(fetchImpl, config, tokens.captor, linkedPath, "GET");
  assert(linkedAfter.ok, `Mídia vinculada desapareceu após DELETE negado (HTTP ${linkedAfter.status}).`);
}

function unitFrom(body, unitId) {
  const units = Array.isArray(body?.product?.unidades) ? body.product.unidades : [];
  return units.find((unit) => unit?.id === unitId) ?? null;
}

function mediaFrom(body, mediaId) {
  const media = Array.isArray(body?.product?.midias) ? body.product.midias : [];
  return media.find((item) => item?.id === mediaId) ?? null;
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

function ownerVisible(unit, product) {
  return unit?.pode_ver_proprietario === true
    && (Boolean(unit?.proprietario_nome || unit?.proprietario_contato) || product?.proprietarios != null);
}

function unitPayload(unit, marker) {
  return {
    numero: unit.numero,
    tipologia: unit.tipologia,
    area_m2: unit.area_m2,
    vagas: unit.vagas,
    titulo_comercial: marker,
    descricao_comercial: unit.descricao_comercial,
    seo_titulo: unit.seo_titulo,
    seo_descricao: unit.seo_descricao,
    valor_tabela: unit.valor_tabela,
    valor_promo: unit.valor_promo,
    disponivel: unit.disponivel,
    compre_ja_alugado: unit.compre_ja_alugado,
    condominio_valor: unit.condominio_valor,
    iptu: unit.iptu,
    outros_custos: unit.outros_custos,
    proprietario_nome: unit.proprietario_nome,
    proprietario_contato: unit.proprietario_contato,
    acesso_tipo: unit.acesso_tipo,
    acesso_codigo: unit.acesso_codigo,
    acesso_instrucoes: unit.acesso_instrucoes,
  };
}

function draftVersion(body) {
  return Number.isSafeInteger(body?.versao) ? body.versao : null;
}

export async function runProductsIsolatedSmoke(config, { fetchImpl = fetch, log = () => {} } = {}) {
  const baseUrl = new URL(required(config.baseUrl, "APECERTO_ERP_BASE_URL"));
  assertIsolatedOrigin(baseUrl, config);
  assert(config.confirmSynthetic === true, "Confirme que todo o ambiente contém somente fixtures sintéticas.");
  await verifyEnvironmentProof(fetchImpl, baseUrl, config);

  const captorToken = required(config.captorToken, "APECERTO_CAPTOR_ACCESS_TOKEN");
  const nonCaptorToken = required(config.nonCaptorToken, "APECERTO_NON_CAPTOR_ACCESS_TOKEN");
  const managerToken = required(config.managerToken, "APECERTO_MANAGER_ACCESS_TOKEN");
  const inactiveToken = required(config.inactiveToken, "APECERTO_INACTIVE_ACCESS_TOKEN");
  assert(new Set([captorToken, nonCaptorToken, managerToken, inactiveToken]).size === 4, "As quatro sessões sintéticas precisam ser distintas.");

  const productId = required(config.productId, "APECERTO_SMOKE_PRODUCT_ID");
  const unitId = required(config.unitId, "APECERTO_SMOKE_UNIT_ID");
  const mediaIds = Array.isArray(config.mediaIds) ? config.mediaIds : [];
  const marker = required(config.runMarker, "APECERTO_SMOKE_RUN_MARKER");
  assert(UUID.test(productId) && UUID.test(unitId), "IDs sintéticos de produto ou unidade são inválidos.");
  assert(mediaIds.length >= 2 && mediaIds.every((id) => UUID.test(id)) && new Set(mediaIds).size === mediaIds.length, "Informe ao menos duas mídias sintéticas distintas.");
  assert(/^CODEX_SMOKE_PRODUCTS_[A-Z0-9_-]{6,80}$/.test(marker), "O marcador sintético não segue o prefixo obrigatório.");

  const productPath = `/api/product?id=${encodeURIComponent(productId)}`;
  const visitor = await expectStatus(fetchImpl, baseUrl, productPath, {}, 401, "bloqueio de visitante");
  assert(visitor?.product == null, "Visitante recebeu produto autenticado.");
  assertNoOwnerValue(visitor);
  const inactiveSession = await expectOk(fetchImpl, baseUrl, "/api/session", { token: inactiveToken }, "sessão do perfil inativo");
  assert(inactiveSession.active === false, "A sessão reservada ao perfil inativo aparece ativa.");
  await expectStatus(fetchImpl, baseUrl, productPath, { token: inactiveToken }, 401, "bloqueio do perfil inativo");

  const [captorSession, nonCaptorSession, managerSession] = await Promise.all([
    expectOk(fetchImpl, baseUrl, "/api/session", { token: captorToken }, "sessão do captador"),
    expectOk(fetchImpl, baseUrl, "/api/session", { token: nonCaptorToken }, "sessão do não captador"),
    expectOk(fetchImpl, baseUrl, "/api/session", { token: managerToken }, "sessão da gestão"),
  ]);
  assert(captorSession.active === true && captorSession.role === "corretor" && captorSession.brokerId != null, "Captador sintético inválido.");
  assert(nonCaptorSession.active === true && nonCaptorSession.role === "corretor" && nonCaptorSession.brokerId != null, "Não captador sintético inválido.");
  assert(captorSession.brokerId !== nonCaptorSession.brokerId, "Captador e não captador precisam ser corretores diferentes.");
  assert(managerSession.active === true && MANAGER_ROLES.has(managerSession.role), "Gestor sintético inválido.");
  await verifyPrivateStorage(fetchImpl, config, { captor: captorSession, nonCaptor: nonCaptorSession }, { captor: captorToken, nonCaptor: nonCaptorToken }, productId, marker);

  const readProduct = (token, operation) => expectOk(fetchImpl, baseUrl, productPath, { token }, operation);
  let [captorBody, nonCaptorBody, managerBody] = await Promise.all([
    readProduct(captorToken, "produto do captador"),
    readProduct(nonCaptorToken, "produto do não captador"),
    readProduct(managerToken, "produto da gestão"),
  ]);
  const captorUnit = unitFrom(captorBody, unitId);
  const nonCaptorUnit = unitFrom(nonCaptorBody, unitId);
  const managerUnit = unitFrom(managerBody, unitId);
  assert(captorUnit && nonCaptorUnit && managerUnit, "A unidade sintética não apareceu para os três perfis.");
  assert(captorUnit.mine === true && captorUnit.pode_editar === true, "Captador não recebeu a própria unidade editável.");
  assert(ownerVisible(captorUnit, captorBody.product), "Captador não recebeu o proprietário permitido.");
  assert(nonCaptorUnit.mine === false && nonCaptorUnit.pode_editar === false, "Não captador recebeu posse ou edição indevida.");
  assert(nonCaptorUnit.pode_ver_proprietario === false, "Não captador recebeu autorização de proprietário.");
  assertNoOwnerValue(nonCaptorBody);
  assert(ownerVisible(managerUnit, managerBody.product), "Gestão não recebeu o proprietário permitido.");

  const fixtureIdentity = [captorBody.product?.nome, captorBody.product?.titulo, captorBody.product?.codigo, captorUnit.titulo_comercial]
    .filter((value) => typeof value === "string");
  assert(fixtureIdentity.some((value) => value.includes(marker)), "O produto ou a unidade não contém o marcador sintético antes da escrita.");
  assert(typeof captorUnit.proprietario_contato === "string" && captorUnit.proprietario_contato.endsWith(".invalid"), "O contato do proprietário não pertence ao domínio sintético .invalid.");
  assert(captorUnit.aprovacao === "pendente" && captorUnit.publicado === false, "A fixture precisa estar pendente e fora do ar antes da escrita.");

  const unitMedia = (Array.isArray(captorBody.product?.midias) ? captorBody.product.midias : []).filter((item) => item?.unidade_id === unitId);
  assert(unitMedia.length === mediaIds.length && mediaIds.every((id) => unitMedia.some((item) => item.id === id)), "A lista precisa conter todas e somente as mídias da unidade sintética.");
  for (const mediaId of mediaIds) {
    assert(mediaFrom(nonCaptorBody, mediaId) && mediaFrom(managerBody, mediaId), "A galeria operacional não ficou visível aos três perfis.");
    const media = mediaFrom(captorBody, mediaId);
    assert(typeof media?.url === "string" && /\/storage\/v1\/object\/sign\/empreendimentos\//.test(media.url), "Mídia interna não recebeu URL assinada.");
    assert(!/\/storage\/v1\/object\/public\/empreendimentos\//.test(media.url) && !("storage_path" in media), "Mídia interna expôs URL pública ou path físico.");
  }

  const [captorDraftBefore, managerDraftBefore] = await Promise.all([
    expectOk(fetchImpl, baseUrl, "/api/capture", { token: captorToken }, "preflight do rascunho do captador"),
    expectOk(fetchImpl, baseUrl, "/api/capture", { token: managerToken }, "preflight do rascunho da gestão"),
  ]);
  assert(!captorDraftBefore?.draft?.versao && !captorDraftBefore?.draft?.payload, "O captador sintético já possui rascunho; cleanup prévio é obrigatório.");
  assert(!managerDraftBefore?.draft?.versao && !managerDraftBefore?.draft?.payload, "A gestão sintética já possui rascunho; cleanup prévio é obrigatório.");

  const originalUnit = unitPayload(captorUnit, captorUnit.titulo_comercial);
  const originalMedia = mediaIds.map((id) => ({
    id,
    category: mediaFrom(captorBody, id)?.categoria,
    altText: mediaFrom(captorBody, id)?.alt_text,
    isCover: mediaFrom(captorBody, id)?.is_capa === true,
    order: mediaFrom(captorBody, id)?.ordem,
  }));
  assert(originalMedia.every((item) => typeof item.category === "string" && item.category.trim()
    && typeof item.altText === "string" && item.altText.trim().length >= 3 && item.altText.trim().length <= 220
    && typeof item.order === "number"), "A fixture precisa ter categoria, alt text e ordem originais restauráveis.");
  const originalOrder = [...originalMedia].sort((left, right) => left.order - right.order).map((item) => item.id);
  assert(originalMedia.filter((item) => item.isCover).length === 1, "A fixture precisa ter exatamente uma capa restaurável.");
  assert(originalMedia.map((item) => item.order).sort((a, b) => a - b).every((order, index) => order === index), "A fixture precisa começar com ordem contígua a partir de 0.");

  let smokeError = null;
  try {
    const nonCaptorUnitBody = { action: "updateUnit", id: productId, unidadeId: unitId, unidade: unitPayload(captorUnit, `${marker}_DENIED`) };
    await expectStatus(fetchImpl, baseUrl, "/api/product", { token: nonCaptorToken, method: "PATCH", body: nonCaptorUnitBody }, 403, "edição negada ao não captador");
    await expectStatus(fetchImpl, baseUrl, "/api/product", {
      token: nonCaptorToken, method: "PATCH", body: { action: "setUnitAvailability", id: productId, unidadeId: unitId, disponivel: false },
    }, 403, "disponibilidade negada ao não captador");
    await expectOk(fetchImpl, baseUrl, "/api/product", {
      token: captorToken, method: "PATCH", body: { action: "setUnitAvailability", id: productId, unidadeId: unitId, disponivel: false },
    }, "inativação canônica pelo captador");
    await expectOk(fetchImpl, baseUrl, "/api/product", {
      token: captorToken, method: "PATCH", body: { action: "setUnitAvailability", id: productId, unidadeId: unitId, disponivel: originalUnit.disponivel },
    }, "restauração canônica de disponibilidade");

    await expectOk(fetchImpl, baseUrl, "/api/product", {
      token: captorToken, method: "PATCH", body: { action: "updateUnit", id: productId, unidadeId: unitId, unidade: unitPayload(captorUnit, `${marker}_CAPTOR`) },
    }, "edição da unidade pelo captador");
    captorBody = await readProduct(captorToken, "persistência da edição do captador");
    assert(unitFrom(captorBody, unitId)?.titulo_comercial === `${marker}_CAPTOR`, "Edição do captador não persistiu.");

    await expectOk(fetchImpl, baseUrl, "/api/product", {
      token: managerToken, method: "PATCH", body: { action: "updateUnit", id: productId, unidadeId: unitId, unidade: unitPayload(unitFrom(captorBody, unitId), `${marker}_MANAGER`) },
    }, "edição da unidade pela gestão");
    managerBody = await readProduct(managerToken, "persistência da edição da gestão");
    assert(unitFrom(managerBody, unitId)?.titulo_comercial === `${marker}_MANAGER`, "Edição da gestão não persistiu.");

    const mediaId = mediaIds[0];
    await expectStatus(fetchImpl, baseUrl, "/api/product", {
      token: nonCaptorToken, method: "PATCH", body: { action: "updateMedia", id: productId, mediaId, category: "fixture-negada", altText: "Fixture negada" },
    }, 403, "edição de mídia negada ao não captador");
    await expectOk(fetchImpl, baseUrl, "/api/product", {
      token: captorToken, method: "PATCH", body: { action: "updateMedia", id: productId, mediaId, category: "fixture-captador", altText: `${marker} captador` },
    }, "edição de mídia pelo captador");
    captorBody = await readProduct(captorToken, "persistência da mídia do captador");
    assert(mediaFrom(captorBody, mediaId)?.categoria === "fixture-captador", "Categoria da mídia do captador não persistiu.");
    await expectOk(fetchImpl, baseUrl, "/api/product", {
      token: managerToken, method: "PATCH", body: { action: "updateMedia", id: productId, mediaId, category: "fixture-gestao", altText: `${marker} gestão` },
    }, "edição de mídia pela gestão");
    await expectOk(fetchImpl, baseUrl, "/api/product", {
      token: captorToken, method: "PATCH", body: { action: "setCover", id: productId, mediaId: mediaIds[1] },
    }, "troca de capa pelo captador");
    await expectOk(fetchImpl, baseUrl, "/api/product", {
      token: managerToken, method: "PATCH", body: { action: "reorderMedia", id: productId, mediaId: mediaIds[1], mediaIds: [...mediaIds].reverse() },
    }, "reordenação de mídia pela gestão");
    managerBody = await readProduct(managerToken, "persistência de capa e ordem");
    assert(mediaFrom(managerBody, mediaIds[1])?.is_capa === true, "Troca de capa não persistiu.");
    assert(mediaIds.every((id, index) => mediaFrom(managerBody, id)?.ordem === mediaIds.length - 1 - index), "Reordenação não persistiu.");

    const draft1 = await expectOk(fetchImpl, baseUrl, "/api/capture", {
      token: captorToken, method: "POST", body: { action: "saveDraft", payload: { runMarker: marker, value: 1 }, step: 1, expectedVersion: null },
    }, "primeira versão do rascunho");
    const version1 = draftVersion(draft1);
    assert(version1 != null, "Primeira versão do rascunho não foi confirmada.");
    const draft2 = await expectOk(fetchImpl, baseUrl, "/api/capture", {
      token: captorToken, method: "POST", body: { action: "saveDraft", payload: { runMarker: marker, value: 2 }, step: 2, expectedVersion: version1 },
    }, "segunda versão do rascunho");
    const version2 = draftVersion(draft2);
    assert(version2 != null && version2 > version1, "Segunda versão do rascunho não avançou.");
    await expectStatus(fetchImpl, baseUrl, "/api/capture", {
      token: captorToken, method: "POST", body: { action: "saveDraft", payload: { runMarker: marker, value: 3 }, step: 3, expectedVersion: version1 },
    }, 409, "conflito otimista do rascunho");
    const persistedDraft = await expectOk(fetchImpl, baseUrl, "/api/capture", { token: captorToken }, "persistência do rascunho");
    assert(persistedDraft?.draft?.versao === version2 && persistedDraft?.draft?.payload?.value === 2, "Rascunho versionado não persistiu corretamente.");
    const nonCaptorDraft = await expectOk(fetchImpl, baseUrl, "/api/capture", { token: nonCaptorToken }, "privacidade do rascunho do captador");
    assert(nonCaptorDraft?.draft?.payload?.runMarker !== marker && nonCaptorDraft?.draft?.payload?.value !== 2, "Não captador recebeu rascunho privado do captador.");
  } catch (error) {
    smokeError = error;
  }

  const cleanupFailures = [];
  const cleanupStep = async (label, operation) => {
    try { await operation(); } catch { cleanupFailures.push(label); }
  };
  await cleanupStep("rascunho", () => expectOk(fetchImpl, baseUrl, "/api/capture", { token: captorToken, method: "POST", body: { action: "deleteDraft" } }, "limpeza do rascunho"));
  await cleanupStep("unidade", () => expectOk(fetchImpl, baseUrl, "/api/product", {
    token: managerToken, method: "PATCH", body: { action: "updateUnit", id: productId, unidadeId: unitId, unidade: originalUnit },
  }, "restauração da unidade sintética"));
  for (const media of originalMedia) {
    await cleanupStep(`mídia ${originalMedia.indexOf(media) + 1}`, () => expectOk(fetchImpl, baseUrl, "/api/product", {
      token: managerToken,
      method: "PATCH",
      body: { action: "updateMedia", id: productId, mediaId: media.id, category: media.category, altText: media.altText },
    }, "restauração da mídia sintética"));
  }
  const originalCover = originalMedia.find((item) => item.isCover).id;
  await cleanupStep("capa", () => expectOk(fetchImpl, baseUrl, "/api/product", {
    token: managerToken, method: "PATCH", body: { action: "setCover", id: productId, mediaId: originalCover },
  }, "restauração da capa sintética"));
  await cleanupStep("ordem", () => expectOk(fetchImpl, baseUrl, "/api/product", {
    token: managerToken, method: "PATCH", body: { action: "reorderMedia", id: productId, mediaId: originalOrder[0], mediaIds: originalOrder },
  }, "restauração da ordem sintética"));

  if (cleanupFailures.length) throw new Error(`Cleanup incompleto nas etapas: ${cleanupFailures.join(", ")}.`);

  const [deletedDraft, restoredBody] = await Promise.all([
    expectOk(fetchImpl, baseUrl, "/api/capture", { token: captorToken }, "confirmação da limpeza do rascunho"),
    readProduct(managerToken, "confirmação da restauração da fixture"),
  ]);
  assert(!deletedDraft?.draft?.payload && !deletedDraft?.draft?.versao, "Rascunho sintético não foi removido.");
  const restoredUnit = unitFrom(restoredBody, unitId);
  assert(restoredUnit?.titulo_comercial === originalUnit.titulo_comercial, "Título original da fixture não foi restaurado.");
  assert(restoredUnit?.aprovacao === "pendente" && restoredUnit?.publicado === false, "Estado editorial original da fixture não foi preservado.");
  for (const media of originalMedia) {
    const restoredMedia = mediaFrom(restoredBody, media.id);
    assert(restoredMedia?.categoria === media.category && restoredMedia?.alt_text === media.altText, "Metadados originais da mídia não foram restaurados.");
    assert(restoredMedia?.is_capa === media.isCover, "Capa original da fixture não foi restaurada.");
    assert(restoredMedia?.ordem === media.order, "Ordem original da fixture não foi restaurada.");
  }
  if (smokeError) throw smokeError;

  const checks = {
    productionBlocked: true,
    visitorDenied: true,
    threeSyntheticProfiles: true,
    inactiveProfileDenied: true,
    ownerPermissionMatrix: true,
    nonCaptorEditDenied: true,
    captorAndManagerEdit: true,
    mediaPermissionAndPersistence: true,
    privateSignedMedia: true,
    canonicalAvailability: true,
    privateStorageMatrix: true,
    draftPrivateAndVersioned: true,
    draftConflict409: true,
    draftCleaned: true,
    fixtureValuesRestored: true,
  };
  log(JSON.stringify({ event: "products_isolated_smoke", ok: true, checks: Object.keys(checks).length }));
  return { ok: true, checks };
}

function configFromEnvironment(env) {
  return {
    baseUrl: env.APECERTO_ERP_BASE_URL,
    approvedIsolatedOrigin: env.APECERTO_ISOLATED_APPROVED_ORIGIN,
    isolationProof: env.APECERTO_ISOLATION_PROOF,
    expectedProjectRefHash: env.APECERTO_ISOLATED_PROJECT_REF_SHA256,
    productionProjectRefHash: env.APECERTO_PRODUCTION_PROJECT_REF_SHA256,
    proofSecret: env.APECERTO_ISOLATED_SMOKE_PROOF_SECRET,
    supabaseUrl: env.APECERTO_ISOLATED_SUPABASE_URL,
    publishableKey: env.APECERTO_ISOLATED_SUPABASE_PUBLISHABLE_KEY,
    foreignLinkedMediaPath: env.APECERTO_SMOKE_FOREIGN_LINKED_MEDIA_PATH,
    confirmSynthetic: env.APECERTO_SMOKE_CONFIRM_SYNTHETIC === "true",
    captorToken: env.APECERTO_CAPTOR_ACCESS_TOKEN,
    nonCaptorToken: env.APECERTO_NON_CAPTOR_ACCESS_TOKEN,
    managerToken: env.APECERTO_MANAGER_ACCESS_TOKEN,
    inactiveToken: env.APECERTO_INACTIVE_ACCESS_TOKEN,
    productId: env.APECERTO_SMOKE_PRODUCT_ID,
    unitId: env.APECERTO_SMOKE_UNIT_ID,
    mediaIds: (env.APECERTO_SMOKE_MEDIA_IDS || "").split(",").map((value) => value.trim()).filter(Boolean),
    runMarker: env.APECERTO_SMOKE_RUN_MARKER,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductsIsolatedSmoke(configFromEnvironment(process.env), { log: console.log }).catch((error) => {
    console.error(JSON.stringify({ event: "products_isolated_smoke", ok: false, error: error instanceof Error ? error.message : "Falha desconhecida." }));
    process.exitCode = 1;
  });
}
